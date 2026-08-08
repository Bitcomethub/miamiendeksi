import { ChangeBadge } from './Metric';
import type { Metric, Publisher } from '@/lib/snapshot';
import { formatMonth, formatValue } from '@/lib/format';

// Tüm göstergeler tek tabloda — sitenin asıl ürünü budur; kartlar sadece
// manşeti öne çıkarır.
//
// Tablo dar ekranda KENDİ içinde yatay kayar (`overflow-x-auto`). Sayfanın
// gövdesi hiçbir genişlikte yatay kaymaz; taşan tek şey bu kutudur — 393 px
// hedefinin doğru çözümü sütun atmak değil, taşmayı sınırlamaktır.
//
// `relative` SÜS DEĞİL, taşma denetiminin geçmesinin sebebi. `overflow-x:auto`
// duran bir kutu, `position:static` ise mutlak konumlu TORUNLARINI KIRPMAZ —
// onların kapsayıcı bloğu bu kutu değil, daha yukarısıdır. Tailwind'in
// `.sr-only`'si `position:absolute` kullanır; `ChangeBadge` içindeki ekran
// okuyucu metni 736 px'lik tablonun içinde x≈446'da duruyordu ve oradan
// dokümanın kaydırma alanına sızıyordu: 393 px'lik ekranda 53 px'lik,
// hiçbir elemanın kutusunda GÖRÜNMEYEN bir yatay taşma. `relative` bu kutuyu
// kapsayıcı blok yapar, kırpma yeniden geçerli olur. Kaldırma.

export function MetricTable({
  metrics,
  publishers,
  caption,
}: {
  metrics: Metric[];
  publishers: Publisher[];
  caption: string;
}) {
  const nameOf = (id: string) => publishers.find((p) => p.id === id)?.name ?? id;

  return (
    <div className="panel relative overflow-x-auto">
      <table className="w-full min-w-[46rem] border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-edge">
            {['Gösterge', 'Değer', 'Aylık', 'Yıllık', 'Dönem', 'Kaynak'].map((h, i) => (
              <th
                key={h}
                scope="col"
                className={`px-4 py-3 font-mono text-[0.6875rem] tracking-wider text-dim uppercase ${
                  i >= 1 && i <= 3 ? 'text-right' : ''
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => (
            <tr key={m.id} className="border-b border-edge/60 last:border-0">
              <th scope="row" className="px-4 py-3 text-small leading-snug font-normal text-ice">
                {m.label}
                {m.national ? (
                  <span className="ml-2 font-mono text-[0.625rem] tracking-wide text-magenta uppercase">
                    ABD geneli
                  </span>
                ) : null}
              </th>
              <td className="tabular px-4 py-3 text-right font-mono text-small font-medium text-ice">
                {formatValue(m.value, m.unit)}
              </td>
              <td className="px-4 py-3 text-right">
                <ChangeBadge change={m.mom} label="önceki aya" />
              </td>
              <td className="px-4 py-3 text-right">
                <ChangeBadge change={m.yoy} label="geçen yılın aynı ayına" />
              </td>
              <td className="px-4 py-3 font-mono text-[0.75rem] whitespace-nowrap text-mute">
                {formatMonth(m.asOf)}
              </td>
              <td className="px-4 py-3 font-mono text-[0.75rem] whitespace-nowrap text-dim">
                {nameOf(m.publisher)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
