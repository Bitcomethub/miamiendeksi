# Learnings — miamiendeksi

> Bu dosya KISA tutulur (üst sınır ~12.000 karakter) ve her oturumun başında
> okunur. Buraya yalnızca **her gelecek oturumu bağlayan kural** yazılır.
> Vakanın tam anlatısı `LEARNINGS_ARCHIVE.md`'dedir ve oturum başında
> OKUNMAZ — yalnızca buradaki bir başlığa benzeyen bir semptom aktif olarak
> ayıklanırken açılır.


## 2026-09-03 — "Logo" istenen model sahne çizdi; sonra 1 ikon ölçülmüş sarma eşiğini itti

- **Problem:** Marka işareti üretimi + başlığa yerleştirme. İki ayrı tuzak çıktı.
- **Elenen:** Prompt'u sıkılaştırmak → Recraft V3 negative prompt'u HİÇ onurlandırmıyor, iki tur boyunca editoryal sahne çizdi (grafiğin yanında duran adam); alt stiller (`cutout`/`roundish_flat`) durumu KÖTÜLEŞTİRDİ, çünkü stil ailesi illüstrasyon üzerine eğitilmiş. · `recraft/vectorize` ile SVG almak → alfayı DÜZLEŞTİRİYOR, işareti "dolu dikdörtgen + oyan yollar" olarak kuruyor; zemin yollarını silmek dolu bloğa düşürür. · Başlıkta boşlukları (`gap-2.5`, menü `gap-1`) kısmak → 8px kazandırıp eşiği geri alıyor AMA o değerler bu başlıkta ölçülerek verilmiş, yan etki olarak değiştirilemez.
- **KURAL:** (1) Üretken modelde "logo/ikon" istiyorsan model AİLESİNİ değiştir, prompt'u değil: `ideogram/v3` + `style: DESIGN` + `negative_prompt` + `color_palette`, ve **`expand_prompt: false`** (açıksa MagicPrompt manzarayı geri getirir). Yeteneği şema enum'undan doğrula, hafızadan değil. (2) Raster→SVG'de şeffaflık korundu SANMA; alfayı kaynak alan yerel `potrace` kullan. (3) Ölçülmüş boşluk bütçesi olan başlığa görsel eklerken eşiği YENİDEN ölç (sarmayı `header` YÜKSEKLİĞİNDEN tespit et — `nav.top` karşılaştırması flex hizası yüzünden yanıltır) ve gerileme varsa **breakpoint'le görünürlüğü** çöz: ikon 393→417px'e itmişti, `hidden min-[420px]:block` dar ekranı birebir eski hâline döndürdü.

## 2026-08-26 — "Mutasyon sessiz geçti" önce ARACI suçla, sonra testi

- **Problem:** Yeni geometrinin 7 mutasyonunun 7'si de sessiz geçti; sanki 12 yeni testin hiçbiri hiçbir dalı tutmuyordu. Testler değil, mutasyon koşum aracı bozuktu — ve tek oturumda iki farklı biçimde.
- **Elenen:** `npm test | tail -3` içinde `"✗ N test kaldı"` aramak → başlık listenin BAŞINDA yazılır, birkaç test düşünce pencerenin dışına kayar (bu repodaki *"kesen rapor, rapor değildir"* dersinin, kapıyı sınayan araçtaki tekrarı); `if grep ... | head` → boru hattının çıkış kodu SON komuta aittir, `head` daima 0 döner, koşul hep doğru okunur; yalnız çıkış koduna geçmek → `sed` deseni eşleşmezse dosya hiç değişmez, test doğal olarak geçer ve yine "sessiz geçti" gibi görünür.
- **KURAL:** Bir mutasyon koşum aracı üç şeyi birden yapmadan güvenilmez: (1) çıktıyı grep'lemek yerine **çıkış koduna** bakar, (2) her turdan önce `diff` ile **mutasyonun gerçekten uygulandığını** doğrular, (3) yedekten geri yükler. Aracı önce KASITLI bir gerçek hatayla sınayıp kırmızı verdiğini gör; vermiyorsa ölçtüğün şey kod değil, araçtır.

## 2026-08-26 — "Eşdeğer mutant" iddiası kanıtlanmadıkça bir bahanedir

- **Problem:** `Math.min(0, ...values)` → `Math.min(...values)` mutasyonu hiçbir testi düşürmedi. "Yanındaki üçlü işleç zaten sıfırı garantiliyor, eşdeğer mutant" diyip geçmeye hazırdım.
- **Elenen:** Muhakemeyle eşdeğerlik ilan etmek → elle hesaplayınca yanlış çıktı: TEK gözlemli kümede `min === max` olur, `span === 0` dalına düşülür ve tek bir −27,3 değeri x = **−1315**'e, tuvalin çok dışına gider. Test kaçırmıştı çünkü `w > 0` diye bakıyordu — felaket de bu koşulu sağlıyor.
- **KURAL:** Sessiz kalan mutasyonu eşdeğer ilan etmeden önce **sınır girdilerinde sayısal olarak karşılaştır** (tek eleman, hepsi aynı işaret, hepsi sıfır). Ve bir geometri testi asla yalnızca "çizildi mi" (`w > 0`) diye sormaz; **nereye çizildiğini** sorar (`0 ≤ x` ve `x + w ≤ genişlik`). Gerçekten eşdeğer olanı da yazılı bırak: `BAR_PAD` saf estetik paydır, onu sabitleyen sahte test YAZMA.

## 2026-08-22 — Eşik sabiti testsizse kapıda sessiz delik vardır
- **Problem:** Palet kapısının 6 eşiğinden birini (`SURFACE_MAX_L`) körelttiğimde o anki 55 testten HİÇBİRİ düşmedi — o dal hiç test edilmemişti ve fark edilmeden silinebilirdi.
- **Neden görünmedi:** Kapının iki kuralı vardı (krem ailesi + yüzey koyuluğu) ve testler yalnız birincisini zorluyordu. `#808080` krem DEĞİLDİR (L=0,600, eşiğin altı), yani orta gri bir sayfa zeminini yalnız ikinci kural durduruyordu.
- **KURAL:** Bir kapı yazdıktan sonra her eşik sabitini/dalını tek tek boz ve `npm test` koştur. Hiçbir testi düşürmeyen mutasyon = test edilmemiş dal = kapıda delik. "Testler geçiyor" ile "kapı çalışıyor" aynı şey değildir; ikincisi ancak kapının kendisi sabote edilerek kanıtlanır.

## 2026-08-08 — 393 px'te yatay taşma var, taşan hiçbir eleman yok
- **Problem:** `/endeks/2026-08` 393 px'te 53 px taşıyordu; ölçüm hiçbir elemanı suçlu göstermiyordu — taşma "sahipsizdi".
- **Elenen:** tablonun kendisi (`min-w-[46rem]` kasıtlı, `overflow-x-auto` zaten sarıyordu) → sarmalayıcı VARDI, yine taşıyordu; bayat layout ölçümü ("rAF/reflow bekle") → `first/afterRaf/afterReflow/afterWait` dördü de 446 verdi, hipotez öldü; `<td>` gizleyip bakmak → her `<td>` "düzeltiyordu", çünkü tablo daralınca mutlak konumlu çocuk da yer değiştiriyordu — yanlış iz.
- **Seçilen:** kaydırma kutusuna `relative`. `overflow-x` YALNIZCA kendi containing-block'u olduğu elemanları kırpar; `position: static` bir kutu, `position: absolute` torunlarını kırpmaz. Tailwind `.sr-only` mutlak konumludur — ekran okuyucu metni kutudan sızıp belgeyi taşırıyordu.
- **Kanıt:** `npm run check:layout` → 320/393/768 × 6 sayfa = 18/18 temiz, çıkış 0. Öncesinde 7 kombinasyon kırmızıydı.
- **KURAL:** `overflow-*` kullanan HER kutuya `relative` ver. İçinde `.sr-only`, tooltip, `sticky` başlık ya da herhangi bir mutlak konumlu çocuk varsa bu süs değil, kırpmanın ön koşuludur. (Bu projede üç yerde: `MetricTable`, `TrendChart`, `metodoloji`.)

## 2026-08-08 — Lighthouse 100 aldı ama kontrast hiç ölçülmemişti
- **Problem:** Altı rotanın altısı erişilebilirlikte 100; buna rağmen `--color-dim` gerçek bir zeminde AA'nın altındaydı (4,33:1).
- **Elenen:** "Lighthouse 100 = kontrast tamam" → Lighthouse sayfayı YALNIZ durağan hâlde denetler; `.panel-hover:hover` zemini (`--color-panel-2`) hiçbir koşuda ölçülmez, ayrıca denetim `notApplicable` dönerse puan yine 100 görünür; `panel-2`'yi koyulaştırmak → koyu temada hover'ın çukura gitmesi demek, "kalkma" hissi kaybolur.
- **Seçilen:** metin rengini açmak (`#7489AE → #7C90B6`, en kötü yüzeyde 4,76:1) + kontrastı YORUM tablosundan çıkarıp hesaplayan bir kapıya taşımak (`scripts/check-a11y.mjs --tokens`).
- **Kanıt:** 7 metin rengi × 3 yüzey hesaplandı, hepsi ≥ 4,5; Lighthouse'ta ayrıca `color-contrast.scoreDisplayMode === 'binary'` doğrulandı (yani denetim gerçekten koştu).
- **KURAL:** Kontrastı elle yazılmış tabloda TUTMA — yanındaki hex bir kez değişince yalan söyler; hesapla. Ve hover/focus/açık-menü gibi geçici yüzeyleri ayrıca ölç: Lighthouse'un göremediği yüzey, olmayan yüzey değildir.

## 2026-08-08 — Kendi ölçüm aracım eksik rapor verip beni yanlış yere gönderdi
- **Problem:** Taşma raporu "suçlu" listesini sırasız ve ilk 8'le kesiyordu; sarmalayıcının İÇİNDEKİ masum hücreler sekiz yeri de doldurunca gerçek suçlu iki koşu boyunca hiç görünmedi.
- **Elenen:** listeyi büyütmek → yalnızca gürültüyü büyütür, sıralama yoksa yine yanlış şey en üstte; kırpılmış elemanları tamamen elemek → rapor bu kez "53 px taşma var, suçlu YOK" dedi, yani araç sessizleşti (aşırı düzeltme).
- **Seçilen:** iki liste — `guilty` (kırpılmayan) ve `suspects` (kırpıldığı SANILAN); ikisi de sağ kenara göre sıralı; `guilty` boşsa `suspects` "ŞÜPHELİ" etiketiyle gösterilir; toplam sayı her zaman yazılır (`N elemandan ilk 8`).
- **Kanıt:** Aynı araç, düzeltmeden önce `MetricTable` içindeki `.sr-only`'yi x≈446'da tek suçlu olarak gösterdi; düzeltmeden sonra 18/18 temiz.
- **KURAL:** Bir kapı, bulduğunu KESEREK raporluyorsa kapı değil filtredir. Kesme varsa sırala + toplamı yaz; ve bir eleme kuralı ekliyorsan (burada "kırpılmış") o kuralın her şeyi eleyip aracı sessizleştirdiği hâli de test et. Kapı iki yönlü sınanır: yakalaması gerekeni yakalıyor mu, geçirmesi gerekeni geçiriyor mu.

## Kalıcı kısıtlar (vaka değil, sitenin anayasası)

- **Uydurma sayı = sıfır tolerans.** Yayınlanan her sayı `scripts/lib/sources.mjs` kaydındaki bir tanımdan gelir. Veri çekilemiyorsa sayfa/bölüm BOŞ kalır; placeholder rakam yazılmaz. Model çıktısındaki her sayı `scripts/lib/guard.mjs` ile anlık görüntüye karşı doğrulanır; tek uyuşmazlıkta çıktının TAMAMI atılır (kısmi düzeltme yok).
- **"Miami" = Miami-Fort Lauderdale-Pompano Beach metro alanı** (Miami-Dade + Broward + Palm Beach). Üç kaynağın üçü de aynı bölgeyi tarif eder. "Miami şehri" DEĞİL — sayfalarda da böyle yazılır.
- **Bu site GECE.** Krem/bej/beyaz zemin yasak. Renk değiştiren her commit `npm run check:a11y -- --tokens` çalıştırır.
- **Anahtarı kabuk komutuna yazma** (`.claude/settings.local.json` onaylanan komutları düz metin saklar). Değerler `.env.local`'e.
