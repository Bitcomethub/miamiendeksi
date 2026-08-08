#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
// Dar ekran taşma denetimi — 393 px (iPhone 15 mantıksal genişliği)
//
// EKRAN GÖRÜNTÜSÜNE BAKMAZ. Yatay taşma göz kararıyla denetlenmez: 4 px'lik
// bir taşma bir görüntüde fark edilmez ama gerçek telefonda sayfayı yana
// kaydırır. Burada `scrollWidth` ve her elemanın kutu sınırı ÖLÇÜLÜR.
//
// Bağımlılık kurmaz: sistemdeki Chrome'u başlatıp CDP'ye ham WebSocket ile
// bağlanır. (Node 20'de WebSocket bayrak arkasında — npm script bunu geçer.)
//
// Kullanım: npm run check:layout   (sunucu ayrı terminalde açık olmalı)
// ─────────────────────────────────────────────────────────────────────────

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const BASE = process.env.CHECK_BASE ?? 'http://localhost:4321';
const WIDTHS = [320, 393, 768];
const PATHS = [
  '/',
  '/endeks',
  '/endeks/2026-08',
  '/analiz',
  '/analiz/stok-eriyor-fiyat-geriliyor',
  '/metodoloji',
];

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9223;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function findTarget() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      /* Chrome henüz dinlemiyor */
    }
    await sleep(250);
  }
  throw new Error('Chrome CDP uç noktası açılmadı');
}

/** Minimal CDP istemcisi — id eşlemeli istek/yanıt. */
function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  let nextId = 1;

  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    const slot = pending.get(msg.id);
    if (!slot) return;
    pending.delete(msg.id);
    if (msg.error) slot.reject(new Error(JSON.stringify(msg.error)));
    else slot.resolve(msg.result);
  });

  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('CDP bağlantısı kurulamadı')), {
      once: true,
    });
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

  return { ready, send, close: () => ws.close() };
}

// Tarayıcı içinde çalışacak ölçüm. `document` burada YOK — string olarak
// gönderiliyor, Chrome içinde değerlendiriliyor.
const MEASURE = `(() => {
  const de = document.documentElement;
  const overflow = de.scrollWidth - de.clientWidth;
  const guilty = [];

  // Yatay kaydırılabilir bir ata, çocuğunu KENDİ kaydırma alanına hapseder:
  // 736 px'lik bir tablo, \`overflow-x:auto\` bir sarmalayıcının içindeyse
  // sayfayı yana kaydırmaz. Böyle elemanlar sayfa taşmasının SEBEBİ değildir
  // ve raporda yer kaplarlarsa gerçek suçluyu gizlerler (bu bir kez oldu:
  // ilk sekiz satırı tablo hücreleri doldurdu, asıl taşan eleman listeye
  // hiç girmedi).
  const clipped = (el) => {
    for (let p = el.parentElement; p && p !== de; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') return true;
    }
    return false;
  };

  // \`clipped\` bir SEZGİDİR, kanıt değil: \`overflow-x:hidden\` duran bir ata,
  // konumlandırılmamışsa \`position:absolute\` bir torunu kırpMAZ. Yani filtre
  // bazen gerçek suçluyu eler. Bu yüzden iki liste tutuluyor ve rapor asla
  // "taşma var ama sorumlu yok" demiyor: suçlu listesi boş kalırsa kırpılmış
  // sayılanlar şüpheli olarak gösterilir.
  const suspects = [];

  if (overflow > 0) {
    const limit = de.clientWidth;
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.right <= limit + 1 && r.left >= -1) continue;
      const row = {
        tag: el.tagName.toLowerCase(),
        cls: (el.getAttribute('class') || '').slice(0, 70),
        text: (el.textContent || '').trim().slice(0, 40),
        left: Math.round(r.left),
        right: Math.round(r.right),
        width: Math.round(r.width),
      };
      if (clipped(el)) suspects.push(row);
      else guilty.push(row);
    }
  }

  // En çok taşan önce: kırpma listesi kısaltılacaksa, kesilen uç en az
  // bilgilendirici olan uç olmalı.
  guilty.sort((a, b) => b.right - a.right);
  suspects.sort((a, b) => b.right - a.right);

  const list = guilty.length > 0 ? guilty : suspects;

  return {
    scrollWidth: de.scrollWidth,
    clientWidth: de.clientWidth,
    overflow,
    fallback: guilty.length === 0 && suspects.length > 0,
    guiltyTotal: list.length,
    guilty: list.slice(0, 8),
  };
})()`;

// ─────────────────────────────────────────────────────────────────────────
// DOKUNMA HEDEFİ BOYUTU BURADA DENETLENMİYOR — bilinçli.
//
// İlk sürüm 24×24 px altındaki her <a>'yı işaretliyordu ve gövde metninin
// içindeki bağlantıların TAMAMINI yakalıyordu. WCAG 2.2 SC 2.5.8 bir cümle
// ya da metin bloğu içindeki hedefleri AÇIKÇA muaf tutar ("inline
// exception"); görsel olarak gizlenmiş "içeriğe atla" bağlantısı da
// odaklanana dek 1×1'dir ve doğru davranıştır.
//
// Yani denetim, kurallara UYAN kodu suçluyordu. Yanlış alarm veren bir kapı,
// bir süre sonra okunmayan bir kapıdır. Dokunma hedefi ölçümü Lighthouse'un
// kendi denetimine bırakıldı; buradaki script tek bir şeyi, kesin biçimde
// ölçüyor: yatay taşma.
// ─────────────────────────────────────────────────────────────────────────

async function main() {
  const profile = mkdtempSync(path.join(tmpdir(), 'miamiendeksi-chrome-'));
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  let failures = 0;

  try {
    const wsUrl = await findTarget();
    const cdp = connect(wsUrl);
    await cdp.ready;
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    for (const width of WIDTHS) {
      console.log(`\n▸ ${width} px`);

      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 900,
        deviceScaleFactor: 1,
        mobile: width < 768,
      });

      for (const p of PATHS) {
        await cdp.send('Page.navigate', { url: BASE + p });
        // Yükleme + yazı tipi yerleşimi. Yazı tipi geç gelirse metin
        // genişliği değişir ve erken ölçüm yalancı "temiz" verir.
        await sleep(700);
        await cdp.send('Runtime.evaluate', {
          expression: 'document.fonts ? document.fonts.ready : Promise.resolve()',
          awaitPromise: true,
        });

        const { result } = await cdp.send('Runtime.evaluate', {
          expression: MEASURE,
          returnByValue: true,
        });
        const r = result.value;

        const clean = r.overflow <= 0;
        if (!clean) failures += 1;

        console.log(
          `  ${clean ? '✓' : '✗'} ${p.padEnd(38)} scrollWidth ${r.scrollWidth} / görünür ${r.clientWidth}`,
        );

        if (r.overflow > 0) {
          const more = r.guiltyTotal > r.guilty.length ? ` (${r.guiltyTotal} elemandan ilk ${r.guilty.length})` : '';
          const how = r.fallback ? ' — kırpılmış sanılanlar, ŞÜPHELİ' : '';
          console.log(`      ↳ ${r.overflow} px yatay taşma${more}${how}:`);
          for (const g of r.guilty) {
            console.log(
              `         <${g.tag} class="${g.cls}"> sol ${g.left} sağ ${g.right} (gen ${g.width}) "${g.text}"`,
            );
          }
        }
      }
    }

    cdp.close();
  } finally {
    chrome.kill();
    // Chrome kill'den SONRA da profile yazmayı sürdürüyor; hemen silmek
    // ENOTEMPTY veriyor ve geçici dizin temizliği denetimi kırıyordu.
    // Çıkışı bekle, sonra sil — ve silme hatası denetimin sonucunu
    // GÖLGELEMESİN (geçici dizin, ölçümün doğruluğuyla ilgisiz).
    await new Promise((r) => {
      chrome.once('exit', r);
      setTimeout(r, 3000);
    });
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    } catch {
      /* geçici dizin kalabilir — /tmp temizler */
    }
  }

  if (failures > 0) {
    console.error(`\n✗ ${failures} sayfa/genişlik kombinasyonunda yatay taşma var.`);
    process.exit(1);
  }
  console.log('\n✓ Hiçbir genişlikte yatay taşma yok.');
}

main().catch((err) => {
  console.error('✗ Denetim çöktü:', err.message);
  process.exit(1);
});
