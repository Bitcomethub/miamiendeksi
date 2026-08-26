import { barPlot, describeBars, canDrawBars } from '@/lib/chart';
import { ChangeBadge } from './Metric';
import { formatChange, type Change } from '@/lib/format';

// ─────────────────────────────────────────────────────────────────────────
// Iraksayan karşılaştırma çubuğu — tek ölçü, çok gösterge
//
// SUNUCU BİLEŞENİ, BİLİNÇLİ: `TrendChart` bir client component çünkü imleç
// ipucu taşıyor. Karşılaştırma çubuğunun ipucuna ihtiyacı yok — her satırın
// sayısı zaten satırın SAĞINDA yazılı. İpucu olmayınca JS de olmuyor: bu
// grafik tam SSG sitede sıfır kB istemci yükü ekler. `chart.ts` başlığındaki
// "kütüphane yok" gerekçesinin en somut hâli burası.
//
// SVG DEĞİL, CSS KUTUSU: çubuk bir dikdörtgendir; yüzdeyle konumlanan bir
// `<div>` her genişlikte tam doğru çizer. SVG'yi `preserveAspectRatio="none"`
// ile esnetseydik sıfır çizgisinin KALINLIĞI da kapsayıcı genişliğiyle
// ölçeklenirdi (Sparkline'daki daire bozulmasının kardeşi). CSS'te sıfır
// çizgisi 393 px'te de 1280 px'te de tam 1 px.
//
// ERİŞİLEBİLİRLİK: `TrendChart` ile aynı mimari. Çubuklar `aria-hidden`
// (renkli kutular ekran okuyucuya hiçbir şey söylemez), grafiğin ŞEKLİ
// `<figcaption>`'da koddan hesaplanmış bir cümle, KESİN sayılar hem her
// satırın sağında hem alttaki tabloda. Renk tek başına anlam taşımaz:
// yanında ok işareti, işaretli sayı ve `ChangeBadge`'in ekran okuyucuya
// yazdığı yön sözcüğü var (WCAG 1.4.1).
// ─────────────────────────────────────────────────────────────────────────

type Props = {
  items: { id: string; label: string; value: number }[];
  /** `pct` (yüzde değişim) mi `pp` (yüzde PUANI) mı — karışık olamaz. */
  kind: Change['kind'];
  /** Grafiğin adı, özet cümlesinde geçer: "Yıllık değişim". */
  label: string;
  /** Ekran okuyucu karşılaştırma ifadesi: "geçen yılın aynı ayına". */
  compareLabel: string;
  /** Kaynak künyesi: "Zillow Research · Redfin · FRED" */
  source: string;
};

export function BarChart({ items, kind, label, compareLabel, source }: Props) {
  // Sıralama editoryal DEĞİL, okunabilirlik: sırasız ıraksayan çubuk yığını
  // göz taramasına kapalıdır. En çok gerileyen üstte — grafik böylece bir
  // SIRALAMA olur ve `describeBars`'ın yazdığı cümleyle aynı düzeni izler.
  const sorted = [...items].sort((a, b) => a.value - b.value);
  const g = barPlot(sorted);

  // Veri yoksa bölüm hiç çizilmez — boş bir çerçeve de bir tür yer tutucudur.
  // Tek satır da çizilmez: eşik `chart-geom.mjs` → MIN_BARS'ta, tek yerde.
  // Bu bileşeni saran her bölüm AYNI eşiği sormalı, yoksa başlığı yazılmış
  // ama grafiği olmayan bir bölüm kalır.
  if (!canDrawBars(g.rows)) return null;

  const summary = describeBars(g.rows, kind, label);

  return (
    <figure className="mt-6">
      <div className="panel relative p-4 sm:p-5">
        <ol className="space-y-3.5">
          {g.rows.map((r) => {
            const fill = r.dir === 'up' ? 'bg-up' : r.dir === 'down' ? 'bg-down' : 'bg-mute';
            return (
              <li key={r.id}>
                {/* `flex-wrap` + iki tarafa `shrink-0`: dar ekranda flex önce
                    METNİ ezer. Kırılma noktasını tahmin etmek yerine satırın
                    kendisi hesaplasın. */}
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span className="shrink-0 text-small leading-snug text-mute">{r.label}</span>
                  <span className="shrink-0">
                    <ChangeBadge change={{ value: r.value, kind }} label={compareLabel} />
                  </span>
                </div>

                <div
                  aria-hidden="true"
                  className="relative mt-1.5 h-1.5 w-full bg-panel-2"
                >
                  <span
                    className={`absolute inset-y-0 ${fill}`}
                    style={{ left: `${r.x}%`, width: `${r.w}%` }}
                  />
                  {/* Taban çizgisi: sıfır. Rakamın işareti burada başlar.
                      Çubuktan SONRA boyanır — her çubuk sıfırda başladığı için
                      önce boyansaydı tam o pikselde çubuğun altında kalır ve
                      tek işaretli kümelerde (hepsi eksi) hiç görünmezdi. */}
                  <span
                    className="absolute -inset-y-1 w-px bg-edge"
                    style={{ left: `${g.zero}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <figcaption className="mt-2.5 text-[0.8125rem] leading-relaxed text-mute">
        {summary} <span className="text-dim">Kaynak: {source}.</span>
      </figcaption>

      <details className="group mt-2">
        <summary className="cursor-pointer font-mono text-[0.75rem] tracking-wide text-dim uppercase transition-colors hover:text-cyan">
          Veriyi tablo olarak göster
        </summary>
        {/* `relative`: aşağıdaki `.sr-only` başlık mutlak konumludur ve
            `static` bir kaydırma kutusu onu KIRPMAZ — belgeyi taşırır.
            Bkz. MetricTable, TrendChart. */}
        <div className="relative mt-2 max-h-72 overflow-y-auto">
          <table className="w-full text-left text-small">
            <caption className="sr-only">{label} — karşılaştırılan tüm göstergeler</caption>
            <thead className="sticky top-0 bg-panel">
              <tr>
                <th
                  scope="col"
                  className="px-2.5 py-1.5 font-mono text-[0.6875rem] tracking-wide text-dim uppercase"
                >
                  Gösterge
                </th>
                <th
                  scope="col"
                  className="px-2.5 py-1.5 text-right font-mono text-[0.6875rem] tracking-wide text-dim uppercase"
                >
                  Değişim
                </th>
              </tr>
            </thead>
            <tbody>
              {g.rows.map((r) => (
                <tr key={r.id} className="border-t border-edge/60">
                  <td className="px-2.5 py-1.5 text-[0.8125rem] text-mute">{r.label}</td>
                  <td className="tabular px-2.5 py-1.5 text-right font-mono text-[0.8125rem] text-ice">
                    {formatChange({ value: r.value, kind })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
