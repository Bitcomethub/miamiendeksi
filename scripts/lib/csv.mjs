// ─────────────────────────────────────────────────────────────────────────
// Sınırlandırılmış metin ayrıştırma (CSV / TSV)
//
// NEDEN elle yazılmış bir ayrıştırıcı: Zillow'un bölge sütunu birebir
// `"Miami, FL"` — yani ayırıcıyı İÇEREN tırnaklı bir alan. `line.split(',')`
// bu satırda sonraki BÜTÜN sütunları bir kaydırır; sonuç parse hatası
// vermez, sessizce YANLIŞ AYIN fiyatını bu ayın fiyatı diye yayınlar.
// Bu dosyanın tek işi o kaymayı imkânsız kılmak.
//
// Desteklenen: RFC 4180 tırnaklama (`""` kaçışı dâhil), CRLF, son satır
// sonu olmayan dosyalar.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Tek bir satırı alanlara böler. Tırnak içindeki ayırıcı ve satır sonu
 * korunur.
 *
 * @param {string} line
 * @param {string} delimiter
 * @returns {string[]}
 */
export function parseDelimitedLine(line, delimiter = ',') {
  const fields = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        // `""` kaçırılmış tırnaktır, alanı KAPATMAZ.
        if (line[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      fields.push(field);
      field = '';
    } else {
      field += char;
    }
  }

  fields.push(field);
  return fields;
}

/**
 * Tüm metni satır dizisine böler. Tırnak içindeki satır sonlarını yutar.
 *
 * @param {string} text
 * @returns {string[]}
 */
function splitRecords(text) {
  const records = [];
  let record = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        record += '""';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      record += char;
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      // CRLF'i tek satır sonu say.
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      records.push(record);
      record = '';
      continue;
    }

    record += char;
  }

  if (record.length > 0) records.push(record);
  return records;
}

/**
 * Başlık satırı + veri satırları döndürür.
 *
 * @param {string} text
 * @param {string} delimiter
 * @returns {{ header: string[], rows: string[][] }}
 */
export function parseDelimited(text, delimiter = ',') {
  const records = splitRecords(text).filter((r) => r.trim().length > 0);
  if (records.length === 0) return { header: [], rows: [] };

  const header = parseDelimitedLine(records[0], delimiter).map((h) =>
    h.replace(/^"|"$/g, '').trim(),
  );
  const rows = records.slice(1).map((r) => parseDelimitedLine(r, delimiter));
  return { header, rows };
}

/**
 * Sayıya çevirir. Boş, `.` (FRED'in eksik gözlem işareti), `NA` ve
 * ayrıştırılamayan her şey `null` döner — 0 DEĞİL.
 *
 * Bu ayrım kritik: eksik veriyi 0 saymak, "bu ay stok sıfıra düştü" gibi
 * bir yalanı grafiğe çizer.
 *
 * @param {string | undefined} raw
 * @returns {number | null}
 */
export function toNumber(raw) {
  if (raw === undefined || raw === null) return null;
  const cleaned = String(raw).trim().replace(/^"|"$/g, '');
  if (cleaned === '' || cleaned === '.' || cleaned.toUpperCase() === 'NA') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
