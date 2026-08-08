# Learnings — miamiendeksi

> Bu dosya KISA tutulur (üst sınır ~12.000 karakter) ve her oturumun başında
> okunur. Buraya yalnızca **her gelecek oturumu bağlayan kural** yazılır.
> Vakanın tam anlatısı `LEARNINGS_ARCHIVE.md`'dedir ve oturum başında
> OKUNMAZ — yalnızca buradaki bir başlığa benzeyen bir semptom aktif olarak
> ayıklanırken açılır.

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
