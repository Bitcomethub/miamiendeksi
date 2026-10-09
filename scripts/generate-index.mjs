#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
// Aylık yorum yazısı üretici.
//
// Sayfalardaki SAYILAR bu scriptten GELMEZ — onlar `fetch-data.mjs`'in
// yazdığı anlık görüntüden okunur. Buranın işi yalnızca o sayıların
// çevresine Türkçe yorum örmektir. Model hiçbir zaman "veri kaynağı"
// değildir; kendisine verilen FACTS bloğunun dışındaki her sayı
// uydurmadır ve kapıda ölür.
//
// AKIŞ: anlık görüntü → FACTS → model → sayı kapısı + dil kapısı +
//       yapı kontrolü → (1 düzeltme turu) → articles.json
//
// BAŞARISIZLIKTA YAZMAZ. Reddedilen taslak `.needs-review/` altına
// bırakılır ve script kırmızı düşer. Yayında yorum olmaması, yanlış
// sayı olmasından iyidir.
//
// Kullanım:
//   node scripts/generate-index.mjs                 # gerçek çağrı
//   node scripts/generate-index.mjs --mock --dry-run  # ağsız hat testi
//   node scripts/generate-index.mjs --period 2026-08
// ─────────────────────────────────────────────────────────────────────────

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { hasFlag, readPeriodOrExit } from './lib/args.mjs';
import { verifyNumbers, verifyLanguage } from './lib/guard.mjs';
import { MIN_BARS } from '../src/lib/chart-geom.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INDEX_DIR = path.join(ROOT, 'src/content/index');
const ARTICLES_FILE = path.join(ROOT, 'src/content/articles/articles.json');
const REVIEW_DIR = path.join(ROOT, '.needs-review');

const args = process.argv.slice(2);
const MOCK = hasFlag(args, 'mock');
const DRY_RUN = hasFlag(args, 'dry-run');
const PERIOD_ARG = readPeriodOrExit(args);

// Modeli brief SABİTLEDİ. Değiştirmeden önce bu satırı okuyan kişiye:
// Gemini 3.x bu projede kullanılmaz (kurucunun açık talimatı).
const MODEL = 'claude-sonnet-5-5';
const ENDPOINT = 'https://api.anthropic.com/v1/chat/completions';

// ── Biçimlendirme ────────────────────────────────────────────────────────
// FACTS bloğu sayıları TÜRKÇE biçimde verir (binlik `.`, ondalık `,`).
// Nedeni pratiktir: model gördüğü diziyi olduğu gibi kopyalar; İngilizce
// biçimde verilirse kopyaladığı `476,598` metinde 476,598 (yani ~477)
// olarak okunur ve kapı haklı olarak reddeder.

const nf = (digits) =>
  new Intl.NumberFormat('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

function fmtValue(value, unit) {
  if (unit === 'usd') return `${nf(0).format(Math.round(value))} dolar`;
  if (unit === 'pct') return `%${nf(2).format(value)}`;
  if (unit === 'days') return `${nf(0).format(Math.round(value))} gün`;
  if (unit === 'ratio') return nf(2).format(value);
  return nf(0).format(Math.round(value));
}

function fmtChange(change) {
  if (!change) return 'yok (karşılaştırılabilir gözlem bulunamadı)';
  const dir = change.value > 0 ? 'artış' : change.value < 0 ? 'düşüş' : 'değişim yok';
  const abs = nf(2).format(Math.abs(change.value));
  return change.kind === 'pp' ? `${abs} puan ${dir}` : `%${abs} ${dir}`;
}

const AY = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

function fmtMonth(iso) {
  const [y, m] = iso.split('-');
  return `${AY[Number(m) - 1]} ${y}`;
}

// ── FACTS ────────────────────────────────────────────────────────────────

function buildFacts(snap) {
  const pubName = (id) => snap.publishers.find((p) => p.id === id)?.name ?? id;
  const lines = [];

  lines.push(`DÖNEM: ${fmtMonth(`${snap.period}-01`)}`);
  lines.push(`COĞRAFYA: ${snap.geography}`);
  lines.push(`VERİ ÇEKİM TARİHİ: ${snap.fetchedAt}`);
  lines.push('');
  lines.push('GÖSTERGELER:');

  for (const m of snap.metrics) {
    lines.push(
      [
        `- id: ${m.id}`,
        `  ad: ${m.label}`,
        `  değer: ${fmtValue(m.value, m.unit)}`,
        `  gözlem ayı: ${fmtMonth(m.asOf)}`,
        `  aylık: ${fmtChange(m.mom)}`,
        `  yıllık: ${fmtChange(m.yoy)}`,
        `  kaynak: ${pubName(m.publisher)} — ${m.dataset}`,
        m.national ? '  kapsam: ABD GENELİ (Miami değil — metinde bunu belirt)' : null,
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }

  if (snap.derived.length > 0) {
    lines.push('');
    lines.push('TÜRETİLMİŞ (bizim hesabımız, yayıncı verisi değil):');
    for (const d of snap.derived) {
      lines.push(
        `- id: ${d.id}\n  ad: ${d.label}\n  değer: ${fmtValue(d.value, d.unit)}\n  formül: ${d.formula}\n  gözlem ayı: ${fmtMonth(d.asOf)}`,
      );
    }
  }

  if (snap.warnings.length > 0) {
    lines.push('');
    lines.push('BU AY ÇEKİLEMEYEN GÖSTERGELER (haklarında TEK KELİME yazma):');
    for (const w of snap.warnings) lines.push(`- ${w.metric}: ${w.reason}`);
  }

  return lines.join('\n');
}

// ── İstem ────────────────────────────────────────────────────────────────

const SYSTEM = `Sen Türk yatırımcılar için Miami konut piyasası verisi yayınlayan
bağımsız bir veri yayınının editörüsün. Türkçe yazıyorsun.

MUTLAK KURALLAR — ihlal eden çıktı tamamen atılır:

1. SAYI: Metindeki HER sayı, sana verilen FACTS bloğundan gelmek zorunda.
   FACTS'te olmayan hiçbir rakamı yazamazsın — ne tahmin, ne hatırladığın
   bir değer, ne "yaklaşık" bir sayı. Sayıları FACTS'teki biçimde, birebir
   kopyalayarak yaz (binlik ayracı nokta, ondalık ayracı virgül).
   Yuvarlama serbesttir ("476.598 dolar" yerine "yaklaşık 477 bin dolar"),
   ama uydurma hassasiyet yasaktır.
2. YÖN: Bir düşüşü anlatırken sayıyı pozitif yaz, yönü kelimeyle ver:
   "yıllık %2,23 geriledi". Eksi işaretli sayı yazma.
3. PUAN vs YÜZDE: Yüzde birimli bir göstergenin değişimi PUAN'dır
   ("0,20 puan yükseldi"), yüzde değildir. FACTS hangisi olduğunu söylüyor.
4. GELECEK: Fiyat/faiz tahmini yapma. "Yükselecek", "beklenmektedir",
   "önümüzdeki ay" gibi ileri dönük iddia kurma. Yalnızca GERÇEKLEŞMİŞ
   veriyi anlat.
5. TAVSİYE: Yatırım tavsiyesi verme. "Almalısınız", "fırsat", "kaçırmayın",
   "riski yok", "garanti" yasak.
6. KAYNAKSIZ OTORİTE: "Uzmanlara göre", "piyasa çevreleri", "analistler"
   gibi isimsiz otorite uydurma. Tek otoriten FACTS'teki yayıncılardır.
7. KAPSAM: Bir gösterge ABD geneliyse (FACTS söyler), onu Miami rakamı
   gibi sunma — açıkça ABD geneli olduğunu yaz.
8. Çekilemeyen göstergeler hakkında yazma; yokluklarını da tartışma.

ÜSLUP: Serin, kanıta dayalı, satış dili yok. Kısa cümleler. Okur, Miami'de
konut alıp almamayı düşünen Türk yatırımcı; emlak jargonunu bilmiyor,
sayıyı ciddiye alıyor. Neyi bilemeyeceğimizi de söyle.`;

function userPrompt(facts, feedback) {
  const base = `Aşağıdaki FACTS bloğuna dayanarak bu ayın analiz yazısını üret.

<FACTS>
${facts}
</FACTS>

İSTENEN YAPI:
- title: Bu ayın en dikkat çekici GERÇEKLEŞMİŞ hareketini anlatan başlık.
- excerpt: Tek cümlelik özet.
- answer: 120-220 kelimelik "answer-first" paragraf — başlıktaki soruyu
  ilk paragrafta tam sayılarla cevapla. AI arama motorları alıntıyı
  buradan alacak, tek başına okunduğunda anlamlı olmalı.
- blocks: 6-10 blok. "h2" (ara başlık), "p" (paragraf), "list" (madde
  listesi), "chart" (FACTS'teki bir id ile çizgi grafiği), "bars" (birden
  çok göstergenin değişimini yan yana koyan karşılaştırma çubuğu),
  "caveat" (metodolojik çekince) tiplerini karışık kullan. En az 1 chart
  ve en az 1 caveat bulunsun. chart bloğunun metricId'si FACTS'teki bir id
  ile BİREBİR aynı olmalı.
  "bars" bloğu: metricIds alanına FACTS'ten EN AZ 3 id yaz, hepsi yazının
  konusuyla ilgili olsun. Bu bloğa SAYI YAZMAZSIN — değerler veriden
  okunur. DİKKAT: yüzde PUANI ile ölçülen göstergeler (yıllık/aylık
  değişimi "puan" olan satırlar, ör. faiz ve oran metrikleri) bu bloğa
  ALINMAZ, çizilmezler; en az 3 id'nin yüzde değişimli olması gerekir.
- faqs: 4-6 soru-cevap. Sorular Türk yatırımcının gerçekten arattığı
  biçimde ("Miami'de konut fiyatları düşüyor mu?"). Cevaplar 2-4 cümle.
- keywords: 4-6 Türkçe arama terimi.
- slug: Türkçe karaktersiz, tireli, kısa (ör. "kira-getirisi-ve-faiz").`;

  if (!feedback) return base;

  return `${base}

────────────────────────────────────────────────────────
ÖNCEKİ DENEMEN REDDEDİLDİ. Doğrulama kapısı şunları yakaladı:

${feedback}

Bu ihlalleri düzelt. Reddedilen sayıları FACTS'teki gerçek değerlerle
değiştir ya da o cümleyi tamamen çıkar. Sayıyı "yaklaşık" diyerek
kurtarmaya çalışma — FACTS'te yoksa cümle gider.`;
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['slug', 'title', 'excerpt', 'answer', 'keywords', 'blocks', 'faqs'],
  properties: {
    slug: { type: 'string' },
    title: { type: 'string' },
    excerpt: { type: 'string' },
    answer: { type: 'string' },
    keywords: { type: 'array', items: { type: 'string' } },
    blocks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type'],
        properties: {
          type: { type: 'string', enum: ['h2', 'p', 'list', 'chart', 'bars', 'caveat'] },
          text: { type: 'string' },
          items: { type: 'array', items: { type: 'string' } },
          metricId: { type: 'string' },
          metricIds: { type: 'array', items: { type: 'string' } },
          compare: { type: 'string', enum: ['yoy', 'mom'] },
          accent: { type: 'string', enum: ['cyan', 'magenta'] },
        },
      },
    },
    faqs: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['q', 'a'],
        properties: { q: { type: 'string' }, a: { type: 'string' } },
      },
    },
  },
};

// ── Model çağrısı ────────────────────────────────────────────────────────

async function callModel(facts, feedback) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      'ANTHROPIC_API_KEY tanımlı değil. Ağsız hat testi için: npm run index:dry',
    );
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userPrompt(facts, feedback) },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'analiz_yazisi', strict: true, schema: SCHEMA },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic ${res.status}: ${body.slice(0, 400)}`);
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('Model boş içerik döndürdü.');

  return JSON.parse(content);
}

/**
 * Ağsız taklit: yazıyı anlık görüntünün KENDİSİNDEN kurar.
 *
 * Sabit bir fixture yerine bunu tercih ettim, çünkü sabit fixture bir gün
 * veriyle uyuşmaz hâle gelir ve `index:dry` ya sahte biçimde kırmızı düşer
 * ya da (daha kötüsü) kapıyı gerçekten sınamadan yeşil kalır. Buradaki
 * taklit, gerçek sayılarla gerçek kapıdan geçer.
 */
function mockDraft(snap) {
  const pick = snap.metrics.slice(0, 4);
  const [m, b, c, d] = [pick[0], pick[1] ?? pick[0], pick[2] ?? pick[0], pick[3] ?? pick[0]];

  // `bars` bloğu için YÜZDE DEĞİŞİMLİ göstergeler — sabit bir id listesi
  // yazmıyorum, çünkü o liste bir gün veriyle uyuşmaz hâle gelir ve
  // `index:dry` kapıyı gerçekten sınamadan yeşil kalır (bu dosyanın taklit
  // gerekçesiyle aynı sebep). `pp` ölçülenler burada da kendiliğinden
  // dışarıda kalır — kapının eleme dalı böylece gerçekten koşulur.
  const karsilastirilabilir = snap.metrics
    .filter((x) => !x.national && x.yoy && x.yoy.kind === 'pct')
    .slice(0, 4)
    .map((x) => x.id);
  const say = (x) => `${x.label.toLowerCase()} ${fmtValue(x.value, x.unit)}`;

  return {
    slug: `taklit-${snap.period}`,
    title: `${m.label} ${fmtMonth(m.asOf)} itibarıyla ${fmtValue(m.value, m.unit)}`,
    excerpt: `${fmtMonth(m.asOf)} gözlemine göre ${say(m)} seviyesinde.`,
    answer:
      `${snap.geography} için ${say(m)} olarak kaydedildi; bu, ${fmtMonth(m.asOf)} gözlemidir ` +
      `ve yıllık ${fmtChange(m.yoy)}, aylık ${fmtChange(m.mom)} anlamına geliyor. ` +
      `Aynı anlık görüntüde ${say(b)}, ${say(c)} ve ${say(d)} seviyesinde bulunuyor. ` +
      `Bu dört gösterge farklı kurumlarca, farklı yöntemlerle ve farklı gecikmelerle ` +
      `yayımlanıyor; seviyeleri birbirini tutmadığında bunun nedeni ölçüm hatası değil, ` +
      `tanım farkıdır. Bu metin ağsız hat testi için kodla üretildi ve yalnızca ` +
      `doğrulama kapılarının çalıştığını göstermek için vardır; yayına giren aylık yorum ` +
      `modelden gelir ve tam olarak aynı sayı, dil ve yapı kapılarından geçer. ` +
      `Kapıdan geçemeyen yorum yayımlanmaz, aylık endeks sayfası ise yorumdan bağımsız ` +
      `olarak doğrudan veriden üretilir.`,
    keywords: ['Miami konut fiyatları', 'Miami emlak verisi'],
    blocks: [
      { type: 'h2', text: 'Bu ayın gözlemi' },
      { type: 'p', text: `${m.label}: ${fmtValue(m.value, m.unit)} (${fmtMonth(m.asOf)}).` },
      { type: 'chart', metricId: m.id, accent: 'cyan' },
      ...(karsilastirilabilir.length >= 2
        ? [{ type: 'bars', metricIds: karsilastirilabilir, compare: 'yoy' }]
        : []),
      { type: 'h2', text: 'Diğer göstergeler' },
      { type: 'list', items: [say(b), say(c), say(d)] },
      { type: 'p', text: `${b.label} verisi ${b.dataset} veri setinden geliyor.` },
      { type: 'caveat', text: 'Bu taklit metin yalnızca hattı sınamak içindir.' },
    ],
    faqs: [
      { q: 'Bu sayı hangi aya ait?', a: `Gözlem ayı ${fmtMonth(m.asOf)}.` },
      { q: 'Kaynak nedir?', a: `${m.dataset} veri seti.` },
      { q: 'Veri ne zaman çekildi?', a: `Çekim tarihi ${snap.fetchedAt}.` },
      { q: 'Bu bir tavsiye mi?', a: 'Hayır, bu içerik yatırım tavsiyesi değildir.' },
    ],
  };
}

// ── Doğrulama ────────────────────────────────────────────────────────────

function draftText(d) {
  const parts = [d.title, d.excerpt, d.answer];
  for (const b of d.blocks ?? []) {
    if (typeof b.text === 'string') parts.push(b.text);
    if (Array.isArray(b.items)) parts.push(...b.items);
  }
  for (const f of d.faqs ?? []) parts.push(f.q, f.a);
  return parts.join('\n');
}

/** Şemanın yakalayamadığı yapısal koşullar. */
function checkStructure(d, snap, existingSlugs) {
  const problems = [];
  const ids = new Set([...snap.metrics.map((m) => m.id), ...snap.derived.map((x) => x.id)]);

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(d.slug ?? '')) {
    problems.push(`slug biçimi geçersiz: "${d.slug}" (küçük harf ve tire)`);
  }
  if (existingSlugs.has(d.slug)) {
    problems.push(`slug zaten kullanılıyor: "${d.slug}"`);
  }

  const words = (d.answer ?? '').trim().split(/\s+/).length;
  if (words < 90) problems.push(`answer çok kısa (${words} kelime, en az 90)`);

  if ((d.blocks?.length ?? 0) < 5) problems.push('en az 5 blok gerekir');
  if ((d.faqs?.length ?? 0) < 4) problems.push('en az 4 SSS gerekir');

  for (const b of d.blocks ?? []) {
    if (b.type === 'chart') {
      // Var olmayan bir metrik id'si, sayfada SESSİZCE grafiksiz bir boşluk
      // bırakır — kapıdan geçmesine izin verilmez.
      if (!ids.has(b.metricId)) problems.push(`bilinmeyen chart metricId: "${b.metricId}"`);
    } else if (b.type === 'bars') {
      const list = Array.isArray(b.metricIds) ? b.metricIds : [];
      if (list.length < MIN_BARS) {
        problems.push(`bars bloğu en az ${MIN_BARS} metricId ister (${list.length} geldi)`);
      }
      for (const id of list) {
        if (!ids.has(id)) problems.push(`bilinmeyen bars metricId: "${id}"`);
      }
      // Şema id'lerin VARLIĞINI doğrular, ÇİZİLEBİLİRLİĞİNİ değil: `pp`
      // ölçülen satırlar aynı eksene giremediği için elenir ve blok 2'nin
      // altına düşerse sayfada hiç görünmez. Sessiz kayıp = kırmızı kapı.
      const alan = b.compare === 'mom' ? 'mom' : 'yoy';
      const cizilebilir = list.filter((id) => {
        const m = snap.metrics.find((x) => x.id === id);
        return m && m[alan] && m[alan].kind === 'pct';
      });
      if (list.length >= MIN_BARS && cizilebilir.length < MIN_BARS) {
        problems.push(
          `bars bloğu ${alan} için yalnızca ${cizilebilir.length} karşılaştırılabilir ` +
            `gösterge bırakıyor (yüzde PUANI ölçülenler çizilemez)`,
        );
      }
    } else if (b.type === 'list') {
      if (!Array.isArray(b.items) || b.items.length === 0) problems.push('boş list bloğu');
    } else if (!b.text || b.text.trim().length === 0) {
      problems.push(`boş ${b.type} bloğu`);
    }
  }

  if (!(d.blocks ?? []).some((b) => b.type === 'chart')) problems.push('en az 1 grafik gerekir');
  if (!(d.blocks ?? []).some((b) => b.type === 'caveat')) problems.push('en az 1 çekince gerekir');

  return problems;
}

function validate(d, snap, existingSlugs) {
  const problems = checkStructure(d, snap, existingSlugs);
  const text = draftText(d);

  const nums = verifyNumbers(text, snap);
  for (const v of nums.violations) {
    problems.push(`veride olmayan sayı: "${v.raw}" — bağlam: …${v.context}…`);
  }

  const lang = verifyLanguage(text);
  for (const v of lang.violations) {
    problems.push(`yasak dil (${v.id}): "${v.match}"`);
  }

  return problems;
}

// ── Ana akış ─────────────────────────────────────────────────────────────

async function main() {
  const period =
    PERIOD_ARG ?? JSON.parse(readFileSync(path.join(INDEX_DIR, 'latest.json'), 'utf8')).period;

  const snapFile = path.join(INDEX_DIR, `${period}.json`);
  if (!existsSync(snapFile)) {
    console.error(`✗ ${period} için anlık görüntü yok. Önce: npm run data:fetch`);
    process.exit(1);
  }

  const snap = JSON.parse(readFileSync(snapFile, 'utf8'));
  const articles = JSON.parse(readFileSync(ARTICLES_FILE, 'utf8'));
  const existingSlugs = new Set(articles.map((a) => a.slug));

  console.log(`▸ Dönem ${period} · ${snap.metrics.length} gösterge · model ${MOCK ? 'TAKLİT' : MODEL}`);

  const facts = buildFacts(snap);
  let draft = null;
  let problems = [];

  // İki tur: ilk deneme + kapının gerekçeleri geri beslenerek bir düzeltme.
  // Üçüncü tur eklenmedi; iki turda düzelmeyen çıktı genellikle FACTS'in
  // desteklemediği bir iddiaya yapışmıştır ve daha çok tur, kapıyı
  // aşındırmaktan başka işe yaramaz.
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const feedback = problems.length > 0 ? problems.map((p) => `- ${p}`).join('\n') : null;

    draft = MOCK ? mockDraft(snap) : await callModel(facts, feedback);
    problems = validate(draft, snap, existingSlugs);

    if (problems.length === 0) {
      console.log(`✓ ${attempt}. denemede kapıdan geçti: "${draft.title}"`);
      break;
    }

    console.log(`\n✗ ${attempt}. deneme reddedildi (${problems.length} ihlal):`);
    for (const p of problems) console.log(`   · ${p}`);
  }

  if (problems.length > 0) {
    mkdirSync(REVIEW_DIR, { recursive: true });
    const reviewFile = path.join(REVIEW_DIR, `${period}.json`);
    writeFileSync(
      reviewFile,
      `${JSON.stringify({ period, model: MODEL, problems, draft }, null, 2)}\n`,
    );
    console.error(`\n✗ İki tur da kapıdan geçemedi. YAZILMADI.`);
    console.error(`  Reddedilen taslak: ${path.relative(ROOT, reviewFile)}`);
    console.error('  Aylık endeks sayfası etkilenmez — o sayfa veriden üretilir, modelden değil.');
    process.exit(1);
  }

  const article = {
    slug: draft.slug,
    title: draft.title,
    excerpt: draft.excerpt,
    answer: draft.answer,
    publishedAt: snap.fetchedAt,
    period,
    keywords: draft.keywords,
    blocks: draft.blocks,
    faqs: draft.faqs,
  };

  if (DRY_RUN) {
    console.log('\n▸ --dry-run: dosya yazılmadı. Taslak özeti:');
    console.log(`   slug   : ${article.slug}`);
    console.log(`   başlık : ${article.title}`);
    console.log(`   blok   : ${article.blocks.length} · SSS: ${article.faqs.length}`);
    return;
  }

  // En yeni yazı başa: `/analiz` listesi ve ana sayfa bu sırayı kullanır.
  articles.unshift(article);
  writeFileSync(ARTICLES_FILE, `${JSON.stringify(articles, null, 2)}\n`);
  console.log(`\n✓ Eklendi: src/content/articles/articles.json → ${article.slug}`);
}

main().catch((err) => {
  console.error('\n✗ Üretim çöktü:', err.message);
  process.exit(1);
});
