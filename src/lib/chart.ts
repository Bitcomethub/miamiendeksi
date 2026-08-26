// ─────────────────────────────────────────────────────────────────────────
// Grafik geometrisi — kütüphane YOK
//
// Neden kütüphane yok: bu sitenin tüm sayfaları statik üretiliyor ve ihtiyaç
// duyduğu iki biçim de (tek serili çizgi, ıraksayan karşılaştırma çubuğu)
// birkaç satır aritmetik. Recharts/Chart.js gibi bir bağımlılık ~50–100 kB JS
// ekler, hiçbirini karşılamadığı bir a11y yükü getirir ve neon/koyu temada
// zaten baştan aşağı override edilirdi. Çubuk grafiğin bu sitedeki hâli
// ayrıca HİÇ JS istemiyor: sunucu bileşeni + CSS kutuları.
//
// TASARIM KARARI (dataviz yordamı): her ÇİZGİ grafiği TEK seri gösterir.
// Böylece kategorik palet kısıtları (renk körlüğü ayrımı, sabit hue sırası)
// devreye girmez — geriye yalnızca zemine karşı kontrast şartı kalır ve neon
// paleti bunu geçer. İki ölçüyü tek eksene BİNDİRMEK yasak; iki metrik = iki
// grafik. Karşılaştırma çubuğu bu kuralın istisnası DEĞİL: orada tek bir ölçü
// (yıllık değişim) birden çok gösterge için yan yana konur, iki farklı ölçü
// üst üste değil. Birim karışırsa (pp ↔ pct) satır hiç seçilmez.
//
// İKİ GRAFİĞİN TABAN ÇİZGİSİ KURALI TERSTİR, ikisi de bilinçlidir:
//   · çizgi  → sıfırdan BAŞLAMAZ (değeri konum kodlar, bkz. `bounds()`)
//   · çubuk  → sıfırdan BAŞLAR   (değeri uzunluk kodlar, bkz. chart-geom.mjs)
// ─────────────────────────────────────────────────────────────────────────

import {
  barPlot as barPlotRaw,
  comparableChanges as comparableChangesRaw,
  superlative,
  BAR_W as BAR_W_RAW,
  MIN_BARS as MIN_BARS_RAW,
} from './chart-geom.mjs';
import type { SeriesPoint, Unit } from './snapshot';
import { formatCompact, formatValue, formatDate, formatChange } from './format';
import type { Change } from './format';

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

// ─────────────────────────────────────────────────────────────────────────
// Karşılaştırma çubukları
//
// Geometri BU DOSYADA DEĞİL, `chart-geom.mjs`'te: `npm test` bir Node 20
// script'i ve TypeScript çalıştıramıyor. Çubuğun taşıdığı iddia (uzunluk =
// büyüklük) bir render kapısının göremeyeceği kadar aritmetik olduğu için
// düz ESM'ye alındı ve birim testi var. Gerekçenin tamamı o dosyanın
// başlığında.
//
// Burada yalnızca TİP yüzeyi ve — `describeSeries` ile aynı disiplinde —
// grafiğin SÖZLE özeti var.
// ─────────────────────────────────────────────────────────────────────────

export type BarItem = { id: string; label: string; value: number };
export type BarDir = 'up' | 'down' | 'flat';
export type BarRow = BarItem & { x: number; w: number; dir: BarDir };
export type BarPlot = { rows: BarRow[]; zero: number; lo: number; hi: number; width: number };

export const BAR_W: number = BAR_W_RAW;
export const MIN_BARS: number = MIN_BARS_RAW;

/** Çizilebilir mi — eşik `chart-geom.mjs`'te tek yerde. */
export function canDrawBars(items: unknown[]): boolean {
  return items.length >= MIN_BARS;
}

export const barPlot = barPlotRaw as (items: BarItem[]) => BarPlot;

/**
 * `pp` ile `pct` aynı eksene giremez — mortgage faizinin +0,06 PUANLIK farkı
 * ile stokun %−20,36'sı aynı birim değildir. Karışık birim ELENMEZ, hiç
 * SEÇİLMEZ; kapının kendisi `chart-geom.mjs`'te ve testli.
 */
export function comparableChanges<T extends { change: Change | null }>(
  entries: T[],
  kind: Change['kind'],
): T[] {
  return comparableChangesRaw(entries, kind) as T[];
}

/**
 * Çubuk grafiğin sözle özeti — `<figcaption>` içine girer.
 *
 * `describeSeries` ile aynı kural: KODDAN hesaplanır, model yazmaz. Grafiğin
 * yanındaki cümle de bir veri iddiasıdır. Ekran okuyucu kullanıcısı sıralamayı
 * bu cümleden, kesin sayıları alttaki tablodan alır — SVG yok, çubuklar zaten
 * `aria-hidden` işaretli kutulardır.
 */
export function describeBars(rows: BarRow[], kind: Change['kind'], label: string): string {
  if (rows.length === 0) return `${label}: veri yok.`;

  const artan = rows.filter((r) => r.dir === 'up').length;
  const azalan = rows.filter((r) => r.dir === 'down').length;
  const sabit = rows.length - artan - azalan;

  const sirali = [...rows].sort((a, b) => a.value - b.value);
  const enDusuk = sirali[0];
  const enYuksek = sirali[sirali.length - 1];

  const ch = (v: number): string => formatChange({ value: v, kind });

  const dagilim = [
    azalan > 0 ? `${azalan} gösterge geriledi` : null,
    artan > 0 ? `${artan} gösterge arttı` : null,
    sabit > 0 ? `${sabit} gösterge değişmedi` : null,
  ]
    .filter(Boolean)
    .join(', ');

  // Sıfat DEĞERİN İŞARETİNE bakar, dizideki konumuna değil. Hepsi negatif bir
  // kümede en büyük değer "en çok artan" DEĞİL, "en az gerileyen"dir — aksi
  // hâlde cümle, artmayan bir göstergeyi artmış gibi yazar.
  const dus = superlative(enDusuk.value, 'low');
  const yuk = superlative(enYuksek.value, 'high');
  const bas = dus.charAt(0).toLocaleUpperCase('tr') + dus.slice(1);

  return (
    `${label}: ${rows.length} gösterge karşılaştırıldı. ${dagilim}. ` +
    `${bas} ${enDusuk.label} (${ch(enDusuk.value)}), ` +
    `${yuk} ${enYuksek.label} (${ch(enYuksek.value)}).`
  );
}
