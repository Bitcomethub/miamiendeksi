// ─────────────────────────────────────────────────────────────────────────
// SAYI KAPISI — bu projenin varlık sebebi
//
// Sitenin tek vaadi: yayınlanan her sayı gerçek ve kaynaklı. Yorum metnini
// bir dil modeli yazıyorsa bu vaat SÖZLE korunamaz; modele "uydurma" demek
// yeterli değildir. Bu yüzden model çıktısındaki HER sayı, koddan gelen
// anlık görüntüye karşı programatik doğrulanır. Tek bir eşleşmeyen sayı →
// çıktının TAMAMI atılır (kısmi düzeltme YOK: modelin bir yerde uydurduğu
// metinde başka yerde de uydurduğu varsayılır).
//
// Kapı iki yönlü ayarlanmıştır:
//   - Fazla gevşek → uydurma istatistik yayına çıkar (kabul edilemez).
//   - Fazla sıkı  → model Türkçe cümle bile kuramaz ("üç kaynak", "12 aylık"
//                   veri gibi yapısal sayılar takılır) ve hat her ay
//                   needs_review'a düşer.
//
// Ayrım BAĞLAMSAL: birim işareti taşıyan (%, $, dolar, puan, bin, milyon)
// ya da 3+ basamaklı sayılar GERÇEK bir veri noktasıyla eşleşmek zorundadır.
// Çıplak küçük tam sayılar ve yıllar dil malzemesi sayılır.
// ─────────────────────────────────────────────────────────────────────────

/** Yapısal olarak serbest bırakılan çıplak tam sayılar (yıl hariç). */
const STRUCTURAL_MAX = 12;
const YEAR_MIN = 1990;
const YEAR_MAX = 2035;

/** Ölçek sözcükleri — sayının hemen ardından gelirse çarpan uygulanır. */
const SCALES = [
  { word: 'milyar', factor: 1e9 },
  { word: 'milyon', factor: 1e6 },
  { word: 'bin', factor: 1e3 },
];

/** Bu işaretlerden biri sayıya bitişikse, sayı VERİ sayılır ve doğrulanır. */
const UNIT_PATTERNS = [
  /^\s*%/, // sonda yüzde
  /^\s*(dolar|usd|\$)/i,
  /^\s*(puan|yüzde puan)/i,
  /^\s*(bin|milyon|milyar)/i,
  /^\s*(gün|adet|konut|daire|ilan)/i,
];

const PRE_UNIT_PATTERNS = [
  /(yüzde|%|\$)\s*$/i,
];

/**
 * Ay adı — ayın GÜNÜ için istisna.
 *
 * "30 Haziran 2026" cümlesindeki 30, yapısal eşiğin (12) üstündedir ve
 * birim işareti taşımaz; kapı onu kaynaksız bir veri iddiası sanıp metnin
 * tamamını atardı. Tarih bir dil öğesidir, istatistik değil — ardından ay
 * adı gelen 1–31 arası tam sayı serbesttir.
 */
const AY_ADI =
  /^\s*(Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık)\b/i;

/**
 * Kredi VADESİ — ürün adının parçası, piyasa istatistiği değil.
 *
 * "30 yıllık sabit mortgage faizi" ifadesindeki 30 bir ölçüm değil, ürünün
 * adıdır; hiçbir veri noktasıyla eşleşmez ve kapı metni atardı. Kalıp
 * bilinçli olarak DAR tutulmuştur: sayıdan sonra "yıllık" ve ardından
 * mortgage/kredi sözcüğü gelmek zorunda. Böylece bu istisnayla uydurma bir
 * piyasa rakamı kaçırılamaz.
 */
const VADE = /^\s*yıllık\s+(sabit\s+|değişken\s+)?(mortgage|kredi|konut kredisi)/i;

/**
 * Metindeki sayıları bağlamlarıyla çıkarır.
 *
 * Türkçe biçim esas alınır: binlik ayırıcı `.`, ondalık ayırıcı `,`
 * (512.345,67). İngilizce biçim (512345.67) de kabul edilir; `.` yalnızca
 * ardından TAM 3 basamak gelip devamında basamak yoksa binlik sayılır.
 *
 * @param {string} text
 */
export function extractNumbers(text) {
  const out = [];
  // Basamak grupları + opsiyonel ondalık kısım.
  const re = /\d[\d.,]*/g;
  let match;

  while ((match = re.exec(text)) !== null) {
    const raw = match[0].replace(/[.,]+$/, ''); // cümle sonu noktasını at
    if (raw === '') continue;

    const parsed = parseTurkishNumber(raw);
    if (parsed === null) continue;

    const before = text.slice(Math.max(0, match.index - 12), match.index);
    // Pencere 28 karakter: "30 yıllık sabit mortgage" kalıbının tamamı
    // sığmak zorunda. 14 karakterle "mortgage" sözcüğü kesiliyor ve vade
    // istisnası hiç devreye girmiyordu.
    const after = text.slice(match.index + raw.length, match.index + raw.length + 28);

    let scale = 1;
    for (const s of SCALES) {
      if (new RegExp(`^\\s*${s.word}`, 'i').test(after)) {
        scale = s.factor;
        break;
      }
    }

    const hasUnit =
      UNIT_PATTERNS.some((p) => p.test(after)) ||
      PRE_UNIT_PATTERNS.some((p) => p.test(before));

    out.push({
      raw,
      value: parsed.value,
      decimals: parsed.decimals,
      scale,
      effective: parsed.value * scale,
      hasUnit,
      before,
      after,
    });
  }

  return out;
}

/**
 * "512.345,67" → 512345.67 · "6,69" → 6.69 · "1.234" → 1234
 * @returns {{value: number, decimals: number} | null}
 */
export function parseTurkishNumber(raw) {
  if (!/\d/.test(raw)) return null;

  let intPart = raw;
  let decPart = '';

  const commaIdx = raw.lastIndexOf(',');
  if (commaIdx !== -1) {
    intPart = raw.slice(0, commaIdx);
    decPart = raw.slice(commaIdx + 1).replace(/\D/g, '');
  } else {
    // Virgül yok: son `.` ondalık olabilir — ancak ardından 3 basamak
    // gelmiyorsa. "1.234" Türkçe metinde bindir; "1.23" ondalıktır.
    const dotIdx = raw.lastIndexOf('.');
    if (dotIdx !== -1) {
      const tail = raw.slice(dotIdx + 1);
      if (/^\d{1,2}$/.test(tail)) {
        intPart = raw.slice(0, dotIdx);
        decPart = tail;
      }
    }
  }

  const digits = intPart.replace(/\D/g, '');
  if (digits === '' && decPart === '') return null;

  const value = Number(`${digits || '0'}.${decPart || '0'}`);
  if (!Number.isFinite(value)) return null;
  return { value, decimals: decPart.length };
}

/**
 * Anlık görüntüden izin verilen ham sayı kümesini kurar.
 *
 * Metrik değerleri, değişimler ve bunların mutlak değerleri girer
 * (metinde "%1,2 geriledi" yazılırken işaret sözcüğe taşınır, sayı pozitif
 * yazılır — mutlak değer olmadan her düşüş raporu kapıda takılırdı).
 *
 * @param {{metrics: any[], derived?: any[]}} snapshot
 * @returns {number[]}
 */
export function allowedValues(snapshot) {
  const vals = [];
  const push = (n) => {
    if (typeof n === 'number' && Number.isFinite(n)) {
      vals.push(n);
      vals.push(Math.abs(n));
    }
  };

  for (const m of [...(snapshot.metrics ?? []), ...(snapshot.derived ?? [])]) {
    push(m.value);
    if (m.mom) push(m.mom.value);
    if (m.yoy) push(m.yoy.value);
  }

  return [...new Set(vals)];
}

/**
 * Bir sayının izin verilenlerden birinin YUVARLANMIŞ hâli olup olmadığı.
 *
 * Tolerans, sayının kendi hassasiyetinden türetilir: "512 bin" yazan metin
 * 512.345'i kastediyor olabilir (yarım adım = 500), ama "512.900" yazan
 * metin kastedemez. Böylece hem doğal Türkçe yuvarlama serbest kalır hem
 * de uydurma kesin rakam geçemez.
 */
export function matchesAllowed(token, allowed) {
  const halfStep = 0.5 * 10 ** -token.decimals * token.scale;
  // Kayan nokta artığına karşı küçük pay.
  const tol = halfStep + Math.max(1e-9, Math.abs(token.effective) * 1e-9);

  return allowed.some((a) => Math.abs(a - token.effective) <= tol);
}

/**
 * Kapının kendisi.
 *
 * @param {string} text       doğrulanacak model çıktısı (düz metin)
 * @param {object} snapshot   veri anlık görüntüsü
 * @returns {{ok: boolean, violations: {raw: string, effective: number, context: string}[]}}
 */
export function verifyNumbers(text, snapshot) {
  const allowed = allowedValues(snapshot);
  const tokens = extractNumbers(text);
  const violations = [];

  for (const t of tokens) {
    const isYear =
      t.scale === 1 &&
      t.decimals === 0 &&
      t.value >= YEAR_MIN &&
      t.value <= YEAR_MAX &&
      !t.hasUnit;

    const isStructural =
      t.scale === 1 &&
      t.decimals === 0 &&
      t.value <= STRUCTURAL_MAX &&
      !t.hasUnit;

    // "30 Haziran 2026" → gün numarası tarihtir, veri iddiası değil.
    const isDayOfMonth =
      t.scale === 1 &&
      t.decimals === 0 &&
      t.value >= 1 &&
      t.value <= 31 &&
      AY_ADI.test(t.after);

    const isLoanTerm = t.scale === 1 && t.decimals === 0 && VADE.test(t.after);

    if (isYear || isStructural || isDayOfMonth || isLoanTerm) continue;

    if (!matchesAllowed(t, allowed)) {
      violations.push({
        raw: t.raw,
        effective: t.effective,
        context: `…${t.before}[${t.raw}]${t.after}…`,
      });
    }
  }

  return { ok: violations.length === 0, violations };
}

/**
 * Metin içi yasak kalıplar — sayı kapısının yakalayamadığı iddia türleri.
 *
 * Sayı doğrulaması "512.345" gibi bir uydurmayı yakalar; ama "uzmanlara
 * göre", "önümüzdeki ay yükselecek" gibi KAYNAKSIZ ya da GELECEĞE DÖNÜK
 * iddialar sayı içermeden de sitenin vaadini bozar. Bu site veri raporlar,
 * kehanet satmaz.
 */
export const FORBIDDEN_PATTERNS = [
  {
    id: 'tahmin',
    re: /\b(tahmin ediyoruz|öngörüyoruz|bekliyoruz ki|yükselecek|düşecek|artacak|azalacak|olacaktır)\b/i,
    why: 'Geleceğe dönük iddia. Bu site gerçekleşmiş veri raporlar, tahmin yayınlamaz.',
  },
  {
    id: 'kaynaksiz-otorite',
    re: /\b(uzmanlara göre|analistler|piyasa kaynakları|bilindiği üzere|herkesin bildiği)\b/i,
    why: 'Kaynaksız otorite atfı. İddia ya veriye dayanır ya yazılmaz.',
  },
  {
    id: 'yatirim-tavsiyesi',
    re: /\b(almalısınız|satmalısınız|kaçırmayın|fırsat kaçıyor|şimdi tam zamanı|yatırım tavsiyesi(?!\s+değildir))\b/i,
    why: 'Yatırım tavsiyesi dili. Site veri yayınlar, tavsiye vermez.',
  },
  {
    id: 'garanti',
    re: /\b(garanti|kesinlikle kazandırır|riski yok|kesin getiri)\b/i,
    why: 'Getiri garantisi ima ediliyor.',
  },
];

/**
 * @param {string} text
 * @returns {{ok: boolean, violations: {id: string, why: string, match: string}[]}}
 */
export function verifyLanguage(text) {
  const violations = [];
  for (const rule of FORBIDDEN_PATTERNS) {
    const m = text.match(rule.re);
    if (m) violations.push({ id: rule.id, why: rule.why, match: m[0] });
  }
  return { ok: violations.length === 0, violations };
}
