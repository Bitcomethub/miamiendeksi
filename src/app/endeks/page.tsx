import type { Metadata } from 'next';
import Link from 'next/link';
import { abs } from '@/lib/site';
import { formatPeriod, formatDate, formatValue } from '@/lib/format';
import { listPeriods, getSnapshot, metric } from '@/lib/snapshot';
import { graph, webPageSchema, breadcrumbSchema } from '@/lib/schema';

// Dönem arşivi. Tek dönem yayınlandığında bile var olması gerekir: kalıcı
// bir /endeks URL'i olmadan aylık sayfalar birbirine bağlanmayan yetim
// adresler olur ve tarayıcı yeni dönemi keşfetmek için sitemap'e mahkûm kalır.

export const metadata: Metadata = {
  title: 'Aylık endeks arşivi',
  description:
    'Miami konut piyasası endeksinin yayınlanmış tüm aylık raporları. Her rapor kendi gözlem tarihleri ve kaynaklarıyla arşivde kalır.',
  alternates: { canonical: '/endeks' },
  openGraph: { url: abs('/endeks'), type: 'website' },
};

export default function IndexArchivePage() {
  const periods = listPeriods();

  // Her dönemin manşet sayısı listede görünür — arşiv bir bağlantı yığını
  // değil, tarihsel serinin kendisi gibi okunur.
  const rows = periods.map((period) => {
    const snap = getSnapshot(period);
    const zhvi = metric(snap, 'zhvi-all');
    return { period, snap, zhvi };
  });

  const jsonLd = graph([
    webPageSchema({
      path: '/endeks',
      name: 'Aylık endeks arşivi',
      description: 'Miami konut piyasası endeksinin yayınlanmış aylık raporları.',
    }),
    breadcrumbSchema([{ name: 'Endeks', path: '/endeks' }]),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="night-wash">
        <div className="mx-auto max-w-6xl px-5 pt-12 pb-10 sm:px-8 sm:pt-16">
          <h1 className="max-w-[18ch] font-display text-h1 font-semibold tracking-tight text-balance text-ice">
            Aylık endeks <span className="text-cyan glow-cyan">arşivi</span>
          </h1>
          <p className="prose-me mt-5 text-body text-mute">
            Her ay yayınlanan rapor arşivde olduğu gibi kalır: sonradan gelen
            revizyonlar geçmiş sayfaya geriye dönük yazılmaz. Yayıncılar seriyi
            revize ederse fark yeni dönemin sayfasında görünür.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ period, snap, zhvi }) => (
            <li key={period}>
              <Link href={`/endeks/${period}`} className="panel panel-hover block h-full p-5">
                <p className="font-mono text-[0.6875rem] tracking-wider text-cyan uppercase">
                  {formatPeriod(period)}
                </p>
                {zhvi ? (
                  <p className="tabular mt-2 font-mono text-[1.75rem] leading-none font-semibold text-ice">
                    {formatValue(zhvi.value, zhvi.unit)}
                  </p>
                ) : null}
                <p className="mt-2 text-[0.8125rem] text-mute">
                  {zhvi ? 'Tipik konut değeri · ' : ''}
                  {snap.metrics.length} gösterge
                </p>
                <p className="mt-3 border-t border-edge pt-2.5 font-mono text-[0.6875rem] text-dim">
                  Çekim {formatDate(snap.fetchedAt)}
                </p>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-10 text-small text-dim">
          Yeni rapor her ayın başında, yayıncılar aylık dosyalarını güncelledikten
          sonra eklenir.
        </p>
      </div>
    </>
  );
}
