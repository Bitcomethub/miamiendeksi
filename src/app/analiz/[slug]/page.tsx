import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TrendChart } from '@/components/TrendChart';
import { BarChart } from '@/components/BarChart';
import { abs, miamiliUrl } from '@/lib/site';
import { formatDate, formatPeriod } from '@/lib/format';
import { ARTICLES, articleBySlug } from '@/content/articles';
import type { Article, Block } from '@/content/articles/types';
import { getSnapshot, metric, seriesFor, publisherOf, type Snapshot } from '@/lib/snapshot';
import { comparableChanges } from '@/lib/chart';
import { graph, webPageSchema, articleSchema, breadcrumbSchema, faqSchema } from '@/lib/schema';

// ─────────────────────────────────────────────────────────────────────────
// Analiz yazısı
//
// Yazı JSX değil VERİDİR (`articles.json`); burada yalnızca blok tipleri
// ekrana çevrilir. Bunun sebebi biçimsel değil: metnin içindeki her sayı
// `npm test` ile veri anlık görüntüsüne karşı doğrulanıyor ve doğrulayıcı
// bir Node script'i — JSX'e gömülü metin ayrıştırılamaz, bir kez denendi ve
// kapı kod yorumlarını içerik sandı.
//
// `chart` bloğu grafiği metrik ID'siyle ÇEKER, veriyi tekrar yazmaz: yazının
// grafiği ile endeks sayfasının grafiği aynı seriden gelir, ayrışamaz.
// ─────────────────────────────────────────────────────────────────────────

export const dynamicParams = false;

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

function load(slug: string): { article: Article; snap: Snapshot } {
  const article = articleBySlug(slug);
  if (!article) notFound();
  return { article, snap: getSnapshot(article.period) };
}

export async function generateMetadata({
  params,
}: PageProps<'/analiz/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const { article } = load(slug);

  return {
    title: article.title,
    description: article.excerpt,
    keywords: article.keywords,
    alternates: { canonical: `/analiz/${slug}` },
    openGraph: {
      title: article.title,
      description: article.excerpt,
      url: abs(`/analiz/${slug}`),
      type: 'article',
      publishedTime: article.publishedAt,
    },
  };
}

function BlockView({ block, snap }: { block: Block; snap: Snapshot }) {
  switch (block.type) {
    case 'h2':
      return (
        <h2 className="mt-10 font-display text-h2 font-semibold tracking-tight text-balance text-ice">
          {block.text}
        </h2>
      );

    case 'p':
      return <p className="mt-4 text-body leading-relaxed text-mute">{block.text}</p>;

    case 'list':
      return (
        <ul className="mt-4 space-y-2.5">
          {block.items.map((item) => (
            <li key={item} className="flex gap-3 text-body leading-relaxed text-mute">
              <span aria-hidden="true" className="mt-[0.7em] h-px w-4 shrink-0 bg-cyan" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );

    case 'caveat':
      return (
        // Çekince kutusu bir üslup tercihi değil: bu sitede her sayının
        // yanında neyi ölçMEDİĞİ de yazılı olmak zorunda.
        <aside className="panel mt-6 border-l-2 border-l-magenta p-5">
          <p className="font-mono text-[0.6875rem] tracking-wider text-magenta uppercase">
            Çekince
          </p>
          <p className="mt-2 text-small leading-relaxed text-mute">{block.text}</p>
        </aside>
      );

    case 'chart': {
      const m = metric(snap, block.metricId);
      const series = seriesFor(snap, block.metricId);
      // Veri yoksa grafik hiç çizilmez — boş çerçeve bırakmak da bir tür
      // yer tutucudur.
      if (!m || !series) return null;
      return (
        <TrendChart
          points={series.points}
          unit={m.unit}
          label={m.label}
          accent={block.accent ?? 'cyan'}
          source={`${publisherOf(snap, m.publisher)?.name ?? ''} · ${m.dataset}`}
        />
      );
    }

    case 'bars': {
      const compare = block.compare ?? 'yoy';

      // Bilinmeyen id sessizce atlanır (yazı eski bir metriğe atıfta
      // bulunuyor olabilir); AMA aşağıdaki iki eşik yüzünden grafik ya
      // dürüst çizilir ya hiç çizilmez.
      const entries = block.metricIds.flatMap((id) => {
        const m = metric(snap, id);
        if (!m) return [];
        return [{ id: m.id, label: m.label, change: compare === 'yoy' ? m.yoy : m.mom }];
      });

      // `pp` satırları HİÇ seçilmez — puan farkı ile yüzde değişim aynı
      // eksene konamaz (bkz. chart-geom.mjs → comparableChanges).
      const items = comparableChanges(entries, 'pct').flatMap((e) =>
        e.change ? [{ id: e.id, label: e.label, value: e.change.value }] : [],
      );

      // Eşik BURADA TEKRARLANMAZ: `BarChart` yetersiz satırda kendi `null`'ını
      // döner (bkz. chart-geom.mjs → MIN_BARS). Buraya ikinci bir kopya koymak,
      // biri güncellenip diğeri unutulduğunda ikisinin ayrışması demekti.

      const kaynaklar = [
        ...new Set(
          items.flatMap((i) => {
            const m = metric(snap, i.id);
            return m ? [publisherOf(snap, m.publisher)?.name ?? ''] : [];
          }),
        ),
      ].filter(Boolean);

      return (
        <BarChart
          items={items}
          kind="pct"
          label={compare === 'yoy' ? 'Yıllık değişim' : 'Aylık değişim'}
          compareLabel={
            compare === 'yoy' ? 'geçen yılın aynı ayına' : 'önceki aya'
          }
          source={kaynaklar.join(' · ')}
        />
      );
    }
  }
}

export default async function ArticlePage({ params }: PageProps<'/analiz/[slug]'>) {
  const { slug } = await params;
  const { article, snap } = load(slug);

  const others = ARTICLES.filter((a) => a.slug !== slug);

  const jsonLd = graph([
    webPageSchema({
      path: `/analiz/${slug}`,
      name: article.title,
      description: article.excerpt,
    }),
    articleSchema(article),
    breadcrumbSchema([
      { name: 'Analiz', path: '/analiz' },
      { name: article.title, path: `/analiz/${slug}` },
    ]),
    faqSchema(article.faqs),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="night-wash">
        <div className="mx-auto max-w-6xl px-5 pt-12 pb-10 sm:px-8 sm:pt-16">
          <nav aria-label="Konum" className="font-mono text-[0.6875rem] tracking-wider uppercase">
            <ol className="flex flex-wrap items-center gap-2 text-dim">
              <li>
                <Link href="/" className="transition-colors hover:text-cyan">
                  Ana sayfa
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href="/analiz" className="transition-colors hover:text-cyan">
                  Analiz
                </Link>
              </li>
            </ol>
          </nav>

          <h1 className="mt-6 max-w-[26ch] font-display text-h1 font-semibold tracking-tight text-balance text-ice">
            {article.title}
          </h1>

          <p className="mt-4 font-mono text-[0.75rem] text-dim">
            {formatDate(article.publishedAt)} ·{' '}
            <Link
              href={`/endeks/${article.period}`}
              className="text-cyan underline underline-offset-4"
            >
              {formatPeriod(article.period)} veri seti
            </Link>
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <article className="prose-me">
          {/* Answer-first: başlıktaki soru İLK paragrafta tam sayılarla
              cevaplanır. AI tarayıcıları alıntıyı buradan alır; cevabı
              üçüncü bölüme saklamak alıntılanabilirliği yok eder. */}
          <p className="border-l-2 border-l-cyan bg-panel/60 px-5 py-4 text-body leading-relaxed text-ice">
            {article.answer}
          </p>

          {article.blocks.map((block, i) => (
            <BlockView key={i} block={block} snap={snap} />
          ))}

          {article.faqs.length > 0 ? (
            <section aria-labelledby="yazi-sss">
              <h2
                id="yazi-sss"
                className="mt-12 font-display text-h2 font-semibold tracking-tight text-ice"
              >
                Sık sorulanlar
              </h2>
              <dl className="mt-5 space-y-4">
                {article.faqs.map((f) => (
                  <div key={f.q} className="panel p-5">
                    <dt className="font-display text-h3 leading-snug font-medium text-balance text-ice">
                      {f.q}
                    </dt>
                    <dd className="mt-2 text-small leading-relaxed text-mute">{f.a}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          <p className="mt-10 border-t border-edge pt-5 text-[0.8125rem] leading-relaxed text-dim">
            Bu yazıdaki tüm sayılar{' '}
            <Link
              href={`/endeks/${article.period}`}
              className="text-cyan underline underline-offset-4"
            >
              {formatPeriod(article.period)} endeksinden
            </Link>{' '}
            gelir ve yayından önce o veri setine karşı doğrulanmıştır. Yöntem:{' '}
            <Link href="/metodoloji" className="text-cyan underline underline-offset-4">
              metodoloji
            </Link>
            . Yayınlanan veriler bilgilendirme amaçlıdır; yatırım tavsiyesi değildir.
          </p>
        </article>

        <aside className="panel mt-band border-l-2 border-l-cyan p-6 sm:p-8">
          <h2 className="font-display text-h3 font-medium text-ice">
            Miami&apos;de bina bazında değerlendirme
          </h2>
          <p className="prose-me mt-2 text-small text-mute">
            Endeks metro ortalamasıdır; aidat, rezerv durumu ve kiralama kuralları
            bina bina değişir. Lisanslı broker desteği{' '}
            <a
              href={miamiliUrl('/', `analiz-${slug}`)}
              rel="noopener"
              className="text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan"
            >
              miamili.com
            </a>{' '}
            üzerinden alınabilir.
          </p>
        </aside>

        {others.length > 0 ? (
          <nav aria-labelledby="diger-yazilar" className="mt-band">
            <h2
              id="diger-yazilar"
              className="font-display text-h2 font-semibold tracking-tight text-ice"
            >
              Diğer yazılar
            </h2>
            <hr className="neon-rule mt-3" />
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {others.map((a) => (
                <li key={a.slug}>
                  <Link href={`/analiz/${a.slug}`} className="panel panel-hover block h-full p-5">
                    <h3 className="font-display text-h3 leading-snug font-medium text-balance text-ice">
                      {a.title}
                    </h3>
                    <p className="mt-2 text-small leading-relaxed text-mute">{a.excerpt}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>
    </>
  );
}
