// ─────────────────────────────────────────────────────────────────────────
// Anlık görüntü erişimi + sayı biçimlendirme
//
// Veri hattı (`scripts/fetch-data.mjs`) her ay `src/content/index/<dönem>.json`
// yazar. Site bu dosyaları BUILD anında okur; çalışma zamanında ne veri
// çekilir ne dosya okunur — tüm sayfalar prerender edilir.
//
// Buradaki biçimlendiriciler sitenin TEK sayı yazma yoludur. Bir sayıyı
// JSX içinde elle `toFixed()` ile yazmak, ondalık ayırıcının (Türkçe `,`)
// sayfadan sayfaya değişmesine yol açar.
// ─────────────────────────────────────────────────────────────────────────

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const CONTENT_DIR = path.join(process.cwd(), 'src', 'content', 'index');

// Birim/değişim tipleri ve tüm biçimlendiriciler `format.ts`'te yaşar
// (client component'ler de kullanıyor; bu dosya `node:fs` çekiyor).
export type { Unit, Change } from './format';
import type { Unit, Change } from './format';

export type Metric = {
  id: string;
  label: string;
  short: string;
  unit: Unit;
  value: number;
  asOf: string;
  mom: Change | null;
  momAsOf?: string;
  yoy: Change | null;
  yoyAsOf?: string;
  publisher: string;
  dataset: string;
  note: string;
  featured: boolean;
  /** Metrik ABD geneli mi? (mortgage faizi Miami'ye özgü DEĞİL.) */
  national: boolean;
  sourceUrl: string;
  fetchedAt: string;
};

export type Derived = {
  id: string;
  label: string;
  short: string;
  unit: Unit;
  value: number;
  asOf: string;
  mom: Change | null;
  yoy: Change | null;
  derived: true;
  formula: string;
  inputs: string[];
  note: string;
  fetchedAt: string;
};

export type SeriesPoint = { date: string; value: number };
export type Series = { id: string; label: string; unit: Unit; points: SeriesPoint[] };

export type Publisher = { id: string; name: string; url: string; terms: string };

export type Snapshot = {
  period: string;
  builtAt: string;
  fetchedAt: string;
  geography: string;
  metrics: Metric[];
  derived: Derived[];
  series: Series[];
  publishers: Publisher[];
  warnings: string[];
};

/** Yayınlanmış dönemler, yeniden eskiye. */
export function listPeriods(): string[] {
  return readdirSync(CONTENT_DIR)
    .filter((f) => /^\d{4}-\d{2}\.json$/.test(f))
    .map((f) => f.replace(/\.json$/, ''))
    .sort()
    .reverse();
}

export function getSnapshot(period: string): Snapshot {
  const file = path.join(CONTENT_DIR, `${period}.json`);
  return JSON.parse(readFileSync(file, 'utf8')) as Snapshot;
}

export function getLatestPeriod(): string {
  const pointer = path.join(CONTENT_DIR, 'latest.json');
  const { period } = JSON.parse(readFileSync(pointer, 'utf8')) as { period: string };
  return period;
}

export function getLatestSnapshot(): Snapshot {
  return getSnapshot(getLatestPeriod());
}

export function metric(snap: Snapshot, id: string): Metric | undefined {
  return snap.metrics.find((m) => m.id === id);
}

export function seriesFor(snap: Snapshot, id: string): Series | undefined {
  return snap.series.find((s) => s.id === id);
}

export function publisherOf(snap: Snapshot, id: string): Publisher | undefined {
  return snap.publishers.find((p) => p.id === id);
}
