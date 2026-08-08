import type { MetadataRoute } from 'next';
import { abs } from '@/lib/site';
import { listPeriods, getSnapshot } from '@/lib/snapshot';
import { ARTICLES } from '@/content/articles';

// Sitemap veriden türer, elle liste tutulmaz: yeni bir aylık dosya
// eklendiğinde ya da yeni yazı yayınlandığında kendiliğinden girer.
//
// `lastModified` uydurulmaz — dönemin gerçek çekim tarihidir. Tarayıcıya
// "bugün güncellendi" demek, güncellenmediyse, tarama bütçesini yakar.
export default function sitemap(): MetadataRoute.Sitemap {
  const periods = listPeriods();
  const latest = periods[0] ? getSnapshot(periods[0]) : null;
  const latestDate = latest?.fetchedAt ?? ARTICLES[0]?.publishedAt ?? '2026-01-01';

  return [
    { url: abs('/'), lastModified: latestDate, changeFrequency: 'monthly', priority: 1 },
    { url: abs('/endeks'), lastModified: latestDate, changeFrequency: 'monthly', priority: 0.8 },
    ...periods.map((p) => ({
      url: abs(`/endeks/${p}`),
      lastModified: getSnapshot(p).fetchedAt,
      changeFrequency: 'yearly' as const,
      priority: p === periods[0] ? 0.9 : 0.5,
    })),
    { url: abs('/analiz'), lastModified: latestDate, changeFrequency: 'monthly', priority: 0.7 },
    ...ARTICLES.map((a) => ({
      url: abs(`/analiz/${a.slug}`),
      lastModified: a.publishedAt,
      changeFrequency: 'yearly' as const,
      priority: 0.6,
    })),
    {
      url: abs('/metodoloji'),
      lastModified: latestDate,
      changeFrequency: 'yearly',
      priority: 0.6,
    },
  ];
}
