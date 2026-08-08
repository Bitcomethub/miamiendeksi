import raw from './articles.json';
import type { Article } from './types';

// ─────────────────────────────────────────────────────────────────────────
// Analiz yazıları
//
// İçerik neden JSON'da, TS dizisinde değil: yazıların içindeki HER SAYI
// `npm test` ile veri anlık görüntüsüne karşı doğrulanıyor ve doğrulayıcı
// bir Node script'i. TS kaynağını metin olarak taramak yanlış girdi verir —
// ilk denemede kapı `'mortgage-30y'` tanımlayıcısını ve kod yorumundaki
// "yatırım tavsiyesi" ifadesini içerik sanıp kaldı. JSON gerçek ayrıştırma
// yapılabilen tek biçim; kapı yalnızca YAZIYI görür, kodu değil.
//
// Yeni yazı eklerken: `articles.json`'a ekle, `npm test` çalıştır. Kapıdan
// geçmeyen sayı yayına çıkamaz.
// ─────────────────────────────────────────────────────────────────────────

export const ARTICLES = raw as Article[];

export function articleBySlug(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}
