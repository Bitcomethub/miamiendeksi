# Learnings — arşiv (tam vaka anlatıları)

> Bu dosya oturum başında OKUNMAZ. Yalnızca `LEARNINGS.md`'deki bir başlığa
> benzeyen bir semptomu aktif olarak ayıklarken açılır. Kısa kural orada,
> nasıl oraya varıldığı burada.

---

## 2026-08-22 — "Krem zemin yasak" bir kural olarak vardı, kapı olarak yoktu

- **Problem:** Gece paleti yalnızca `CLAUDE.md`'de ve `globals.css` yorumunda
  yazılıydı. Hiçbir kapı krem/bej/beyaz zemini KESMİYORDU; kural, uyulup
  uyulmadığı ölçülmeyen bir dilekti. `check:a11y` kontrastı ölçer ama krem
  zemin üzerinde koyu metin AA'yı rahatça geçer — yani a11y kapısı bu ihlali
  yeşil yakardı.

- **Elenen — yasak-hex listesi:** "banned = [#FFFDD0, #F5F5DC, …]". `check-a11y`
  yorumundaki kontrast tablosunun aynı arızası: 21. krem tonu seçildiği gün
  liste yalan söyler. Renk uzayı sürekli, liste sonlu.
- **Elenen — "açık olanı yasakla" (tek eşik: L ≥ 0.78):** neon camgöbeğini de
  eler (cyan L=0,797 · bej L=0,964 — İKİSİ DE açık). Markanın birincil aksanını
  yasaklayan kapı, ilk haftasında kapatılır.
- **Elenen — eşiği `ice`'ı geçirecek kadar gevşetmek:** `--color-ice` (#eaf2ff,
  L=0,959 C=0,019) gerçekten bir kırık beyazdır ve beyden DAHA nötrdür
  (bej C=0,033). Ice'ı geçiren her eşik, bejin tamamını da geçirir. Eşik
  gevşetmek burada kapıyı tümden iptal etmekle eşdeğerdi.
- **Elenen — yalnızca kaynak taraması:** kaynak NİYETİ okur, boyanan pikseli
  değil. Stil sayfası hiç yüklenmezse kaynak tertemizdir ve Chrome sayfayı
  BEYAZ boyar. Kanıtlandı: derlenmiş CSS boşaltıldığında Aşama 1 "✓ Kaynak
  temiz" dedi, sayfa bembeyazdı.

- **Seçilen:** ölçüm + iki aşama.
  1. Her renk OKLCH'e çevrilir; yasak aile = **L ≥ 0,78 VE C ≤ 0,12**. Ayırt
     edici RENKLİLİKTİR, açıklık değil (khaki C=0,112 yakalanır · cyan C=0,134
     geçer — en dar aralık burası).
  2. `ice` istisnası **eşikle değil ADLA** verilir (`ALLOWED_LIGHT_TOKENS`) —
     tek isimli, greplenebilir, gerekçesi dosyada.
  3. Kapalı palet: `bg-*` / `from-*` / `via-*` / `to-*` renk adı `@theme`
     jetonu olmak zorunda → `bg-white`, `bg-stone-100`, `bg-amber-50` tek
     kuralla, hiçbir Tailwind renk tablosu gömmeden kapanır.
  4. Aşama 2 gerçek Chrome'da `getComputedStyle` okur ve `body` zemininin
     GERÇEKTEN gece rengi olduğunu doğrular — "krem bulamadım" yetmez, boş
     sayfada da krem yoktur.

- **Kanıt:** 6 kaynak sabotajı (jeton kreme çevrildi · yeni açık jeton ·
  CSS'e krem kural · `bg-stone-100` · `bg-[#FFFDD0]` · satır içi ham hex) →
  6/6 exit 1, dosya+satır+ölçülmüş L/C ile. 3 render sabotajı (yayınlanan
  CSS'e krem body · stil sayfası boş · `main` bej) → 3/3 exit 1 ve
  ÜÇÜNDE DE Aşama 1 "✓ Kaynak temiz" dedi (aşamalar birbirinin yedeği değil).
  2 kontrol: saydam krem doku (α=0,08) ve 1 px'lik açık yüzey → exit 0.
  `npm test` 39 → 56.

- **Mutasyon testi bir boşluk buldu:** 6 eşik mutasyonundan biri
  (`SURFACE_MAX_L` 0,45 → 0,99) HİÇBİR testi düşürmedi. Yüzey jetonlarının
  "koyu olma" şartı test edilmemişti; `--color-panel: #808080` (orta gri,
  L=0,600) krem eşiğinin ALTINDA olduğu için krem sınıflandırıcısına da
  görünmüyordu. Test eklendi, mutasyon artık yakalanıyor.

---

## 2026-08-08 — 393 px'te yatay taşma var, taşan hiçbir eleman yok

**Semptom.** `npm run check:layout` (CDP ile gerçek Chrome'da `scrollWidth`
vs `clientWidth`) 18 sayfa/genişlik kombinasyonunun 7'sinde kırmızı verdi.
En büyüğü `/endeks/2026-08` @ 393 px: **53 px** taşma. Rapor "suçlu" olarak
tablo hücrelerini listeliyordu — ama o hücreler `overflow-x: auto` bir
sarmalayıcının içindeydi, yani taşımamaları gerekirdi.

**Yanlış iz 1 — "tablo geniş, sarmalayıcı ekle."** Zaten vardı.
`MetricTable` `min-w-[46rem]` ile bilinçli olarak geniş (rakam sütunları
sıkışırsa tablo taranamaz) ve `overflow-x-auto` ile sarılmıştı. Sarmalayıcı
kaldırılıp konsept yeniden düşünülecek bir şey değildi; sorun sarmalayıcının
işini YAPMAMASIYDI.

**Yanlış iz 2 — "ölçüm bayat."** `bisect.mjs` ile her elemanı tek tek
`display:none` yapıp belge genişliğini yeniden ölçtüm. Sonuç kafa
karıştırıcıydı: HERHANGİ bir `<td>`'yi gizlemek taşmayı düzeltiyordu. Bu,
"layout ölçümü geç güncelleniyor" hipotezini akla getirdi. `stale.mjs` ile
aynı değeri dört ayrı anda okudum — ilk ölçüm, `requestAnimationFrame`
sonrası, zorlanmış reflow sonrası, ve 500 ms bekleyip: **446, 446, 446,
446.** Hipotez öldü. Rahatlatıcı açıklamayı kabul etmek yerine kazmaya
devam etmek burada işe yaradı.

Neden her `<td>` "düzeltiyordu": tabloyu daraltmak, tablonun İÇİNDEKİ
mutlak konumlu çocuğu da sola kaydırıyordu. Yani hücreler suçlu değil,
suçlunun koordinatını belirleyen bağlamdı.

**Kök neden.** `rights.mjs` (sarmalayıcının dışına taşan sağ kenarları
listeleyen + sarmalayıcıyı hiç saymadan ölçen betik) suçluyu gösterdi:
`ChangeBadge`'in `.sr-only` ekran-okuyucu metni, 736 px'lik tablonun içinde
x≈446'da duruyordu ve **belgeyi** 53 px taşırıyordu.

Sebep saf CSS: `overflow-x` bir elemanı yalnızca **containing-block'u
olduğu** torunlar için kırpar. `position: static` bir kutu, `position:
absolute` torunlarının containing-block'u DEĞİLDİR — o torun en yakın
konumlandırılmış ataya (burada `<body>`/kök) asılır ve kaydırma kutusunu
görmezden gelir. Tailwind'in `.sr-only` yardımcı sınıfı `position:
absolute` içerir. Yani erişilebilirlik işaretlemesi, layout'a sızmıştı.

**Çözüm.** Kaydırma kutularına `relative`. Üç yerde:
`MetricTable.tsx`, `metodoloji/page.tsx` (aynı desen, henüz patlamamış),
`TrendChart.tsx` (`overflow-y-auto` + `<caption class="sr-only">`).
Üçüne de nedeni açıklayan yorum yazıldı — `relative` "gereksiz" görünüp
sadeleştirme kurbanı olmaya çok müsait.

**Kanıt.** `npm run check:layout` → 320/393/768 × 6 rota, 18/18 temiz,
çıkış kodu 0.

**Yan bulgu — 320 px'te başlık.** Aynı koşu `SiteHeader`'da 9 px taşma
gösterdi: marka (~115 px) + menü (~233 px), 280 px kullanılabilir
genişliğe sığmıyor. Flex, ilk çare olarak METNİ eziyordu (marka kelimesi
ortadan bölünüyordu) ve yine de taşıyordu. Çözüm bir kırılma noktası
TAHMİN etmek değil, kuralı yazmak oldu: iki tarafa da `shrink-0` (ezmeyi
yasakla) + kapsayıcıya `flex-wrap` (sığmıyorsa alt satıra in). Sığdığı her
genişlikte tek satır kalır; sığmadığında kendiliğinden sarar.

---

## 2026-08-08 — Lighthouse 100 aldı ama kontrast hiç ölçülmemişti

**Semptom yok — bu, aramaya gidilmeseydi hiç görünmeyecek bir kusurdu.**
Altı rotanın altısı Lighthouse erişilebilirlikte 100 aldı. Kapı yeşildi.

**Şüphe.** Koyu temada neon metin AA sınırında gezinir. `globals.css`'in
başında elle yazılmış bir kontrast tablosu vardı — ve elle yazılmış tablo,
yanındaki hex bir kez değiştiği an yalan söylemeye başlar. Tabloyu koda
taşımak için `scripts/check-a11y.mjs` yazıldı: `@theme` bloğundaki
`--color-*` değerlerini okur, WCAG 2.1 bağıl parlaklık/kontrast hesaplar,
7 metin rengini 3 yüzeye karşı dener.

**Bulgu.** Üçüncü yüzey — `--color-panel-2` — `.panel-hover` kartlarının
üzerine gelindiğinde aldığı zemindir. `--color-dim` panel üzerinde 4,88:1
ile geçiyor ama panel-2 üzerinde **4,33:1**'e düşüyordu. Ve bu kombinasyon
teorik değildi: `analiz/page.tsx:64` ve `endeks/page.tsx:77` tam olarak dim
metni hover'lanan kartın içinde kullanıyordu.

Lighthouse bunu hiçbir koşuda göremezdi: sayfayı yalnız **durağan** hâlde
denetler. Fareyle üzerine gelinen bir kartın zemini hiçbir denetim
kapsamında değildir. "Puan 100" ile "kontrol edildi" aynı şey değil.

**İkinci sessiz boşluk.** Aynı araştırma sırasında Lighthouse JSON'unda
`scoreDisplayMode` alanı fark edildi: bir denetim `notApplicable` dönerse
kategori puanı yine 100 görünür ama denetim HİÇ KOŞMAMIŞTIR. Bu yüzden
kapı artık `color-contrast.scoreDisplayMode === 'binary'` şartını da
arıyor — yani "koştu ve geçti"yi "hiç bakılmadı"dan ayırıyor.

**Elenen çözüm — `panel-2`'yi koyulaştırmak.** Matematiksel olarak
çalışırdı (zemin koyulaşınca oran açılır). Reddedildi: koyu temada hover
zemininin KOYULAŞMASI, kartın öne çıkmak yerine çukura gitmesi gibi okunur.
Hover'ın işi "bu öğe canlı" demektir; ışık kaybettiren bir hover ters sinyal
verir.

**Seçilen.** Metin rengini açmak: `--color-dim` `#7489AE → #7C90B6`. En
kötü yüzeyde 4,76:1. Görsel hiyerarşi korunur (dim hâlâ mute'un altında),
zemin dokunulmadan kalır.

**Kanıt.**
```
  renk              zemin       panel  panel:hover   durum
  ice             15.85:1    13.55:1      11.44:1   ✓
  mute             7.09:1     6.06:1       5.12:1   ✓
  dim              6.58:1     5.63:1       4.76:1   ✓
  cyan            10.15:1     8.68:1       7.33:1   ✓
  magenta          7.94:1     6.79:1       5.73:1   ✓
  up              11.63:1     9.94:1       8.39:1   ✓
  down             6.36:1     5.44:1       4.60:1   ✓
```
Ayrıca 6 rotanın 6'sında Lighthouse 100 **ve** `color-contrast` `binary`.

**Sınıra en yakın üç değer:** `dim` (4,76), `down` (4,60), `panel-2`.
Üçünü de koyulaştırma — `globals.css` başındaki notta yazılı.

---

## 2026-08-08 — Kendi ölçüm aracım eksik rapor verip beni yanlış yere gönderdi

**Semptom.** Taşma kapısı çalışıyordu (taşmayı doğru buluyordu) ama
gösterdiği suçlular hep yanlıştı. İki tam koşu boyunca beni tablo
hücrelerine yönlendirdi.

**Neden.** Rapor, taşan elemanları **sırasız** topluyor ve **ilk 8'de
kesiyordu**. `overflow-x: auto` sarmalayıcısının içindeki masum hücreler
(teknik olarak kapsayıcı dışına taşıyorlar ama kırpılıyorlar) sekiz yeri de
dolduruyordu. Gerçek suçlu listede vardı — dokuzuncu sıradaydı ve hiç
basılmadı. Araç yalan söylemiyordu; **eksik** söylüyordu, ki pratikte aynı
şey.

**Aşırı düzeltme.** İlk refleks: kırpılmış elemanları tamamen ele.
`clipped()` yardımcısı yazıldı (elemanın atalarında `overflow-x` `auto |
scroll | hidden | clip` var mı). Sonuç: rapor "53 px taşma var, suçlu
listesi BOŞ" dedi. Araç sessizleşti — ve sessiz bir kapı, geçen bir
kapıdan daha tehlikelidir, çünkü "kontrol edildi" izlenimi bırakır.

`clipped()` bir **sezgiseldir, kanıt değildir**: containing-block kuralı
yüzünden bir ata `overflow-x: auto` olsa bile mutlak konumlu torununu
kırpmayabilir — bu vakanın ta kendisi.

**Seçilen tasarım.** İki liste:
- `guilty` — kırpılmadığı anlaşılanlar,
- `suspects` — kırpıldığı SANILANLAR.

İkisi de sağ kenara göre azalan sıralı. `guilty` boşsa `suspects`
"— kırpılmış sanılanlar, ŞÜPHELİ" etiketiyle basılır. Toplam sayı her
zaman yazılır: `(N elemandan ilk 8)`. Böylece rapor asla "taşma var ama
kimse sorumlu değil" demez ve asla kestiğini gizlemez.

**Kanıt.** Yeniden yazılan araç, düzeltmeden ÖNCE `.sr-only`'yi x≈446'da
tek `guilty` olarak gösterdi (yani gerçek suçluyu ilk kez isabetle);
düzeltmeden SONRA 18/18 temiz.

**Genellenen kural.** Bir kapı bulduğunu keserek raporluyorsa kapı değil
filtredir. Ve bir eleme kuralı eklerken o kuralın HER ŞEYİ elediği hâli de
sına: kapılar iki yönlü test edilir — yakalaması gerekeni yakalıyor mu
(MUST_CATCH), geçirmesi gerekeni geçiriyor mu (MUST_PASS).

---

## 2026-08-08 — Kabuk tuzakları (küçük, ama iki kez zaman yedi)

- **zsh, tırnaksız değişkeni kelimelere BÖLMEZ** (bash bölür). `set -- $pair`
  ile `"home /"` tek kelime kaldı, `--output-path=.../lh-home /.json` üretti
  ve Lighthouse 5 kez "cannot be written to" dedi. Çözüm: döngü yerine
  argümanları tırnaklı alan açık bir kabuk fonksiyonu.
- **BSD `sed` `\?` niceleyicisini desteklemez.** `sed 's|</\?loc>||g'`
  macOS'ta etiketleri hiç soymadı; sonuç, 8 sitemap URL'sinin de literal
  `<loc>…</loc>` yolu ile istenip `000` dönmesiydi (site sağlamdı, komut
  bozuktu). Çözüm: iki ayrı ifade (`-e 's|<loc>||' -e 's|</loc>||'`) ya da
  `sed -E`.
- **`node` bir kabuk `for` döngüsünün içinde PATH'ten kayboldu** (5 kez
  `command not found`). Mutlak ikili yolu ile çözüldü; sonrasında döngüler
  tamamen terk edildi.
