# Miami Endeksi

Miami konut piyasasının aylık, kaynaklı veri yayını — Türkçe.
Bir **MiamiLi Media** yayınıdır. → [miamiendeksi.com](https://miamiendeksi.com)

Her sayı üç kamuya açık kaynaktan gelir ve yanında yayıncı, veri seti ve çekim
tarihi ile birlikte yayınlanır:

- [Zillow Research](https://www.zillow.com/research/data/) — ZHVI, ZORI, stok, satış hızı
- [Redfin Data Center](https://www.redfin.com/news/data-center/) — kondo/genel piyasa
- [FRED](https://fred.stlouisfed.org/) (St. Louis Fed) — mortgage faizi, metro serileri

Bölge: Miami-Fort Lauderdale-Pompano Beach metro alanı (Miami-Dade, Broward,
Palm Beach). "Miami şehri" değil — ayrıntı [/metodoloji](https://miamiendeksi.com/metodoloji).

## Kurulum

```bash
npm install
cp .env.example .env.local     # değerler isteğe bağlı; site anahtarsız derlenir
npm run dev
```

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Statik derleme (`prebuild` açık veri dosyalarını üretir) |
| `npm test` | Öz-test — veri hattı, sayı kapısı, biçimlendirme, şema |
| `npm run data:fetch` | Aylık veriyi çeker → `src/content/index/<dönem>.json` |
| `npm run data:dry` | Veriyi çeker, dosyaya yazmaz |
| `npm run index:dry` | Aylık yorumu ağsız/anahtarsız prova eder |
| `npm run index:generate` | Aylık yorumu üretir (`OPENROUTER_API_KEY` gerekir) |
| `npm run check:a11y -- --tokens` | Renk jetonlarının WCAG kontrastını hesaplar |
| `npm run check:a11y` | + Lighthouse erişilebilirlik (sunucu açık olmalı) |
| `npm run check:layout` | 320/393/768 px yatay taşma denetimi (gerçek Chrome) |

`check:*` komutları varsayılan olarak `http://localhost:4321` adresine bakar
(`CHECK_BASE` ile değiştirilebilir): `npm run build && npm start -- -p 4321`.

## Veri modeli

Veri ayda bir çekilir, JSON olarak repoya commit'lenir ve site **build anında**
okur. Veritabanı ya da çalışma zamanı API çağrısı yoktur; tüm sayfalar statik
üretilir. Aylık hat: `.github/workflows/monthly-index.yml`.

Açık veri: her dönem `/veri/miami-endeksi-<dönem>.json` ve `.csv` olarak
indirilebilir.

## Katkı kuralı

Yayınlanan hiçbir sayı elle yazılmaz. Bir metrik `scripts/lib/sources.mjs`
kaydında tanımlı değilse sayfaya çıkamaz; veri çekilemiyorsa bölüm boş kalır.
Ayrıntılı proje kuralları: [`CLAUDE.md`](./CLAUDE.md).

## Lisans

Kod ve içerik © MiamiLi Media. Kaynak veriler ilgili yayıncılarına aittir ve
kendi kullanım koşullarına tabidir.
