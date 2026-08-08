import type { Metadata } from 'next';
import Link from 'next/link';
import { ChangeBadge, MetricCard, DerivedCard } from '@/components/Metric';
import { TrendChart } from '@/components/TrendChart';
import { SITE, abs, miamiliUrl } from '@/lib/site';
import { formatPeriod, formatDate, formatValue } from '@/lib/format';
import { getLatestSnapshot, metric, seriesFor, publisherOf } from '@/lib/snapshot';
import { ARTICLES } from '@/content/articles';
import { graph, webPageSchema, datasetSchema } from '@/lib/schema';

// ─────────────────────────────────────────────────────────────────────────
// Ana sayfa
//
// Hiyerarşi bilinçli olarak TEK SAYIYLA açar. Bir veri sitesinde ziyaretçi
// tek bir şey arar: "şu an ne durumda?" Karşılama metni, değer önerisi ve
// abonelik kutusu bu sorunun önüne konursa site bir pazarlama sayfası olur.
// Manşet sayı ilk ekranda, kaynağıyla birlikte.
//
// Sayfadaki HİÇBİR rakam elle yazılmaz — hepsi anlık görüntüden gelir.
// ─────────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Miami Endeksi — Aylık Miami konut piyasası verileri',
  description: SITE.description,
  alternates: { canonical: '/' },
  openGraph: { url: abs('/'), type: 'website' },
};

export default function HomePage() {
  const snap = getLatestSnapshot();

  const zhvi = metric(snap, 'zhvi-all');
  const zhviSeries = seriesFor(snap, 'zhvi-all');

  // Manşetin altındaki şerit: dört gösterge, hepsi öne çıkanlardan ve
  // manşetin kendisi hariç. Sıralama anlık görüntüdeki sırayı korur.
  const strip = snap.metrics.filter((m) => m.featured && m.id !== 'zhvi-all').slice(0, 4);
  const cards = snap.metrics.filter((m) => m.featured && m.id !== 'zhvi-all').slice(0, 6);

  const posts = [...ARTICLES].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 3);

  const jsonLd = graph([
    webPageSchema({ path: '/', name: SITE.name, description: SITE.description }),
    datasetSchema(snap),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Manşet ─────────────────────────────────────────────────────── */}
      <section className="night-wash relative overflow-hidden" aria-labelledby="manset">
        <div className="grid-glow absolute inset-0" aria-hidden="true" />

        <div className="relative mx-auto max-w-6xl px-5 pt-14 pb-12 sm:px-8 sm:pt-20 sm:pb-16">
          <p className="font-mono text-[0.6875rem] tracking-[0.18em] text-cyan uppercase">
            {formatPeriod(snap.period)} · {snap.metrics.length} gösterge · üç kaynak
          </p>

          <h1
            id="manset"
            className="mt-5 max-w-[16ch] font-display text-hero font-semibold tracking-tight text-balance text-ice"
          >
            Miami konut piyasası, <span className="text-cyan glow-cyan">sayılarla</span>
          </h1>

          <p className="prose-me mt-6 text-body text-mute">
            Her ay Zillow Research, Redfin Data Center ve FRED&apos;in açık
            verilerinden derlenen Miami metro konut endeksi. Her sayının yanında
            kaynağı ve gözlem tarihi yazılıdır; tahmin ve yorum rakamı yayınlanmaz.
          </p>

          {zhvi ? (
            <div className="mt-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:gap-10">
              <div>
                <p className="font-mono text-[0.6875rem] tracking-wider text-dim uppercase">
                  {zhvi.label}
                </p>
                <p className="tabular mt-2 font-mono text-[clamp(2.75rem,1.6rem+5vw,4.75rem)] leading-none font-semibold text-ice">
                  {formatValue(zhvi.value, zhvi.unit)}
                </p>
              </div>

              <dl className="flex gap-8 pb-1">
                <div>
                  <dt className="font-mono text-[0.625rem] tracking-wider text-dim uppercase">
                    Aylık
                  </dt>
                  <dd className="mt-1">
                    <ChangeBadge change={zhvi.mom} label="önceki aya" />
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[0.625rem] tracking-wider text-dim uppercase">
                    Yıllık
                  </dt>
                  <dd className="mt-1">
                    <ChangeBadge change={zhvi.yoy} label="geçen yılın aynı ayına" />
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}

          <p className="mt-4 font-mono text-[0.6875rem] text-dim">
            {publisherOf(snap, zhvi?.publisher ?? '')?.name} · {zhvi?.dataset} ·{' '}
            {zhvi ? `${formatDate(zhvi.asOf)} gözlemi` : null} · çekim{' '}
            {formatDate(snap.fetchedAt)}
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href={`/endeks/${snap.period}`}
              className="bg-cyan px-5 py-3 font-mono text-[0.75rem] tracking-wide text-night uppercase transition-colors hover:bg-ice"
            >
              {formatPeriod(snap.period)} raporu
            </Link>
            <Link
              href="/metodoloji"
              className="panel panel-hover px-5 py-3 font-mono text-[0.75rem] tracking-wide text-cyan uppercase"
            >
              Veri nereden geliyor?
            </Link>
          </div>
        </div>
      </section>

      {/* ── Gösterge şeridi ────────────────────────────────────────────── */}
      {strip.length > 0 ? (
        <section className="border-y border-edge bg-panel/40" aria-labelledby="serit">
          <h2 id="serit" className="sr-only">
            {formatPeriod(snap.period)} öne çıkan göstergeler
          </h2>
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px bg-edge sm:grid-cols-4">
            {strip.map((m) => (
              <div key={m.id} className="bg-night px-5 py-6 sm:px-6">
                <p className="font-mono text-[0.625rem] leading-snug tracking-wider text-dim uppercase">
                  {m.short}
                </p>
                <p className="tabular mt-2 font-mono text-[1.375rem] leading-none font-semibold text-ice">
                  {formatValue(m.value, m.unit)}
                </p>
                <p className="mt-2">
                  <ChangeBadge change={m.yoy} label="geçen yılın aynı ayına" />
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mx-auto max-w-6xl px-5 pt-band sm:px-8">
        {/* ── Ana grafik ───────────────────────────────────────────────── */}
        {zhvi && zhviSeries ? (
          <section aria-labelledby="ana-grafik">
            <h2
              id="ana-grafik"
              className="font-display text-h2 font-semibold tracking-tight text-ice"
            >
              Tipik konut değeri, son beş yıl
            </h2>
            <hr className="neon-rule mt-3" />
            <TrendChart
              points={zhviSeries.points}
              unit={zhvi.unit}
              label={zhvi.label}
              accent="cyan"
              source={`${publisherOf(snap, zhvi.publisher)?.name ?? ''} · ${zhvi.dataset}`}
            />
          </section>
        ) : null}

        {/* ── Kartlar ──────────────────────────────────────────────────── */}
        {cards.length > 0 ? (
          <section className="mt-band" aria-labelledby="gostergeler">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2
                id="gostergeler"
                className="font-display text-h2 font-semibold tracking-tight text-ice"
              >
                {formatPeriod(snap.period)} göstergeleri
              </h2>
              <Link
                href={`/endeks/${snap.period}`}
                className="font-mono text-[0.75rem] tracking-wide text-cyan uppercase underline decoration-cyan/40 underline-offset-4"
              >
                Tümünü gör ({snap.metrics.length})
              </Link>
            </div>
            <hr className="neon-rule mt-3" />
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((m, i) => (
                <MetricCard
                  key={m.id}
                  metric={m}
                  series={seriesFor(snap, m.id)}
                  publisher={publisherOf(snap, m.publisher)}
                  accent={i % 3 === 1 ? 'magenta' : 'cyan'}
                />
              ))}
            </div>
          </section>
        ) : null}

        {/* ── Türetilmiş ───────────────────────────────────────────────── */}
        {snap.derived.length > 0 ? (
          <section className="mt-band" aria-labelledby="oranlar">
            <h2 id="oranlar" className="font-display text-h2 font-semibold tracking-tight text-ice">
              Türetilmiş oranlar
            </h2>
            <hr className="neon-rule neon-rule-magenta mt-3" />
            <p className="prose-me mt-4 text-small text-mute">
              Bunlar yayıncı verisi değil, yukarıdaki endekslerden hesaplanmış
              oranlardır. Formülleri açıkça yazılıdır.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {snap.derived.map((d) => (
                <DerivedCard key={d.id} item={d} />
              ))}
            </div>
          </section>
        ) : null}

        {/* ── Analiz ───────────────────────────────────────────────────── */}
        {posts.length > 0 ? (
          <section className="mt-band" aria-labelledby="analiz">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 id="analiz" className="font-display text-h2 font-semibold tracking-tight text-ice">
                Sayılar ne anlatıyor
              </h2>
              <Link
                href="/analiz"
                className="font-mono text-[0.75rem] tracking-wide text-cyan uppercase underline decoration-cyan/40 underline-offset-4"
              >
                Tüm yazılar
              </Link>
            </div>
            <hr className="neon-rule mt-3" />
            <ul className="mt-6 grid gap-4 lg:grid-cols-3">
              {posts.map((a) => (
                <li key={a.slug}>
                  <Link href={`/analiz/${a.slug}`} className="panel panel-hover block h-full p-6">
                    <p className="font-mono text-[0.6875rem] tracking-wider text-cyan uppercase">
                      {formatPeriod(a.period)} verileri
                    </p>
                    <h3 className="mt-2.5 font-display text-h3 leading-snug font-medium text-balance text-ice">
                      {a.title}
                    </h3>
                    <p className="mt-2.5 text-small leading-relaxed text-mute">{a.excerpt}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* ── Güven bandı ──────────────────────────────────────────────── */}
        <section className="mt-band" aria-labelledby="guven">
          <h2 id="guven" className="font-display text-h2 font-semibold tracking-tight text-ice">
            Bu sitede uydurma sayı yok
          </h2>
          <hr className="neon-rule mt-3" />
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              {
                t: 'Kaynak zorunlu',
                d: 'Her göstergenin yanında yayıncısı, veri seti adı, gözlem dönemi ve çekim tarihi yazılıdır. Kaynak dosyaya doğrudan bağlantı verilir.',
              },
              {
                t: 'Eksik veri boş kalır',
                d: 'Bir seri çekilemezse o gösterge sayfada hiç görünmez ve dönemin uyarı listesine düşer. Tahmini değer yazılmaz.',
              },
              {
                t: 'Yorum da denetlenir',
                d: 'Analiz metinlerindeki her sayı yayından önce veri setine karşı programatik doğrulanır; tek bir eşleşmeyen rakam metnin tamamını reddettirir.',
              },
            ].map((x) => (
              <div key={x.t} className="panel p-5">
                <h3 className="font-display text-h3 font-medium text-ice">{x.t}</h3>
                <p className="mt-2 text-small leading-relaxed text-mute">{x.d}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-small text-dim">
            Ayrıntılı yöntem:{' '}
            <Link href="/metodoloji" className="text-cyan underline underline-offset-4">
              metodoloji sayfası
            </Link>
            .
          </p>
        </section>

        {/* ── MiamiLi bağlamı ──────────────────────────────────────────── */}
        <aside className="panel mt-band border-l-2 border-l-cyan p-6 sm:p-8">
          <h2 className="font-display text-h3 font-medium text-ice">
            Veriden işleme geçerken
          </h2>
          <p className="prose-me mt-2 text-small text-mute">
            Miami Endeksi bir yayındır: ölçer, tavsiye vermez. Fiilî alım, satım
            veya kiralama süreci için lisanslı broker desteği{' '}
            <a
              href={miamiliUrl('/', 'anasayfa-cta')}
              rel="noopener"
              className="text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan"
            >
              miamili.com
            </a>{' '}
            üzerinden alınabilir.
          </p>
        </aside>
      </div>
    </>
  );
}
