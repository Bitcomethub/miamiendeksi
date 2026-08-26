// ─────────────────────────────────────────────────────────────────────────
// Çubuk grafik geometrisi — SAF, bağımlılıksız, TİPSİZ (.mjs)
//
// NEDEN .mjs VE NEDEN src/ İÇİNDE:
//   `npm test` bir Node 20 script'idir; TypeScript'i çalıştıramaz (tip
//   sıyırma Node 22.6+ özelliği). `plot()` bu yüzden bugüne dek hiç birim
//   testi görmedi — yalnızca `check:layout` ve `check:palette --render`
//   kapılarıyla, yani ancak bir sunucu ayaktayken denetlendi.
//
//   Çubuk geometrisinin taşıdığı iddia (uzunluk = büyüklük) bir render
//   kapısının göremeyeceği kadar aritmetiktir: kesilmiş bir taban çizgisi
//   ekranda gayet normal görünür, yalnızca ORANLAR bozulur. Bu yüzden
//   geometri düz ESM olarak yazıldı ve hem `chart.ts` hem `self-test.mjs`
//   AYNI dosyayı içe aktarıyor. İki kopya olsaydı test, yayına giden koddan
//   başka bir şeyi doğrulardı.
//
// TABAN ÇİZGİSİ KURALI — `plot()` İLE TERS, VE BİLİNÇLİ:
//   `plot()` sıfırdan BAŞLAMAZ (bkz. `chart.ts` → `bounds()`): çizgi
//   grafiğinde değeri KONUM kodlar, ZHVI gibi sıfıra hiç yaklaşmayan bir
//   seride sıfır tabanlı eksen tüm hareketi bir şeride sıkıştırır.
//
//   Çubukta değeri UZUNLUK kodlar. Uzunluk oransaldır: iki katı uzun çubuk
//   "iki katı" demektir. Tabanı sıfırdan kaydırmak bu oranı bozar ve grafik
//   ekranda kusursuz görünürken yalan söyler. Bu yüzden sıfır DAİMA
//   eksendedir ve aşağıdaki `barDomain()` bunu yapısal olarak garanti eder:
//   sıfır, alan sınırlarının dışında kalamaz.
// ─────────────────────────────────────────────────────────────────────────

/**
 * @typedef {{ id: string, label: string, value: number }} BarItem
 * @typedef {'up' | 'down' | 'flat'} BarDir
 * @typedef {{ id: string, label: string, value: number, x: number, w: number, dir: BarDir }} BarRow
 * @typedef {{ rows: BarRow[], zero: number, lo: number, hi: number, width: number }} BarPlot
 */

/**
 * Çubuk alanının viewBox genişliği. 100 seçildi ki koordinatlar yüzde gibi
 * okunsun — bir satırın SVG'si `preserveAspectRatio="none"` ile esnetilir.
 */
export const BAR_W = 100;

/** En uzun çubuk kenara yapışmasın diye alanın ucuna eklenen pay. */
export const BAR_PAD = 0.06;

/**
 * Bir karşılaştırma çubuğunun çizilebilmesi için gereken en az satır sayısı.
 *
 * Tek çubuk bir KARŞILAŞTIRMA değildir: yanında kıyaslanacak bir şey olmayan
 * çubuk okuyucuya ölçek hakkında hiçbir şey söylemez, yalnızca dolu bir
 * dikdörtgen gösterir. Eşik burada TEK yerde durur; bileşen, iki sayfa, hat
 * doğrulaması ve testler hepsi buradan okur. İki kopya olsaydı biri
 * güncellenip diğeri unutulduğunda başlıkları çizilmiş ama grafiği olmayan
 * bir bölüm ortaya çıkardı.
 */
export const MIN_BARS = 2;

/**
 * Bir uç değerin hangi üstünlük sıfatını hak ettiği.
 *
 * Bu bir ÜSLUP sorusu değil, bir VERİ İDDİASIDIR: hepsi negatif bir kümede
 * en büyük değere "en çok artan" demek, artmayan bir göstergeyi artmış gibi
 * gösterir (ölçüldü: −%2,88 bir süre "en çok artan" olarak yazıldı). Bu yüzden
 * dal burada, test edilebilir tarafta duruyor.
 *
 * @param {number} value
 * @param {'low' | 'high'} end  dizinin en küçüğü mü en büyüğü mü
 * @returns {string}
 */
export function superlative(value, end) {
  if (value === 0) return 'değişmeyen';
  if (end === 'low') return value < 0 ? 'en çok gerileyen' : 'en az artan';
  return value > 0 ? 'en çok artan' : 'en az gerileyen';
}

/**
 * Değer kümesinin alt/üst sınırı.
 *
 * `Math.min(0, ...)` ve `Math.max(0, ...)` süs değil, KURALIN KENDİSİDİR:
 * sıfır her zaman [lo, hi] aralığının içindedir, dolayısıyla taban çizgisi
 * hiçbir girdi kombinasyonunda alanın dışına kaçamaz. Pay yalnızca sıfırın
 * BULUNMADIĞI yöne eklenir; sıfır tarafına pay eklemek tabanı kenardan
 * içeri iter ve "hepsi negatif" bir kümede sahte bir pozitif alan çizer.
 *
 * @param {number[]} values
 * @returns {{ lo: number, hi: number }}
 */
export function barDomain(values) {
  const lo0 = Math.min(0, ...values);
  const hi0 = Math.max(0, ...values);
  const span = hi0 - lo0;

  // span === 0 ⇒ her değer sıfır. Simetrik bir alan döndürülür; amaç
  // grafiği "doğru" çizmek değil, 0/0'ı ve NaN'ı önlemektir. Çubuklar
  // zaten sıfır genişlikte kalır.
  if (span === 0) return { lo: -1, hi: 1 };

  const pad = span * BAR_PAD;
  return { lo: lo0 < 0 ? lo0 - pad : 0, hi: hi0 > 0 ? hi0 + pad : 0 };
}

/**
 * Iraksayan yatay çubuk düzeni.
 *
 * Boş girdide ÇİZMEZ ama PATLAMAZ da: `rows: []` döner ve çağıran bileşen
 * `null` render eder. Bu sitenin kuralı "veri yoksa bölüm boş kalır" —
 * boş bir çerçeve de bir tür yer tutucudur.
 *
 * @param {BarItem[]} items
 * @returns {BarPlot}
 */
export function barPlot(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { rows: [], zero: 0, lo: 0, hi: 0, width: BAR_W };
  }

  const values = items.map((i) => i.value);
  const { lo, hi } = barDomain(values);

  /** @param {number} v */
  const x = (v) => ((v - lo) / (hi - lo)) * BAR_W;
  const zero = x(0);

  const rows = items.map((i) => {
    const xv = x(i.value);
    return {
      id: i.id,
      label: i.label,
      value: i.value,
      // Çubuk DAİMA sıfırdan başlar: negatifte sola, pozitifte sağa uzar.
      x: Math.min(zero, xv),
      w: Math.abs(xv - zero),
      dir: /** @type {BarDir} */ (i.value > 0 ? 'up' : i.value < 0 ? 'down' : 'flat'),
    };
  });

  return { rows, zero, lo, hi, width: BAR_W };
}

/**
 * Aynı eksene konabilecek değişimleri seçer.
 *
 * `pp` (yüzde PUANI) ile `pct` (yüzde değişim) AYNI GRAFİĞE GİREMEZ.
 * Mortgage faizinin yıllık farkı 0,06 PUANDIR; stok değişimi %−20,36'dır.
 * İkisini yan yana çubuk yapmak, 0,06'yı 20,36 ile aynı birimmiş gibi
 * gösterir — `format.ts` bu ayrımı tam olarak bu yüzden koruyor. Kapı
 * burada: karışık birim sessizce elenmez, HİÇ SEÇİLMEZ.
 *
 * @template {{ change: { value: number, kind: string } | null }} T
 * @param {T[]} entries
 * @param {string} kind
 * @returns {T[]}
 */
export function comparableChanges(entries, kind) {
  return entries.filter(
    (e) => e.change != null && e.change.kind === kind && Number.isFinite(e.change.value),
  );
}
