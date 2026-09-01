// ─────────────────────────────────────────────────────────────────────────
// Site sabitleri ve MiamiLi bağlantı disiplini (SSOT)
//
// miamiendeksi, MiamiLi Media'nın Miami konut verisi yayınıdır. Sahiplik
// AÇIK: footer'da tek satır künye. Gizli link ağı DEĞİL — bu yüzden
// bağlantılar gizlenmez, ama attribution için HER miamili linki utm taşır.
// ─────────────────────────────────────────────────────────────────────────

export const SITE = {
  name: 'Miami Endeksi',
  domain: 'miamiendeksi.com',
  legalName: 'MiamiLi Media',
  url: 'https://miamiendeksi.com',
  locale: 'tr_TR',
  lang: 'tr',
  tagline: 'Aylık Miami konut piyasası endeksi',
  description:
    "Miami konut piyasasının aylık veri raporu: konut değeri, kira, stok, satış hızı ve mortgage faizi. Her sayı kaynaklı — Zillow Research, Redfin Data Center ve FRED verileriyle.",
} as const;

export const PUBLISHER = {
  name: 'MiamiLi Media',
  site: 'https://miamili.com',
} as const;

/**
 * MiamiLi'ye giden HER tıklanabilir bağlantı buradan üretilir.
 *
 * Elle yazılan URL'de `utm_source=miamiendeksi` er ya da geç düşer ve
 * attribution sessizce ölür.
 *
 * İSTİSNA — kimlik/köken URL'leri (JSON-LD `url`/`sameAs`, `rel=author`)
 * UTM ALMAZ: tıklanmazlar, trafik taşımazlar; arama motorları iki markayı
 * bunlarla eşleştirir ve UTM'li varyant o varlık sinyalini böler.
 */
export function miamiliUrl(path: string, campaign: string): string {
  const url = new URL(path, PUBLISHER.site);
  url.searchParams.set('utm_source', 'miamiendeksi');
  url.searchParams.set('utm_medium', 'referral');
  url.searchParams.set('utm_campaign', campaign);
  return url.toString();
}

/** Mutlak URL — metadata, sitemap ve JSON-LD tek yerden beslensin. */
export function abs(path: string): string {
  return new URL(path, SITE.url).toString();
}

// Tarih biçimlendiricileri `format.ts`'e taşındı (client component'ler de
// kullanıyor). Geriye dönük tek içe aktarma noktası olarak buradan da açılır.
export { formatPeriod, formatDate, formatMonth } from './format';


/* ── Kardeş yayın ağı ──────────────────────────────────────────────────────
   Dört site — miamili.com · floridarehberi.com · miamigezi.com ·
   miamiendeksi.com — karşılıklı linkli. Kendi sitemiz listede YOK.

   `rel="nofollow"` KULLANILMIYOR: bağ gerçek, dördü de aynı yayıncının.

   UTM neden kardeş bağlantılarda da var: bu dosyanın başındaki gerekçe
   miamili.com'a ÖZEL DEĞİL. Etiketsiz bir kardeş bağlantısı, ağın gerçekten
   trafik taşıyıp taşımadığını ölçülemez kılar — tam da `miamiliUrl()`'in
   var olma sebebi. Hedef sitenin canonical'ı UTM'li URL'i temiz sürüme
   toplar, yani bağ sinyali bölünmez.

   SIRALAMA: bu dizi footer'da olduğu gibi çizilir; ekleme yaparken alfabe
   değil, ağdaki ağırlık sırası korunur (önce miamili).
   ────────────────────────────────────────────────────────────────────── */
export const KARDES_SITELER = [
  { ad: 'MiamiLi', alan: 'miamili.com', href: miamiliUrl('/', 'kardes-siteler') },
  { ad: 'Florida Rehberi', alan: 'floridarehberi.com', href: kardesUrl('https://floridarehberi.com', 'kardes-siteler') },
  { ad: 'Miami Gezi', alan: 'miamigezi.com', href: kardesUrl('https://miamigezi.com', 'kardes-siteler') },
] as const;

/** Kardeş siteye giden bağlantı — `miamiliUrl()` ile AYNI atıf deseni. */
function kardesUrl(site: string, campaign: string): string {
  const url = new URL('/', site);
  url.searchParams.set('utm_source', 'miamiendeksi');
  url.searchParams.set('utm_medium', 'referral');
  url.searchParams.set('utm_campaign', campaign);
  return url.toString();
}
