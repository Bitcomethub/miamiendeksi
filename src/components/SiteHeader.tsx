import Link from 'next/link';
import { SITE } from '@/lib/site';
import { formatPeriod } from '@/lib/format';
import { SiteMark } from './SiteMark';

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
          {/* `items-baseline` KORUNUR — dönem etiketi marka adıyla aynı
              çizgide durmalı. SVG'nin tabanı metin taban çizgisine oturur,
              2px kaydırma optik hizayı verir.

              ÖLÇÜM (headless Chrome, menü sabit 223px, gap-x-4, px-5):
                marka 110px (işaretsiz) → ≥393px tek satır
                marka 137px (işaretli)  → ≥417px tek satır  (416 sarıyor)
              İşaret 27px (17px ikon + 10px `gap-2.5`) ekliyor ve iPhone 15
              genişliğini (393) sarmaya itiyordu (65px → 98px). ÇÖZÜM: işaret
              420px ALTINDA render EDİLMEZ — ölçülen eşik 417, 3px pay yazı tipi
              geri düşerse metin genişliği kayabildiği için. Boşluk değerlerine
              (`gap-2.5`, menü `gap-1`, `px-2.5`) DOKUNULMADI, kasıtlı.

              BEDELİ AÇIK OLSUN: işaret çoğu telefonda GÖRÜNMEZ (393 iPhone 15,
              360-412 Android). 430px+ (Pro Max) ve tablet/masaüstünde görünür.
              Telefonda da istenirse tek yol boşluk kısmaktır: `gap-2.5`→`gap-2`
              + ikon `1.05`→`0.95rem` + menü `gap-1`→`gap-0.5` = 8px, eşiği
              393'e indirir. ÖLÇÜLDÜ ama uygulanmadı. Değiştiren YENİDEN ölçer. */}
          <SiteMark className="hidden h-[1.05rem] w-[1.05rem] shrink-0 translate-y-[2px] min-[420px]:block" />
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
