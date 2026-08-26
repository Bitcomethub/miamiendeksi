import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MetricCard, DerivedCard } from '@/components/Metric';
import { MetricTable } from '@/components/MetricTable';
import { TrendChart } from '@/components/TrendChart';
import { BarChart } from '@/components/BarChart';
import { abs, miamiliUrl } from '@/lib/site';
import { formatPeriod, formatDate, formatValue } from '@/lib/format';
import {
  getSnapshot,
  listPeriods,
  metric,
  seriesFor,
  publisherOf,
  type Snapshot,
} from '@/lib/snapshot';
import { comparableChanges, canDrawBars } from '@/lib/chart';
import { graph, webPageSchema, datasetSchema, breadcrumbSchema } from '@/lib/schema';

// ─────────────────────────────────────────────────────────────────────────
// Aylık endeks — sitenin ASIL ürünü
//
// Tamamen statik: `generateStaticParams` yayınlanmış dönemleri diskten
// okur, `dynamicParams = false` bilinmeyen dönemi 404'e düşürür. Böylece
// "gelecek ayın sayfası" gibi boş bir URL hiç var olmaz.
//
// SAYFADA HİÇBİR SAYI ELLE YAZILMAZ. Metin kalıpları veriyi sarar; değer,
// değişim, tarih ve kaynak tek tek anlık görüntüden gelir. Veri yoksa
// bölüm hiç çizilmez — boş yer tutucu rakam yasak.
// ─────────────────────────────────────────────────────────────────────────

export const dynamicParams = false;

export function generateStaticParams() {
  return listPeriods().map((period) => ({ period }));
}

function load(period: string): Snapshot {
  try {
    return getSnapshot(period);
  } catch {
    notFound();
  }
}

export async function generateMetadata({
  params,
}: PageProps<'/endeks/[period]'>): Promise<Metadata> {
  const { period } = await params;
  const snap = load(period);
  const zhvi = metric(snap, 'zhvi-all');
  const title = `Miami konut piyasası endeksi — ${formatPeriod(period)}`;

  // Meta açıklaması da veriden türer: manşet sayı değişince açıklama da
  // değişir, elle güncelleme unutulmaz.
  const description = zhvi
    ? `${formatPeriod(period)} Miami konut verileri: tipik konut değeri ${formatValue(zhvi.value, zhvi.unit)}. ${snap.metrics.length} gösterge, kaynakları ve gözlem tarihleriyle.`
    : `${formatPeriod(period)} Miami konut piyasası göstergeleri, kaynakları ve gözlem tarihleriyle.`;

  return {
    title,
    description,
    alternates: { canonical: `/endeks/${period}` },
    openGraph: { title, description, url: abs(`/endeks/${period}`), type: 'article' },
  };
}

export default async function IndexPeriodPage({ params }: PageProps<'/endeks/[period]'>) {
  const { period } = await params;
  const snap = load(period);

  const featured = snap.metrics.filter((m) => m.featured);
  const rest = snap.metrics.filter((m) => !m.featured);

  // Öne çıkan iki grafik: değer endeksi ve kira endeksi. İkisi AYRI
  // grafiktir — tek eksene bindirmek (dual axis) yasak.
  const zhvi = metric(snap, 'zhvi-all');
  const zori = metric(snap, 'zori');
  const zhviSeries = seriesFor(snap, 'zhvi-all');
  const zoriSeries = seriesFor(snap, 'zori');

  // Yıllık değişim karşılaştırması — iki eleme de veri dürüstlüğü için:
  //
  //  1. `!m.national` — mortgage faizi ABD genelidir. Miami metro
  //     göstergeleriyle aynı sıralamaya koymak, okuyucuya bu sayının da
  //     bölgeyi ölçtüğünü söyler. Ölçmüyor.
  //  2. `comparableChanges(..., 'pct')` — `pp` (yüzde PUANI) satırları HİÇ
  //     seçilmez. `zillow-price-cut` yıllık farkı −3,74 PUANDIR; onu
  //     stokun %−13,20'siyle aynı eksene koymak iki farklı birimi tek
  //     çubuk ailesi gibi gösterirdi. Kapı `chart-geom.mjs`'te ve testli.
  //
  // Elenen gösterge yok sayılmaz: ikisi de "Tüm göstergeler" tablosunda
  // kendi birimiyle durur.
  const yoyEntries = snap.metrics
    .filter((m) => !m.national)
    .map((m) => ({ id: m.id, label: m.label, change: m.yoy }));

  const yoyItems = comparableChanges(yoyEntries, 'pct').flatMap((e) =>
    e.change ? [{ id: e.id, label: e.label, value: e.change.value }] : [],
  );

  const periods = listPeriods();
  const idx = periods.indexOf(period);
  const newer = idx > 0 ? periods[idx - 1] : null;
  const older = idx >= 0 && idx < periods.length - 1 ? periods[idx + 1] : null;

  const jsonLd = graph([
    webPageSchema({
      path: `/endeks/${period}`,
      name: `Miami konut piyasası endeksi — ${formatPeriod(period)}`,
      description: `Miami metro alanı için ${snap.metrics.length} konut piyasası göstergesi.`,
    }),
    datasetSchema(snap),
    breadcrumbSchema([
      { name: 'Endeks', path: '/endeks' },
      { name: formatPeriod(period), path: `/endeks/${period}` },
    ]),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="night-wash">
        <div className="mx-auto max-w-6xl px-5 pt-12 pb-band sm:px-8 sm:pt-16">
          <nav aria-label="Konum" className="font-mono text-[0.6875rem] tracking-wider uppercase">
            <ol className="flex flex-wrap items-center gap-2 text-dim">
              <li>
                <Link href="/" className="transition-colors hover:text-cyan">
                  Ana sayfa
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href="/endeks" className="transition-colors hover:text-cyan">
                  Endeks
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-cyan">{formatPeriod(period)}</li>
            </ol>
          </nav>

          <h1 className="mt-6 max-w-[20ch] font-display text-h1 font-semibold tracking-tight text-balance text-ice">
            Miami konut piyasası endeksi
            <span className="block text-cyan glow-cyan">{formatPeriod(period)}</span>
          </h1>

          <p className="prose-me mt-5 text-body text-mute">
            {snap.geography} için {snap.metrics.length} gösterge ve{' '}
            {snap.derived.length} türetilmiş oran. Her sayının yanında kaynağı ve
            gözlem dönemi yazılıdır; veriler {formatDate(snap.fetchedAt)} tarihinde
            yayıncıların açık dosyalarından çekilmiştir.
          </p>

          {/* Yayın döneminin kendisi bir veri noktası: hangi ayın hangi
              gözlemi. Yayıncılar farklı gecikmelerle yayınlıyor, bu yüzden
              "Ağustos endeksi" Haziran ve Mayıs gözlemleri taşıyabilir. */}
          <p className="mt-3 font-mono text-[0.75rem] text-dim">
            Yayın dönemi {formatPeriod(snap.period)} · gözlem tarihleri gösterge
            başına değişir, her kartta yazılıdır.
          </p>

          {snap.warnings.length > 0 ? (
            <div
              role="note"
              className="panel mt-6 border-l-2 border-l-magenta p-4 sm:p-5"
              aria-label="Veri uyarıları"
            >
              <h2 className="font-mono text-[0.75rem] tracking-wider text-magenta uppercase">
                Bu dönemde eksik kalan veriler
              </h2>
              <ul className="mt-2 space-y-1 text-small text-mute">
                {snap.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
              <p className="mt-2.5 text-[0.8125rem] text-dim">
                Eksik gösterge için tahmini değer yazılmaz; sayfada hiç görünmez.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        {featured.length > 0 ? (
          <section aria-labelledby="one-cikanlar">
            <h2
              id="one-cikanlar"
              className="font-display text-h2 font-semibold tracking-tight text-ice"
            >
              Öne çıkan göstergeler
            </h2>
            <hr className="neon-rule mt-3" />
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((m, i) => (
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

        {zhvi && zhviSeries ? (
          <section className="mt-band" aria-labelledby="deger-grafigi">
            <h2
              id="deger-grafigi"
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

        {zori && zoriSeries ? (
          <section className="mt-band" aria-labelledby="kira-grafigi">
            <h2
              id="kira-grafigi"
              className="font-display text-h2 font-semibold tracking-tight text-ice"
            >
              Talep edilen kira endeksi, son beş yıl
            </h2>
            <hr className="neon-rule neon-rule-magenta mt-3" />
            <TrendChart
              points={zoriSeries.points}
              unit={zori.unit}
              label={zori.label}
              accent="magenta"
              source={`${publisherOf(snap, zori.publisher)?.name ?? ''} · ${zori.dataset}`}
            />
          </section>
        ) : null}

        {canDrawBars(yoyItems) ? (
          <section className="mt-band" aria-labelledby="yillik-degisim">
            <h2
              id="yillik-degisim"
              className="font-display text-h2 font-semibold tracking-tight text-ice"
            >
              Yıllık değişim, gösterge bazında
            </h2>
            <hr className="neon-rule mt-3" />
            <p className="prose-me mt-4 text-small text-mute">
              Aşağıdaki {yoyItems.length} gösterge, bir yıl önceki aynı gözlemle
              karşılaştırılmıştır. Çubuğun uzunluğu değişimin büyüklüğüdür ve
              taban çizgisi sıfırdadır — iki katı uzun çubuk iki katı değişim
              demektir. Karşılaştırılan şey her satırda YÜZDE DEĞİŞİMDİR,
              seviyeler değil: fiyat, adet ve gün ölçen göstergeler bu yüzden
              yan yana durabilir.
            </p>
            <p className="mt-3 font-mono text-[0.75rem] leading-relaxed text-dim">
              Yüzde PUANI ile ölçülen göstergeler (fiyat indirimi oranı,
              mortgage faizi) bu grafiğe alınmaz — puan farkı ile yüzde değişim
              aynı birim değildir. Onlar tabloda kendi birimleriyle durur.
            </p>
            <BarChart
              items={yoyItems}
              kind="pct"
              label="Yıllık değişim"
              compareLabel="geçen yılın aynı ayına"
              source={snap.publishers.map((p) => p.name).join(' · ')}
            />
          </section>
        ) : null}

        {snap.derived.length > 0 ? (
          <section className="mt-band" aria-labelledby="turetilmis">
            <h2
              id="turetilmis"
              className="font-display text-h2 font-semibold tracking-tight text-ice"
            >
              Türetilmiş oranlar
            </h2>
            <hr className="neon-rule neon-rule-magenta mt-3" />
            <p className="prose-me mt-4 text-small text-mute">
              Aşağıdaki iki oran yayıncı verisi DEĞİL, yukarıdaki endekslerden
              hesaplanmıştır. Formülleri açıkça yazılıdır; girdileri değişirse
              sonuç da değişir.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {snap.derived.map((d) => (
                <DerivedCard key={d.id} item={d} />
              ))}
            </div>
          </section>
        ) : null}

        {rest.length > 0 ? (
          <section className="mt-band" aria-labelledby="tum-gostergeler">
            <h2
              id="tum-gostergeler"
              className="font-display text-h2 font-semibold tracking-tight text-ice"
            >
              Tüm göstergeler
            </h2>
            <hr className="neon-rule mt-3" />
            <p className="mt-4 text-small text-dim">
              Dar ekranda tablo kendi içinde yana kayar.
            </p>
            <div className="mt-4">
              <MetricTable
                metrics={snap.metrics}
                publishers={snap.publishers}
                caption={`${formatPeriod(period)} Miami konut piyasası göstergeleri: değer, aylık ve yıllık değişim, gözlem dönemi ve kaynak.`}
              />
            </div>
          </section>
        ) : null}

        <section className="mt-band" aria-labelledby="veri-indir">
          <h2
            id="veri-indir"
            className="font-display text-h2 font-semibold tracking-tight text-ice"
          >
            Ham veri
          </h2>
          <hr className="neon-rule mt-3" />
          <p className="prose-me mt-4 text-small text-mute">
            Bu sayfadaki tüm göstergeler makine okunur biçimde indirilebilir.
            Kaynak gösterildiği sürece serbestçe kullanılabilir.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={`/veri/miami-endeksi-${period}.json`}
              download
              className="panel panel-hover px-4 py-2.5 font-mono text-[0.75rem] tracking-wide text-cyan uppercase"
            >
              JSON indir
            </a>
            <a
              href={`/veri/miami-endeksi-${period}.csv`}
              download
              className="panel panel-hover px-4 py-2.5 font-mono text-[0.75rem] tracking-wide text-cyan uppercase"
            >
              CSV indir
            </a>
          </div>
        </section>

        <section className="mt-band" aria-labelledby="kaynaklar">
          <h2 id="kaynaklar" className="font-display text-h2 font-semibold tracking-tight text-ice">
            Kaynaklar ve kullanım koşulları
          </h2>
          <hr className="neon-rule mt-3" />
          <dl className="mt-6 grid gap-4 sm:grid-cols-3">
            {snap.publishers.map((p) => (
              <div key={p.id} className="panel p-5">
                <dt className="font-display text-h3 font-medium text-ice">
                  <a
                    href={p.url}
                    rel="nofollow noopener external"
                    className="underline decoration-cyan/40 underline-offset-4 transition-colors hover:text-cyan"
                  >
                    {p.name}
                  </a>
                </dt>
                <dd className="mt-2 text-[0.8125rem] leading-relaxed text-mute">{p.terms}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 text-small text-dim">
            Hesaplama yöntemi, hangi serinin neden seçildiği ve bilinen sınırlar:{' '}
            <Link
              href="/metodoloji"
              className="text-cyan underline decoration-cyan/40 underline-offset-4"
            >
              metodoloji sayfası
            </Link>
            .
          </p>
        </section>

        {newer || older ? (
          <nav
            aria-label="Diğer dönemler"
            className="mt-band flex flex-wrap justify-between gap-4 border-t border-edge pt-6"
          >
            {older ? (
              <Link
                href={`/endeks/${older}`}
                className="font-mono text-[0.75rem] tracking-wide text-mute uppercase transition-colors hover:text-cyan"
              >
                ← {formatPeriod(older)}
              </Link>
            ) : (
              <span />
            )}
            {newer ? (
              <Link
                href={`/endeks/${newer}`}
                className="font-mono text-[0.75rem] tracking-wide text-mute uppercase transition-colors hover:text-cyan"
              >
                {formatPeriod(newer)} →
              </Link>
            ) : null}
          </nav>
        ) : null}

        {/* Bağlam bağlantısı: veri okuyan kişinin bir sonraki adımı işlem
            yapmaksa, o iş MiamiLi'nin. Bağlantı utm taşır. */}
        <aside className="panel mt-band border-l-2 border-l-cyan p-6 sm:p-8">
          <h2 className="font-display text-h3 font-medium text-ice">
            Bu verilerle bir alım-satım kararı mı vereceksiniz?
          </h2>
          <p className="prose-me mt-2 text-small text-mute">
            Endeks piyasanın genelini ölçer; tek bir binanın aidatını, kat farkını
            ya da kiraya verilebilirliğini ölçmez. Bina bazında değerlendirme için
            lisanslı broker desteği{' '}
            <a
              href={miamiliUrl('/', 'endeks-cta')}
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
