// ─────────────────────────────────────────────────────────────────────────
// Biçimlendirme — SAF, bağımlılıksız
//
// Bu dosya bilinçli olarak `node:fs` gibi sunucu modüllerinden AYRIDIR:
// grafiğin ipucu katmanı bir client component ve aynı biçimlendiricileri
// kullanmak zorunda. Sayı yazma işi burada tek merkezde toplanmazsa ondalık
// ayırıcı (Türkçe `,`) sayfadan sayfaya kayar.
// ─────────────────────────────────────────────────────────────────────────

export type Unit = 'usd' | 'pct' | 'count' | 'days' | 'index';

/** Değişim: `pct` yüzde değişim, `pp` yüzde PUANI farkı. */
export type Change = { value: number; kind: 'pct' | 'pp' };

// ── Tarih ────────────────────────────────────────────────────────────────
//
// Ay adları sabit dizidir; `new Date().toLocaleDateString('tr-TR')` ile
// ÜRETİLMEZ. Sunucu UTC'de, ziyaretçi başka bir saat diliminde: aynı ISO
// tarihi iki tarafta farklı güne düşebilir ve prerender edilmiş HTML ile
// hydration çıktısı uyuşmaz.

const AYLAR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
] as const;

/** '2026-08' → 'Ağustos 2026' */
export function formatPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number);
  const ay = AYLAR[m - 1];
  return ay ? `${ay} ${y}` : period;
}

/** '2026-06-30' → '30 Haziran 2026' */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const ay = AYLAR[m - 1];
  return ay ? `${d} ${ay} ${y}` : iso;
}

/** '2026-06-30' → 'Haziran 2026' — gözlem dönemi için gün anlamsız. */
export function formatMonth(iso: string): string {
  const [y, m] = iso.slice(0, 10).split('-').map(Number);
  const ay = AYLAR[m - 1];
  return ay ? `${ay} ${y}` : iso;
}

/** '2026-06-30' → '06.26' — grafik ekseni için. */
export function formatAxisDate(iso: string): string {
  const [y, m] = iso.slice(0, 10).split('-');
  return `${m}.${y.slice(2)}`;
}

// ── Sayı ─────────────────────────────────────────────────────────────────

const nf = (min: number, max: number) =>
  new Intl.NumberFormat('tr-TR', { minimumFractionDigits: min, maximumFractionDigits: max });

const int = nf(0, 0);
const one = nf(1, 1);
const two = nf(2, 2);

/**
 * Bir metrik değerini birimine göre yazar.
 *
 * Para değerleri TAM DOLARA yuvarlanır: ZHVI 476.597,656 gibi bir endeksin
 * kuruş hanesi anlamlı değildir ve sahte hassasiyet izlenimi verir.
 */
export function formatValue(value: number, unit: Unit): string {
  switch (unit) {
    case 'usd':
      return `$${int.format(Math.round(value))}`;
    case 'pct':
      return `%${one.format(value)}`;
    case 'count':
      return int.format(Math.round(value));
    case 'days':
      return `${int.format(Math.round(value))} gün`;
    case 'index':
      return two.format(value);
  }
}

/** Grafik ekseni için kısa biçim: $476b · 51,0b · %19,7 */
export function formatCompact(value: number, unit: Unit): string {
  const abs = Math.abs(value);
  if (unit === 'pct') return `%${one.format(value)}`;
  if (unit === 'days') return int.format(Math.round(value));
  if (unit === 'index') return one.format(value);

  const prefix = unit === 'usd' ? '$' : '';
  if (abs >= 1_000_000) return `${prefix}${one.format(value / 1_000_000)}mn`;
  if (abs >= 1_000) return `${prefix}${one.format(value / 1_000)}b`;
  return `${prefix}${int.format(Math.round(value))}`;
}

/**
 * Değişimi işaretiyle yazar.
 *
 * `pp` ile `pct` AYRIMI KORUNUR: mortgage faizi %6,49'dan %6,69'a çıktığında
 * fark 0,20 PUANDIR, %0,20 değil (yüzde olarak artış %3,1'dir). İkisini
 * karıştırmak faiz ve oran metriklerinde büyük hata üretir.
 */
export function formatChange(change: Change): string {
  const sign = change.value > 0 ? '+' : change.value < 0 ? '−' : '';
  const abs = Math.abs(change.value);
  return change.kind === 'pp'
    ? `${sign}${two.format(abs)} puan`
    : `${sign}%${two.format(abs)}`;
}

/** Yön: renk ve ok işareti için. YARGI DEĞİL — yalnızca artış/azalış. */
export function direction(change: Change | null): 'up' | 'down' | 'flat' {
  if (!change || change.value === 0) return 'flat';
  return change.value > 0 ? 'up' : 'down';
}

/**
 * Ekran okuyucu için yön sözcüğü.
 *
 * Renk ve ok işareti TEK BAŞINA anlam taşımaz (WCAG 1.4.1): yeşil/kırmızı
 * ayrımını göremeyen kullanıcı yönü bu sözcükten okur.
 */
export function directionWord(change: Change | null): string {
  const d = direction(change);
  return d === 'up' ? 'arttı' : d === 'down' ? 'azaldı' : 'değişmedi';
}
