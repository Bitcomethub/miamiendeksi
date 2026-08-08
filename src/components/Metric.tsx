import { Sparkline } from './Sparkline';
import type { Derived, Metric, Publisher, Series } from '@/lib/snapshot';
import {
  direction,
  directionWord,
  formatChange,
  formatDate,
  formatMonth,
  formatValue,
  type Change,
} from '@/lib/format';

// ─────────────────────────────────────────────────────────────────────────
// Metrik gösterimi
//
// RENK KURALI: yeşil/kırmızı YÖNÜ kodlar, iyi/kötüyü değil. Düşen bir konut
// fiyatı satıcı için kötü, alıcı için iyidir; site taraf tutmaz. Bu yüzden
// renk hiçbir zaman TEK BAŞINA anlam taşımaz — yanında ok işareti, işaretli
// sayı ve ekran okuyucu için yön sözcüğü bulunur (WCAG 1.4.1).
// ─────────────────────────────────────────────────────────────────────────

export function ChangeBadge({ change, label }: { change: Change | null; label: string }) {
  if (!change) {
    return (
      <span className="font-mono text-[0.8125rem] text-dim">
        <span className="sr-only">{label}: </span>karşılaştırma yok
      </span>
    );
  }

  const dir = direction(change);
  const color = dir === 'up' ? 'text-up' : dir === 'down' ? 'text-down' : 'text-mute';
  const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '—';

  return (
    <span className={`tabular font-mono text-[0.8125rem] ${color}`}>
      <span aria-hidden="true">{arrow} </span>
      {formatChange(change)}
      <span className="sr-only"> {label} göre {directionWord(change)}</span>
    </span>
  );
}

/** Kaynak künyesi — her sayının altında, istisnasız. */
export function SourceLine({
  publisher,
  dataset,
  asOf,
  fetchedAt,
  sourceUrl,
}: {
  publisher?: Publisher;
  dataset: string;
  asOf: string;
  fetchedAt: string;
  sourceUrl?: string;
}) {
  return (
    <p className="mt-3 border-t border-edge pt-2.5 font-mono text-[0.6875rem] leading-relaxed text-dim">
      <span className="text-mute">{formatMonth(asOf)} verisi</span>
      {' · '}
      {sourceUrl ? (
        <a
          href={sourceUrl}
          rel="nofollow noopener"
          className="underline decoration-dim/40 underline-offset-2 transition-colors hover:text-cyan"
        >
          {publisher?.name ?? 'Kaynak'}
        </a>
      ) : (
        (publisher?.name ?? 'Kaynak')
      )}
      {' · '}
      <span title={dataset}>{dataset}</span>
      {' · '}
      <span>çekim {formatDate(fetchedAt)}</span>
    </p>
  );
}

export function MetricCard({
  metric,
  series,
  publisher,
  accent = 'cyan',
}: {
  metric: Metric;
  series?: Series;
  publisher?: Publisher;
  accent?: 'cyan' | 'magenta';
}) {
  return (
    <article className="panel panel-hover flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-h3 leading-snug font-medium text-balance text-ice">
          {metric.label}
        </h3>
        {metric.national ? (
          <span className="shrink-0 border border-magenta-deep px-1.5 py-0.5 font-mono text-[0.625rem] tracking-wide text-magenta uppercase">
            ABD geneli
          </span>
        ) : null}
      </div>

      <p className="tabular mt-3 font-mono text-[clamp(1.75rem,1.2rem+2vw,2.5rem)] leading-none font-semibold text-ice">
        {formatValue(metric.value, metric.unit)}
      </p>

      {series ? (
        <div className="mt-4">
          <Sparkline points={series.points} unit={metric.unit} accent={accent} />
        </div>
      ) : null}

      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        <div>
          <dt className="font-mono text-[0.625rem] tracking-wider text-dim uppercase">Aylık</dt>
          <dd className="mt-0.5">
            <ChangeBadge change={metric.mom} label="önceki aya" />
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[0.625rem] tracking-wider text-dim uppercase">Yıllık</dt>
          <dd className="mt-0.5">
            <ChangeBadge change={metric.yoy} label="geçen yılın aynı ayına" />
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-[0.8125rem] leading-relaxed text-mute">{metric.note}</p>

      <div className="mt-auto">
        <SourceLine
          publisher={publisher}
          dataset={metric.dataset}
          asOf={metric.asOf}
          fetchedAt={metric.fetchedAt}
          sourceUrl={metric.sourceUrl}
        />
      </div>
    </article>
  );
}

/** Türetilmiş gösterge — formülü GÖRÜNÜR yazılır, kara kutu bırakılmaz. */
export function DerivedCard({ item }: { item: Derived }) {
  return (
    <article className="panel flex flex-col p-5">
      <h3 className="font-display text-h3 leading-snug font-medium text-ice">{item.label}</h3>

      <p className="tabular mt-3 font-mono text-[clamp(1.75rem,1.2rem+2vw,2.5rem)] leading-none font-semibold text-magenta">
        {formatValue(item.value, item.unit)}
      </p>

      <p className="mt-3 font-mono text-[0.75rem] text-cyan">{item.formula}</p>
      <p className="mt-3 text-[0.8125rem] leading-relaxed text-mute">{item.note}</p>

      <p className="mt-auto border-t border-edge pt-2.5 font-mono text-[0.6875rem] text-dim">
        <span className="text-mute">{formatMonth(item.asOf)} verisi</span> · MiamiLi Media hesabı ·
        girdiler Zillow Research · çekim {formatDate(item.fetchedAt)}
      </p>
    </article>
  );
}
