# Miami Endeksi — miamiendeksi.com

Miami konut piyasasının **aylık, kaynaklı** veri yayını. Türk yatırımcı için Türkçe.
Yayıncı: MiamiLi Media (`miamili.com`). Repo: `~/code/miamiendeksi`.

## Oturum protokolü

1. Oturum BAŞINDA `.claude/LEARNINGS.md` oku (kısa dosya). `LEARNINGS_ARCHIVE.md`'yi
   oturum başında OKUMA — yalnızca oradaki bir başlığa benzeyen bir semptomu aktif
   olarak ayıklarken aç.
2. Oturum SONUNDA / son commit'ten önce: şu eşiklerden biri geçildiyse
   `extract-approach` skill'ini uygula — 2+ başarısız deneme, semptomdan uzakta
   bulunan kök neden, gerçek mimari seçim, ya da para/auth/geri-alınamaz veriye
   dokunan değişiklik. Tam anlatı arşive, yalnızca **kalıcı kural** kısa dosyaya.
3. Bu dosya 40.000 karakteri aşamaz. Tarihli vaka anlatısı buraya BİRİKTİRİLMEZ.

## Bu sitenin tek vaadi

**Yayınlanan her sayı gerçek ve kaynaklıdır.** Diğer her kural bunun türevidir.

- Sayfaya çıkan her metrik `scripts/lib/sources.mjs` kaydındaki bir tanımdan gelir.
  Kayıtta olmayan metrik yayınlanamaz. Elle yazılmış/hatırlanmış sayı YOK.
- **Veri çekilemiyorsa bölüm boş kalır.** Placeholder rakam, "yaklaşık", "tahmini"
  değer yazılmaz. Boş bir kart, yanlış bir sayıdan iyidir.
- Her sayının yanında yayıncı + veri seti + **çekim tarihi** görünür.
- Dil modeli metin yazar, **sayı yazmaz**: model çıktısındaki her sayı
  `scripts/lib/guard.mjs` ile o ayın anlık görüntüsüne karşı programatik doğrulanır.
  Tek uyuşmazlıkta çıktının TAMAMI atılır — kısmi düzeltme yok (bir yerde uyduran
  metnin başka yerde de uydurduğu varsayılır).

**Coğrafya, her sayfada aynı:** "Miami" = Miami-Fort Lauderdale-Pompano Beach metro
alanı (Miami-Dade + Broward + Palm Beach). Zillow `msa 394856`, FRED `CBSA 33100`,
Redfin `Miami, FL metro area` — üçü de aynı bölge. **"Miami şehri" değil.**

## Mimari

| Katman | Ne |
|---|---|
| Framework | Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4 |
| Render | **Tam SSG.** `generateStaticParams()` + `dynamicParams = false`. Çalışma zamanında ne veri çekilir ne dosya okunur. |
| Veri | Ayda bir çekilir, JSON olarak repoya commit'lenir. Veritabanı YOK, API YOK. |
| Hosting | Vercel |

Veri akışı tek yönlü ve build-time:

```
Zillow/Redfin/FRED CSV
  → scripts/fetch-data.mjs        (çeker, doğrular, hesaplar)
  → src/content/index/<dönem>.json (SSOT — repoda, commit'li)
  → src/lib/snapshot.ts            (build anında node:fs ile okur)
  → sayfalar (prerender)
  → scripts/export-public-data.mjs (prebuild: public/veri/*.json|csv + llms.txt)
```

`public/veri/` ve `public/llms.txt` **gitignore'da** — `prebuild` her derlemede
yeniden üretir. Commit'lenirse bayatlar.

## Dosya sorumlulukları (SSOT haritası)

| Dosya | Tek yetkili olduğu şey |
|---|---|
| `scripts/lib/sources.mjs` | Kaynak/metrik kaydı, bölge kimlikleri, coğrafya cümlesi |
| `scripts/lib/compute.mjs` | Türetilmiş metrikler (kira getirisi, aylık/yıllık değişim) |
| `scripts/lib/guard.mjs` | Model çıktısındaki sayı doğrulaması |
| `src/content/index/*.json` | Aylık anlık görüntü — **elle düzenlenmez**, hat yazar |
| `src/content/articles/articles.json` | Yazılar — hat append eder |
| `src/lib/site.ts` | Site sabitleri + `miamiliUrl()` (UTM disiplini) |
| `src/lib/format.ts` | **Sayı/tarih biçimlendirmenin tek yolu.** JSX'te elle `toFixed()` yazma — ondalık ayırıcı sayfadan sayfaya kayar. |
| `src/lib/schema.ts` | JSON-LD |
| `src/app/globals.css` `@theme` | Renk ve tipografi jetonları |

## Görsel kimlik — "Neon Nights"

Bloomberg terminali × Ocean Drive neonu. **Bu site GECE.**
Krem, bej, beyaz zemin **YASAK**.

| Rol | Jeton | Değer |
|---|---|---|
| Zemin | `--color-night` | `#0B0F1E` |
| Panel | `--color-panel` | `#131A2E` |
| Panel (hover) | `--color-panel-2` | `#1A2440` |
| Metin | `--color-ice` | `#EAF2FF` |
| Birincil aksan | `--color-cyan` | `#22D3EE` |
| İkincil aksan | `--color-magenta` | `#F472B6` |
| Veri: artı yön | `--color-up` | `#A3E635` |
| Veri: eksi yön | `--color-down` | `#FB4E4E` |

Fontlar: Space Grotesk (display) · Inter (gövde) · JetBrains Mono (rakam/etiket).
Tablolarda `font-variant-numeric: tabular-nums` zorunlu — basamaklar hizalanmazsa
sütun gözle taranamaz.

**Renk = YÖN kodlar, yargı değil.** Düşen fiyat alıcı için iyi, satıcı için kötüdür;
metodoloji sayfasında böyle yazılı. `up`/`down` iyi/kötü demek DEĞİL.

**Glow yalnızca 24 px üstü display metinde.** Küçük puntoda `text-shadow` kenar
yumuşamasıyla birleşip algılanan kontrastı düşürür.

## Doğrulama kapıları (hepsi commit'ten önce)

```bash
npm test                      # 39 test — hat, kapı, biçimlendirme, şema
npm run index:dry             # ağsız/anahtarsız hat provası (mock model)
npm run build                 # 12 statik sayfa
npm run check:a11y -- --tokens   # jeton kontrastı (saniyeler, tarayıcısız)
npm run check:a11y            # + Lighthouse (sunucu açık olmalı)
npm run check:layout          # 320/393/768 px yatay taşma (gerçek Chrome, CDP)
```

`check:*` betikleri `CHECK_BASE` ile başka bir kökene bakabilir
(varsayılan `http://localhost:4321`); önce `npm run build && npm start -p 4321`.

**Kapılar hakkında iki kural, ikisi de acıdan öğrenildi:**

1. **Kesen rapor, rapor değildir.** Bir kapı bulduğunu ilk N ile kesiyorsa sırala ve
   toplamı yaz. Ve bir eleme kuralı eklerken kuralın HER ŞEYİ elediği hâli de sına —
   sessizleşen kapı, kırmızı kapıdan tehlikelidir.
2. **Lighthouse 100 ≠ kontrol edildi.** Lighthouse sayfayı yalnız durağan hâlde
   denetler; hover/focus yüzeyleri hiç ölçülmez. Ayrıca bir denetim `notApplicable`
   dönerse puan yine 100 görünür. Bu yüzden `check:a11y` hem jetonları kendi hesaplar
   hem `color-contrast.scoreDisplayMode === 'binary'` şartını arar.

## Tekrar etmeyecek hatalar (ayrıntı: `.claude/LEARNINGS.md`)

- **`overflow-*` olan her kutuya `relative` ver.** `overflow` yalnızca
  containing-block'u olduğu torunları kırpar; `static` bir kutu `absolute` torununu
  kırpmaz ve Tailwind `.sr-only` mutlak konumludur. Erişilebilirlik işaretlemesi
  belgeyi taşırır. Üç yerde var (`MetricTable`, `TrendChart`, `metodoloji`) — o
  `relative`'ler süs değil, silme.
- **Kontrastı yorum satırında tutma, hesapla.** Elle yazılmış tablo, yanındaki hex
  bir kez değiştiği an yalan söyler.
- **Renk değiştiren her commit** `npm run check:a11y -- --tokens` çalıştırır.
  AA sınırına en yakın üç değer: `dim` (4,76), `down` (4,60), `panel-2`. Koyulaştırma.
- **Dar ekranda flex önce metni ezer.** Sığmayan bir satırda kırılma noktası tahmin
  etme: iki tarafa `shrink-0` + kapsayıcıya `flex-wrap` kendi kendini hesaplar.

## Aylık hat

`.github/workflows/monthly-index.yml` — ayın 22'si 08:00 UTC (Zillow ayın ortasında,
Redfin ayın başında güncellenir; 22 ikisini de bekler). `workflow_dispatch` ile elle
de çalışır (`period`, `skip_redfin` girdileri).

**Sıra bilinçlidir: önce veri commit'lenir, sonra yorum üretilir.** Model susarsa o
ayın endeks sayfası yine yayına girer — sayfa veriden üretilir, modelden değil.
Yorum kapıda takılırsa iş **kırmızı** düşer (sessizce atlamaz) ama bu veri
commit'inden SONRA olur; reddedilen taslak `.needs-review/` artefaktına kaydedilir.

Model: `anthropic/claude-sonnet-5` (OpenRouter). **Gemini 3.x kullanılmayacak.**

## Ortam değişkenleri

Tam liste ve açıklamalar: `.env.example`. Özet:

- `NEXT_PUBLIC_SITE_URL` — ops., kanonik URL/sitemap/JSON-LD.
- `NEXT_PUBLIC_GA4_MEASUREMENT_ID` — ops. **Boşken hiçbir GA betiği ve çerez bandı
  yoktur** (izlemediğimiz ziyaretçiden onay istemek yanıltıcıdır). Doluyken bile
  gtag yalnızca "Kabul et" sonrası DOM'a basılır — onay **render'ı** kontrol eder,
  görünürlüğü değil.
- `OPENROUTER_API_KEY` — yalnız `index:generate` ve CI. Sitenin render'ı buna bağlı
  değil. GitHub repo secret olarak ekli.

**Anahtar değerini kabuk komutunun İÇİNE yazma** — Claude Code onaylanan komutları
`.claude/settings.local.json`'a düz metin kaydeder ve orada kalıcı olur.

## MiamiLi bağlantı disiplini

Sahiplik açık: footer'da "Bir MiamiLi Media yayınıdır" künyesi. Gizli link ağı değil.

- Tıklanabilir her miamili.com bağlantısı `miamiliUrl(path, campaign)` ile üretilir —
  elle yazılan URL'de `utm_source=miamiendeksi` er ya da geç düşer.
- **İstisna:** kimlik/köken URL'leri (JSON-LD `url`/`sameAs`, `rel=author`) UTM ALMAZ.
  Tıklanmazlar; UTM'li varyant iki markayı eşleştiren varlık sinyalini böler.
