import { plot, type Box } from '@/lib/chart';
import type { SeriesPoint, Unit } from '@/lib/snapshot';

// Kart içi mikro grafik: eksen yok, etiket yok, ipucu yok.
// Kartın sayısı ve değişimleri zaten METİN olarak yazılı; bu SVG sadece
// hareketin şeklini gösterir, bu yüzden tamamen dekoratiftir (`aria-hidden`).
// Ekran okuyucuya ek bir şey söylemez — söyleseydi kartın metnini tekrarlardı.

const BOX: Box = { w: 240, h: 48, top: 4, right: 2, bottom: 4, left: 2 };

export function Sparkline({
  points,
  unit,
  accent = 'cyan',
  months = 36,
}: {
  points: SeriesPoint[];
  unit: Unit;
  accent?: 'cyan' | 'magenta';
  months?: number;
}) {
  const tail = points.slice(-months);
  if (tail.length < 2) return null;

  const g = plot(tail, unit, BOX);
  const stroke = accent === 'cyan' ? 'var(--color-cyan)' : 'var(--color-magenta)';
  const last = g.points[g.points.length - 1];

  return (
    // Ölçek DÜZGÜN (preserveAspectRatio varsayılan): `none` yatayda esnetir
    // ve uç noktadaki daireyi elipse çevirir — `vector-effect` çizgi
    // kalınlığını korur ama daire geometrisini korumaz. 5:1 en-boy oranı
    // kart genişliğiyle birlikte ölçekleniyor, bozulma olmuyor.
    <svg
      viewBox={`0 0 ${BOX.w} ${BOX.h}`}
      className="block h-auto w-full"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={g.path}
        fill="none"
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.9"
      />
      <circle cx={last.x} cy={last.y} r="2.5" fill={stroke} />
    </svg>
  );
}
