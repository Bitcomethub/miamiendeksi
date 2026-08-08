#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
// Erişilebilirlik kapısı — iki aşamalı
//
// AŞAMA 1 — JETON KONTRASTI (hızlı, tarayıcısız, ağsız)
//   `globals.css`'teki `@theme` bloğundan renkleri OKUR ve her metin
//   renginin her zemin üzerindeki WCAG oranını HESAPLAR. Dosyanın başındaki
//   kontrast tablosu bir YORUMDUR; yorum, yanındaki değerle birlikte
//   güncellenmediği gün yalan söylemeye başlar. Burası o tabloyu her
//   çalıştırmada yeniden üretir.
//
//   Bu aşama `--color-panel-2`'yi de dener ve asıl sebebi budur:
//   panel-2, `.panel-hover` kartlarının ÜZERİNE GELİNCE aldığı zemindir.
//   Lighthouse sayfayı yalnızca durağan hâlde denetler; fareyle üzerine
//   gelinen bir kartın kontrastı hiçbir Lighthouse koşusunda ölçülmez.
//   Yani bu aşama, Aşama 2'nin göremediği bir yüzeyi kapatıyor.
//
// AŞAMA 2 — LIGHTHOUSE (gerçek sayfa, gerçek DOM)
//   Her rota için erişilebilirlik puanı 100 olmak zorunda. Ek olarak
//   `color-contrast` denetiminin GERÇEKTEN KOŞTUĞU doğrulanır: denetim
//   `notApplicable` dönerse puan yine 100 görünür ama kontrast hiç
//   ölçülmemiştir. "100 aldı" ile "kontrol edildi" aynı şey değildir.
//
// Kullanım:
//   npm run check:a11y                 (iki aşama; sunucu açık olmalı)
//   npm run check:a11y -- --tokens     (yalnız Aşama 1 — saniyeler sürer)
// ─────────────────────────────────────────────────────────────────────────

import { readFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasFlag } from './lib/args.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CSS = path.join(ROOT, 'src/app/globals.css');

const BASE = process.env.CHECK_BASE ?? 'http://localhost:4321';
const ROUTES = [
  '/',
  '/endeks',
  '/endeks/2026-08',
  '/analiz',
  '/analiz/stok-eriyor-fiyat-geriliyor',
  '/metodoloji',
];

// AA, normal punto. Büyük punto 3.0'a düşer ama burada gevşetmiyoruz:
// bir rengi "yalnızca başlıkta kullanacağım" diye eşiğin altına indirmek,
// o rengin gövde metnine sızdığı gün sessizce ihlal üretir.
const AA = 4.5;

// ── WCAG 2.1 bağıl parlaklık ve kontrast ────────────────────────────────

function srgbToLinear(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function contrast(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

// ── Aşama 1 ─────────────────────────────────────────────────────────────

/** `--color-x: #hex;` satırlarını `@theme` bloğundan toplar. */
function readTokens() {
  const css = readFileSync(CSS, 'utf8');
  const out = {};
  for (const m of css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    out[m[1]] = m[2];
  }
  return out;
}

const SURFACES = [
  ['night', 'zemin'],
  ['panel', 'panel'],
  ['panel-2', 'panel:hover'],
];

const FOREGROUNDS = ['ice', 'mute', 'dim', 'cyan', 'magenta', 'up', 'down'];

function checkTokens() {
  const t = readTokens();
  const missing = [...SURFACES.map(([s]) => s), ...FOREGROUNDS].filter((k) => !t[k]);
  if (missing.length > 0) {
    console.error(`✗ globals.css içinde bulunamayan jeton: ${missing.join(', ')}`);
    return 1;
  }

  console.log('▸ Jeton kontrastı (WCAG 2.1, hesaplanmış)\n');
  console.log(
    '  renk'.padEnd(12) + SURFACES.map(([, l]) => l.padStart(12)).join('') + '   durum',
  );

  let bad = 0;
  for (const fg of FOREGROUNDS) {
    const ratios = SURFACES.map(([s]) => contrast(t[fg], t[s]));
    const worst = Math.min(...ratios);
    const ok = worst >= AA;
    if (!ok) bad += 1;
    console.log(
      `  ${fg.padEnd(10)}` +
        ratios.map((r) => `${r.toFixed(2)}:1`.padStart(12)).join('') +
        `   ${ok ? '✓' : '✗ AA ALTI'}`,
    );
  }

  console.log(`\n  eşik: ${AA}:1 (AA, normal punto) — en kötü yüzey belirleyicidir`);
  if (bad > 0) console.error(`\n✗ ${bad} renk bir yüzeyde AA'nın altında.`);
  else console.log('\n✓ Tüm metin renkleri her yüzeyde AA.');
  return bad > 0 ? 1 : 0;
}

// ── Aşama 2 ─────────────────────────────────────────────────────────────

function runLighthouse() {
  const dir = mkdtempSync(path.join(tmpdir(), 'miamiendeksi-lh-'));
  let bad = 0;

  try {
    console.log('\n▸ Lighthouse erişilebilirlik (her rota 100 olmalı)\n');

    for (const route of ROUTES) {
      const file = path.join(dir, `${route.replace(/\W+/g, '_') || 'root'}.json`);
      try {
        execFileSync(
          'npx',
          [
            '--yes',
            'lighthouse@12',
            BASE + route,
            '--only-categories=accessibility',
            '--output=json',
            `--output-path=${file}`,
            '--chrome-flags=--headless=new --no-sandbox',
            '--quiet',
          ],
          { stdio: ['ignore', 'ignore', 'pipe'] },
        );
      } catch (err) {
        console.error(`  ✗ ${route.padEnd(38)} Lighthouse çalışmadı: ${err.message.split('\n')[0]}`);
        bad += 1;
        continue;
      }

      const r = JSON.parse(readFileSync(file, 'utf8'));
      const score = Math.round(r.categories.accessibility.score * 100);
      const fails = Object.values(r.audits).filter((a) => a.score !== null && a.score < 1);
      const cc = r.audits['color-contrast'];

      // "100 aldı" yetmez: kontrast denetimi koşmadıysa puan da bir şey
      // KANITLAMAZ. `notApplicable` sessiz bir boşluktur.
      const ccRan = cc?.scoreDisplayMode === 'binary';

      const ok = score === 100 && ccRan;
      if (!ok) bad += 1;

      const notes = [];
      if (fails.length > 0) notes.push(`düşen: ${fails.map((f) => f.id).join(', ')}`);
      if (!ccRan) notes.push(`color-contrast KOŞMADI (${cc?.scoreDisplayMode})`);

      console.log(
        `  ${ok ? '✓' : '✗'} ${route.padEnd(38)} ${String(score).padStart(3)}` +
          (notes.length > 0 ? `  ${notes.join(' | ')}` : ''),
      );
    }
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    } catch {
      /* geçici dizin kalabilir */
    }
  }

  if (bad > 0) console.error(`\n✗ ${bad} rota erişilebilirlik kapısından geçemedi.`);
  else console.log('\n✓ Tüm rotalar 100 ve kontrast denetimi gerçekten koştu.');
  return bad > 0 ? 1 : 0;
}

// ── Giriş ───────────────────────────────────────────────────────────────

const tokensOnly = hasFlag(process.argv.slice(2), 'tokens');
let code = checkTokens();
if (!tokensOnly) code = runLighthouse() || code;
process.exit(code);
