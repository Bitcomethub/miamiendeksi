// ─────────────────────────────────────────────────────────────────────────
// Kaynak ve metrik kaydı (SSOT)
//
// Bu sitede yayınlanan HER sayı buradaki bir tanımdan gelir. Elle yazılmış,
// hatırlanmış ya da tahmin edilmiş sayı yoktur — kayıtta olmayan bir metrik
// sayfaya çıkamaz.
//
// COĞRAFYA NOTU (metodoloji sayfasında da yazılı): üç kaynağın üçü de AYNI
// istatistiksel bölgeyi tarif ediyor —
//   Zillow  : "Miami, FL" (msa, RegionID 394856)
//   FRED    : CBSA 33100
//   Redfin  : "Miami, FL metro area"
// Bu bölge Miami-Fort Lauderdale-Pompano Beach MSA'dır: Miami-Dade, Broward
// ve Palm Beach ilçeleri. "Miami şehri" DEĞİLDİR. Sitede geçen "Miami" bu
// üç ilçelik metro alanıdır ve her sayfada böyle yazılır.
// ─────────────────────────────────────────────────────────────────────────

/** Zillow'un metro CSV'lerinde Miami metro satırını bulan anahtar. */
export const ZILLOW_REGION_ID = '394856';
export const ZILLOW_REGION_NAME = 'Miami, FL';

/** FRED metro serilerinin CBSA kodu. */
export const FRED_CBSA = '33100';

/** Redfin metro tracker'ındaki bölge adı. */
export const REDFIN_REGION = 'Miami, FL metro area';

export const GEOGRAPHY =
  'Miami-Fort Lauderdale-Pompano Beach metro alanı (Miami-Dade, Broward, Palm Beach ilçeleri)';

const ZILLOW_BASE = 'https://files.zillowstatic.com/research/public_csvs';

/**
 * Yayıncı düzeyinde kaynaklar. `url` insanın açıp veriyi kendi
 * doğrulayabileceği sayfa; `terms` kullanım koşulu beyanı.
 */
export const PUBLISHERS = {
  zillow: {
    id: 'zillow',
    name: 'Zillow Research',
    url: 'https://www.zillow.com/research/data/',
    terms:
      'Zillow Research verileri kamuya açık olarak, kaynak gösterme koşuluyla yayınlanır.',
  },
  fred: {
    id: 'fred',
    name: 'FRED — St. Louis Fed',
    url: 'https://fred.stlouisfed.org/',
    terms:
      'FRED üzerinden dağıtılan seriler kamuya açıktır; her serinin telif durumu kaynak kurumuna aittir.',
  },
  redfin: {
    id: 'redfin',
    name: 'Redfin Data Center',
    url: 'https://www.redfin.com/news/data-center/',
    terms:
      'Redfin, pazar verisini kaynak gösterme koşuluyla kamuya açık olarak yayınlar.',
  },
};

/**
 * Metrik kaydı.
 *
 * kind:
 *   'zillow-wide'  → satır=bölge, sütun=ay olan geniş CSV
 *   'fred'         → observation_date,VALUE uzun CSV
 *   'redfin'       → gzip TSV, mülk tipine göre filtrelenir
 *
 * unit:  'usd' | 'count' | 'days' | 'pct' | 'index'
 *
 * `higherIsBetter` KULLANILMIYOR — bu site yorum yapmaz, yön gösterir.
 * Renk değişimin İŞARETİNİ kodlar (artı/eksi), iyi/kötü yargısını değil.
 * Bu ayrım metodoloji sayfasında açıkça yazılıdır.
 */
export const METRICS = [
  // ── Zillow ────────────────────────────────────────────────────────────
  {
    id: 'zhvi-all',
    kind: 'zillow-wide',
    label: 'Tipik konut değeri',
    short: 'ZHVI (tüm konutlar)',
    unit: 'usd',
    publisher: 'zillow',
    dataset: 'ZHVI — All Homes, Smoothed & Seasonally Adjusted',
    file: `${ZILLOW_BASE}/zhvi/Metro_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv`,
    note: 'Zillow Home Value Index: piyasanın orta %33–67 dilimindeki tipik konut değeri. Satış medyanı DEĞİLDİR — satılan konutların bileşiminden etkilenmez.',
    featured: true,
  },
  {
    id: 'zhvi-condo',
    kind: 'zillow-wide',
    label: 'Tipik daire (kondo) değeri',
    short: 'ZHVI (kondo)',
    unit: 'usd',
    publisher: 'zillow',
    dataset: 'ZHVI — Condo/Co-op, Smoothed & Seasonally Adjusted',
    file: `${ZILLOW_BASE}/zhvi/Metro_zhvi_uc_condo_tier_0.33_0.67_sm_sa_month.csv`,
    note: 'Yalnızca daire/kondo stoku. Türkiye’den yatırım çoğunlukla bu segmentte olduğu için ayrı izleniyor.',
    featured: true,
  },
  {
    id: 'zori',
    kind: 'zillow-wide',
    label: 'Tipik aylık kira',
    short: 'ZORI',
    unit: 'usd',
    publisher: 'zillow',
    dataset: 'ZORI — Observed Rent Index (tüm konut tipleri)',
    file: `${ZILLOW_BASE}/zori/Metro_zori_uc_sfrcondomfr_sm_month.csv`,
    note: 'Zillow Observed Rent Index: ilan edilen kiraların kalite-denkleştirilmiş ortalaması.',
    featured: true,
  },
  {
    id: 'zillow-inventory',
    kind: 'zillow-wide',
    label: 'Satıştaki konut stoku',
    short: 'Stok',
    unit: 'count',
    publisher: 'zillow',
    dataset: 'For-Sale Inventory (smoothed)',
    file: `${ZILLOW_BASE}/invt_fs/Metro_invt_fs_uc_sfrcondo_sm_month.csv`,
    note: 'Ay içinde satışta olan toplam konut sayısı.',
  },
  {
    id: 'zillow-new-listings',
    kind: 'zillow-wide',
    label: 'Yeni ilan sayısı',
    short: 'Yeni ilan',
    unit: 'count',
    publisher: 'zillow',
    dataset: 'New Listings (smoothed)',
    file: `${ZILLOW_BASE}/new_listings/Metro_new_listings_uc_sfrcondo_sm_month.csv`,
  },
  {
    id: 'zillow-days-pending',
    kind: 'zillow-wide',
    label: 'Satışa geçme süresi',
    short: 'Gün (medyan)',
    unit: 'days',
    publisher: 'zillow',
    dataset: 'Median Days to Pending',
    file: `${ZILLOW_BASE}/med_doz_pending/Metro_med_doz_pending_uc_sfrcondo_sm_month.csv`,
    note: 'İlan yayına girdikten sonra sözleşmeye bağlanana kadar geçen medyan gün.',
    featured: true,
  },
  {
    id: 'zillow-price-cut',
    kind: 'zillow-wide',
    label: 'Fiyat indirimi yapan ilan oranı',
    short: 'İndirim oranı',
    unit: 'pct',
    publisher: 'zillow',
    dataset: 'Share of Listings With a Price Cut',
    file: `${ZILLOW_BASE}/perc_listings_price_cut/Metro_perc_listings_price_cut_uc_sfrcondo_sm_month.csv`,
    // Zillow bu seriyi ORAN olarak yayınlıyor (0,1968), yüzde olarak değil.
    // Ham hâliyle yayınlamak "ilanların %0,2'si indirim yaptı" gibi
    // gerçeğin yüzde biri büyüklüğünde bir yanlış beyan üretirdi.
    // Ölçek ham noktalara, metrik kurulmadan ÖNCE uygulanır — sonra
    // uygulanırsa yüzde puan farkları da 100 kat küçük çıkar.
    scale: 100,
    note: 'Ay içinde fiyatını düşüren ilanların, toplam ilanlara oranı. Satıcı tarafındaki baskının en hızlı göstergesi.',
    featured: true,
  },
  {
    id: 'zillow-median-sale',
    kind: 'zillow-wide',
    label: 'Medyan satış fiyatı',
    short: 'Medyan satış',
    unit: 'usd',
    publisher: 'zillow',
    dataset: 'Median Sale Price (smoothed, seasonally adjusted)',
    file: `${ZILLOW_BASE}/median_sale_price/Metro_median_sale_price_uc_sfrcondo_sm_sa_month.csv`,
    note: 'Gerçekleşen satışların medyanı. ZHVI’den farklı olarak satılan konutların bileşiminden ETKİLENİR.',
  },

  // ── FRED ──────────────────────────────────────────────────────────────
  {
    id: 'mortgage-30y',
    kind: 'fred',
    seriesId: 'MORTGAGE30US',
    label: 'ABD 30 yıl sabit mortgage faizi',
    short: 'Mortgage 30Y',
    unit: 'pct',
    publisher: 'fred',
    dataset: 'Freddie Mac Primary Mortgage Market Survey (haftalık)',
    note: 'Ülke geneli ortalama; Miami’ye özgü değildir. Alıcı bütçesini belirleyen tek en büyük dış değişken olduğu için izleniyor.',
    featured: true,
    national: true,
  },
  {
    id: 'active-listings',
    kind: 'fred',
    seriesId: `ACTLISCOU${FRED_CBSA}`,
    label: 'Aktif ilan sayısı',
    short: 'Aktif ilan',
    unit: 'count',
    publisher: 'fred',
    dataset: 'Realtor.com — Housing Inventory: Active Listing Count (CBSA 33100)',
    note: 'Realtor.com sayımı. Zillow stok rakamıyla aynı şeyi ölçer ama farklı yöntem kullanır; iki kaynağın ayrışması bilgi taşır.',
  },
  {
    id: 'median-list-price',
    kind: 'fred',
    seriesId: `MEDLISPRI${FRED_CBSA}`,
    label: 'Medyan liste fiyatı',
    short: 'Liste fiyatı',
    unit: 'usd',
    publisher: 'fred',
    dataset: 'Realtor.com — Median Listing Price (CBSA 33100)',
    note: 'Satıcıların İSTEDİĞİ fiyatın medyanı; gerçekleşen satış fiyatı değildir.',
  },
  {
    id: 'list-price-sqft',
    kind: 'fred',
    seriesId: `MEDLISPRIPERSQUFEE${FRED_CBSA}`,
    label: 'Liste fiyatı (ft² başına)',
    short: '$/ft²',
    unit: 'usd',
    publisher: 'fred',
    dataset: 'Realtor.com — Median Listing Price per Square Feet (CBSA 33100)',
    note: 'Konut büyüklüğü değişiminden arındırılmış fiyat göstergesi. 1 ft² ≈ 0,0929 m².',
  },
  {
    id: 'days-on-market',
    kind: 'fred',
    seriesId: `MEDDAYONMAR${FRED_CBSA}`,
    label: 'Piyasada kalma süresi',
    short: 'Piyasada gün',
    unit: 'days',
    publisher: 'fred',
    dataset: 'Realtor.com — Median Days on Market (CBSA 33100)',
  },
  {
    id: 'new-listing-count',
    kind: 'fred',
    seriesId: `NEWLISCOU${FRED_CBSA}`,
    label: 'Aya giren yeni ilan (Realtor.com)',
    short: 'Yeni ilan (R)',
    unit: 'count',
    publisher: 'fred',
    dataset: 'Realtor.com — New Listing Count (CBSA 33100)',
  },
  {
    id: 'price-reduced-count',
    kind: 'fred',
    seriesId: `PRIREDCOU${FRED_CBSA}`,
    label: 'Fiyatı düşürülen ilan sayısı',
    short: 'İndirimli ilan',
    unit: 'count',
    publisher: 'fred',
    dataset: 'Realtor.com — Price Reduced Count (CBSA 33100)',
  },

  // ── Redfin ────────────────────────────────────────────────────────────
  {
    id: 'redfin-condo-sale',
    kind: 'redfin',
    propertyType: 'Condo/Co-op',
    field: 'MEDIAN_SALE_PRICE',
    label: 'Kondo medyan satış fiyatı',
    short: 'Kondo satış',
    unit: 'usd',
    publisher: 'redfin',
    dataset: 'Redfin Metro Market Tracker — Condo/Co-op',
    note: 'Kapanmış (tapu devri olmuş) kondo satışlarının medyanı.',
    featured: true,
  },
  {
    id: 'redfin-condo-sold',
    kind: 'redfin',
    propertyType: 'Condo/Co-op',
    field: 'HOMES_SOLD',
    label: 'Satılan kondo sayısı',
    short: 'Kondo satış adedi',
    unit: 'count',
    publisher: 'redfin',
    dataset: 'Redfin Metro Market Tracker — Condo/Co-op',
  },
  {
    id: 'redfin-all-sale',
    kind: 'redfin',
    propertyType: 'All Residential',
    field: 'MEDIAN_SALE_PRICE',
    label: 'Tüm konutlarda medyan satış fiyatı',
    short: 'Tüm konut satış',
    unit: 'usd',
    publisher: 'redfin',
    dataset: 'Redfin Metro Market Tracker — All Residential',
  },
  {
    id: 'redfin-inventory',
    kind: 'redfin',
    propertyType: 'All Residential',
    field: 'INVENTORY',
    label: 'Redfin stok sayımı',
    short: 'Stok (Redfin)',
    unit: 'count',
    publisher: 'redfin',
    dataset: 'Redfin Metro Market Tracker — All Residential',
  },
];

export const REDFIN_FILE =
  'https://redfin-public-data.s3-us-west-2.amazonaws.com/redfin_market_tracker/redfin_metro_market_tracker.tsv000.gz';

/**
 * Türetilmiş metrikler.
 *
 * Bunlar kaynaktan GELMEZ, iki sayının bölünmesiyle HESAPLANIR. Sayfada
 * ayrı işaretlenir ve formülü görünür yazılır — okuyucu kendi kontrol
 * edebilsin. Formülü değiştiren, metodoloji sayfasını AYNI commit'te
 * günceller.
 */
export const DERIVED = [
  {
    id: 'gross-yield',
    label: 'Brüt kira getirisi (gösterge)',
    short: 'Brüt getiri',
    unit: 'pct',
    formula: '(ZORI × 12) ÷ ZHVI (tüm konutlar)',
    inputs: ['zori', 'zhvi-all'],
    note: 'Kaba bir göstergedir. Aidat, emlak vergisi, sigorta, boşluk ve yönetim gideri DÜŞÜLMEMİŞTİR — net getiri bunun belirgin biçimde altındadır. İki farklı endeksin oranı olduğu için tek bir dairenin getirisi değil, piyasa ortalamasının kabaca nerede durduğudur.',
    compute: (m) => {
      const rent = m['zori'];
      const value = m['zhvi-all'];
      if (!rent || !value || !value.value) return null;
      return (rent.value * 12 * 100) / value.value;
    },
  },
  {
    id: 'price-to-rent',
    label: 'Fiyat / yıllık kira çarpanı',
    short: 'F/K çarpanı',
    unit: 'index',
    formula: 'ZHVI (tüm konutlar) ÷ (ZORI × 12)',
    inputs: ['zhvi-all', 'zori'],
    note: 'Tipik konutun kaç yıllık brüt kiraya denk geldiği. Yüksek değer, kiralamanın satın almaya göre görece ucuz olduğunu gösterir.',
    compute: (m) => {
      const rent = m['zori'];
      const value = m['zhvi-all'];
      if (!rent || !value || !rent.value) return null;
      return value.value / (rent.value * 12);
    },
  },
];
