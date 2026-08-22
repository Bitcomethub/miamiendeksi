#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
// Palet kapısı — krem/bej/beyaz zemin koruması. İki aşamalı.
//
// AŞAMA 1 — KAYNAK TARAMASI (hızlı, tarayıcısız, ağsız, sunucusuz)
//   `src/` ağacındaki her renk sabiti OKLCH'te ÖLÇÜLÜR ve krem/bej/beyaz
//   ailesindeyse reddedilir. Ayrıca `bg-*` / `from-*` / `via-*` / `to-*`
//   yardımcılarının renk adı `@theme` jetonlarından biri olmak zorundadır —
//   bu tek kural `bg-white`, `bg-stone-100`, `bg-amber-50` gibi Tailwind
//   varsayılanlarının hepsini, hiçbir renk tablosu gömmeden kapatır.
//   Eşiklerin gerekçesi ve ölçülmüş sınır komşuları: `lib/palette.mjs`.
//
// AŞAMA 2 — GERÇEK RENDER (`--render`, gerçek Chrome, computed style)
//   Kaynak taraması NİYETİ okur, boyanan pikseli değil. Aşama 2 sayfayı
//   gerçekten açar ve her elemanın `getComputedStyle().backgroundColor`
//   değerini okur. Kaynakta göremeyeceğin üç arıza yalnız burada görünür:
//
//     · stil dosyası hiç yüklenmezse Chrome sayfayı BEYAZ boyar — kaynak
//       tertemizdir, ekran bembeyazdır;
//     · `background-image` gradyanının ara durağı açık olabilir;
//     · zemin, kaynakta hiç geçmeyen bir yerden (UA stil sayfası, üçüncü
//       taraf, çalışma zamanında kurulan sınıf) gelebilir.
//
//   Bu yüzden aşama YALNIZCA "krem bulamadım" demez; `body` zemininin
//   gerçekten gece rengi olduğunu da DOĞRULAR. Onu doğrulamayan bir kapı,
//   stil hiç yüklenmediğinde de yeşil yanar (boş sayfada krem yoktur).
//
// Kullanım:
//   npm run check:palette            (Aşama 1 — saniyenin altında)
//   npm run check:palette:render     (Aşama 1 + 2; sunucu açık olmalı)
//                                    CHECK_BASE ile başka köken verilebilir
// ─────────────────────────────────────────────────────────────────────────

import { spawn } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { hasFlag } from './lib/args.mjs';
import {
  readTheme,
  checkTheme,
  scanTree,
  parseColor,
  isForbiddenSurface,
  oklch,
  ALPHA_FLOOR,
  LIGHT_MIN,
  CHROMA_MAX,
} from './lib/palette.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const CSS = path.join(SRC, 'app/globals.css');

const BASE = process.env.CHECK_BASE ?? 'http://localhost:4321';
const ROUTES = [
  '/',
  '/endeks',
  '/endeks/2026-08',
  '/analiz',
  '/analiz/stok-eriyor-fiyat-geriliyor',
  '/metodoloji',
];

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9224;

/** Görünür alanın bu oranını aşan açık yüzey "zemin" sayılır. Altında
 *  kalanlar rapor edilir ama kapıyı düşürmez: `hover:bg-ice` gibi küçük
 *  düğme dolguları meşrudur, sayfa zemini olmaları mümkün değildir. */
const AREA_LIMIT = 0.05;

const rel = (p) => path.relative(ROOT, p);

// ── Aşama 1 ─────────────────────────────────────────────────────────────

function checkSource() {
  console.log('▸ Aşama 1 — kaynak taraması (OKLCH ölçümü + kapalı palet)\n');

  const theme = readTheme(readFileSync(CSS, 'utf8'));
  const tokenViolations = checkTheme(theme);
  const treeViolations = scanTree(SRC);

  console.log(
    `  @theme jetonu: ${Object.keys(theme).length} · ` +
      `eşik: L ≥ ${LIGHT_MIN} ve C ≤ ${CHROMA_MAX} (opaklık ≥ ${ALPHA_FLOOR})`,
  );

  if (tokenViolations.length > 0) {
    console.error(`\n  ✗ Jeton ihlali (${tokenViolations.length}):`);
    for (const v of tokenViolations) console.error(`      · ${v.detail}`);
  } else {
    console.log('  ✓ Jetonlar: yüzeyler koyu, izinsiz açık jeton yok.');
  }

  if (treeViolations.length > 0) {
    console.error(`\n  ✗ Kaynak ihlali (${treeViolations.length}):`);
    for (const v of treeViolations) {
      console.error(`      · ${rel(v.file)}:${v.line}  ${v.detail}`);
    }
  } else {
    console.log('  ✓ Kaynak: krem/bej/beyaz sabit yok, palet dışı zemin adı yok.');
  }

  return tokenViolations.length + treeViolations.length;
}

// ── Aşama 2 ─────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function findTarget() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      /* Chrome henüz dinlemiyor */
    }
    await sleep(250);
  }
  throw new Error('Chrome CDP uç noktası açılmadı');
}

/** Minimal CDP istemcisi — id eşlemeli istek/yanıt. */
function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  let nextId = 1;

  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    const slot = pending.get(msg.id);
    if (!slot) return;
    pending.delete(msg.id);
    if (msg.error) slot.reject(new Error(JSON.stringify(msg.error)));
    else slot.resolve(msg.result);
  });

  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('CDP bağlantısı kurulamadı')), {
      once: true,
    });
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

  return { ready, send, close: () => ws.close() };
}

// Tarayıcı içinde koşar. SINIFLANDIRMA BURADA YAPILMAZ: renkler ham
// toplanıp Node'a döner, eşikleri `lib/palette.mjs` uygular. Eşik iki yerde
// dursaydı biri güncellenip diğeri unutulurdu.
const PROBE = String.raw`(() => {
  const viewport = innerWidth * innerHeight;
  const seen = new Map();

  const note = (color, el, source) => {
    if (!color || color === 'none' || color === 'transparent') return;
    const r = el.getBoundingClientRect();
    const area = Math.max(0, r.width) * Math.max(0, r.height);
    if (area <= 0) return;

    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 4).join(' ') : '';
    const desc = '<' + el.tagName.toLowerCase() + (cls ? ' class="' + cls + '"' : '') + '>';

    const key = color + '|' + source;
    const prev = seen.get(key);
    if (!prev) seen.set(key, { color, source, area, ratio: area / viewport, desc, count: 1 });
    else {
      prev.count += 1;
      if (area > prev.area) { prev.area = area; prev.ratio = area / viewport; prev.desc = desc; }
    }
  };

  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
    note(cs.backgroundColor, el, 'background-color');
    if (cs.backgroundImage && cs.backgroundImage !== 'none') {
      for (const m of cs.backgroundImage.matchAll(/rgba?\([^)]*\)/g)) {
        note(m[0], el, 'background-image');
      }
    }
  }

  return {
    bodyBackground: getComputedStyle(document.body).backgroundColor,
    htmlBackground: getComputedStyle(document.documentElement).backgroundColor,
    elements: document.querySelectorAll('*').length,
    surfaces: [...seen.values()],
  };
})()`;

function judge(page, expectedNight) {
  const problems = [];
  const small = [];

  // Boş/stilsiz sayfa da "krem içermez". Kapının yeşil yanması için
  // zeminin gerçekten GECE olduğu KANITLANMALI.
  const body = parseColor(page.bodyBackground);
  if (!body || body.alpha < ALPHA_FLOOR) {
    problems.push(
      `body zemini boyanmıyor (${page.bodyBackground}) — stil sayfası yüklenmemiş olabilir`,
    );
  } else if (body.hex !== expectedNight) {
    problems.push(`body zemini ${body.hex}, beklenen gece rengi ${expectedNight}`);
  }

  if (page.elements < 10) {
    problems.push(`sayfada yalnızca ${page.elements} eleman var — sayfa gerçekten yüklendi mi?`);
  }

  for (const s of page.surfaces) {
    const color = parseColor(s.color);
    if (!color || color.alpha < ALPHA_FLOOR) continue;
    if (!isForbiddenSurface(color.hex)) continue;

    const { L, C } = oklch(color.hex);
    const line =
      `${color.hex} (L=${L.toFixed(3)} C=${C.toFixed(3)}) ` +
      `· ${s.source} · görünür alanın %${(s.ratio * 100).toFixed(1)}'i · ${s.count} eleman · ${s.desc}`;
    if (s.ratio >= AREA_LIMIT) problems.push(line);
    else small.push(line);
  }

  return { problems, small };
}

async function checkRender(expectedNight) {
  console.log('\n▸ Aşama 2 — gerçek render (Chrome, computed style)\n');

  const profile = mkdtempSync(path.join(tmpdir(), 'miamiendeksi-palette-'));
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  let failures = 0;
  let smallTotal = 0;

  try {
    const cdp = connect(await findTarget());
    await cdp.ready;
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    for (const route of ROUTES) {
      await cdp.send('Page.navigate', { url: BASE + route });
      await sleep(700);
      await cdp.send('Runtime.evaluate', {
        expression: 'document.fonts ? document.fonts.ready : Promise.resolve()',
        awaitPromise: true,
      });

      const { result } = await cdp.send('Runtime.evaluate', {
        expression: PROBE,
        returnByValue: true,
      });

      const { problems, small } = judge(result.value, expectedNight);
      smallTotal += small.length;
      if (problems.length > 0) failures += 1;

      console.log(
        `  ${problems.length === 0 ? '✓' : '✗'} ${route.padEnd(38)} ` +
          `${String(result.value.elements).padStart(4)} eleman · zemin ${result.value.bodyBackground}`,
      );
      for (const p of problems) console.error(`      ✗ ${p}`);
      for (const s of small) console.log(`      · küçük açık yüzey (eşik altı, kapıyı düşürmez): ${s}`);
    }

    cdp.close();
  } finally {
    chrome.kill();
    await new Promise((r) => {
      chrome.once('exit', r);
      setTimeout(r, 3000);
    });
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    } catch {
      /* geçici dizin kalabilir */
    }
  }

  console.log(
    `\n  zemin eşiği: görünür alanın %${(AREA_LIMIT * 100).toFixed(0)}'i · ` +
      `eşik altında kalan açık yüzey: ${smallTotal}`,
  );
  return failures;
}

// ── Giriş ───────────────────────────────────────────────────────────────

const withRender = hasFlag(process.argv.slice(2), 'render');

let failures = checkSource();

if (withRender) {
  const theme = readTheme(readFileSync(CSS, 'utf8'));
  const night = parseColor(theme.night ?? '#000000');
  failures += await checkRender(night.hex);
}

if (failures > 0) {
  console.error(`\n✗ Palet kapısı: ${failures} ihlal. Bu site GECE — krem/bej/beyaz zemin yasak.`);
  process.exit(1);
}

console.log(
  `\n✓ Palet kapısı temiz${withRender ? ' (kaynak + gerçek render)' : ' (kaynak)'}. Zemin gece.`,
);
