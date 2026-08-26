#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
// Hat öz-testi — `npm test`
//
// AĞA ÇIKMAZ. Yalnızca ayrıştırma, hesaplama ve doğrulama kapılarını
// deterministik girdilerle sınar; ayrıca repodaki gerçek yazıları gerçek
// veri anlık görüntüsüne karşı yeniden doğrular.
//
// Kapı testleri İKİ YÖNLÜDÜR ve bu bilinçlidir:
//   · YAKALAMALI  — uydurulmuş/bozulmuş sayı ve yasak dil geçerse kapı
//                   işe yaramıyordur.
//   · GEÇİRMELİ   — meşru Türkçe cümle takılırsa kapı kullanılamaz hâle
//                   gelir, hat her ay `needs_review`'a düşer ve insan
//                   sonunda kapıyı kapatır. Bu da bir arıza türüdür.
//
// Yalnız birinci yönü test etmek, "her şeyi reddet" kadar aptal bir kapıyı
// da geçirir.
// ─────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseDelimitedLine, parseDelimited, toNumber } from './lib/csv.mjs';
import { shiftMonths, findNearest, change, round, buildMetric } from './lib/compute.mjs';
import { hasFlag, readPeriod } from './lib/args.mjs';
import { verifyNumbers, verifyLanguage, extractNumbers, parseTurkishNumber } from './lib/guard.mjs';
import {
  oklch,
  parseColor,
  isForbiddenSurface,
  readTheme,
  checkTheme,
  scanText,
  scanTree,
} from './lib/palette.mjs';
import {
  barPlot,
  barDomain,
  comparableChanges,
  superlative,
  BAR_W,
  BAR_PAD,
  MIN_BARS,
} from '../src/lib/chart-geom.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let passed = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (err) {
    failures.push({ name, message: err.message });
  }
}

function eq(actual, expected, what = '') {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${what}beklenen ${e}, gelen ${a}`);
}

function ok(cond, msg) {
  if (!cond) throw new Error(msg);
}

// ── 1. Ayrıştırma ────────────────────────────────────────────────────────
// Bu testler gerçek bir arıza sınıfını kilitliyor: Zillow'un bölge sütunu
// birebir `"Miami, FL"` ve naif bir `split(',')` sonraki TÜM sütunları bir
// kaydırır — parse hatası vermeden yanlış ayın fiyatını yayınlar.

check('CSV: tırnaklı alan içindeki virgül sütunu kaydırmaz', () => {
  const cols = parseDelimitedLine('394856,"Miami, FL",Msa,FL,476597.65', ',');
  eq(cols.length, 5, 'sütun sayısı: ');
  eq(cols[1], 'Miami, FL');
  eq(cols[4], '476597.65');
});

check('CSV: ikilenmiş tırnak (`""`) alanı kapatmaz', () => {
  const cols = parseDelimitedLine('a,"12"" ekran",b', ',');
  eq(cols, ['a', '12" ekran', 'b']);
});

check('TSV: sekme ayracı ve tırnaklama birlikte çalışır', () => {
  const cols = parseDelimitedLine('Miami, FL metro area\t"All Residential"\t765', '\t');
  eq(cols, ['Miami, FL metro area', 'All Residential', '765']);
});

check('CSV: CRLF, başlık ayrımı ve son satır sonu olmayan dosya', () => {
  const { header, rows } = parseDelimited('a,b\r\n1,2\r\n3,4', ',');
  eq(header, ['a', 'b']);
  eq(rows, [
    ['1', '2'],
    ['3', '4'],
  ]);
});

check('CSV: tırnak içindeki satır sonu kaydı BÖLMEZ', () => {
  // Zillow/Redfin dışa aktarımlarında bölge adı serbest metindir; gömülü
  // satır sonu naif `split('\n')` ile dosyayı ortadan ikiye böler.
  const { rows } = parseDelimited('a,b\n"iki\nsatır",7\n', ',');
  eq(rows.length, 1, 'kayıt sayısı: ');
  eq(rows[0], ['iki\nsatır', '7']);
});

check('toNumber: boş ve geçersiz alan null döner, 0 DEĞİL', () => {
  // Bu ayrım kritik: boş alanı 0 saymak "stok sıfıra düştü" gibi
  // tamamen uydurma bir manşet üretir.
  eq(toNumber(''), null);
  eq(toNumber('.'), null);
  eq(toNumber('476597.65'), 476597.65);
});

// ── 2. Hesaplama ─────────────────────────────────────────────────────────

check('shiftMonths: ay sonu taşmaz', () => {
  eq(shiftMonths('2026-03-31', 1), '2026-02-28');
  eq(shiftMonths('2024-03-31', 1), '2024-02-29'); // artık yıl
  eq(shiftMonths('2026-01-15', 12), '2025-01-15');
});

check('findNearest: tolerans dışındaki gözlemi reddeder', () => {
  const pts = [
    { date: '2025-06-30', value: 1 },
    { date: '2026-06-30', value: 2 },
  ];
  ok(findNearest(pts, '2026-06-28', 25) !== null, 'yakın gözlem bulunmalı');
  eq(findNearest(pts, '2026-01-31', 25), null, 'uzak gözlem: ');
});

check('change: yüzde birimli metrikte PUAN, diğerlerinde YÜZDE', () => {
  // Faiz %6,49'dan %6,69'a çıkarsa fark 0,20 PUANDIR; yüzde olarak
  // %3,08'dir. İkisini karıştırmak faiz metriklerinde büyük hata üretir.
  eq(change(6.69, 6.49, 'pct'), { value: 0.2, kind: 'pp' });
  eq(change(6.69, 6.49, 'usd'), { value: 3.08, kind: 'pct' });
  eq(change(100, 0, 'usd'), null, 'sıfıra bölme: ');
});

check('round: yarım yukarı, ondalık korunur', () => {
  eq(round(2.225, 2), 2.23);
  eq(round(-2.234, 2), -2.23);
});

check('buildMetric: ham değeri KIRPMAZ', () => {
  // Yuvarlama yalnız gösterimde yapılır. Ham değeri burada kırpmak,
  // sayı kapısının izin verdiği kümeyi bozar ve meşru metni reddettirir.
  const pts = [
    { date: '2025-06-30', value: 487500.123456 },
    { date: '2026-05-31', value: 477000.5 },
    { date: '2026-06-30', value: 476597.6561849468 },
  ];
  const m = buildMetric({ id: 't', label: 'T', short: 'T', unit: 'usd', publisher: 'x', dataset: 'd' }, pts);
  eq(m.value, 476597.6561849468);
  eq(m.asOf, '2026-06-30');
  eq(m.mom.kind, 'pct');
  eq(m.yoy.kind, 'pct');
});

check('buildMetric: tek gözlemli seride karşılaştırma UYDURMAZ', () => {
  const m = buildMetric(
    { id: 't', label: 'T', short: 'T', unit: 'usd', publisher: 'x', dataset: 'd' },
    [{ date: '2026-06-30', value: 100 }],
  );
  eq(m.mom, null);
  eq(m.yoy, null);
});

// ── 3. Komut satırı ──────────────────────────────────────────────────────
// Gerçek bir arızadan doğdu: iki script `--period`'ü iki farklı biçimde
// okuyordu ve yanlış biçim SESSİZCE varsayılana düşüyordu — yani elle
// tetiklenen bir çalıştırma, istenen ayın yerine içinde bulunulan ayın
// verisini çekip başarıyla bitiyordu.

check('args: her iki biçim de aynı değeri verir', () => {
  eq(readPeriod(['--period=2026-08']), '2026-08');
  eq(readPeriod(['--period', '2026-08']), '2026-08');
  eq(readPeriod(['--dry-run']), null);
});

check('args: bozuk ya da eksik değer SESSİZCE yutulmaz', () => {
  const throws = (argv) => {
    try {
      readPeriod(argv);
      return false;
    } catch {
      return true;
    }
  };
  ok(throws(['--period']), 'değersiz --period hata vermeli');
  ok(throws(['--period', '--mock']), 'sonraki bayrağı değer sanmamalı');
  ok(throws(['--period=2026-13']), 'geçersiz ay hata vermeli');
  ok(throws(['--period=agustos']), 'geçersiz biçim hata vermeli');
});

check('args: bayraklar birbirine karışmaz', () => {
  const argv = ['--mock', '--dry-run', '--period=2026-08'];
  ok(hasFlag(argv, 'mock') && hasFlag(argv, 'dry-run'), 'bayraklar okunmalı');
  ok(!hasFlag(argv, 'skip-redfin'), 'verilmeyen bayrak okunmamalı');
});

// ── 4. Sayı ayrıştırma (Türkçe biçim) ────────────────────────────────────

check('parseTurkishNumber: binlik `.` ile ondalık `.` ayrımı', () => {
  eq(parseTurkishNumber('476.598'), { value: 476598, decimals: 0 });
  eq(parseTurkishNumber('6,69'), { value: 6.69, decimals: 2 });
  eq(parseTurkishNumber('512.345,67'), { value: 512345.67, decimals: 2 });
  eq(parseTurkishNumber('1.23'), { value: 1.23, decimals: 2 });
});

check('extractNumbers: birim işareti bağlamdan okunur', () => {
  const toks = extractNumbers('değer %6,69 ve 51.021 konut ile 2026 yılında');
  const byRaw = Object.fromEntries(toks.map((t) => [t.raw, t]));
  ok(byRaw['6,69'].hasUnit, 'yüzde işareti birim sayılmalı');
  ok(byRaw['51.021'].hasUnit, '"konut" birim sayılmalı');
  ok(!byRaw['2026'].hasUnit, 'çıplak yıl birim taşımamalı');
});

// ── 5. Sayı kapısı — YAKALAMALI ──────────────────────────────────────────

const GATE_SNAP = {
  metrics: [
    { value: 476597.6561849468, mom: { value: -0.01, kind: 'pct' }, yoy: { value: -2.23, kind: 'pct' } },
    { value: 6.69, mom: { value: 0.2, kind: 'pp' }, yoy: null },
    { value: 51021, mom: null, yoy: { value: -13.2, kind: 'pct' } },
  ],
  derived: [{ value: 6.78, mom: null, yoy: null }],
};

const MUST_CATCH = [
  ['uydurulmuş kesin rakam', 'Tipik konut değeri 512.900 dolar oldu.'],
  ['bir basamağı bozulmuş rakam', 'Tipik konut değeri 476.698 dolar.'],
  ['var olmayan yüzde', 'Faiz %7,15 seviyesinde.'],
  ['var olmayan sayım', 'Piyasada 62.400 konut listelendi.'],
  ['sahte ölçekli sayı', 'Stok 1,2 milyon konuta ulaştı.'],
  ['doğru sayının yanlış ölçeği', 'Değer 476 milyon dolar.'],
];

for (const [name, text] of MUST_CATCH) {
  check(`sayı kapısı YAKALAR: ${name}`, () => {
    const r = verifyNumbers(text, GATE_SNAP);
    ok(!r.ok, `geçmemeliydi: ${text}`);
  });
}

// ── 6. Sayı kapısı — GEÇİRMELİ ───────────────────────────────────────────
// Meşru Türkçe yazı takılırsa kapı kullanılamaz hâle gelir. Bu yön en az
// diğeri kadar önemli.

const MUST_PASS = [
  ['gerçek değer + yuvarlama', 'Tipik konut değeri 476.598 dolar; kabaca 477 bin dolar.'],
  ['gerçek yüzde ve puan farkı', 'Faiz %6,69 seviyesinde, önceki aya göre 0,20 puan yukarıda.'],
  ['düşüşte mutlak değer', 'Endeks yıllık %2,23 geriledi.'],
  ['yapısal küçük sayı', 'Üç kaynak ve 12 aylık karşılaştırma kullanıldı.'],
  ['yıl', '2026 yılının ikinci yarısında, 2021 seviyesine göre.'],
  ['ayın günü', 'Veriler 30 Haziran 2026 gözlemine aittir.'],
  ['kredi vadesi', '30 yıllık sabit mortgage faizi %6,69 seviyesinde.'],
  ['türetilmiş oran', 'Brüt kira getirisi %6,78 olarak hesaplandı.'],
];

for (const [name, text] of MUST_PASS) {
  check(`sayı kapısı GEÇİRİR: ${name}`, () => {
    const r = verifyNumbers(text, GATE_SNAP);
    ok(r.ok, `takılmamalıydı: ${text} → ${JSON.stringify(r.violations)}`);
  });
}

// ── 7. Dil kapısı ────────────────────────────────────────────────────────

const LANG_CATCH = [
  ['gelecek iddiası', 'Fiyatların önümüzdeki ay yükselecek olması bekleniyor.'],
  ['kaynaksız otorite', 'Uzmanlara göre piyasa dibi gördü.'],
  ['yatırım tavsiyesi', 'Bu fiyattan almalısınız.'],
  ['getiri garantisi', 'Bu yatırımın riski yok.'],
];

for (const [name, text] of LANG_CATCH) {
  check(`dil kapısı YAKALAR: ${name}`, () => {
    ok(!verifyLanguage(text).ok, `geçmemeliydi: ${text}`);
  });
}

check('dil kapısı GEÇİRİR: zorunlu yasal çekince', () => {
  // "yatırım tavsiyesi değildir" YASAK DEĞİL — tam tersi, her sayfada
  // bulunması gerekiyor. Kalıp bunu negatif ileri bakışla ayırıyor.
  ok(verifyLanguage('Bu içerik yatırım tavsiyesi değildir.').ok, 'çekince cümlesi takıldı');
});

check('dil kapısı GEÇİRİR: gerçekleşmiş olayın anlatımı', () => {
  ok(
    verifyLanguage('Stok geçen yıla göre eridi, değer endeksi ekside kaldı.').ok,
    'geçmiş zaman anlatımı takıldı',
  );
});

// ── 8. Yayındaki gerçek içerik ───────────────────────────────────────────
// Repodaki yazılar, repodaki veriye karşı. Bu test bir simülasyon değil:
// yayına giden metnin ta kendisini denetler.

check('yayındaki yazılar veri setine karşı doğrulanır', () => {
  const articles = JSON.parse(
    readFileSync(path.join(ROOT, 'src/content/articles/articles.json'), 'utf8'),
  );
  ok(articles.length > 0, 'yazı yok');

  for (const a of articles) {
    const snap = JSON.parse(
      readFileSync(path.join(ROOT, `src/content/index/${a.period}.json`), 'utf8'),
    );

    const parts = [a.title, a.excerpt, a.answer];
    for (const b of a.blocks) {
      if (typeof b.text === 'string') parts.push(b.text);
      if (Array.isArray(b.items)) parts.push(...b.items);
      // `chart` bloğunun metrik ID'si gerçekten var olmalı — olmayan bir
      // ID sessizce grafiksiz bir yazı üretirdi.
      if (b.type === 'chart') {
        ok(
          snap.metrics.some((m) => m.id === b.metricId),
          `${a.slug}: bilinmeyen metrik "${b.metricId}"`,
        );
      }
      // `bars` bloğu birden çok id taşır. Her biri var olmalı ve blok
      // ÇİZİLEBİLİR olmalı: `pp` elemesinden sonra 2'nin altına düşen bir
      // blok sayfada sessizce kaybolur — yazıda ona atıf varsa okuyucu
      // olmayan bir grafiğe gönderilir.
      if (b.type === 'bars') {
        ok(Array.isArray(b.metricIds), `${a.slug}: bars bloğunda metricIds dizisi yok`);
        for (const id of b.metricIds) {
          ok(
            snap.metrics.some((m) => m.id === id),
            `${a.slug}: bars bloğunda bilinmeyen metrik "${id}"`,
          );
        }
        const alan = b.compare === 'mom' ? 'mom' : 'yoy';
        const cizilebilir = b.metricIds
          .map((id) => snap.metrics.find((m) => m.id === id))
          .filter((m) => m && m[alan] && m[alan].kind === 'pct');
        ok(
          cizilebilir.length >= MIN_BARS,
          `${a.slug}: bars bloğu ${alan} için yalnızca ${cizilebilir.length} karşılaştırılabilir ` +
            `gösterge bırakıyor (en az ${MIN_BARS} gerekir) — blok sayfada hiç çizilmez`,
        );
      }
    }
    for (const f of a.faqs) parts.push(f.q, f.a);

    const text = parts.join('\n');
    const n = verifyNumbers(text, snap);
    ok(n.ok, `${a.slug}: sayı ihlali ${JSON.stringify(n.violations.map((v) => v.raw))}`);

    const l = verifyLanguage(text);
    ok(l.ok, `${a.slug}: dil ihlali ${JSON.stringify(l.violations.map((v) => v.id))}`);

    ok(a.faqs.length >= 3, `${a.slug}: en az 3 SSS gerekir`);
    ok(a.answer.length >= 120, `${a.slug}: answer-first paragraf çok kısa`);
  }
});

// ── 9. Anlık görüntü bütünlüğü ───────────────────────────────────────────

check('anlık görüntü: yer tutucu/uydurma değer taşımaz', () => {
  const snap = JSON.parse(readFileSync(path.join(ROOT, 'src/content/index/latest.json'), 'utf8'));
  const data = JSON.parse(
    readFileSync(path.join(ROOT, `src/content/index/${snap.period}.json`), 'utf8'),
  );

  ok(data.metrics.length > 0, 'metrik yok');

  for (const m of data.metrics) {
    ok(Number.isFinite(m.value), `${m.id}: değer sayı değil`);
    ok(m.sourceUrl && /^https:\/\//.test(m.sourceUrl), `${m.id}: kaynak URL yok`);
    ok(/^\d{4}-\d{2}-\d{2}$/.test(m.asOf), `${m.id}: gözlem tarihi biçimi bozuk`);
    ok(data.publishers.some((p) => p.id === m.publisher), `${m.id}: tanımsız yayıncı`);
    // Aylık dosya YAYIN döneminden sonraki bir gözlem taşıyamaz.
    ok(m.asOf.slice(0, 7) <= data.period, `${m.id}: gözlem yayın döneminin ilerisinde`);
  }

  for (const d of data.derived) {
    ok(Number.isFinite(d.value), `${d.id}: değer sayı değil`);
    ok(d.formula && d.inputs.length > 0, `${d.id}: formül/girdi eksik`);
    for (const input of d.inputs) {
      ok(data.metrics.some((m) => m.id === input), `${d.id}: girdi "${input}" yok`);
    }
  }
});

// ── 10. Palet kapısı — krem/bej/beyaz koruması ───────────────────────────
// Bu site GECE. Kapı İKİ YÖNLÜ sınanır ve sebebi somut: eşiği krem ailesini
// yakalayacak kadar geniş tutarsan neon camgöbeğini de eler (aradaki fark
// yalnızca renklilikte: khaki C=0,112 · cyan C=0,134), o zaman kapı her
// commit'te bağırır ve biri onu kapatır. Sessiz kapı, kırmızı kapıdan
// tehlikelidir.


// Deterministik palet — testler globals.css değişince kaymasın diye
// sabittir; gerçek dosyanın kendisi ayrı bir testle sınanır.
const THEME = {
  night: '#0b0f1e', panel: '#131a2e', 'panel-2': '#1a2440', edge: '#22304f',
  ice: '#eaf2ff', mute: '#8fa3c8', dim: '#7c90b6', cyan: '#22d3ee',
  'cyan-deep': '#0e7f92', magenta: '#f472b6', 'magenta-deep': '#9d3f74',
  up: '#a3e635', down: '#fb4e4e',
};

check('OKLCH: dönüşüm bilinen renklerde doğru koordinat verir', () => {
  const w = oklch('#ffffff');
  ok(Math.abs(w.L - 1) < 0.005, `beyaz L=${w.L.toFixed(3)}, 1 olmalı`);
  ok(w.C < 0.005, `beyaz renkliliği ${w.C.toFixed(3)}, 0 olmalı`);
  const n = oklch('#0b0f1e');
  ok(Math.abs(n.L - 0.173) < 0.01, `night L=${n.L.toFixed(3)}, ~0,173 olmalı`);
});

check('sınıflandırıcı: krem/bej/beyaz ailesinin TAMAMINI yakalar', () => {
  const banned = {
    white: '#ffffff', cream: '#FFFDD0', beige: '#F5F5DC', ivory: '#FFFFF0',
    linen: '#FAF0E6', antiquewhite: '#FAEBD7', oldlace: '#FDF5E6',
    seashell: '#FFF5EE', tan: '#D2B48C', wheat: '#F5DEB3', khaki: '#F0E68C',
    bisque: '#FFE4C4', eggshell: '#F0EAD6', 'off-white': '#FAF7F0',
    'warm-gray': '#E7E5E4', 'tw-stone-100': '#F5F5F4', 'tw-amber-50': '#FFFBEB',
    'tw-neutral-200': '#E5E5E5', 'tw-slate-100': '#F1F5F9', 'tw-stone-300': '#D6D3D1',
    lightcyan: '#E0FFFF', 'pale-pink': '#FFE4E1',
  };
  const missed = Object.entries(banned).filter(([, hex]) => !isForbiddenSurface(hex));
  eq(missed, [], 'kaçan krem tonu: ');
});

check('sınıflandırıcı: proje paletinin TAMAMINI geçirir (ice hariç)', () => {
  // ice (#eaf2ff, L=0,959) gerçekten bir kırık beyazdır ve sınıflandırıcı
  // onu dürüstçe yakalar; taramada ADIYLA muaf tutulur. Eşiği ice'ı
  // geçirecek kadar gevşetmek, bejin tamamını da geçirirdi.
  const palette = {
    night: '#0b0f1e', panel: '#131a2e', 'panel-2': '#1a2440', edge: '#22304f',
    mute: '#8fa3c8', dim: '#7c90b6', cyan: '#22d3ee', 'cyan-deep': '#0e7f92',
    magenta: '#f472b6', 'magenta-deep': '#9d3f74', up: '#a3e635', down: '#fb4e4e',
  };
  const flagged = Object.entries(palette).filter(([, hex]) => isForbiddenSurface(hex));
  eq(flagged, [], 'yanlışlıkla yasaklanan proje rengi: ');
});

check('sınıflandırıcı: EN DAR sınır — khaki yakalanır, camgöbeği geçer', () => {
  // Eşiğin iki yakası. Bu test kırmızıya dönerse eşik kaymıştır; hangi
  // yöne kaydığını da söyler.
  ok(isForbiddenSurface('#F0E68C'), 'khaki (C=0,112) yakalanmalıydı');
  ok(!isForbiddenSurface('#22d3ee'), 'neon camgöbeği (C=0,134) geçmeliydi');
});

check('sınıflandırıcı: ice dürüstçe kırık-beyaz sayılır', () => {
  ok(isForbiddenSurface('#eaf2ff'), 'ice sınıflandırıcıda yakalanmalı (muafiyet ADLA verilir)');
});

check('parseColor: hex3/hex6/hex8, rgb(), rgba() ve Tailwind alt çizgili biçim', () => {
  eq(parseColor('#fff'), { hex: '#ffffff', alpha: 1 });
  eq(parseColor('#F5F5DC'), { hex: '#f5f5dc', alpha: 1 });
  eq(parseColor('#F5F5DC80'), { hex: '#f5f5dc', alpha: 128 / 255 });
  eq(parseColor('rgb(34 211 238 / 0.045)'), { hex: '#22d3ee', alpha: 0.045 });
  eq(parseColor('rgba(255, 253, 208, 0.5)'), { hex: '#fffdd0', alpha: 0.5 });
  eq(parseColor('rgb(0_0_0/0.7)'), { hex: '#000000', alpha: 0.7 });
});

check('tarama: saydam krem ELENİR, opak krem yakalanır', () => {
  // Alfa eşiği bir ELEME kuralıdır; eleme kuralları kapıyı sessizleştirdiği
  // için iki yönü de kilitleniyor.
  const seffaf = scanText('.x { background: rgb(255 253 208 / 0.08); }', 'a.css', THEME);
  eq(seffaf, [], 'saydam doku ihlal sayılmamalı: ');
  const opak = scanText('.x { background: rgb(255 253 208 / 0.9); }', 'a.css', THEME);
  eq(opak.length, 1, 'opak krem yakalanmalı: ');
});

check('tarama: CSS yorumundaki hex sayılmaz ama AYNI satırdaki gerçek ihlal sayılır', () => {
  // Yorum ayıklama da bir eleme kuralıdır: fazla ayıklarsa kapı körelir.
  const v = scanText('.x { background: #F5F5DC; /* #FAF0E6 yasak */ }', 'a.css', THEME);
  eq(v.length, 1, 'ihlal sayısı: ');
  eq(v[0].raw, '#f5f5dc', 'yakalanan: ');
});

check('jeton kapısı: mevcut yüzey jetonları geçer', () => {
  eq(checkTheme(THEME), [], 'mevcut palet temiz olmalı: ');
});

check('jeton kapısı: yüzey jetonu kreme kayarsa yakalar', () => {
  const sabote = { ...THEME, night: '#FAF7F0' };
  const v = checkTheme(sabote);
  eq(v.length, 1, 'ihlal sayısı: ');
  ok(v[0].detail.includes('night'), `mesaj jetonu adlandırmalı: ${v[0].detail}`);
});

check('jeton kapısı: ice DIŞINDA açık jeton eklenirse yakalar', () => {
  // Muafiyet listesi tek isimlidir; "krem jetonu tanımlayıp bg-krem yaz"
  // kaçamağını kapatan test budur.
  const v = checkTheme({ ...THEME, parchment: '#F5F5DC' });
  eq(v.length, 1, 'ihlal sayısı: ');
  ok(v[0].detail.includes('parchment'), `mesaj jetonu adlandırmalı: ${v[0].detail}`);
});

check('jeton kapısı: yüzey jetonu orta griye kayarsa yakalar (krem ailesi DEĞİL)', () => {
  // Mutasyon testi bu boşluğu buldu: #808080 krem DEĞİLDİR (L=0,600, eşiğin
  // altında), yani krem sınıflandırıcısı onu hiç görmez. Gece sitesinin
  // zemininin gri olmasını engelleyen tek şey yüzey jetonlarının ayrıca
  // "koyu olma" şartıdır. O şart test edilmeden sessizce silinebiliyordu.
  ok(!isForbiddenSurface('#808080'), 'orta gri krem ailesinde OLMAMALI');
  const v = checkTheme({ ...THEME, panel: '#808080' });
  eq(v.length, 1, 'ihlal sayısı: ');
  ok(v[0].detail.includes('YÜZEY'), `yüzey kuralı devreye girmeliydi: ${v[0].detail}`);
});

check('sınıf taraması: palet dışı zemin yardımcıları yakalanır', () => {
  const cases = ['bg-white', 'bg-stone-100', 'bg-amber-50', 'bg-[#F5F5DC]', 'to-neutral-200'];
  for (const c of cases) {
    const v = scanText(`<div className="${c}" />`, 'a.tsx', THEME);
    ok(v.length === 1, `${c} yakalanmalıydı (bulunan: ${v.length})`);
  }
});

check('sınıf taraması: gerçek kaynaktaki zemin biçimleri GEÇER', () => {
  // Bunlar repoda BUGÜN kullanılan biçimler. Kapı bunlara bağırırsa
  // kullanılamaz hâle gelir.
  const gercek =
    '<div className="bg-night bg-panel/40 hover:bg-ice focus:bg-cyan bg-edge bg-night/95 bg-transparent bg-black" />';
  eq(scanText(gercek, 'a.tsx', THEME), [], 'yanlış pozitif: ');
});

check('sınıf taraması: renk OLMAYAN bg-* yardımcıları geçer', () => {
  const v = scanText('<div className="bg-cover bg-center bg-no-repeat bg-gradient-to-r" />', 'a.tsx', THEME);
  eq(v, [], 'renk olmayan yardımcı ihlal sayılmamalı: ');
});

check('gerçek dosya: globals.css @theme bloğu jeton kapısından geçer', () => {
  const css = readFileSync(path.join(ROOT, 'src/app/globals.css'), 'utf8');
  eq(checkTheme(readTheme(css)), [], 'globals.css jeton ihlali: ');
});

check('gerçek kaynak: src/ ağacında krem/bej/beyaz yok', () => {
  const v = scanTree(path.join(ROOT, 'src'));
  eq(
    v.map((x) => `${x.file}:${x.line} ${x.raw ?? x.detail}`),
    [],
    'gerçek kaynakta ihlal: ',
  );
});


// ── 11. Çubuk grafik geometrisi ──────────────────────────────────────────
// Çubuğun iddiası ARİTMETİKTİR: uzunluk = büyüklük. Kesilmiş bir taban
// çizgisi ekranda kusursuz görünür ve yalnızca ORANLARI bozar — yani
// `check:layout` de `check:palette --render` de onu göremez. Bu yüzden
// geometri burada, sunucusuz ve deterministik olarak sınanır.
//
// Kapı yine İKİ YÖNLÜ: yanlış oranı yakalamalı, meşru veriyi geçirmeli.

const EPS = 1e-9;

check('çubuk: boş girdi çizmez ama patlamaz', () => {
  for (const empty of [[], null, undefined]) {
    const g = barPlot(empty);
    eq(g.rows, [], `${JSON.stringify(empty)} için: `);
    ok(Number.isFinite(g.zero), 'zero sayı olmalı');
    ok(Number.isFinite(g.lo) && Number.isFinite(g.hi), 'alan sınırları sayı olmalı');
  }
});

check('çubuk: tüm değerler sıfırken NaN üretmez', () => {
  const g = barPlot([
    { id: 'a', label: 'A', value: 0 },
    { id: 'b', label: 'B', value: 0 },
  ]);
  for (const r of g.rows) {
    ok(Number.isFinite(r.x), `${r.id}: x NaN`);
    ok(Number.isFinite(r.w), `${r.id}: w NaN`);
    eq(r.w, 0, `${r.id}: sıfır değer sıfır genişlik olmalı — `);
    eq(r.dir, 'flat', `${r.id}: yön `);
  }
});

// Tek gözlem, geometrinin en kırılgan hâli: `barDomain` uçları sıfıra
// KARŞI almazsa min ile max eşitlenir, "hepsi sıfır" dalına düşülür ve tek
// çubuk alanın çok dışına ışınlanır (ölçüldü: −27,3 için x = −1315).
// Bu yüzden burada `w > 0` YETMEZ — sınır denetimi şart.
check('çubuk: tek gözlem alanın içinde çizilir', () => {
  for (const value of [-27.3, 0.06, 18.4]) {
    const g = barPlot([{ id: 'a', label: 'A', value }]);
    eq(g.rows.length, 1, `${value} için satır sayısı: `);
    const r = g.rows[0];
    ok(r.w > 0, `${value}: tek çubuk sıfır genişlikte kalmamalı`);
    ok(Number.isFinite(g.zero), `${value}: zero sayı olmalı`);
    ok(r.x >= -EPS, `${value}: sol kenardan taştı (x=${r.x})`);
    ok(r.x + r.w <= BAR_W + EPS, `${value}: sağ kenardan taştı (sağ=${r.x + r.w})`);
    // Tek gözlemde sıfır DAİMA bir kenardadır: pozitifse solda, negatifse sağda.
    const kenar = value > 0 ? 0 : BAR_W;
    ok(Math.abs(g.zero - kenar) < EPS, `${value}: zero ${g.zero}, ${kenar} olmalı`);
  }
});

// Payın HANGİ YÖNE eklendiğini sabitler. Bu test olmasaydı hem `Math.min(0,…)`
// hem de yanındaki üçlü işleç aynı değişmezi savunduğu için ikisinden birini
// silmek hiçbir testi düşürmezdi — yani biri ölü kod sanılıp atılabilirdi.
check('çubuk alanı: pay yalnızca veri yönüne eklenir, sıfır kenarda kalır', () => {
  // Hepsi negatif: üst sınır TAM sıfır. Aralık sıfıra karşı ölçülür
  // (0 − (−9) = 9), veri uçları arasında değil (−3 − (−9) = 6).
  const neg = barDomain([-3, -9]);
  eq(neg.hi, 0, 'negatif kümede üst sınır tam sıfır olmalı: ');
  ok(
    Math.abs(neg.lo - (-9 - 9 * BAR_PAD)) < 1e-9,
    `alt sınır ${neg.lo}, ${-9 - 9 * BAR_PAD} olmalı`,
  );

  // Hepsi pozitif: alt sınır TAM sıfır, aralık yine sıfıra karşı (9 − 0 = 9).
  const poz = barDomain([3, 9]);
  eq(poz.lo, 0, 'pozitif kümede alt sınır tam sıfır olmalı: ');
  ok(
    Math.abs(poz.hi - (9 + 9 * BAR_PAD)) < 1e-9,
    `üst sınır ${poz.hi}, ${9 + 9 * BAR_PAD} olmalı`,
  );
});

// ASIL TEST: uzunluk büyüklükle ORANTILI olmalı. Taban sıfırdan kaydığı an
// bu oran bozulur — grafiğin tek yalan söyleme biçimi budur.
check('çubuk: uzunluk büyüklükle orantılıdır (taban sıfırda)', () => {
  const g = barPlot([
    { id: 'a', label: 'A', value: 10 },
    { id: 'b', label: 'B', value: 20 },
    { id: 'c', label: 'C', value: -5 },
  ]);
  const w = Object.fromEntries(g.rows.map((r) => [r.id, r.w]));
  ok(Math.abs(w.b / w.a - 2) < 1e-9, `iki katı değer iki katı uzunluk olmalı, oran ${w.b / w.a}`);
  ok(Math.abs(w.a / w.c - 2) < 1e-9, `|10| / |−5| = 2 olmalı, oran ${w.a / w.c}`);
});

check('çubuk: her çubuk taban çizgisine DEĞER', () => {
  const g = barPlot([
    { id: 'a', label: 'A', value: 18.4 },
    { id: 'b', label: 'B', value: -27.3 },
    { id: 'c', label: 'C', value: 0 },
  ]);
  for (const r of g.rows) {
    const baslangic = Math.abs(r.x - g.zero) < EPS;
    const bitis = Math.abs(r.x + r.w - g.zero) < EPS;
    ok(baslangic || bitis, `${r.id}: çubuk sıfırdan başlamıyor (x=${r.x}, w=${r.w}, zero=${g.zero})`);
  }
});

check('çubuk: yön işareti değerin işaretidir', () => {
  const g = barPlot([
    { id: 'p', label: 'P', value: 1.2 },
    { id: 'n', label: 'N', value: -1.2 },
    { id: 'z', label: 'Z', value: 0 },
  ]);
  eq(g.rows.map((r) => r.dir), ['up', 'down', 'flat']);
});

check('çubuk: hepsi pozitifse sıfır sol kenarda, hepsi negatifse sağ kenarda', () => {
  const poz = barPlot([
    { id: 'a', label: 'A', value: 3 },
    { id: 'b', label: 'B', value: 9 },
  ]);
  ok(Math.abs(poz.zero - 0) < EPS, `hepsi pozitif: zero ${poz.zero}, 0 olmalı`);

  const neg = barPlot([
    { id: 'a', label: 'A', value: -3 },
    { id: 'b', label: 'B', value: -9 },
  ]);
  ok(Math.abs(neg.zero - BAR_W) < EPS, `hepsi negatif: zero ${neg.zero}, ${BAR_W} olmalı`);
});

check('çubuk: çubuklar alanın dışına taşmaz', () => {
  const g = barPlot([
    { id: 'a', label: 'A', value: 41.7 },
    { id: 'b', label: 'B', value: -38.2 },
  ]);
  for (const r of g.rows) {
    ok(r.x >= -EPS, `${r.id}: sol kenardan taştı (x=${r.x})`);
    ok(r.x + r.w <= BAR_W + EPS, `${r.id}: sağ kenardan taştı (sağ=${r.x + r.w})`);
  }
});

check('çubuk alanı: sıfır her zaman sınırların içindedir', () => {
  const kumeler = [[5, 9], [-5, -9], [-4, 7], [0, 0], [0.06], [-27.3]];
  for (const values of kumeler) {
    const { lo, hi } = barDomain(values);
    ok(lo <= 0 && hi >= 0, `${JSON.stringify(values)} → [${lo}, ${hi}] sıfırı içermiyor`);
    ok(hi > lo, `${JSON.stringify(values)} → alan sıfır genişlikte`);
  }
});

// pp (yüzde PUANI) ile pct (yüzde) aynı eksene KONAMAZ. Bu kapı olmasaydı
// mortgage faizinin +0,06 PUANLIK farkı, stokun %−20,36'sıyla aynı birimmiş
// gibi yan yana çizilirdi.
check('çubuk: pp ile pct aynı eksene giremez', () => {
  const entries = [
    { id: 'zhvi-all', change: { value: -2.23, kind: 'pct' } },
    { id: 'mortgage-30y', change: { value: 0.06, kind: 'pp' } },
    { id: 'zillow-price-cut', change: { value: -3.74, kind: 'pp' } },
    { id: 'zori', change: { value: 1.15, kind: 'pct' } },
    { id: 'yok', change: null },
  ];
  eq(comparableChanges(entries, 'pct').map((e) => e.id), ['zhvi-all', 'zori']);
  eq(comparableChanges(entries, 'pp').map((e) => e.id), ['mortgage-30y', 'zillow-price-cut']);
});

check('çubuk: sayı olmayan değişim seçilmez', () => {
  const entries = [
    { id: 'iyi', change: { value: -1.5, kind: 'pct' } },
    { id: 'nan', change: { value: NaN, kind: 'pct' } },
    { id: 'inf', change: { value: Infinity, kind: 'pct' } },
  ];
  eq(comparableChanges(entries, 'pct').map((e) => e.id), ['iyi']);
});

// Grafiğin yanındaki CÜMLE de bir veri iddiasıdır. Hepsi negatif bir kümede
// en büyük değere "en çok artan" demek, artmayan bir göstergeyi artmış gibi
// yazar — bir kez oldu: −%2,88 "en çok artan" olarak yayımlandı.
check('çubuk özeti: sıfat değerin İŞARETİNE bakar, sıradaki yerine değil', () => {
  // Hepsi negatif: en büyük değer artmış değil, EN AZ gerilemiştir.
  eq(superlative(-27.3, 'low'), 'en çok gerileyen');
  eq(superlative(-2.88, 'high'), 'en az gerileyen');

  // Hepsi pozitif: en küçük değer gerilemiş değil, EN AZ artmıştır.
  eq(superlative(0.35, 'low'), 'en az artan');
  eq(superlative(18.4, 'high'), 'en çok artan');

  // Karışık işaret: iki uç da kendi yönünü alır.
  eq(superlative(-13.2, 'low'), 'en çok gerileyen');
  eq(superlative(1.15, 'high'), 'en çok artan');

  // Sıfır hiçbir yöne yazılmaz.
  eq(superlative(0, 'low'), 'değişmeyen');
  eq(superlative(0, 'high'), 'değişmeyen');
});

check('çubuk: MIN_BARS eşiği tek kaynakta ve anlamlı', () => {
  ok(MIN_BARS >= 2, `MIN_BARS ${MIN_BARS} — tek çubuk karşılaştırma değildir`);
});

// Yayındaki gerçek veriyle: endeks sayfasındaki karşılaştırma grafiği
// gerçekten çizilebiliyor mu, ve içine pp sızıyor mu?
check('çubuk: yayındaki anlık görüntü karşılaştırılabilir çubuk üretir', () => {
  const pointer = JSON.parse(readFileSync(path.join(ROOT, 'src/content/index/latest.json'), 'utf8'));
  const snap = JSON.parse(
    readFileSync(path.join(ROOT, `src/content/index/${pointer.period}.json`), 'utf8'),
  );

  const entries = snap.metrics
    .filter((m) => !m.national)
    .map((m) => ({ id: m.id, label: m.short ?? m.label, change: m.yoy }));
  const secilen = comparableChanges(entries, 'pct');

  ok(secilen.length >= 2, `karşılaştırma için en az 2 metrik gerekir, ${secilen.length} bulundu`);
  for (const e of secilen) {
    ok(e.change.kind === 'pct', `${e.id}: pct olmayan değişim seçildi (${e.change.kind})`);
  }

  const g = barPlot(secilen.map((e) => ({ id: e.id, label: e.label, value: e.change.value })));
  eq(g.rows.length, secilen.length, 'satır sayısı: ');
  for (const r of g.rows) {
    ok(Number.isFinite(r.x) && Number.isFinite(r.w), `${r.id}: geometri NaN`);
    ok(r.x >= -EPS && r.x + r.w <= BAR_W + EPS, `${r.id}: alan dışına taştı`);
  }
});


// ── Sonuç ────────────────────────────────────────────────────────────────

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} test kaldı (${passed} geçti):\n`);
  for (const f of failures) console.error(`  · ${f.name}\n      ${f.message}`);
  process.exit(1);
}

console.log(`✓ ${passed} test geçti — ayrıştırma, hesaplama, sayı/dil kapısı, yayındaki içerik.`);
