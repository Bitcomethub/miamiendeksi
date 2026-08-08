'use client';

import { useMemo, useState } from 'react';
import { plot, describeSeries, type Box } from '@/lib/chart';
import { formatValue, formatDate, formatAxisDate, type Unit } from '@/lib/format';

// ─────────────────────────────────────────────────────────────────────────
// Tek serili çizgi grafiği — neon, koyu zemin
//
// ERİŞİLEBİLİRLİK KARARI: SVG `aria-hidden`. Bunun nedeni erişilebilirlikten
// vazgeçmek DEĞİL, tersi. Bir çizgi grafiğini ARIA ile "okunur" yapmaya
// çalışmak (role="img" + uzun aria-label, ya da her noktaya odaklanılabilir
// eleman) ekran okuyucuda 60 gözlemlik bir sayı yığını üretir. Bunun yerine:
//
//   1. `<figcaption>` grafiğin şeklini SÖZLE anlatır — koddan hesaplanır,
//      model yazmaz (bkz. lib/chart.ts describeSeries).
//   2. Tüm sayılar grafiğin altındaki GERÇEK tabloda, her zaman DOM'da.
//   3. SVG yalnızca görsel katman.
//
// İmleç ipucu fare/dokunma için bir kolaylıktır; klavye eşdeğeri tablodur.
// Bu yüzden grafik odaklanılabilir değildir (klavye tuzağı da oluşmaz).
// ─────────────────────────────────────────────────────────────────────────

const BOX: Box = { w: 760, h: 280, top: 16, right: 16, bottom: 30, left: 56 };

type Props = {
  points: { date: string; value: number }[];
  unit: Unit;
  label: string;
  /** Vurgu rengi — ikinci bir grafiği ayırmak için magenta kullanılabilir. */
  accent?: 'cyan' | 'magenta';
  /** Kaynak künyesi: "Zillow Research · 8 Ağustos 2026" */
  source: string;
};

export function TrendChart({ points, unit, label, accent = 'cyan', source }: Props) {
  const [active, setActive] = useState<number | null>(null);

  const g = useMemo(() => plot(points, unit, BOX), [points, unit]);
  const summary = useMemo(() => describeSeries(points, unit, label), [points, unit, label]);

  if (points.length === 0) return null;

  const stroke = accent === 'cyan' ? 'var(--color-cyan)' : 'var(--color-magenta)';
  const gradId = `fill-${accent}-${label.replace(/\W+/g, '')}`;

  // Eksende ~5 tarih etiketi; hepsini yazmak 393 px'te üst üste biner.
  const step = Math.max(1, Math.ceil(points.length / 5));
  const xLabels = g.points.filter((_, i) => i % step === 0 || i === g.points.length - 1);

  const cur = active !== null ? g.points[active] : null;
  const last = g.points[g.points.length - 1];

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    // Piksel → viewBox koordinatı → en yakın gözlem.
    const vx = ((e.clientX - rect.left) / rect.width) * BOX.w;
    const inner = BOX.w - BOX.left - BOX.right;
    const ratio = (vx - BOX.left) / inner;
    const i = Math.round(ratio * (points.length - 1));
    setActive(Math.min(points.length - 1, Math.max(0, i)));
  }

  return (
    <figure className="mt-6">
      <div
        className="panel relative touch-pan-y p-3 sm:p-4"
        onPointerMove={onMove}
        onPointerLeave={() => setActive(null)}
      >
        <svg
          viewBox={`0 0 ${BOX.w} ${BOX.h}`}
          className="block h-auto w-full"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.26" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Kılavuz: geri planda kalır, veriyle yarışmaz */}
          {g.ticks.map((t, i) => (
            <g key={i}>
              <line
                x1={BOX.left}
                x2={BOX.w - BOX.right}
                y1={t.y}
                y2={t.y}
                stroke="var(--color-edge)"
                strokeWidth="1"
              />
              <text
                x={BOX.left - 10}
                y={t.y + 4}
                textAnchor="end"
                fill="var(--color-dim)"
                fontSize="12"
                fontFamily="var(--font-mono)"
              >
                {t.label}
              </text>
            </g>
          ))}

          {xLabels.map((p, i) => (
            <text
              key={i}
              x={p.x}
              y={BOX.h - 10}
              textAnchor="middle"
              fill="var(--color-dim)"
              fontSize="12"
              fontFamily="var(--font-mono)"
            >
              {formatAxisDate(p.date)}
            </text>
          ))}

          <path d={g.areaPath} fill={`url(#${gradId})`} />
          <path
            d={g.path}
            fill="none"
            stroke={stroke}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Son gözlem her zaman işaretli — grafiğin "şimdi"si */}
          <circle cx={last.x} cy={last.y} r="4.5" fill={stroke} stroke="var(--color-panel)" strokeWidth="2" />

          {cur ? (
            <g>
              <line
                x1={cur.x}
                x2={cur.x}
                y1={BOX.top}
                y2={BOX.h - BOX.bottom}
                stroke={stroke}
                strokeWidth="1"
                strokeDasharray="3 3"
                opacity="0.6"
              />
              <circle cx={cur.x} cy={cur.y} r="6" fill={stroke} stroke="var(--color-panel)" strokeWidth="2" />
            </g>
          ) : null}
        </svg>

        {cur ? (
          <div
            className="pointer-events-none absolute top-4 z-10 -translate-x-1/2 border border-edge bg-night/95 px-2.5 py-1.5 text-center whitespace-nowrap"
            style={{
              // %8–92 arasına sıkıştırılır: kenarlarda kutu paneli taşardı.
              left: `${Math.min(92, Math.max(8, (cur.x / BOX.w) * 100))}%`,
            }}
          >
            <span className="block font-mono text-[0.6875rem] text-dim">{formatDate(cur.date)}</span>
            <span className="tabular block font-mono text-small font-medium text-ice">
              {formatValue(cur.value, unit)}
            </span>
          </div>
        ) : null}
      </div>

      <figcaption className="mt-2.5 text-[0.8125rem] leading-relaxed text-mute">
        {summary} <span className="text-dim">Kaynak: {source}.</span>
      </figcaption>

      <details className="group mt-2">
        <summary className="cursor-pointer font-mono text-[0.75rem] tracking-wide text-dim uppercase transition-colors hover:text-cyan">
          Veriyi tablo olarak göster
        </summary>
        {/* `relative`: aşağıdaki tablonun `.sr-only` başlığı mutlak konumlu.
            Kaydırma kutusu `static` kalırsa onu kırpmaz. Bkz. MetricTable. */}
        <div className="relative mt-2 max-h-72 overflow-y-auto">
          <table className="w-full text-left text-small">
            <caption className="sr-only">{label} — tüm gözlemler</caption>
            <thead className="sticky top-0 bg-panel">
              <tr>
                <th scope="col" className="px-2.5 py-1.5 font-mono text-[0.6875rem] tracking-wide text-dim uppercase">
                  Dönem
                </th>
                <th scope="col" className="px-2.5 py-1.5 text-right font-mono text-[0.6875rem] tracking-wide text-dim uppercase">
                  Değer
                </th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.date} className="border-t border-edge/60">
                  <td className="px-2.5 py-1.5 font-mono text-[0.8125rem] text-mute">{formatDate(p.date)}</td>
                  <td className="tabular px-2.5 py-1.5 text-right font-mono text-[0.8125rem] text-ice">
                    {formatValue(p.value, unit)}
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
