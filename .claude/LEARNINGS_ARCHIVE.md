# Learnings — arşiv (tam vaka anlatıları)

> Bu dosya oturum başında OKUNMAZ. Yalnızca `LEARNINGS.md`'deki bir başlığa
> benzeyen bir semptomu aktif olarak ayıklarken açılır. Kısa kural orada,
> nasıl oraya varıldığı burada.

---

## 2026-09-03 — fal.ai "logo" istendi, editoryal illüstrasyon geldi; suçlu prompt değil MODELdi
- **Problem:** Marka işareti üretimi. `recraft-v3` + `vector_illustration` gravür
  dokulu, kalabalık SAHNE çizdi (martı, yürüyen adam, manzara) — 32px'te lapa.
  Prompt'a "minimalist / no scene / no people" yazmak hiçbir şey değiştirmedi.
- **Eliminated:** Prompt'u sıkılaştırmak → Recraft V3 **negative prompt'u hiç
  onurlandırmıyor**, 2 tur boyunca ispatlandı. · Alt stiller
  (`cutout`, `roundish_flat`) → DAHA KÖTÜ: stil ailesi editoryal illüstrasyon
  üzerine eğitilmiş, alt stil onu derinleştiriyor (grafiğin yanında duran adam). ·
  `recraft-20b` / `recraft/v2` `icon/*` stilleri → fal'ın hiçbir Recraft ucunda
  enum'da YOK (şemadan doğrulandı).
- **Chosen:** `fal-ai/ideogram/v3`, `style: DESIGN` + `negative_prompt` +
  `color_palette` (RGB + ağırlık) + **`expand_prompt: false`** — sonuncusu şart,
  açık kalırsa MagicPrompt prompt'u süsleyip manzarayı geri getiriyor.
- **Evidence:** Aynı motif/prompt iskeletiyle 4 tur: recraft 15 aday → 0 kullanılabilir;
  ideogram DESIGN 12 aday → 9'u marka işareti, 3'ü doğrudan yayına girdi.
  Şema enum'u: `curl "https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=..."`.
- **Rule:** Üretken görsel modeli seçerken ÖNCE şema enum'unu çek; "logo/ikon"
  istiyorsan illüstrasyon modeline prompt yazma, işi görsel KİMLİK olan modele git.

## 2026-09-03 — Vektörleştirici şeffaflığı yedi; zemin yollarını silmek işareti dolu bloğa çevirdi
- **Problem:** `fal-ai/recraft/vectorize` şeffaf PNG'yi SVG'ye çevirdi ama alfa
  gitti. Zemin renkli path'leri silince işaret dolu renkli DİKDÖRTGENE düştü.
- **Eliminated:** Zemin path'lerini silmek → vektörleştirici işareti "büyük dolu
  dikdörtgen + üstünde zemin renginde OYAN yollar" olarak kuruyor; oymayı silince
  geriye dikdörtgen kalıyor (florida ve miamigezi böyle çöktü, endeksi'nin
  katmanlanması gerçekten arkada olduğu için tesadüfen kurtuldu — bu tesadüf
  kuralı gizliyordu). · Zemini sayfa rengine boyamak → şeffaflık yok, koyu/açık
  temada ve favicon'da kırılır.
- **Chosen:** Yerel `potrace`, maskeyi **alfa kanalından** kurarak; çok renkli
  işarette her opak piksel en yakın marka rengine atanıp katman katman izlendi.
- **Evidence:** florida 38KB → blur(3)+threshold ön işlemle 3,3KB; üç işaret de
  hem beyazda hem lacivertte, hem 24px hem 1024px'te doğru çizildi (render kanıtı).
- **Rule:** Raster→SVG dönüşümünde şeffaflık KORUNDU sanma; alfayı kaynak alan
  bir izleyici kullan. Fal'ın vectorize'ı alfayı düzleştirir.

## 2026-09-03 — Başlığa 1 ikon eklemek ölçülmüş sarma eşiğini 393→417px'e itti
- **Problem:** Marka işareti künye GENİŞLİĞİNE ekleniyor. miamiendeksi başlığının
  tek-satır eşiği ölçülmüştü; ikon 27px (17px ikon + 10px boşluk) ekleyip 393→417px yaptı; iPhone 15'te başlık 65→98px.
- **Eliminated:** Eşiği kabul edip yaşamak → iPhone 15 (393px)
  gibi ÇOK yaygın bir genişlikte başlık kalıcı olarak yükseliyor, sticky olduğu
  için viewport'tan sürekli yiyor. · Boşlukları kısmak (`gap`, ikon boyu, menü
  `gap`) → 8px kazandırıyor ve eşiği geri alıyor AMA o değerler bu başlıkta
  ölçülerek verilmiş; sahibinin kararını yan etki olarak değiştirmek olurdu.
- **Chosen:** İkon `hidden min-[420px]:block` — eşiğin altında hiç RENDER
  edilmiyor. `display:none` flex öğesini kutudan tamamen çıkarır, `gap` de
  uygulanmaz; dar ekran eski hâline BİREBİR döner. Boşluklara dokunulmadı.
- **Evidence:** headless Chrome + CDP, `Emulation.setDeviceMetricsOverride` ile
  genişlik taraması; sarma `header.getBoundingClientRect().height` ile ölçüldü
  (nav.top karşılaştırması YANILTTI — flex hizası yüzünden hep "sarmış" dedi).
  Sonrası: eşiğin altında ikon=0 ve eski eşik aynen, üstünde ikon var + tek satır.
- **Rule:** Ölçülmüş boşluk bütçesi olan bir başlığa görsel eklerken eşiği YENİDEN
  ÖLÇ ve gerileme varsa önce **görünürlüğü breakpoint'le** çöz — başkasının
  ölçerek verdiği `gap` değerlerini yan etki olarak değiştirme.

## 2026-08-26 — Mutasyon "sessiz geçti" dedi; sessiz olan koşum aracıydı

- **Problem:** Karşılaştırma çubuğu geometrisine 12 birim testi yazdıktan
  sonra, `LEARNINGS.md`'deki kural gereği her eşiği/dalı tek tek bozup
  `npm test` koşturdum. **7 mutasyonun 7'si de sessiz geçti** — yani teste
  göre geometrinin hiçbir dalı test edilmemişti. Bu, yeni yazılmış 12 testin
  tamamının işe yaramadığı anlamına gelirdi.

- **Elenen (koşum aracının kendisi, iki kez bozuk çıktı):**
  - `npm test 2>&1 | tail -3` içinde `"test kaldı"` aramak → başarısızlık
    başlığı (`✗ N test kaldı`) listenin BAŞINDA yazılıyor, ardından her
    başarısız test tek tek dökülüyor. 5 test düşünce başlık `tail -3`
    penceresinin dışına kayıyor ve araç "geçti" sanıyordu. Bu, bu repodaki
    *"kesen rapor, rapor değildir"* dersinin birebir tekrarı — bu sefer
    kapıda değil, kapıyı sınayan araçta.
  - `if grep -rl "X" dir/ | head -5; then` → **boru hattının çıkış kodu son
    komuta aittir**; `head` her zaman 0 döner. Koşul hep doğru okundu ve
    "BarChart istemci chunk'ında bulundu" diye yanlış rapor verdi (gerçekte
    hiç yoktu). Aynı tuzak iki farklı biçimde, tek oturumda.
  - Çıkış koduna geçmek → yetmedi: `sed` deseni eşleşmediğinde dosya hiç
    değişmiyor, test doğal olarak geçiyor ve bu da "sessiz geçti" gibi
    görünüyordu. Araca `diff -q` ile **mutasyonun gerçekten uygulandığını**
    doğrulatmak gerekti.

- **Seçilen:** koşum aracı üç şeyi birden yapar — (1) `npm test`'in ÇIKIŞ
  KODUNA bakar, çıktısını grep'lemez; (2) her turdan önce `diff -q` ile
  mutasyonun uygulandığını doğrular, uygulanmadıysa `⚠ sed eşleşmedi` der;
  (3) yedekten geri yükler. Düzeltilmiş araçla 10 mutasyonun 9'u yakalandı.

- **Sonra çıkan asıl bulgu (semptomdan uzakta):** Geriye kalan tek sessiz
  mutasyon `barDomain`'deki `Math.min(0, ...values)` → `Math.min(...values)`
  idi. "Yanındaki üçlü işleç zaten sıfırı garantiliyor, demek ki eşdeğer
  mutant" diye geçiştirmeye hazırdım. Elle hesaplayınca **öyle olmadığı**
  ortaya çıktı: TEK gözlemli bir kümede `min === max` olur, `span === 0`
  dalına düşülür ve alan `[-1, 1]`'e sabitlenir. Tek bir −27,3 değeri
  x = **−1315**'e, yani tuvalin çok dışına ışınlanıyordu. Test bunu
  kaçırmıştı çünkü `w > 0` diye bakıyordu ve bu felaket de `w > 0`
  koşulunu sağlıyordu. Testi sınır denetimi ekleyerek güçlendirdim
  (`x >= 0 && x + w <= BAR_W`, ayrıca tek gözlemde sıfırın kenarda olması).

- **Kanıt:** Düzeltilmiş araçla ikinci tur: `M1 min(0,…) düştü ✓ YAKALANDI
  (2 test düştü)`, `M1b max(0,…) ✓`, M2–M8 ✓ — 10/10 anlamlı mutasyon
  yakalandı. Geriye kalan tek sessiz mutasyon `BAR_PAD 0,06 → 0,2`; bu
  GERÇEKTEN eşdeğer mutant (saf estetik boşluk payı, ne sıfır tabanını ne
  oranı bozar) ve keyfi bir estetik değeri sabitleyen sahte test yazmadım.

- **Mimari seçim (reddedileni de çalışırdı):** Geometri neden `.mjs`?
  `npm test` Node 20 script'i; tip sıyırma Node 22.6+ özelliği, yani
  `src/lib/chart.ts` içe aktarılamıyor. Bu yüzden mevcut `plot()` bugüne dek
  hiç birim testi görmedi — yalnızca sunucu ayaktayken `check:layout` ve
  `check:palette --render` ile denetlendi. Çizgi için bu yeterliydi; çubuk
  için DEĞİL: çubuğun iddiası (uzunluk = büyüklük) tamamen aritmetiktir,
  kesilmiş bir taban çizgisi ekranda kusursuz görünür ve yalnızca oranları
  bozar — hiçbir render kapısı bunu göremez. Elenen seçenekler: TS'i test
  için derlemek (hatta bir build adımı daha), geometriyi `.mjs`'e kopyalamak
  (iki kopya = test yayına gitmeyen kodu doğrular). Seçilen: tek dosya
  `src/lib/chart-geom.mjs`, hem `chart.ts` hem `self-test.mjs` AYNI dosyayı
  içe aktarır.

- **Kural:** Aşağıdaki iki satır `LEARNINGS.md`'ye taşındı.

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
