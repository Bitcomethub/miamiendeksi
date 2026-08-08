// ─────────────────────────────────────────────────────────────────────────
// Seriden metriğe: son gözlem, aylık ve yıllık değişim
//
// İKİ TUZAK bu dosyanın tasarımını belirledi:
//
// 1) YÜZDE BİRİMLİ METRİKTE "yüzde değişim" YANLIŞTIR.
//    Mortgage faizi %6,50'den %6,69'a çıktığında değişim +0,19 YÜZDE PUANDIR,
//    "+%2,9" değil. İkisini karıştırmak finans metninde klasik hatadır ve
//    okuyucuyu yanıltır. Bu yüzden her değişim `kind` taşır: 'pp' | 'pct'.
//
// 2) KARŞILAŞTIRMA NOKTASI İNDEKSLE DEĞİL TARİHLE BULUNUR.
//    MORTGAGE30US haftalık, geri kalan her şey aylık. "12 gözlem geriye git"
//    biri için 12 hafta, öteki için 12 aydır. Takvim tarihi hedeflenir,
//    ona en yakın gözlem seçilir.
// ─────────────────────────────────────────────────────────────────────────

/**
 * ISO tarihi (YYYY-MM-DD) gün sayısına çevirir. Saat dilimi YOK — string
 * aritmetiği; Vercel/GitHub runner'ın UTC'si sonucu kaydıramaz.
 *
 * @param {string} iso
 * @returns {number} 1970-01-01'den beri gün
 */
export function isoToDays(iso) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/**
 * Bir ISO tarihten N ay geri gider. Ayın son gününü taşırmaz
 * (31 Mart − 1 ay = 28/29 Şubat, 3 Mart DEĞİL).
 *
 * @param {string} iso
 * @param {number} months
 * @returns {string} YYYY-MM-DD
 */
export function shiftMonths(iso, months) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const totalMonth = y * 12 + (m - 1) - months;
  const ny = Math.floor(totalMonth / 12);
  const nm = totalMonth - ny * 12;
  const lastDay = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  const nd = Math.min(d, lastDay);
  return `${String(ny).padStart(4, '0')}-${String(nm + 1).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
}

/**
 * Hedef tarihe EN YAKIN gözlemi bulur.
 *
 * `toleranceDays` hedeften bu kadar uzaktaki gözlemi reddeder: seri
 * ortasında boşluk varsa yanlış dönemle karşılaştırıp sahte bir değişim
 * yayınlamaktansa `null` dönmek doğrudur.
 *
 * @param {{date: string, value: number}[]} points  tarihe göre ARTAN sıralı
 * @param {string} targetIso
 * @param {number} toleranceDays
 */
export function findNearest(points, targetIso, toleranceDays) {
  const target = isoToDays(targetIso);
  let best = null;
  let bestDist = Infinity;

  for (const p of points) {
    const dist = Math.abs(isoToDays(p.date) - target);
    if (dist < bestDist) {
      bestDist = dist;
      best = p;
    }
  }

  if (!best || bestDist > toleranceDays) return null;
  return best;
}

/**
 * Değişim hesabı. Yüzde birimli metrikte YÜZDE PUAN farkı, diğerlerinde
 * yüzde değişim döner.
 *
 * @param {number} current
 * @param {number} previous
 * @param {string} unit
 * @returns {{ value: number, kind: 'pp' | 'pct' } | null}
 */
export function change(current, previous, unit) {
  if (previous === null || previous === undefined || current === null) return null;
  if (unit === 'pct') {
    return { value: round(current - previous, 2), kind: 'pp' };
  }
  if (previous === 0) return null;
  return { value: round(((current - previous) / previous) * 100, 2), kind: 'pct' };
}

/** @param {number} n @param {number} digits */
export function round(n, digits) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/**
 * Ham seriyi yayına hazır metriğe çevirir.
 *
 * Dönen nesnede `value` HER ZAMAN kaynaktaki sayıdır — yuvarlama yalnızca
 * gösterim katmanında yapılır. Ham değeri burada kırpmak, doğrulama
 * kapısının (guard.mjs) izin verdiği sayı kümesini bozar.
 *
 * @param {object} def      METRICS kaydı
 * @param {{date: string, value: number}[]} points
 */
export function buildMetric(def, points) {
  const clean = points
    .filter((p) => p && p.value !== null && Number.isFinite(p.value))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (clean.length === 0) return null;

  const latest = clean[clean.length - 1];

  // Haftalık seride "geçen ay" 4-5 hafta önce; aylıkta bir önceki gözlem.
  // Tolerans ikisini de kapsayacak kadar geniş, iki dönem atlamayı
  // engelleyecek kadar dar tutuldu.
  const momRef = findNearest(clean.slice(0, -1), shiftMonths(latest.date, 1), 20);
  const yoyRef = findNearest(clean, shiftMonths(latest.date, 12), 25);

  return {
    id: def.id,
    label: def.label,
    short: def.short,
    unit: def.unit,
    value: latest.value,
    asOf: latest.date,
    mom: momRef ? change(latest.value, momRef.value, def.unit) : null,
    momAsOf: momRef ? momRef.date : null,
    yoy: yoyRef ? change(latest.value, yoyRef.value, def.unit) : null,
    yoyAsOf: yoyRef ? yoyRef.date : null,
    publisher: def.publisher,
    dataset: def.dataset,
    note: def.note ?? null,
    featured: Boolean(def.featured),
    national: Boolean(def.national),
  };
}

/**
 * Grafik için son N gözlemi seyreltmeden döndürür.
 * @param {{date: string, value: number}[]} points
 * @param {number} limit
 */
export function tailSeries(points, limit) {
  return points
    .filter((p) => p && p.value !== null && Number.isFinite(p.value))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-limit)
    .map((p) => ({ date: p.date, value: round(p.value, 4) }));
}
