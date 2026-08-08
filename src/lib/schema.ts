// ─────────────────────────────────────────────────────────────────────────
// JSON-LD üretimi
//
// KURAL (miamili'de bir kez bedeli ödendi): bir özelliği eklemeden ÖNCE
// schema.org'daki `domainIncludes` listesi kontrol edilir. `inLanguage`,
// `isPartOf`, `about`, `license` → CreativeWork; Organization'a ya da
// Place'e YAZILAMAZ. Parse hatası vermez, sessizce ihlal olur.
//
// Bu sitede ana tip `Dataset`: yayınlanan şey yorum değil, ÖLÇÜMDÜR.
// `Dataset` bir CreativeWork alt tipidir, dolayısıyla yukarıdaki özellikler
// onun üzerinde geçerlidir. `variableMeasured`, `temporalCoverage`,
// `spatialCoverage` ve `distribution` da Dataset'in kendi alanlarıdır.
//
// `isBasedOn` ile kaynak veri setlerine ATIF verilir. Bu dekoratif değil:
// AI tarayıcıları için "bu sayı nereden geldi" zincirini makine okunur
// biçimde kuran tek alan budur ve sitenin tek vaadi zaten kaynaklı olmak.
// ─────────────────────────────────────────────────────────────────────────

import { SITE, PUBLISHER, abs } from './site';
import { formatPeriod } from './format';
import type { Snapshot } from './snapshot';
import type { Article } from '@/content/articles/types';

const ORG_ID = `${SITE.url}/#publisher`;
const SITE_ID = `${SITE.url}/#website`;

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID,
    name: PUBLISHER.name,
    url: PUBLISHER.site,
    // Sahiplik açık beyan: Miami Endeksi, MiamiLi Media'nın bir yayınıdır.
    sameAs: [PUBLISHER.site],
  };
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': SITE_ID,
    name: SITE.name,
    url: SITE.url,
    inLanguage: 'tr-TR',
    description: SITE.description,
    publisher: { '@id': ORG_ID },
  };
}

export function breadcrumbSchema(trail: { name: string; path: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: SITE.url },
      ...trail.map((t, i) => ({
        '@type': 'ListItem',
        position: i + 2,
        name: t.name,
        item: abs(t.path),
      })),
    ],
  };
}

export function faqSchema(faqs: { q: string; a: string }[]) {
  return {
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

/**
 * Aylık endeksin Dataset düğümü.
 *
 * `variableMeasured` HER göstergeyi tek tek sayar — ölçülen değerin yanında
 * biriminin ve gözlem tarihinin makine okunur hâli. Bir AI tarayıcısı
 * sayfayı okumadan da "Haziran 2026 tipik konut değeri 476.598 dolar"
 * bilgisini buradan çıkarabilir.
 */
export function datasetSchema(snap: Snapshot) {
  const url = abs(`/endeks/${snap.period}`);
  const dates = snap.metrics.map((m) => m.asOf).sort();

  return {
    '@type': 'Dataset',
    '@id': `${url}#dataset`,
    name: `Miami Konut Piyasası Endeksi — ${formatPeriod(snap.period)}`,
    description: `Miami-Fort Lauderdale-Pompano Beach metro alanı için ${snap.metrics.length} konut piyasası göstergesi: konut değeri, kira, stok, satış hızı ve mortgage faizi. Kaynaklar Zillow Research, Redfin Data Center ve FRED.`,
    url,
    inLanguage: 'tr-TR',
    isPartOf: { '@id': SITE_ID },
    creator: { '@id': ORG_ID },
    publisher: { '@id': ORG_ID },
    datePublished: snap.fetchedAt,
    dateModified: snap.fetchedAt,
    // Veri setinin kendisi derlemedir; kaynak serilerin lisansı yayıncılara ait.
    license: 'https://creativecommons.org/licenses/by/4.0/',
    temporalCoverage: `${dates[0]}/${dates[dates.length - 1]}`,
    spatialCoverage: {
      '@type': 'Place',
      name: 'Miami-Fort Lauderdale-Pompano Beach, FL Metropolitan Statistical Area',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Miami',
        addressRegion: 'FL',
        addressCountry: 'US',
      },
    },
    variableMeasured: snap.metrics.map((m) => ({
      '@type': 'PropertyValue',
      name: m.label,
      value: m.value,
      unitText: unitText(m.unit),
      measurementTechnique: m.dataset,
      observationDate: m.asOf,
    })),
    distribution: [
      {
        '@type': 'DataDownload',
        encodingFormat: 'application/json',
        contentUrl: abs(`/veri/miami-endeksi-${snap.period}.json`),
      },
      {
        '@type': 'DataDownload',
        encodingFormat: 'text/csv',
        contentUrl: abs(`/veri/miami-endeksi-${snap.period}.csv`),
      },
    ],
    isBasedOn: snap.publishers.map((p) => ({
      '@type': 'Dataset',
      name: p.name,
      url: p.url,
    })),
  };
}

function unitText(unit: string): string {
  switch (unit) {
    case 'usd':
      return 'USD';
    case 'pct':
      return 'PERCENT';
    case 'days':
      return 'DAY';
    case 'count':
      return 'COUNT';
    default:
      return 'INDEX';
  }
}

export function articleSchema(article: Article) {
  const url = abs(`/analiz/${article.slug}`);
  return {
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: article.title,
    description: article.excerpt,
    inLanguage: 'tr-TR',
    datePublished: article.publishedAt,
    dateModified: article.publishedAt,
    author: { '@id': ORG_ID },
    publisher: { '@id': ORG_ID },
    isPartOf: { '@id': SITE_ID },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    keywords: article.keywords.join(', '),
    // Yazının dayandığı veri seti — iddia zinciri kapanır.
    isBasedOn: { '@id': `${abs(`/endeks/${article.period}`)}#dataset` },
  };
}

export function webPageSchema(opts: {
  path: string;
  name: string;
  description: string;
}) {
  return {
    '@type': 'WebPage',
    '@id': `${abs(opts.path)}#webpage`,
    url: abs(opts.path),
    name: opts.name,
    description: opts.description,
    inLanguage: 'tr-TR',
    isPartOf: { '@id': SITE_ID },
    publisher: { '@id': ORG_ID },
  };
}

/** Sayfa başına TEK `@graph` — düğümler `@id` ile birbirine bağlanır. */
export function graph(nodes: object[]) {
  return { '@context': 'https://schema.org', '@graph': nodes };
}
