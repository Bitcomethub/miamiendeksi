// ─────────────────────────────────────────────────────────────────────────
// Palet koruması — krem/bej/beyaz zeminin sızmasını engelleyen sınıflandırıcı
//
// Bu site GECE (`CLAUDE.md` → "Görsel kimlik — Neon Nights"). Kural tek
// cümle: krem, bej, beyaz zemin YASAK. Burası o cümlenin çalıştırılabilir
// hâlidir.
//
// NEDEN YASAK-HEX LİSTESİ DEĞİL:
//   Elle yazılmış "yasak renkler" listesi, tıpkı elle yazılmış kontrast
//   tablosu gibi (bkz. `check-a11y.mjs`), 21. krem tonu seçildiği gün yalan
//   söyler. Bu yüzden liste yok: her renk OKLCH'e çevrilip ÖLÇÜLÜYOR.
//   Sınıflandırıcı hiç görmediği bir tonu da doğru yargılar.
//
// AYIRT EDİCİ RENKLİLİKTİR, AÇIKLIK DEĞİL:
//   bej  #F5F5DC → L=0,964  C=0,033
//   cyan #22d3ee → L=0,797  C=0,134
//   İkisi de "açık". Aradaki fark renkliliktir. "Açık olanı yasakla" deseydik
//   markanın birincil aksanını yasaklamış olurduk.
//
//   Ölçülmüş sınır komşuları (eşiği oynatmadan önce buraya bak):
//     yakalanan en KOYU   : tan   #D2B48C  L=0,786
//     geçen en AÇIK        : up    #a3e635  L=0,849 (C=0,207 ile kurtulur)
//     yakalanan en RENKLİ : khaki #F0E68C  C=0,112
//     geçen en SOLUK       : cyan  #22d3ee  C=0,134   ← en dar aralık burası
//
// ICE İSTİSNASI — EŞİK DEĞİL, AD:
//   `--color-ice` (#eaf2ff, L=0,959 C=0,019) gerçekten bir kırık beyazdır ve
//   sınıflandırıcı onu dürüstçe yakalar. Eşiği ice'ı geçirecek kadar
//   gevşetmek bejin TAMAMINI da geçirirdi (bej, ice'tan daha nötr değildir).
//   Bu yüzden istisna ada verilir: aşağıdaki tek isimli liste. Ice metin
//   rengidir; zemin olarak yalnızca küçük düğme dolgusunda (`hover:bg-ice`)
//   kullanılır — sayfa zemini olarak değil.
// ─────────────────────────────────────────────────────────────────────────

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/** Krem ailesinin en koyusu (tan) 0,786; geçmesi gereken en açık aksan
 *  (up) 0,849 renkliliğiyle kurtulur. */
export const LIGHT_MIN = 0.78;

/** Yakalanan en renkli (khaki) 0,112; geçen en soluk (cyan) 0,134. */
export const CHROMA_MAX = 0.12;

/** Bunun altındaki bir renk ZEMİN değildir: `.grid-glow` dokusu (α=0,045)
 *  ya da `.night-wash` perdesi (α=0,13) altındaki gece rengini boyamaz. */
export const ALPHA_FLOOR = 0.5;

/** Yüzey jetonları bundan açık olamaz. Mevcut en açığı `edge` (0,313). */
export const SURFACE_MAX_L = 0.45;

/** Tek istisna, gerekçesi dosya başında. Buraya isim eklemek paleti
 *  gevşetmektir — eklerken `npm run check:a11y -- --tokens` da koştur. */
export const ALLOWED_LIGHT_TOKENS = new Set(['ice']);

/** Sayfanın/panelin gerçek zeminleri. Bunlar ayrıca KOYU olmak zorunda. */
export const SURFACE_TOKENS = ['night', 'panel', 'panel-2', 'edge'];

/** Renk adı olmayan, ama `bg-` ile başlayan Tailwind yardımcıları. */
const BG_NON_COLOR =
  /^(cover|contain|auto|center|top|bottom|left|right|repeat|no-repeat|repeat-x|repeat-y|repeat-round|repeat-space|fixed|local|scroll|origin-|clip-|blend-|none|size-|position-|gradient-|linear-|radial-|conic-)/;

/** Renk adı yerine geçen, paletten bağımsız anahtar kelimeler. */
const KEYWORD_COLORS = new Set(['transparent', 'current', 'inherit', 'black', 'initial', 'unset']);

const COLOR_UTILITIES = /(?:^|[\s"'`{])((?:[a-z0-9-]+:)*)(bg|from|via|to)-([^\s"'`}]+)/g;

const COLOR_LITERAL =
  /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]*\)/g;

// ── Renk uzayı ───────────────────────────────────────────────────────────

function srgbToLinear(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** sRGB hex → OKLCH (Björn Ottosson, 2020). Açıklık ALGISALDIR: WCAG bağıl
 *  parlaklığı değil. `#808080` WCAG'de 0,216, OKLab'da 0,600 verir; insan
 *  gözünün "orta gri" dediği yer ikincisidir ve krem/bej ayrımı algısaldır. */
export function oklch(hex) {
  const h = String(hex).replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h.slice(0, 6);
  const r = srgbToLinear(parseInt(full.slice(0, 2), 16));
  const g = srgbToLinear(parseInt(full.slice(2, 4), 16));
  const b = srgbToLinear(parseInt(full.slice(4, 6), 16));

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  let H = (Math.atan2(B, A) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C: Math.hypot(A, B), H };
}

/** Metinden tek bir rengi çözer. Tailwind keyfi değerlerinde boşluk yerine
 *  alt çizgi kullanılır (`bg-[rgb(0_0_0/0.7)]`) — o biçim de kabul edilir. */
export function parseColor(raw) {
  const str = String(raw).trim().replace(/_/g, ' ');

  const hex = /^#([0-9a-fA-F]{3,8})$/.exec(str);
  if (hex) {
    const h = hex[1];
    if (h.length === 3 || h.length === 4) {
      const full = [...h].map((c) => c + c).join('');
      return { hex: `#${full.slice(0, 6)}`.toLowerCase(), alpha: h.length === 4 ? parseInt(full.slice(6, 8), 16) / 255 : 1 };
    }
    if (h.length === 6) return { hex: `#${h}`.toLowerCase(), alpha: 1 };
    if (h.length === 8) {
      return { hex: `#${h.slice(0, 6)}`.toLowerCase(), alpha: parseInt(h.slice(6, 8), 16) / 255 };
    }
    return null;
  }

  const fn = /^rgba?\(([^)]*)\)$/.exec(str);
  if (fn) {
    const parts = fn[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const [r, g, b] = parts.slice(0, 3).map((p) => {
      const n = p.endsWith('%') ? (parseFloat(p) / 100) * 255 : parseFloat(p);
      return Math.max(0, Math.min(255, Math.round(n)));
    });
    if ([r, g, b].some((n) => !Number.isFinite(n))) return null;
    let alpha = 1;
    if (parts.length > 3) {
      const a = parts[3];
      alpha = a.endsWith('%') ? parseFloat(a) / 100 : parseFloat(a);
      if (!Number.isFinite(alpha)) alpha = 1;
    }
    const to2 = (n) => n.toString(16).padStart(2, '0');
    return { hex: `#${to2(r)}${to2(g)}${to2(b)}`, alpha };
  }

  return null;
}

/** Bu renk zemin olarak kullanılırsa "krem / bej / kırık beyaz" mıdır? */
export function isForbiddenSurface(hex) {
  const { L, C } = oklch(hex);
  return L >= LIGHT_MIN && C <= CHROMA_MAX;
}

// ── @theme jetonları ─────────────────────────────────────────────────────

/** `globals.css` `@theme` bloğundaki `--color-*` tanımlarını toplar. */
export function readTheme(css) {
  const out = {};
  for (const m of stripCssComments(css).matchAll(
    /--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g,
  )) {
    out[m[1]] = m[2];
  }
  return out;
}

/**
 * Jeton kapısı. Her jeton için EN FAZLA bir ihlal üretir: aynı hatayı iki
 * kez saymak, rapordaki sayıyı anlamsızlaştırır.
 */
export function checkTheme(theme) {
  const violations = [];

  for (const [name, hex] of Object.entries(theme)) {
    if (isForbiddenSurface(hex) && !ALLOWED_LIGHT_TOKENS.has(name)) {
      const { L, C } = oklch(hex);
      violations.push({
        kind: 'token',
        token: name,
        raw: hex,
        detail: `--color-${name}: ${hex} krem/bej/beyaz ailesinde (L=${L.toFixed(3)} C=${C.toFixed(3)})`,
      });
      continue;
    }
    if (SURFACE_TOKENS.includes(name)) {
      const { L } = oklch(hex);
      if (L > SURFACE_MAX_L) {
        violations.push({
          kind: 'token',
          token: name,
          raw: hex,
          detail: `--color-${name}: ${hex} bir YÜZEY jetonu ve fazla açık (L=${L.toFixed(3)} > ${SURFACE_MAX_L})`,
        });
      }
    }
  }

  for (const name of SURFACE_TOKENS) {
    if (!(name in theme)) {
      violations.push({
        kind: 'token',
        token: name,
        raw: null,
        detail: `--color-${name} tanımsız — yüzey jetonu silinmiş olabilir`,
      });
    }
  }

  return violations;
}

// ── Kaynak taraması ──────────────────────────────────────────────────────

/** CSS yorumlarını boşlukla değiştirir (indeksler kaymasın diye SİLMEZ).
 *  Gerekçesi: `globals.css` başındaki not bloğu gerçek hex'lerden söz eder
 *  ve yasak bir tonu ÖRNEK olarak yazmak ihlal değildir. */
export function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (text[i] === '\n') line += 1;
  return line;
}

/**
 * Bir dosyanın metnini tarar. İki mekanizma:
 *
 *   1. KAPALI PALET — `bg-*`, `from-*`, `via-*`, `to-*` yardımcılarının renk
 *      adı `@theme` jetonlarından biri olmak ZORUNDA. Bu, `bg-white` /
 *      `bg-stone-100` / `bg-amber-50` gibi Tailwind varsayılanlarını tek
 *      kuralla kapatır; hiçbir renk tablosu gömmeye gerek kalmaz.
 *   2. DEĞER ÖLÇÜMÜ — kaynakta geçen her renk sabiti OKLCH'te ölçülür.
 *      Krem ailesindeyse ve saydam değilse ihlaldir.
 *
 * Aynı yeri iki kez saymamak için önce yardımcılar taranır ve kapladıkları
 * aralıklar işaretlenir; `bg-[#F5F5DC]` tek ihlal üretir, iki değil.
 */
export function scanText(text, file = 'kaynak', theme = {}) {
  const isCss = file.endsWith('.css');
  const body = isCss ? stripCssComments(text) : text;
  const violations = [];
  const consumed = [];

  const allowedNames = new Set([...Object.keys(theme), ...KEYWORD_COLORS]);

  COLOR_UTILITIES.lastIndex = 0;
  for (const m of body.matchAll(COLOR_UTILITIES)) {
    const [full, , prefix, rawValue] = m;
    const start = m.index + full.length - (prefix.length + 1 + rawValue.length);
    const end = m.index + full.length;

    if (prefix === 'bg' && BG_NON_COLOR.test(rawValue)) continue;

    // `bg-panel/40` → opaklık soneki renk adının parçası değildir.
    const value = rawValue.replace(/\/[0-9.]+%?$/, '');

    if (value.startsWith('[')) {
      const inner = value.slice(1, value.endsWith(']') ? -1 : undefined);
      const color = parseColor(inner);
      consumed.push([start, end]);
      if (color && color.alpha >= ALPHA_FLOOR && isForbiddenSurface(color.hex)) {
        violations.push({
          file,
          line: lineOf(body, start),
          kind: 'utility',
          raw: color.hex,
          detail: `${prefix}-[${inner}] krem/bej/beyaz ailesinde bir zemin boyuyor`,
        });
      }
      continue;
    }

    if (!allowedNames.has(value)) {
      consumed.push([start, end]);
      violations.push({
        file,
        line: lineOf(body, start),
        kind: 'utility',
        raw: `${prefix}-${value}`,
        detail: `"${prefix}-${value}" palet dışı bir renk adı — zeminler yalnızca @theme jetonlarından gelir`,
      });
    }
  }

  const inConsumed = (i) => consumed.some(([a, b]) => i >= a && i < b);

  COLOR_LITERAL.lastIndex = 0;
  for (const m of body.matchAll(COLOR_LITERAL)) {
    if (inConsumed(m.index)) continue;

    const color = parseColor(m[0]);
    if (!color || color.alpha < ALPHA_FLOOR) continue;
    if (!isForbiddenSurface(color.hex)) continue;

    // İzinli AÇIK jetonun kendi tanımı ihlal değildir (`--color-ice: #eaf2ff`).
    const lineStart = body.lastIndexOf('\n', m.index) + 1;
    const before = body.slice(lineStart, m.index);
    const def = /--color-([a-z0-9-]+):\s*$/.exec(before);
    if (def && ALLOWED_LIGHT_TOKENS.has(def[1])) continue;

    const { L, C } = oklch(color.hex);
    violations.push({
      file,
      line: lineOf(body, m.index),
      kind: 'literal',
      raw: color.hex,
      detail: `${m[0]} krem/bej/beyaz ailesinde (L=${L.toFixed(3)} C=${C.toFixed(3)})`,
    });
  }

  return violations;
}

const SCANNED = new Set(['.css', '.ts', '.tsx', '.js', '.jsx', '.mjs']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SCANNED.has(path.extname(entry))) out.push(full);
  }
  return out;
}

/** Bir ağacın tamamını tarar. Jeton haritası ağacın kendi `globals.css`'inden
 *  okunur — kapalı palet kuralı, o an geçerli palete göre uygulanır. */
export function scanTree(root) {
  const cssPath = path.join(root, 'app/globals.css');
  let theme = {};
  try {
    theme = readTheme(readFileSync(cssPath, 'utf8'));
  } catch {
    /* @theme yoksa kapalı palet listesi boş kalır — her renk adı ihlal olur */
  }

  const violations = [];
  for (const file of walk(root)) {
    violations.push(...scanText(readFileSync(file, 'utf8'), file, theme));
  }
  return violations;
}
