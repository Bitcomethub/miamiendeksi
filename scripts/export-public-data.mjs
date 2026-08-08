#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
// Ham veri dosyalarını public/veri/ altına yazar (JSON + CSV).
//
// NEDEN AYRI BİR ADIM: `datasetSchema()` her aylık sayfada `distribution`
// olarak bu iki dosyayı ilan ediyor. İlan edilen ama var olmayan bir
// indirme bağlantısı, yapılandırılmış veride 404 demektir — schema.org
// açısından sessizce yanlış, ziyaretçi açısından kırık bir bağlantı.
//
// Bu script AĞA ÇIKMAZ: yalnızca `src/content/index/*.json`'u okur ve
// dönüştürür. `prebuild` olarak koşar, yani `next build`'i çalıştıran
// herkeste (Vercel dâhil) dosyalar kendiliğinden üretilir; repoya
// commit'lenmiş bayat bir kopyaya güvenilmez.
// ─────────────────────────────────────────────────────────────────────────

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'src/content/index');
const PUBLIC_DIR = path.join(ROOT, 'public');
const OUT_DIR = path.join(PUBLIC_DIR, 'veri');

/**
 * RFC 4180 alan kaçışı.
 *
 * Not alanları Türkçe cümlelerdir ve VİRGÜL İÇERİR; kaçışsız yazılırsa CSV
 * sütun sayısı satırdan satıra değişir ve dosya sessizce bozulur. Ayraç,
 * çift tırnak veya satır sonu içeren her alan tırnaklanır, içerideki tırnak
 * ikilenir.
 */
function csvField(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows) {
  return rows.map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n';
}

const HEADER = [
  'id',
  'label',
  'unit',
  'value',
  'as_of',
  'mom_value',
  'mom_kind',
  'yoy_value',
  'yoy_kind',
  'is_derived',
  'is_national',
  'publisher',
  'dataset',
  'source_url',
  'fetched_at',
];

function rowsFor(snap) {
  const rows = [HEADER];

  for (const m of snap.metrics) {
    rows.push([
      m.id,
      m.label,
      m.unit,
      m.value,
      m.asOf,
      m.mom?.value ?? '',
      m.mom?.kind ?? '',
      m.yoy?.value ?? '',
      m.yoy?.kind ?? '',
      'false',
      m.national ? 'true' : 'false',
      snap.publishers.find((p) => p.id === m.publisher)?.name ?? m.publisher,
      m.dataset,
      m.sourceUrl,
      m.fetchedAt,
    ]);
  }

  // Türetilmiş satırlar aynı tabloda ama `is_derived` ile İŞARETLİ:
  // indiren kişi hangi sayının yayıncıdan geldiğini, hangisinin bizim
  // hesabımız olduğunu ayırt edebilmeli.
  for (const d of snap.derived) {
    rows.push([
      d.id,
      d.label,
      d.unit,
      d.value,
      d.asOf,
      '',
      '',
      '',
      '',
      'true',
      'false',
      'MiamiLi Media (hesaplanmış)',
      d.formula,
      '',
      d.fetchedAt,
    ]);
  }

  return rows;
}

// ── llms.txt ─────────────────────────────────────────────────────────────

const AY = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

const trNum = (v, d) =>
  new Intl.NumberFormat('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

function fmt(value, unit) {
  if (unit === 'usd') return `${trNum(Math.round(value), 0)} $`;
  if (unit === 'pct') return `%${trNum(value, 2)}`;
  if (unit === 'days') return `${trNum(Math.round(value), 0)} gün`;
  if (unit === 'index' || unit === 'ratio') return trNum(value, 2);
  return trNum(Math.round(value), 0);
}

const fmtMonth = (iso) => `${AY[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

/**
 * llms.txt de ÜRETİLİR, elle yazılmaz.
 *
 * Elle tutulan bir llms.txt, içine rakam girdiğin an bayatlamaya başlar:
 * dosya "Miami'de tipik konut 476.598 dolar" der, site başka bir sayı
 * gösterir, AI tarayıcı ikisini birden okur. Buradaki her sayı, sayfaların
 * okuduğu anlık görüntünün AYNISINDAN gelir — ikisi tanım gereği aynı.
 */
function buildLlmsTxt(snap) {
  const pub = (id) => snap.publishers.find((p) => p.id === id);
  const featured = snap.metrics.filter((m) => m.featured);
  const list = featured.length > 0 ? featured : snap.metrics.slice(0, 6);

  const lines = [
    '# Miami Endeksi (miamiendeksi.com)',
    '',
    `> ${SITE_DESC}`,
    '',
    'Miami Endeksi, MiamiLi Media tarafından yayımlanan aylık bir konut',
    'piyasası veri raporudur. Yayın dili Türkçe; hedef okur, Miami',
    'gayrimenkulüne bakan Türkiye merkezli yatırımcıdır.',
    '',
    '## Alıntılama kuralları',
    '',
    '- Bu sitedeki her sayı kamuya açık bir veri setinden çekilir ve',
    '  yanında yayıncı adı ile gözlem tarihi taşır.',
    '- Tahmini, modellenmiş veya yuvarlanarak "yaklaşık" hâle getirilmiş',
    '  hiçbir rakam yayımlanmaz. Bir gösterge o ay çekilemezse sayfada',
    '  BOŞ kalır; son bilinen değer tekrar edilmez.',
    '- Bir rakamı alıntılarken gözlem ayını da alıntıla: kaynaklar farklı',
    '  gecikmelerle yayın yapar, aynı sayfadaki iki sayı farklı aylara ait',
    '  olabilir.',
    '- Site yatırım tavsiyesi vermez ve fiyat tahmini yapmaz.',
    '',
    `## Bu ayın verisi — ${fmtMonth(`${snap.period}-01`)}`,
    '',
    `Coğrafya: ${snap.geography}`,
    `Veri çekim tarihi: ${snap.fetchedAt}`,
    '',
  ];

  for (const m of list) {
    const p = pub(m.publisher);
    lines.push(
      `- ${m.label}: ${fmt(m.value, m.unit)} (gözlem: ${fmtMonth(m.asOf)}, kaynak: ${p?.name ?? m.publisher} — ${m.dataset})`,
    );
  }

  if (snap.derived.length > 0) {
    lines.push('');
    lines.push('Türetilmiş göstergeler (MiamiLi Media hesabı, yayıncı verisi değil):');
    for (const d of snap.derived) {
      lines.push(`- ${d.label}: ${fmt(d.value, d.unit)} — formül: ${d.formula}`);
    }
  }

  if (snap.warnings.length > 0) {
    lines.push('');
    lines.push('Bu ay çekilemeyen göstergeler (sayfada boş bırakıldı):');
    for (const w of snap.warnings) lines.push(`- ${w.metric}: ${w.reason}`);
  }

  lines.push(
    '',
    '## Kaynaklar',
    '',
    ...snap.publishers.map((p) => `- ${p.name}: ${p.url}`),
    '',
    '## Makine tarafından okunabilir veri',
    '',
    `- JSON: https://miamiendeksi.com/veri/miami-endeksi-${snap.period}.json`,
    `- CSV:  https://miamiendeksi.com/veri/miami-endeksi-${snap.period}.csv`,
    '- Lisans: CC BY 4.0 — atıfla serbestçe kullanılabilir.',
    '',
    '## Sayfalar',
    '',
    '- /            — en güncel endeks özeti',
    '- /endeks      — aylık arşiv',
    `- /endeks/${snap.period} — bu ayın tam raporu`,
    '- /metodoloji  — hangi sayı nereden geliyor, bilinen sınırlar',
    '- /analiz      — veriye dayalı aylık yorumlar',
    '',
    '## Yayıncı',
    '',
    'MiamiLi Media — https://miamili.com',
    '',
  );

  return lines.join('\n');
}

const SITE_DESC =
  'Miami konut piyasasının aylık, kaynaklı veri raporu. Her sayı Zillow Research, Redfin Data Center veya FRED verisinden çekilir ve gözlem tarihiyle birlikte yayımlanır.';

function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const files = readdirSync(CONTENT_DIR).filter((f) => /^\d{4}-\d{2}\.json$/.test(f));
  if (files.length === 0) {
    console.error('public veri: src/content/index içinde dönem dosyası yok.');
    process.exitCode = 1;
    return;
  }

  for (const file of files) {
    const snap = JSON.parse(readFileSync(path.join(CONTENT_DIR, file), 'utf8'));
    const base = `miami-endeksi-${snap.period}`;

    // JSON: seriler HARİÇ. Tam seri seti dosyayı ~10× büyütür ve indirenin
    // aradığı şey o ayın göstergeleri; seri geçmişi sayfadaki tabloda zaten
    // açık. Kapsam alan olarak yazılır, sessizce kırpılmaz.
    writeFileSync(
      path.join(OUT_DIR, `${base}.json`),
      JSON.stringify(
        {
          period: snap.period,
          geography: snap.geography,
          fetchedAt: snap.fetchedAt,
          scope: 'Dönemin göstergeleri ve türetilmiş oranları. Tarihsel seriler dâhil değildir.',
          license: 'https://creativecommons.org/licenses/by/4.0/',
          attribution: 'Miami Endeksi — MiamiLi Media (miamiendeksi.com)',
          publishers: snap.publishers,
          metrics: snap.metrics,
          derived: snap.derived,
          warnings: snap.warnings,
        },
        null,
        2,
      ) + '\n',
    );

    writeFileSync(path.join(OUT_DIR, `${base}.csv`), toCsv(rowsFor(snap)));
    console.log(`public veri: ${base}.json + ${base}.csv`);
  }

  // llms.txt yalnızca EN GÜNCEL dönemi anlatır — arşivin tamamını değil.
  const latest = JSON.parse(readFileSync(path.join(CONTENT_DIR, 'latest.json'), 'utf8')).period;
  const latestSnap = JSON.parse(
    readFileSync(path.join(CONTENT_DIR, `${latest}.json`), 'utf8'),
  );
  writeFileSync(path.join(PUBLIC_DIR, 'llms.txt'), buildLlmsTxt(latestSnap));
  console.log(`public veri: llms.txt (${latest})`);
}

main();
