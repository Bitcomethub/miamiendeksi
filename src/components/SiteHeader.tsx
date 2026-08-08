import Link from 'next/link';
import { SITE } from '@/lib/site';
import { formatPeriod } from '@/lib/format';

// ─────────────────────────────────────────────────────────────────────────
// Üst bar
//
// Dönem (`period`) prop olarak GELİR, burada okunmaz: dönem bilgisi
// `node:fs` ile disk okuyan `snapshot.ts`'te yaşıyor. Layout zaten bir
// sunucu bileşeni, okuma orada bir kez yapılır; başlık saf kalır.
//
// Menü üç bağlantıdır ve açılır menü YOKTUR — dört sayfalık bir sitede
// dropdown, klavye/ARIA yükünü karşılıksız satın almaktır.
// ─────────────────────────────────────────────────────────────────────────

const NAV = [
  { href: '/endeks', label: 'Endeks' },
  { href: '/analiz', label: 'Analiz' },
  { href: '/metodoloji', label: 'Metodoloji' },
];

export function SiteHeader({ period }: { period: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-edge bg-night/85 backdrop-blur-md">
      {/* `flex-wrap` + iki tarafta da `shrink-0`: 320 px'te marka (≈115 px) ile
          menü (≈233 px) tek satıra SIĞMIYOR (kullanılabilir genişlik 280 px) ve
          eskiden marka kelimesi ortadan bölünüp yine de 9 px taşıyordu. Kırılma
          noktası tahmin etmek yerine sarma kuralı işi yapıyor: sığdığı her
          genişlikte tek satır kalır, sığmadığı yerde menü alt satıra iner.
          `shrink-0` olmazsa flex önce metni ezmeyi dener — asıl kusur oydu. */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3.5 sm:px-8">
        <Link href="/" className="group flex shrink-0 items-baseline gap-2.5">
          <span className="font-display text-[1.0625rem] font-semibold tracking-tight text-ice">
            {SITE.name}
          </span>
          {/* Yayında olan dönem marka kilidinin yanında: ziyaretçinin ilk
              sorusu "bu veri ne kadar taze". Cevabı aramaya bırakma. */}
          <span className="hidden font-mono text-[0.6875rem] tracking-wider text-cyan uppercase sm:inline">
            {formatPeriod(period)}
          </span>
        </Link>

        <nav aria-label="Ana menü" className="shrink-0">
          {/* `-ml-2.5`: alt satıra indiğinde ilk bağlantının METNİ marka ile
              hizalansın — hizayı bozan şey görünmez iç boşluk. Tek satırda
              menü sağa yaslı olduğu için sağ kenarı değişmez. */}
          <ul className="-ml-2.5 flex items-center gap-1 sm:ml-0">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block px-2.5 py-2 font-mono text-[0.75rem] tracking-wide text-mute uppercase transition-colors hover:text-cyan sm:px-3"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
