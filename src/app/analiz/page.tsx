import type { Metadata } from 'next';
import Link from 'next/link';
import { abs } from '@/lib/site';
import { formatDate, formatPeriod } from '@/lib/format';
import { ARTICLES } from '@/content/articles';
import { graph, webPageSchema, breadcrumbSchema } from '@/lib/schema';

export const metadata: Metadata = {
  title: 'Analiz — Miami konut verilerinin okunması',
  description:
    'Miami konut piyasası verilerinin ne anlama geldiği: stok, kondo ayrışması, kira getirisi ve mortgage faizi. Her yazıdaki her sayı aynı aylık veri setinden gelir.',
  alternates: { canonical: '/analiz' },
  openGraph: { url: abs('/analiz'), type: 'website' },
};

export default function AnalysisIndexPage() {
  // En yeni önce. Aynı gün yayınlananlarda dosya sırası korunur — üç tohum
  // yazı aynı gün yayınlandı, aralarında yapay bir sıra uydurmuyoruz.
  const posts = [...ARTICLES].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  const jsonLd = graph([
    webPageSchema({
      path: '/analiz',
      name: 'Analiz',
      description: 'Miami konut piyasası verilerinin okunmasına dair yazılar.',
    }),
    breadcrumbSchema([{ name: 'Analiz', path: '/analiz' }]),
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
            Analiz
          </h1>
          <p className="prose-me mt-5 text-body text-mute">
            Endeks sayıyı verir; bu yazılar sayının neyi ölçtüğünü ve neyi
            ölçmediğini anlatır. Yazılardaki her rakam, o ayın veri setinden
            gelir ve yayından önce o veri setine karşı programatik doğrulanır.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <ul className="grid gap-4 lg:grid-cols-3">
          {posts.map((a) => (
            <li key={a.slug}>
              <article className="panel panel-hover h-full p-6">
                <p className="font-mono text-[0.6875rem] tracking-wider text-cyan uppercase">
                  {formatPeriod(a.period)} verileri
                </p>
                <h2 className="mt-2.5 font-display text-h3 leading-snug font-medium text-balance text-ice">
                  <Link href={`/analiz/${a.slug}`} className="hover:text-cyan">
                    {a.title}
                  </Link>
                </h2>
                <p className="mt-2.5 text-small leading-relaxed text-mute">{a.excerpt}</p>
                <p className="mt-4 border-t border-edge pt-2.5 font-mono text-[0.6875rem] text-dim">
                  {formatDate(a.publishedAt)}
                </p>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
