#!/usr/bin/env node
/**
 * IndexNow ping — sitemap.xml'deki URL'leri Bing/Yandex'e bildirir.
 *
 * ── NEDEN VAR ──
 * Yeni yayımlanan bir sayfayı motorun kendi tarama takvimine bırakmak günler
 * alır. IndexNow bu bildirimi dakikalara indirir. Sitemap'i otomatik göndermek
 * ayrıca "sitemap'i gönderdim sanıp aslında hiçbir şey göndermemiş olma"
 * durumunu ortadan kaldırır.
 *
 * ── ANAHTAR NEREDEN OKUNUR ──
 * Gizli bir secret'tan DEĞİL, yayımlanan `public/<anahtar>.txt` dosyasından.
 * Sebep somut: IndexNow, `key` alanı ile `keyLocation`daki dosyanın içeriğinin
 * BİREBİR aynı olmasını şart koşuyor ve uymazsa 403 döner. Anahtarı ikinci bir
 * yerde (Actions secret'ı, sabit) tutmak, ikisinin ayrıştığı güne kadar sessizce
 * çalışan bir kurulum demek. Tek kaynak = tek doğru.
 *
 * ── HATA DEPLOY'U KIRMAZ ──
 * Çıkış kodu varsayılan olarak HER ZAMAN 0. Bu script bir yayın hattının son
 * adımı; Bing'in 429'u yüzünden günün makalesini yayımlamamak yanlış olurdu.
 * Gerçekten kırmızı istiyorsan `--strict`.
 *
 * Kullanım:
 *   node scripts/indexnow.mjs                  # sitemap'teki tüm URL'ler
 *   node scripts/indexnow.mjs <url> [<url>...]  # yalnız bu URL'ler
 *   node scripts/indexnow.mjs --dry-run         # POST atmadan payload'ı yaz
 *   node scripts/indexnow.mjs --wait-for-key    # anahtar dosyası yayına girene
 *                                               # kadar bekle, sonra ping at
 *   node scripts/indexnow.mjs --limit=50        # ilk 50 URL
 *   node scripts/indexnow.mjs --strict          # başarısızlıkta çıkış kodu 1
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// ── AYAR ──────────────────────────────────────────────────────────────────
// Bu satır dışında script tüm depolarda AYNIdır. Ortam değişkeniyle ezilebilir
// (önizleme alan adına karşı denemek için).
const SITE_ORIGIN = (process.env.INDEXNOW_SITE || 'https://miamiendeksi.com').replace(/\/+$/, '');

const ENDPOINT = 'https://api.indexnow.org/indexnow';
/** IndexNow anahtar dosyası sözleşmesi: public/<hex>.txt, içeriği = dosya adı. */
const KEY_FILE_RE = /^[a-f0-9]{8,128}\.txt$/i;
/** Protokol sınırı: tek istekte en fazla 10.000 URL. */
const MAX_URLS_PER_REQUEST = 10_000;
const FETCH_TIMEOUT_MS = 30_000;
const KEY_WAIT_TIMEOUT_MS = 420_000;
const KEY_WAIT_INTERVAL_MS = 15_000;

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Vetto gibi "tek depo, çok uygulama" kurulumlarında public/ kökte değil.
const PUBLIC_DIR_CANDIDATES = ['public', 'apps/api/public', 'apps/web/public'];

const argv = process.argv.slice(2);

function parseArgs(args) {
  const opts = {
    urls: [],
    dryRun: false,
    strict: false,
    quiet: false,
    waitForKey: false,
    waitTimeoutMs: KEY_WAIT_TIMEOUT_MS,
    limit: 0,
    sitemap: null,
    publicDir: null,
  };

  for (const arg of args) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--strict') opts.strict = true;
    else if (arg === '--quiet') opts.quiet = true;
    else if (arg === '--wait-for-key') opts.waitForKey = true;
    else if (arg.startsWith('--wait-for-key=')) {
      opts.waitForKey = true;
      opts.waitTimeoutMs = Number(arg.slice('--wait-for-key='.length)) * 1000 || KEY_WAIT_TIMEOUT_MS;
    } else if (arg.startsWith('--limit=')) opts.limit = Number(arg.slice('--limit='.length)) || 0;
    else if (arg.startsWith('--sitemap=')) opts.sitemap = arg.slice('--sitemap='.length);
    else if (arg.startsWith('--public=')) opts.publicDir = arg.slice('--public='.length);
    else if (/^https?:\/\//i.test(arg)) opts.urls.push(arg);
    // Bilinmeyen bayraklar sessizce yok sayılır: bu script bir yayın hattının
    // sonunda koşuyor, tanımadığı bir bayrak yüzden patlamamalı.
  }
  return opts;
}

const log = (msg) => process.stdout.write(`${msg}\n`);
const warn = (msg) => process.stderr.write(`${msg}\n`);

/** public/ dizinini bul — depo düzenine göre değişiyor. */
function findPublicDir(explicit) {
  const candidates = explicit ? [explicit] : PUBLIC_DIR_CANDIDATES;
  for (const rel of candidates) {
    const dir = path.join(REPO_ROOT, rel);
    if (existsSync(dir)) return dir;
  }
  return null;
}

/**
 * Yayımlanmış IndexNow anahtarını bul.
 * Hem dosya adı hem içerik desenle uyuşmalı — rastgele bir .txt'i anahtar
 * sanmak, ping'i 403'e gönderip "çalışıyor" gibi göstermekten iyidir.
 */
function findKey(publicDir) {
  if (process.env.INDEXNOW_KEY) {
    return { key: process.env.INDEXNOW_KEY.trim(), source: 'env:INDEXNOW_KEY' };
  }
  if (!publicDir || !existsSync(publicDir)) return null;

  for (const name of readdirSync(publicDir)) {
    if (!KEY_FILE_RE.test(name)) continue;
    const key = name.replace(/\.txt$/i, '');
    let content;
    try {
      content = readFileSync(path.join(publicDir, name), 'utf8').trim();
    } catch {
      continue;
    }
    if (content === key) {
      return { key, source: path.join(path.relative(REPO_ROOT, publicDir), name) };
    }
  }
  return null;
}

async function get(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': `indexnow-worker (+${SITE_ORIGIN})` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: 'follow',
  });
  return res;
}

/**
 * Sitemap'ten <loc> değerlerini çıkarır.
 * Sitemap INDEX'i (içinde <sitemap> barındıran) de gelirse bir seviye iner —
 * yoksa "sitemap okundu, 0 URL" diye sessizce boş ping atardık.
 */
async function sitemapUrls(sitemapUrl, depth = 0) {
  if (depth > 2) return [];
  const res = await get(sitemapUrl);
  if (!res.ok) throw new Error(`sitemap ${sitemapUrl} → HTTP ${res.status}`);
  const xml = await res.text();

  if (/<sitemapindex[\s>]/i.test(xml)) {
    const children = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
    const nested = await Promise.all(children.map((c) => sitemapUrls(c, depth + 1).catch(() => [])));
    return nested.flat();
  }

  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, '&'));
}

/**
 * Yerel olmayan URL'leri at. IndexNow tek istekte yalnızca `keyLocation` ile
 * AYNI host'a ait URL'leri kabul eder; karışık bir liste isteğin tamamını 422
 * ile düşürür — yani tek bir yabancı satır işi bozar.
 */
function sameHost(urls) {
  const host = new URL(SITE_ORIGIN).host;
  const kept = [];
  const dropped = [];
  for (const url of urls) {
    try {
      if (new URL(url).host === host) kept.push(url);
      else dropped.push(url);
    } catch {
      dropped.push(url);
    }
  }
  return { kept, dropped };
}

/** Anahtar dosyası canlıda mı? IndexNow doğrulamayı canlı URL üzerinden yapar. */
async function waitForKeyFile(keyLocation, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  const expected = keyLocation.split('/').pop().replace(/\.txt$/i, '');

  while (Date.now() < deadline) {
    try {
      const res = await get(`${keyLocation}?cb=${Date.now()}`);
      if (res.ok) {
        const body = (await res.text()).trim();
        if (body === expected) return true;
        warn(`  anahtar dosyası yayında ama içeriği beklenenden farklı (${keyLocation})`);
      }
    } catch {
      /* ağ hatası: yeniden dene */
    }
    await new Promise((r) => setTimeout(r, KEY_WAIT_INTERVAL_MS));
  }
  return false;
}

async function post(key, keyLocation, host, urlList) {
  const payload = { host, key, keyLocation, urlList };
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  return res;
}

/** IndexNow dönüş kodlarının anlamı — log'u okunur kılmak için. */
function explain(status) {
  switch (status) {
    case 200:
      return 'kabul edildi';
    case 202:
      return 'alındı, anahtar doğrulaması bekleniyor';
    case 400:
      return 'bozuk istek (payload biçimi)';
    case 403:
      return 'anahtar geçersiz — keyLocation canlıda mı / içeriği key ile aynı mı?';
    case 422:
      return 'URL\'ler keyLocation host\'uyla uyuşmuyor ya da anahtar eşleşmiyor';
    case 429:
      return 'çok fazla istek — sonra tekrar denenebilir';
    default:
      return 'beklenmeyen yanıt';
  }
}

async function main() {
  const opts = parseArgs(argv);
  const host = new URL(SITE_ORIGIN).host;

  let publicDir = opts.publicDir ? path.resolve(REPO_ROOT, opts.publicDir) : findPublicDir(null);
  const found = findKey(publicDir);
  if (!found) {
    warn(`IndexNow: public/ altında geçerli anahtar dosyası bulunamadı (${publicDir ?? 'public/ yok'}). Atlanıyor.`);
    return 1;
  }
  const { key } = found;
  const keyLocation = `${SITE_ORIGIN}/${key}.txt`;

  // ── URL listesi ──
  let urls = opts.urls;
  let source = 'argüman';
  if (urls.length === 0) {
    const sitemapUrl = opts.sitemap || `${SITE_ORIGIN}/sitemap.xml`;
    source = 'sitemap';
    try {
      urls = await sitemapUrls(sitemapUrl);
    } catch (err) {
      warn(`IndexNow: sitemap okunamadı (${err.message}). Atlanıyor.`);
      return 1;
    }
  }

  const { kept, dropped } = sameHost(urls);
  const unique = [...new Set(kept)];
  if (opts.limit > 0) unique.length = Math.min(unique.length, opts.limit);

  if (unique.length === 0) {
    warn('IndexNow: gönderilecek URL yok. Atlanıyor.');
    return 1;
  }

  log(`IndexNow → ${ENDPOINT}`);
  log(`  site        : ${SITE_ORIGIN}`);
  log(`  host        : ${host}`);
  log(`  key         : ${key}   (${found.source})`);
  log(`  keyLocation : ${keyLocation}`);
  log(`  urlList     : ${unique.length} URL (${source})`);
  if (dropped.length > 0) log(`  atlanan     : ${dropped.length} URL farklı host'ta`);

  if (opts.dryRun) {
    log('  --dry-run: POST atılmadı. İlk 5 URL:');
    for (const u of unique.slice(0, 5)) log(`    ${u}`);
    return 0;
  }

  // Deploy henüz bitmemişse anahtar dosyası 404'tür ve IndexNow 403 döner.
  // Sabit bir `sleep` yerine gerçek durumu beklemek, hem hızlı hem güvenilir.
  if (opts.waitForKey) {
    log(`  anahtar dosyasının yayına girmesi bekleniyor (en fazla ${opts.waitTimeoutMs / 1000}s)…`);
    const ready = await waitForKeyFile(keyLocation, opts.waitTimeoutMs);
    if (!ready) {
      warn(`IndexNow: ${keyLocation} zaman aşımında yayına girmedi. Ping atlanıyor.`);
      return 1;
    }
    log('  anahtar dosyası yayında.');
  }

  let failures = 0;
  for (let i = 0; i < unique.length; i += MAX_URLS_PER_REQUEST) {
    const chunk = unique.slice(i, i + MAX_URLS_PER_REQUEST);
    try {
      const res = await post(key, keyLocation, host, chunk);
      const ok = res.status === 200 || res.status === 202;
      if (!ok) failures += 1;
      log(`  HTTP ${res.status} ${explain(res.status)}  (${chunk.length} URL)`);
      if (!ok) {
        const body = await res.text().catch(() => '');
        if (body.trim()) log(`    yanıt: ${body.trim().slice(0, 300)}`);
      }
    } catch (err) {
      failures += 1;
      warn(`  istek başarısız: ${err.message}`);
    }
  }

  return failures > 0 ? 1 : 0;
}

main()
  .then((code) => {
    // Varsayılan: hata deploy'u KIRMAZ (yukarıdaki "HATA DEPLOY'U KIRMAZ" notu).
    process.exitCode = parseArgs(argv).strict ? code : 0;
  })
  .catch((err) => {
    warn(`IndexNow: beklenmeyen hata — ${err?.stack || err}`);
    process.exitCode = 0;
  });
