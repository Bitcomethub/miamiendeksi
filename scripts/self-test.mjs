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

// ── Sonuç ────────────────────────────────────────────────────────────────

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} test kaldı (${passed} geçti):\n`);
  for (const f of failures) console.error(`  · ${f.name}\n      ${f.message}`);
  process.exit(1);
}

console.log(`✓ ${passed} test geçti — ayrıştırma, hesaplama, sayı/dil kapısı, yayındaki içerik.`);
