// ─────────────────────────────────────────────────────────────────────────
// Grafik geometrisi — kütüphane YOK, saf SVG
//
// Neden kütüphane yok: bu sitenin tüm sayfaları statik üretiliyor ve tek
// ihtiyaç duyduğu biçim tek serili çizgi grafiği. Recharts/Chart.js gibi bir
// bağımlılık ~50–100 kB JS ekler, hiçbirini karşılamadığı bir a11y yükü
// getirir ve neon/koyu temada zaten baştan aşağı override edilirdi.
//
// TASARIM KARARI (dataviz yordamı): her grafik TEK seri gösterir. Böylece
// kategorik palet kısıtları (renk körlüğü ayrımı, sabit hue sırası) devreye
// girmez — geriye yalnızca zemine karşı kontrast şartı kalır ve neon paleti
// bunu geçer. İki ölçüyü tek eksene BİNDİRMEK yasak; iki metrik = iki grafik.
// ─────────────────────────────────────────────────────────────────────────

import type { SeriesPoint, Unit } from './snapshot';
import { formatCompact, formatValue, formatDate } from './format';

export type Box = { w: number; h: number; top: number; right: number; bottom: number; left: number };

export type Plotted = {
  points: { x: number; y: number; date: string; value: number }[];
  path: string;
  areaPath: string;
  ticks: { y: number; label: string }[];
  min: number;
  max: number;
  box: Box;
};

/**
 * Serinin y ekseni alt/üst sınırı.
 *
 * Sıfırdan BAŞLAMAZ: konut değeri gibi hiçbir zaman sıfıra yaklaşmayan bir
 * seride sıfır tabanlı eksen tüm hareketi ekranın üst şeridine sıkıştırır ve
 * grafiği okunamaz kılar. Bunun karşılığı, dikey ölçeğin değişimi abartma
 * riskidir — bu yüzden eksen etiketleri HER ZAMAN yazılır ve grafiğin altında
 * gerçek sayı tablosu bulunur.
 */
function bounds(values: number[]): { lo: number; hi: number } {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    const pad = Math.abs(min) * 0.05 || 1;
    return { lo: min - pad, hi: max + pad };
  }
  const pad = (max - min) * 0.12;
  return { lo: min - pad, hi: max + pad };
}

export function plot(points: SeriesPoint[], unit: Unit, box: Box): Plotted {
  const values = points.map((p) => p.value);
  const { lo, hi } = bounds(values);

  const innerW = box.w - box.left - box.right;
  const innerH = box.h - box.top - box.bottom;

  const x = (i: number) =>
    points.length === 1 ? box.left + innerW / 2 : box.left + (i / (points.length - 1)) * innerW;
  const y = (v: number) => box.top + innerH - ((v - lo) / (hi - lo)) * innerH;

  const mapped = points.map((p, i) => ({ x: x(i), y: y(p.value), date: p.date, value: p.value }));

  const path = mapped.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');

  const baseline = box.top + innerH;
  const areaPath =
    mapped.length > 0
      ? `${path} L${mapped[mapped.length - 1].x.toFixed(2)} ${baseline} L${mapped[0].x.toFixed(2)} ${baseline} Z`
      : '';

  // 4 yatay kılavuz — daha fazlası koyu zeminde gürültü yapıyor.
  const ticks = [0, 1, 2, 3].map((i) => {
    const v = lo + ((hi - lo) * i) / 3;
    return { y: y(v), label: formatCompact(v, unit) };
  });

  return { points: mapped, path, areaPath, ticks, min: Math.min(...values), max: Math.max(...values), box };
}

/**
 * Grafiğin sözle özeti — `<figcaption>` içine girer.
 *
 * KODDAN hesaplanır, model yazmaz: grafiğin yanındaki cümle de bir veri
 * iddiasıdır ve sitenin kuralı her sayının kaynaklı olması. Ekran okuyucu
 * kullanıcısı grafiğin şeklini bu cümleden, kesin sayıları alttaki tablodan
 * alır — SVG'nin kendisi bu yüzden `aria-hidden`.
 */
export function describeSeries(points: SeriesPoint[], unit: Unit, label: string): string {
  if (points.length === 0) return `${label}: veri yok.`;

  const first = points[0];
  const last = points[points.length - 1];
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);

  const dir = last.value > first.value ? 'yükseldi' : last.value < first.value ? 'geriledi' : 'yatay seyretti';

  return (
    `${label}: ${formatDate(first.date)} – ${formatDate(last.date)} arası ${points.length} gözlem. ` +
    `${formatValue(first.value, unit)} seviyesinden ${formatValue(last.value, unit)} seviyesine ${dir}. ` +
    `Dönemin en düşüğü ${formatValue(min, unit)}, en yükseği ${formatValue(max, unit)}.`
  );
}
