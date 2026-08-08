#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
// Veri hattı — kaynaklardan Miami metro serilerini çeker, anlık görüntü yazar
//
// Bu script sitenin TEK gerçek kaynağıdır. Ürettiği JSON'da olmayan bir sayı
// sitede görünemez.
//
// SERT KURAL: bir kaynak çekilemezse o metrik anlık görüntüye GİRMEZ ve
// `warnings` dizisine düşer. Tahmini/placeholder/son bilinen değer YAZILMAZ.
// Sayfa eksik metriği çizmez; metodoloji sayfası da eksiği görünür kılar.
// "Veri yoksa boşluk" bu projede bir hata değil, doğru davranıştır.
//
// Kullanım:
//   node scripts/fetch-data.mjs                 # tam çekim
//   node scripts/fetch-data.mjs --dry-run       # dosya yazmaz
//   node scripts/fetch-data.mjs --skip-redfin   # 111 MB'lık indirmeyi atlar
//   node scripts/fetch-data.mjs --period 2026-08
// ─────────────────────────────────────────────────────────────────────────

import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { hasFlag, readPeriodOrExit } from './lib/args.mjs';
import { parseDelimited, parseDelimitedLine, toNumber } from './lib/csv.mjs';
import { buildMetric, tailSeries, change, round } from './lib/compute.mjs';
import {
  METRICS,
  DERIVED,
  PUBLISHERS,
  REDFIN_FILE,
  REDFIN_REGION,
  ZILLOW_REGION_ID,
  GEOGRAPHY,
} from './lib/sources.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'src/content/index');
const CACHE_DIR = path.join(ROOT, '.cache');

const args = process.argv.slice(2);
const DRY_RUN = hasFlag(args, 'dry-run');
const SKIP_REDFIN = hasFlag(args, 'skip-redfin');
const NO_CACHE = hasFlag(args, 'no-cache');
const periodArg = readPeriodOrExit(args);

/** Çekim zamanı UTC — "ne zaman çekildi" sorusunun cevabı evrensel olmalı. */
const FETCHED_AT = new Date().toISOString();
const FETCH_DATE = FETCHED_AT.slice(0, 10);
const PERIOD = periodArg ?? FETCH_DATE.slice(0, 7);

const warnings = [];

function log(...a) {
  console.log(...a);
}

// ── İndirme ───────────────────────────────────────────────────────────────

/**
 * Yeniden denemeli metin indirme. Ağ hatası geçici olabilir; ilk hatada
 * pes etmek, aylık bir hattı tek bir TCP sıfırlaması yüzünden boş
 * bırakırdı.
 */
async function fetchText(url, { retries = 3 } = {}) {
  const cacheFile = path.join(CACHE_DIR, encodeURIComponent(url).slice(-180));
  if (!NO_CACHE && existsSync(cacheFile)) {
    log(`  · önbellek: ${path.basename(url)}`);
    return readFileSync(cacheFile, 'utf8');
  }

  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'miamiendeksi/1.0 (+https://miamiendeksi.com)' },
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (!NO_CACHE) {
        mkdirSync(CACHE_DIR, { recursive: true });
        writeFileSync(cacheFile, text);
      }
      return text;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        const wait = attempt * 2000;
        log(`  ! ${path.basename(url)} denemesi ${attempt} başarısız (${err.message}), ${wait}ms sonra tekrar`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw lastErr;
}

// ── Zillow: geniş CSV (satır = bölge, sütun = ay) ─────────────────────────

/**
 * Miami satırını RegionID ile bulur.
 *
 * NEDEN RegionID, isim değil: Zillow bölge etiketlerini zaman zaman
 * yeniden adlandırıyor ("Miami-Fort Lauderdale, FL" → "Miami, FL").
 * Sayısal kimlik sabit kalıyor; isme bağlanan bir hat, adlandırma
 * değiştiği ay sessizce boşalırdı.
 */
function extractZillowSeries(csvText) {
  const { header, rows } = parseDelimited(csvText, ',');

  const idIdx = header.indexOf('RegionID');
  if (idIdx === -1) throw new Error('RegionID sütunu yok — dosya biçimi değişmiş olabilir');

  // Tarih sütunları: YYYY-MM-DD biçimindeki başlıklar.
  const dateCols = [];
  header.forEach((h, i) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(h)) dateCols.push({ date: h, i });
  });
  if (dateCols.length === 0) throw new Error('Tarih sütunu bulunamadı');

  const row = rows.find((r) => (r[idIdx] ?? '').replace(/"/g, '').trim() === ZILLOW_REGION_ID);
  if (!row) throw new Error(`RegionID ${ZILLOW_REGION_ID} (Miami) satırı yok`);

  return dateCols
    .map(({ date, i }) => ({ date, value: toNumber(row[i]) }))
    .filter((p) => p.value !== null);
}

// ── FRED: uzun CSV ────────────────────────────────────────────────────────

function extractFredSeries(csvText) {
  const { header, rows } = parseDelimited(csvText, ',');
  if (header.length < 2) throw new Error('FRED CSV beklenen iki sütunu taşımıyor');
  return rows
    .map((r) => ({ date: (r[0] ?? '').trim(), value: toNumber(r[1]) }))
    .filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date) && p.value !== null);
}

// ── Redfin: 111 MB gzip TSV, AKIŞ ile ─────────────────────────────────────

/**
 * Redfin dosyası sıkıştırılmış 111 MB; açılmış hâli gigabaytlarca.
 * Belleğe ALINMAZ — gunzip akışı satır satır okunur ve yalnızca Miami
 * metro satırları tutulur (birkaç bin satır).
 *
 * @returns {Map<string, {date: string, value: number}[]>} `${propertyType}|${field}` → seri
 */
async function fetchRedfinSeries(fields) {
  // Süzülmüş Miami satırları önbelleğe yazılır: 111 MB'ı her denemede
  // yeniden indirmeden hattı geliştirebilmek için (süzülmüş hâli ~1 MB).
  const cacheFile = path.join(CACHE_DIR, 'redfin-miami.tsv');
  let lines;

  if (!NO_CACHE && existsSync(cacheFile)) {
    log('  · önbellek: redfin-miami.tsv');
    lines = readFileSync(cacheFile, 'utf8').split('\n').filter(Boolean);
  } else {
    const res = await fetch(REDFIN_FILE, {
      headers: { 'User-Agent': 'miamiendeksi/1.0 (+https://miamiendeksi.com)' },
      signal: AbortSignal.timeout(600_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const gunzip = createGunzip();
    Readable.fromWeb(res.body).pipe(gunzip);
    const rl = createInterface({ input: gunzip, crlfDelay: Infinity });

    lines = [];
    let first = true;
    for await (const line of rl) {
      // Başlık + yalnızca Miami metro satırları tutulur; gerisi atılır.
      // Açılmış dosya gigabaytlarca — belleğe ALINMAZ.
      if (first) {
        lines.push(line);
        first = false;
        continue;
      }
      if (line.includes(REDFIN_REGION)) lines.push(line);
    }

    if (!NO_CACHE) {
      mkdirSync(CACHE_DIR, { recursive: true });
      writeFileSync(cacheFile, lines.join('\n'));
    }
  }

  if (lines.length < 2) throw new Error('Miami satırı bulunamadı');

  const header = parseDelimitedLine(lines[0], '\t').map((h) => h.replace(/"/g, '').trim());
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  for (const need of ['REGION', 'PROPERTY_TYPE', 'PERIOD_BEGIN', 'PERIOD_DURATION', 'IS_SEASONALLY_ADJUSTED']) {
    if (idx[need] === undefined) throw new Error(`Redfin sütunu eksik: ${need}`);
  }

  const out = new Map();
  for (const f of fields) out.set(`${f.propertyType}|${f.field}`, []);

  for (const line of lines.slice(1)) {
    const cols = parseDelimitedLine(line, '\t').map((c) => c.replace(/^"|"$/g, ''));
    if (cols[idx.REGION] !== REDFIN_REGION) continue;
    // Aylık kayıtlar (30 gün); Redfin ayrıca 90 günlük pencereler yayınlıyor.
    if (cols[idx.PERIOD_DURATION] !== '30') continue;

    // ZORUNLU SÜZGEÇ — Redfin her (dönem, mülk tipi) için İKİ satır yazar:
    // mevsimsel düzeltilmiş ve ham. İkisini birden toplamak, aynı tarihte
    // iki farklı değer üretir ve "son gözlem" dosya sırasına göre değişir
    // (çalıştırmadan çalıştırmaya farklı sayı yayınlanır). Ham seri
    // seçildi: Redfin'in manşet rakamı budur ve tam sayı verir — düzeltilmiş
    // seri "700,83 konut satıldı" gibi anlamsız kesirler üretiyordu.
    // Mevsimselliğin MoM okumasına etkisi metodoloji sayfasında yazılı.
    // Sütun 'false'/'true' yazar ('f'/'t' DEĞİL — dosyadan doğrulandı).
    if (cols[idx.IS_SEASONALLY_ADJUSTED] !== 'false') continue;

    const pType = cols[idx.PROPERTY_TYPE];
    const date = cols[idx.PERIOD_BEGIN];

    for (const f of fields) {
      if (f.propertyType !== pType) continue;
      const col = idx[f.field];
      if (col === undefined) continue;
      const value = toNumber(cols[col]);
      if (value === null) continue;
      out.get(`${f.propertyType}|${f.field}`).push({ date, value });
    }
  }

  return out;
}

// ── Ana akış ──────────────────────────────────────────────────────────────

async function main() {
  log(`\n▸ miamiendeksi veri hattı — dönem ${PERIOD}, çekim ${FETCH_DATE}`);
  log(`  coğrafya: ${GEOGRAPHY}\n`);

  const metrics = [];
  const series = [];
  const usedPublishers = new Set();

  // ── Zillow + FRED (her metrik kendi dosyasını çeker) ────────────────────
  for (const def of METRICS.filter((m) => m.kind !== 'redfin')) {
    const url =
      def.kind === 'fred'
        ? `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${def.seriesId}`
        : def.file;

    try {
      log(`▸ ${def.id}`);
      const text = await fetchText(url);
      let points =
        def.kind === 'fred' ? extractFredSeries(text) : extractZillowSeries(text);

      if (points.length === 0) throw new Error('seri boş döndü');

      // Birim ölçeği (ör. Zillow'un 0-1 aralığındaki oranı yüzdeye).
      // Metrik KURULMADAN önce uygulanmak zorunda: sonrasında yalnızca
      // gösterilen değer düzelir, yüzde puan farkları yanlış kalır.
      if (def.scale && def.scale !== 1) {
        points = points.map((p) => ({ date: p.date, value: p.value * def.scale }));
      }

      const metric = buildMetric(def, points);
      if (!metric) throw new Error('geçerli gözlem yok');

      metric.sourceUrl = url;
      metric.fetchedAt = FETCH_DATE;
      metrics.push(metric);
      usedPublishers.add(def.publisher);

      series.push({
        id: def.id,
        label: def.label,
        unit: def.unit,
        points: tailSeries(points, def.kind === 'fred' && def.seriesId === 'MORTGAGE30US' ? 160 : 61),
      });

      log(`  ✓ ${metric.value} @ ${metric.asOf} (${points.length} gözlem)`);
    } catch (err) {
      warnings.push({ metric: def.id, source: def.publisher, reason: err.message });
      log(`  ✗ ATLANDI: ${err.message}`);
    }
  }

  // ── Redfin (tek akış, çok metrik) ──────────────────────────────────────
  const redfinDefs = METRICS.filter((m) => m.kind === 'redfin');
  if (redfinDefs.length > 0 && !SKIP_REDFIN) {
    try {
      log(`\n▸ Redfin (${redfinDefs.length} metrik, tek akışta ~111 MB)`);
      const table = await fetchRedfinSeries(redfinDefs);

      for (const def of redfinDefs) {
        const points = table.get(`${def.propertyType}|${def.field}`) ?? [];
        if (points.length === 0) {
          warnings.push({ metric: def.id, source: 'redfin', reason: 'seri boş' });
          log(`  ✗ ${def.id}: seri boş`);
          continue;
        }
        const metric = buildMetric(def, points);
        if (!metric) {
          warnings.push({ metric: def.id, source: 'redfin', reason: 'geçerli gözlem yok' });
          continue;
        }
        metric.sourceUrl = REDFIN_FILE;
        metric.fetchedAt = FETCH_DATE;
        metrics.push(metric);
        usedPublishers.add('redfin');
        series.push({ id: def.id, label: def.label, unit: def.unit, points: tailSeries(points, 61) });
        log(`  ✓ ${def.id}: ${metric.value} @ ${metric.asOf}`);
      }
    } catch (err) {
      for (const def of redfinDefs) {
        warnings.push({ metric: def.id, source: 'redfin', reason: err.message });
      }
      log(`  ✗ Redfin tamamen atlandı: ${err.message}`);
    }
  } else if (SKIP_REDFIN) {
    for (const def of redfinDefs) {
      warnings.push({ metric: def.id, source: 'redfin', reason: '--skip-redfin ile atlandı' });
    }
    log('\n▸ Redfin atlandı (--skip-redfin)');
  }

  // ── Türetilmiş metrikler ───────────────────────────────────────────────
  const byId = Object.fromEntries(metrics.map((m) => [m.id, m]));
  const derived = [];

  for (const d of DERIVED) {
    const missing = d.inputs.filter((i) => !byId[i]);
    if (missing.length > 0) {
      warnings.push({ metric: d.id, source: 'türetilmiş', reason: `girdi eksik: ${missing.join(', ')}` });
      continue;
    }
    const value = d.compute(byId);
    if (value === null || !Number.isFinite(value)) {
      warnings.push({ metric: d.id, source: 'türetilmiş', reason: 'hesaplanamadı' });
      continue;
    }

    // Türetilmiş metriğin "geçerlilik tarihi" girdilerinin EN ESKİSİDİR —
    // en yenisi yazılırsa, sayı olduğundan güncel görünür.
    const asOf = d.inputs.map((i) => byId[i].asOf).sort()[0];

    derived.push({
      id: d.id,
      label: d.label,
      short: d.short,
      unit: d.unit,
      value: round(value, 2),
      asOf,
      mom: null,
      yoy: null,
      derived: true,
      formula: d.formula,
      inputs: d.inputs,
      note: d.note,
      fetchedAt: FETCH_DATE,
    });
    log(`▸ ${d.id} (türetilmiş) = ${round(value, 2)} @ ${asOf}`);
  }

  // ── Anlık görüntü ──────────────────────────────────────────────────────
  const snapshot = {
    period: PERIOD,
    builtAt: FETCHED_AT,
    fetchedAt: FETCH_DATE,
    geography: GEOGRAPHY,
    metrics,
    derived,
    series,
    publishers: [...usedPublishers].map((id) => PUBLISHERS[id]),
    warnings,
  };

  log(`\n▸ Özet: ${metrics.length} metrik + ${derived.length} türetilmiş, ${warnings.length} uyarı`);
  if (warnings.length > 0) {
    for (const w of warnings) log(`  ! ${w.metric}: ${w.reason}`);
  }

  if (DRY_RUN) {
    log('\n▸ --dry-run: dosya yazılmadı.');
    return;
  }

  if (metrics.length === 0) {
    console.error('\n✗ Hiçbir metrik çekilemedi — anlık görüntü YAZILMADI.');
    console.error('  Boş bir sayfa yayınlamaktansa eski veri yerinde kalsın.');
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, `${PERIOD}.json`);
  writeFileSync(outFile, `${JSON.stringify(snapshot, null, 2)}\n`);
  log(`\n✓ Yazıldı: ${path.relative(ROOT, outFile)}`);

  // Sayfaların okuduğu "en güncel" işaretçisi.
  writeFileSync(
    path.join(OUT_DIR, 'latest.json'),
    `${JSON.stringify({ period: PERIOD }, null, 2)}\n`,
  );
  log(`✓ Yazıldı: src/content/index/latest.json → ${PERIOD}`);
}

main().catch((err) => {
  console.error('\n✗ Hat çöktü:', err);
  process.exit(1);
});
