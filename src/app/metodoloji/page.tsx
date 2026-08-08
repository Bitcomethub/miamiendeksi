import type { Metadata } from 'next';
import Link from 'next/link';
import { abs } from '@/lib/site';
import { formatDate, formatMonth } from '@/lib/format';
import { getLatestSnapshot } from '@/lib/snapshot';
import { graph, webPageSchema, breadcrumbSchema, faqSchema } from '@/lib/schema';

// ─────────────────────────────────────────────────────────────────────────
// Metodoloji
//
// Bu sayfa pazarlama metni değil, sitenin denetlenebilirlik belgesidir.
// Bir veri sitesinin tek gerçek sermayesi "bu sayı nereden geldi" sorusuna
// tam cevap verebilmesi; cevap veremeyen site, güzel grafikli bir blogdur.
//
// Gösterge listesi ELLE YAZILMAZ — anlık görüntüden türer. Yeni bir metrik
// hatta eklendiğinde metodoloji sayfası kendiliğinden onu anlatır; elle
// tutulan bir liste ilk ayda bayatlardı.
// ─────────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Metodoloji — veriler nereden geliyor, nasıl hesaplanıyor',
  description:
    'Miami Endeksi hangi kaynaklardan hangi seriyi çekiyor, neyi hesaplıyor, neyi hesaplamıyor. Gözlem gecikmeleri, revizyon politikası ve bilinen sınırlar.',
  alternates: { canonical: '/metodoloji' },
  openGraph: { url: abs('/metodoloji'), type: 'article' },
};

const FAQS = [
  {
    q: 'Miami Endeksi verileri nereden alıyor?',
    a: 'Üç kamuya açık kaynaktan: Zillow Research (ZHVI, ZORI, stok ve satış hızı serileri), Redfin Data Center (aylık pazar verisi) ve FRED (mortgage faizi ile Realtor.com kaynaklı ilan serileri). Hiçbir sayı elle girilmez; hepsi yayıncının açık dosyasından programatik çekilir ve her gösterge kendi kaynak bağlantısını taşır.',
  },
  {
    q: 'Endeks hangi coğrafyayı kapsıyor?',
    a: 'Miami-Fort Lauderdale-Pompano Beach metropol istatistik alanı; yani Miami-Dade, Broward ve Palm Beach ilçeleri. Bu, Miami şehir sınırından çok daha geniştir. Brickell ya da Sunny Isles gibi tek bir mahallenin rakamı değildir.',
  },
  {
    q: 'Veriler ne kadar günceldir?',
    a: 'Yayıncılar farklı gecikmelerle çalışır. Zillow serileri genellikle bir önceki ayın sonunu, Redfin iki ay öncesini, FRED üzerinden gelen mortgage faizi ise haftalık olarak son günleri gösterir. Bu yüzden her göstergenin yanında gözlem dönemi ayrı ayrı yazılıdır; sayfanın yayın ayı ile verinin ait olduğu ay aynı değildir.',
  },
  {
    q: 'ZHVI ile medyan satış fiyatı arasındaki fark nedir?',
    a: 'Medyan satış fiyatı, o ay SATILAN konutların ortasıdır; ay içinde lüks satış ağırlık kazanırsa piyasa değişmese bile yükselir. ZHVI ise piyasanın orta yüzde 33–67 dilimindeki tipik konutun değerini izler ve satılan konutların bileşiminden etkilenmez. İkisi farklı soruları cevaplar; aynı grafikte karşılaştırılmaz.',
  },
  {
    q: 'Yayınlanan rakamlar sonradan değişir mi?',
    a: 'Yayıncılar serilerini revize edebilir. Yayınlanmış aylık sayfalar geriye dönük DÜZELTİLMEZ — o sayfa, o tarihte açık olan veriyi gösterir ve arşiv olarak kalır. Revizyonun etkisi bir sonraki ayın sayfasında görünür.',
  },
  {
    q: 'Brüt kira getirisi neden gerçek getirim değil?',
    a: 'Brüt getiri iki ayrı endeksin oranıdır: yıllık talep edilen kira bölü tipik konut değeri. Aidat, emlak vergisi, sigorta, boşluk dönemi ve yönetim gideri düşülmemiştir. Miami kondolarında bu kalemler yüksektir; net getiri brütün belirgin biçimde altındadır. Rakam piyasanın kabaca nerede durduğunu gösterir, tek bir dairenin getirisini değil.',
  },
];

export default function MethodologyPage() {
  const snap = getLatestSnapshot();

  const byPublisher = snap.publishers.map((p) => ({
    publisher: p,
    metrics: snap.metrics.filter((m) => m.publisher === p.id),
  }));

  const jsonLd = graph([
    webPageSchema({
      path: '/metodoloji',
      name: 'Metodoloji',
      description:
        'Miami Endeksi veri kaynakları, hesaplama yöntemi, gözlem gecikmeleri ve bilinen sınırlar.',
    }),
    breadcrumbSchema([{ name: 'Metodoloji', path: '/metodoloji' }]),
    faqSchema(FAQS),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="night-wash">
        <div className="mx-auto max-w-6xl px-5 pt-12 pb-10 sm:px-8 sm:pt-16">
          <h1 className="max-w-[22ch] font-display text-h1 font-semibold tracking-tight text-balance text-ice">
            Metodoloji
          </h1>
          <p className="prose-me mt-5 text-body text-mute">
            Bu sitenin tek vaadi var: yayınlanan her sayı gerçek bir kaynaktan
            gelir ve nereden geldiği yazılıdır. Aşağıda hangi seriyi neden
            seçtiğimiz, neyi hesapladığımız ve neyi hesaplamadığımız var.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <section aria-labelledby="ilke">
          <h2 id="ilke" className="font-display text-h2 font-semibold tracking-tight text-ice">
            Çalışma ilkeleri
          </h2>
          <hr className="neon-rule mt-3" />
          <ol className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              {
                t: 'Tahmini sayı yok',
                d: 'Bir gösterge çekilemezse o gösterge sayfada hiç görünmez ve dönemin uyarı listesine yazılır. Boşluğu doldurmak için tahmin, geçen ayın değeri ya da yuvarlanmış bir yer tutucu YAZILMAZ.',
              },
              {
                t: 'Her sayının künyesi var',
                d: 'Değer, gözlem dönemi, yayıncı, veri seti adı ve çekim tarihi birlikte gösterilir. Kaynağa doğrudan bağlantı verilir; okuyucu aynı dosyayı indirip doğrulayabilir.',
              },
              {
                t: 'Yorum metni de denetlenir',
                d: 'Analiz yazılarındaki her sayı, yayından önce veri anlık görüntüsüne karşı programatik doğrulanır. Eşleşmeyen tek bir rakam varsa metnin tamamı reddedilir; kısmi düzeltme yapılmaz.',
              },
              {
                t: 'Tahmin ve tavsiye yayınlanmaz',
                d: 'Site gerçekleşmiş veriyi raporlar. Fiyat öngörüsü, alım-satım tavsiyesi ve getiri garantisi içeren dil otomatik kapıda engellenir.',
              },
            ].map((x, i) => (
              <li key={x.t} className="panel p-5">
                <p className="font-mono text-[0.6875rem] tracking-wider text-cyan uppercase">
                  {String(i + 1).padStart(2, '0')}
                </p>
                <h3 className="mt-2 font-display text-h3 font-medium text-ice">{x.t}</h3>
                <p className="mt-2 text-small leading-relaxed text-mute">{x.d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-band" aria-labelledby="kapsam">
          <h2 id="kapsam" className="font-display text-h2 font-semibold tracking-tight text-ice">
            Coğrafi kapsam
          </h2>
          <hr className="neon-rule mt-3" />
          <p className="prose-me mt-4 text-body text-mute">
            Tüm göstergeler {snap.geography} içindir. Bu alan Miami şehir
            sınırından çok daha geniştir: Miami Beach de, Fort Lauderdale de, West
            Palm Beach de aynı metro alanının içindedir. Metro seviyesinde bir
            endeks, tek bir mahallenin ya da tek bir binanın fiyatını temsil
            ETMEZ — mahalle bazında sapma metro ortalamasından büyük olabilir.
          </p>
          <p className="prose-me mt-4 text-body text-mute">
            Mortgage faizi tek istisnadır: ABD geneli haftalık ortalamadır ve
            Miami&apos;ye özgü değildir. Kartlarda ve tabloda &laquo;ABD
            geneli&raquo; rozetiyle işaretlidir.
          </p>
        </section>

        <section className="mt-band" aria-labelledby="kaynak-detay">
          <h2
            id="kaynak-detay"
            className="font-display text-h2 font-semibold tracking-tight text-ice"
          >
            Kaynak kaynak göstergeler
          </h2>
          <hr className="neon-rule mt-3" />
          <p className="prose-me mt-4 text-small text-mute">
            Aşağıdaki liste elle tutulmaz; en güncel anlık görüntüden üretilir.
            Hatta yeni bir gösterge eklendiğinde bu sayfa da kendiliğinden
            günceller.
          </p>

          <div className="mt-6 space-y-8">
            {byPublisher.map(({ publisher, metrics }) =>
              metrics.length === 0 ? null : (
                <div key={publisher.id}>
                  <h3 className="font-display text-h3 font-medium text-ice">
                    <a
                      href={publisher.url}
                      rel="nofollow noopener external"
                      className="underline decoration-cyan/40 underline-offset-4 transition-colors hover:text-cyan"
                    >
                      {publisher.name}
                    </a>
                  </h3>
                  <p className="mt-1.5 max-w-[70ch] text-[0.8125rem] text-dim">
                    {publisher.terms}
                  </p>

                  {/* `relative` gerekli: `position:static` bir kaydırma kutusu,
                      mutlak konumlu torunlarını (burada `.sr-only` başlık)
                      kırpmaz ve onlar sayfayı yana kaydırır. Bkz. MetricTable. */}
                  <div className="panel relative mt-4 overflow-x-auto">
                    <table className="w-full min-w-[42rem] border-collapse text-left">
                      <caption className="sr-only">
                        {publisher.name} kaynaklı göstergeler, veri setleri ve gözlem
                        dönemleri
                      </caption>
                      <thead>
                        <tr className="border-b border-edge">
                          {['Gösterge', 'Veri seti', 'Son gözlem', 'Ne ölçer'].map((h) => (
                            <th
                              key={h}
                              scope="col"
                              className="px-4 py-3 font-mono text-[0.6875rem] tracking-wider text-dim uppercase"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.map((m) => (
                          <tr key={m.id} className="border-b border-edge/60 last:border-0">
                            <th
                              scope="row"
                              className="px-4 py-3 text-small leading-snug font-normal text-ice"
                            >
                              {m.label}
                            </th>
                            <td className="px-4 py-3 font-mono text-[0.75rem] text-mute">
                              {m.dataset}
                            </td>
                            <td className="px-4 py-3 font-mono text-[0.75rem] whitespace-nowrap text-mute">
                              {formatMonth(m.asOf)}
                            </td>
                            <td className="max-w-[38ch] px-4 py-3 text-[0.8125rem] leading-relaxed text-dim">
                              {m.note}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ),
            )}
          </div>
        </section>

        <section className="mt-band" aria-labelledby="hesap">
          <h2 id="hesap" className="font-display text-h2 font-semibold tracking-tight text-ice">
            Hesaplananlar
          </h2>
          <hr className="neon-rule neon-rule-magenta mt-3" />
          <p className="prose-me mt-4 text-body text-mute">
            Aylık ve yıllık değişimler serinin kendi geçmiş gözleminden
            hesaplanır: aylık değişim bir önceki gözleme, yıllık değişim on iki ay
            öncesine göredir. Yüzde birimli göstergelerde (mortgage faizi, indirim
            oranı) değişim <strong className="text-ice">puan</strong> olarak
            verilir, yüzde olarak değil — faizin 6,49&apos;dan 6,69&apos;a çıkması
            0,20 puanlık bir artıştır.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {snap.derived.map((d) => (
              <div key={d.id} className="panel p-5">
                <h3 className="font-display text-h3 font-medium text-ice">{d.label}</h3>
                <p className="mt-2 font-mono text-[0.8125rem] text-cyan">{d.formula}</p>
                <p className="mt-2 text-small leading-relaxed text-mute">{d.note}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-band" aria-labelledby="sinirlar">
          <h2 id="sinirlar" className="font-display text-h2 font-semibold tracking-tight text-ice">
            Bilinen sınırlar
          </h2>
          <hr className="neon-rule mt-3" />
          <ul className="prose-me mt-4 space-y-3 text-body text-mute">
            <li>
              <strong className="text-ice">Gecikme.</strong> Hiçbir kaynak &laquo;bugünü&raquo;
              göstermez. Son gözlem tarihleri gösterge başına farklıdır ve her
              kartta yazılıdır.
            </li>
            <li>
              <strong className="text-ice">Metro ortalaması.</strong> Mahalle, bina ve kat
              farkları endeksin içinde kaybolur. Waterfront bir kondo ile
              batıdaki bir müstakil aynı ortalamaya girer.
            </li>
            <li>
              <strong className="text-ice">Kondo piyasasının özel yükleri.</strong> Florida&apos;da
              aidat, yapısal rezerv ve sigorta kalemleri kondolarda hızlı
              değişebiliyor. Bu kalemler hiçbir fiyat ya da kira endeksinin içinde
              değildir.
            </li>
            <li>
              <strong className="text-ice">Mevsimsellik.</strong> Zillow&apos;un değer serisi
              mevsimsel düzeltilmiş, Redfin&apos;den alınan seri ham (düzeltilmemiş)
              veridir. İkisi doğrudan birbirine karşı okunmaz.
            </li>
            <li>
              <strong className="text-ice">Kur yok.</strong> Tüm rakamlar ABD dolarıdır.
              Türk lirası karşılığı yayınlanmaz; kur çevrimi okuyucunun kendi
              tarihinde yapması gereken ayrı bir karardır.
            </li>
          </ul>
        </section>

        <section className="mt-band" aria-labelledby="sss">
          <h2 id="sss" className="font-display text-h2 font-semibold tracking-tight text-ice">
            Sık sorulanlar
          </h2>
          <hr className="neon-rule mt-3" />
          {/* Cevaplar hem şemada hem EKRANDA: Google yalnızca sayfada görünen
              içeriği zengin sonuçta gösterir. Birini silersen ikisini birden sil. */}
          <dl className="mt-6 space-y-5">
            {FAQS.map((f) => (
              <div key={f.q} className="panel p-5">
                <dt className="font-display text-h3 leading-snug font-medium text-balance text-ice">
                  {f.q}
                </dt>
                <dd className="prose-me mt-2 text-small leading-relaxed text-mute">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="mt-band border-t border-edge pt-6 font-mono text-[0.75rem] text-dim">
          Son veri çekimi {formatDate(snap.fetchedAt)} ·{' '}
          <Link href={`/endeks/${snap.period}`} className="text-cyan underline underline-offset-4">
            güncel endeks
          </Link>
        </p>
      </div>
    </>
  );
}
