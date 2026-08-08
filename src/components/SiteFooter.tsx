import Link from 'next/link';
import { SITE, PUBLISHER, miamiliUrl } from '@/lib/site';
import { formatDate } from '@/lib/format';

// ─────────────────────────────────────────────────────────────────────────
// Alt bar
//
// İki iş yapar:
//   1. KÜNYE — "Bir MiamiLi Media yayınıdır." Sahiplik gizlenmez.
//   2. KAYNAK BEYANI — hangi veri setlerinden beslendiği ve son çekim
//      tarihi. Bu satır dekoratif değil: sitenin tek vaadi kaynaklı olmak,
//      vaadin kanıtı her sayfanın altında durmalı.
//
// MiamiLi'ye giden bağlantılar `miamiliUrl()` ile üretilir (utm zorunlu);
// elle yazılmış bir `https://miamili.com` attribution'ı sessizce öldürür.
// ─────────────────────────────────────────────────────────────────────────

export function SiteFooter({
  publishers,
  fetchedAt,
}: {
  publishers: { id: string; name: string; url: string }[];
  fetchedAt: string;
}) {
  // Telif yılı veri çekim tarihinden türer, `new Date()`'ten DEĞİL: prerender
  // edilmiş HTML ile client hydration'ı yıl dönümünde uyuşmazdı.
  const year = fetchedAt.slice(0, 4);

  return (
    <footer className="mt-band border-t border-edge bg-panel/40">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-display text-[1.0625rem] font-semibold tracking-tight text-ice">
              {SITE.name}
            </p>
            <p className="mt-2 max-w-[34ch] text-small text-mute">{SITE.tagline}</p>
          </div>

          <nav aria-labelledby="footer-site">
            <h2
              id="footer-site"
              className="font-mono text-[0.6875rem] tracking-wider text-dim uppercase"
            >
              Site
            </h2>
            <ul className="mt-3 space-y-2 text-small">
              {[
                { href: '/endeks', label: 'Aylık endeks' },
                { href: '/analiz', label: 'Analiz yazıları' },
                { href: '/metodoloji', label: 'Metodoloji' },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-mute transition-colors hover:text-cyan">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-sources">
            <h2
              id="footer-sources"
              className="font-mono text-[0.6875rem] tracking-wider text-dim uppercase"
            >
              Veri kaynakları
            </h2>
            <ul className="mt-3 space-y-2 text-small">
              {publishers.map((p) => (
                <li key={p.id}>
                  <a
                    href={p.url}
                    rel="noopener external"
                    className="text-mute transition-colors hover:text-cyan"
                  >
                    {p.name}
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-3 font-mono text-[0.6875rem] text-dim">
              Son çekim: {formatDate(fetchedAt)}
            </p>
          </nav>

          <div>
            <h2 className="font-mono text-[0.6875rem] tracking-wider text-dim uppercase">
              Yayıncı
            </h2>
            {/* Zorunlu künye — brief'te aynen istendi. */}
            <p className="mt-3 text-small text-mute">
              Bir{' '}
              <a
                href={miamiliUrl('/', 'footer-kunye')}
                rel="noopener"
                className="text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan"
              >
                {PUBLISHER.name}
              </a>{' '}
              yayınıdır.
            </p>
            <p className="mt-2 max-w-[34ch] text-[0.8125rem] leading-relaxed text-dim">
              Miami&apos;de gayrimenkul alım-satımı için{' '}
              <a
                href={miamiliUrl('/', 'footer-danisma')}
                rel="noopener"
                className="text-mute underline decoration-mute/30 underline-offset-4 transition-colors hover:text-cyan"
              >
                miamili.com
              </a>
              .
            </p>
          </div>
        </div>

        <hr className="neon-rule mt-10" />

        <div className="mt-5 flex flex-col gap-2 text-[0.8125rem] text-dim sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {PUBLISHER.name}. Veri setlerinin hakları ilgili yayıncılara
            aittir.
          </p>
          {/* Sitenin ne OLMADIĞI: yatırım tavsiyesi. Sayı yayınlayan bir
              site için bu satır hukuki değil, editoryal bir sınırdır. */}
          <p className="max-w-[46ch] sm:text-right">
            Yayınlanan veriler bilgilendirme amaçlıdır; yatırım tavsiyesi değildir.
          </p>
        </div>
      </div>
    </footer>
  );
}
