'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';

// ─────────────────────────────────────────────────────────────────────────
// GA4 + kendi onay kapımız (KVKK/GDPR)
//
// KURAL: onay kapısı GÖRÜNÜRLÜĞÜ değil RENDER'ı kontrol eder. CSS ile
// gizlenmiş bir <Script> yine indirilir, yine çalışır, yine çerez yazar.
// Bu yüzden gtag JSX'i yalnızca `consent === 'granted'` iken AĞACA GİRER.
//
// "Reddet" butonu "Kabul et" ile EŞİT AĞIRLIKTA olmak zorunda (GDPR
// Art. 7(3) / EDPB 05/2020): reddetmek kabul etmek kadar kolay değilse
// banner uyumsuzdur. Tek butonlu "anladım" bandı bu kapıyı geçmez.
//
// Ölçüm kimliği env'den okunur. `NEXT_PUBLIC_*` BUILD anında gömülür:
// Vercel'e eklendikten sonra yeniden deploy edilmezse ölçüm çalışmaz.
// Kimlik yoksa banner HİÇ gösterilmez — onay istemenin karşılığı olmaz.
// ─────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'me-consent-v1';
const GA_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;

type Consent = 'unknown' | 'granted' | 'denied';

export function Analytics() {
  // Sunucu ve ilk client render'ı 'unknown' — localStorage okuması effect'te,
  // aksi hâlde prerender edilmiş HTML ile hydration çıktısı uyuşmaz.
  const [consent, setConsent] = useState<Consent>('unknown');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'granted' || stored === 'denied') setConsent(stored);
    } catch {
      // localStorage engelliyse (gizli sekme / üçüncü parti kısıtı) onay
      // sorulmamış sayılır; ölçüm yapılmaz, banner her oturumda görünür.
    }
  }, []);

  function decide(value: Exclude<Consent, 'unknown'>) {
    setConsent(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* yazılamıyorsa karar yalnızca bu oturum için geçerli */
    }
  }

  const showBanner = mounted && consent === 'unknown' && Boolean(GA_ID);

  return (
    <>
      {consent === 'granted' && GA_ID ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'granted'});
gtag('config','${GA_ID}',{anonymize_ip:true});`}
          </Script>
        </>
      ) : null}

      {showBanner ? (
        <div
          role="dialog"
          aria-labelledby="consent-title"
          aria-describedby="consent-desc"
          className="panel fixed inset-x-3 bottom-3 z-50 px-5 py-4 shadow-[0_18px_50px_-12px_rgb(0_0_0/0.7)] sm:inset-x-auto sm:right-5 sm:bottom-5 sm:max-w-sm"
        >
          <h2
            id="consent-title"
            className="font-display text-small font-semibold tracking-tight text-ice"
          >
            Ölçümleme çerezleri
          </h2>
          <p id="consent-desc" className="mt-1.5 text-[0.8125rem] leading-relaxed text-mute">
            Hangi verilerin okunduğunu görmek için Google Analytics kullanmak
            istiyoruz. Reklam çerezi yok. Reddederseniz site aynı şekilde çalışır.
          </p>
          <div className="mt-3.5 flex gap-2">
            <button
              type="button"
              onClick={() => decide('granted')}
              className="cursor-pointer bg-cyan px-4 py-2 font-mono text-[0.75rem] tracking-wide text-night uppercase transition-colors hover:bg-ice"
            >
              Kabul et
            </button>
            <button
              type="button"
              onClick={() => decide('denied')}
              className="cursor-pointer px-4 py-2 font-mono text-[0.75rem] tracking-wide text-mute uppercase underline decoration-mute/40 underline-offset-4 transition-colors hover:text-ice"
            >
              Reddet
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
