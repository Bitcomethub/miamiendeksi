// Analiz yazısı içerik modeli.
//
// Metin JSX içine GÖMÜLMEZ: yazılar veri gibi tutulur. Böylece aynı dizi
// hem sayfayı, hem listeyi, hem JSON-LD'yi, hem sitemap'i besler ve — asıl
// önemlisi — `scripts/self-test.mjs` yazıların içindeki HER SAYIYI veri
// anlık görüntüsüne karşı programatik doğrulayabilir. JSX'e gömülü metin
// denetlenemez.

export type Block =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'list'; items: string[] }
  /** Yazının içine gömülen grafik — metrik id'siyle anlık görüntüden çekilir. */
  | { type: 'chart'; metricId: string; accent?: 'cyan' | 'magenta' }
  /** Uyarı/çekince kutusu — metodolojik sınırlar burada yazılır. */
  | { type: 'caveat'; text: string };

export type Article = {
  slug: string;
  title: string;
  /** Liste ve meta description için tek cümlelik özet. */
  excerpt: string;
  /**
   * Answer-first paragraf: başlıktaki soruyu İLK paragrafta, tam sayılarla
   * cevaplar. AI tarayıcıları alıntıyı buradan alır.
   */
  answer: string;
  publishedAt: string;
  /** Hangi aylık anlık görüntüye dayanıyor — grafikler ve JSON-LD bunu kullanır. */
  period: string;
  keywords: string[];
  blocks: Block[];
  faqs: { q: string; a: string }[];
};

/** Yazının denetlenecek tüm düz metni — sayı kapısı bunu okur. */
export function articleText(a: Article): string {
  const parts = [a.title, a.excerpt, a.answer];
  for (const b of a.blocks) {
    if (b.type === 'p' || b.type === 'h2' || b.type === 'caveat') parts.push(b.text);
    if (b.type === 'list') parts.push(...b.items);
  }
  for (const f of a.faqs) parts.push(f.q, f.a);
  return parts.join('\n');
}
