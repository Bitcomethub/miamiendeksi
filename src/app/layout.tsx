import type { Metadata, Viewport } from 'next';
import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { Analytics } from '@/components/Analytics';
import { SITE } from '@/lib/site';
import { organizationSchema, websiteSchema } from '@/lib/schema';
import { getLatestSnapshot } from '@/lib/snapshot';

// Türkçe diacritics (ı İ ş ğ) `latin-ext` subset'indedir — `latin` tek
// başına yetmez; eksikse tarayıcı yalnız o harfler için fallback fonta
// düşer ve tek kelimenin içinde iki farklı font karışır.
//
// Üç font, üç iş: Space Grotesk başlıkta (teknik/terminal karakteri),
// Inter gövdede (uzun Türkçe metinde en yüksek okunurluk), JetBrains Mono
// RAKAMDA. Sonuncusu keyfî değil — mono yüzeyler `tabular-nums` ile
// sütunlarda basamak hizası verir, veri sitesinde bu zorunludur.
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-space',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: 'Miami Endeksi — Aylık Miami konut piyasası verileri',
    template: '%s | Miami Endeksi',
  },
  description: SITE.description,
  applicationName: SITE.name,
  authors: [{ name: SITE.legalName, url: 'https://miamili.com' }],
  publisher: SITE.legalName,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: SITE.locale,
    url: SITE.url,
    siteName: SITE.name,
    title: 'Miami Endeksi — Aylık Miami konut piyasası verileri',
    description: SITE.description,
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  // Tek disk okuması: başlık ve alt bar aynı anlık görüntüden beslenir.
  // Layout bir SUNUCU bileşeni olduğu için bu iş build anında biter;
  // çalışma zamanında dosya sistemine dokunulmaz.
  const snap = getLatestSnapshot();

  return (
    <html
      lang={SITE.lang}
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-night text-ice">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([organizationSchema(), websiteSchema()]),
          }}
        />
        <a
          href="#icerik"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-cyan focus:px-4 focus:py-2 focus:font-mono focus:text-small focus:text-night"
        >
          İçeriğe atla
        </a>
        <SiteHeader period={snap.period} />
        <main id="icerik" className="flex-1">
          {children}
        </main>
        <SiteFooter publishers={snap.publishers} fetchedAt={snap.fetchedAt} />
        <Analytics />
      </body>
    </html>
  );
}

export const viewport: Viewport = {
  themeColor: '#0b0f1e',
  width: 'device-width',
  initialScale: 1,
};
