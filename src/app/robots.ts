import type { MetadataRoute } from 'next';
import { abs } from '@/lib/site';

// AI tarayıcıları açıkça karşılanır: bu sitenin işi Türkçe Miami konut
// sorularına kaynaklı, alıntılanabilir cevap vermek. Engellenecek bir bölüm
// yok — olursa buraya YAZILIR, varsayılan açıktır.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: abs('/sitemap.xml'),
    host: abs('/').replace(/\/$/, ''),
  };
}
