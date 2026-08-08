// ─────────────────────────────────────────────────────────────────────────
// Komut satırı okuma — TEK yerde.
//
// Neden ayrı dosya: `fetch-data.mjs` bir zaman `--period=2026-08`, üretici
// ise `--period 2026-08` bekliyordu. İkisi de sessizce çalışıyordu; yanlış
// biçim verildiğinde uyarı YOKTU, script varsayılana düşüp başka bir ayın
// verisini çekiyordu. Bir hattın en tehlikeli hatası, hata vermeyenidir.
//
// Artık ikisi de bu dosyayı kullanıyor ve her iki biçimi de kabul ediyor.
// ─────────────────────────────────────────────────────────────────────────

/** `--flag` var mı. */
export function hasFlag(argv, name) {
  return argv.includes(`--${name}`);
}

/**
 * `--name=değer` ya da `--name değer` okur. Yoksa `null`.
 *
 * `--name` yazılıp değer verilmemişse (ya da ardından başka bir bayrak
 * geliyorsa) sessizce `null` DÖNMEZ — atlamak yerine bağırır, çünkü
 * "değer vermeyi unuttum" ile "hiç istemedim" farklı niyetlerdir.
 */
export function readOption(argv, name) {
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) {
    const value = eq.slice(name.length + 3);
    if (value.length === 0) throw new Error(`--${name}= boş bırakılamaz`);
    return value;
  }

  const i = argv.indexOf(`--${name}`);
  if (i === -1) return null;

  const next = argv[i + 1];
  if (next === undefined || next.startsWith('--')) {
    throw new Error(`--${name} bir değer bekliyor (ör. --${name}=2026-08)`);
  }
  return next;
}

/** `YYYY-AA` doğrular ve döndürür. Hatalı girdide FIRLATIR (testler bunu kullanır). */
export function readPeriod(argv) {
  const raw = readOption(argv, 'period');
  if (raw === null) return null;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) {
    throw new Error(`--period biçimi YYYY-AA olmalı, gelen: "${raw}"`);
  }
  return raw;
}

/**
 * Script'lerin kullandığı sarmalayıcı: aynı doğrulama, ama hatada yığın
 * izi yerine tek satır mesaj.
 *
 * Ayrıştırma modül gövdesinde çalıştığı için fırlatılan hata `main()`'in
 * `catch`'ine hiç ulaşmaz ve kullanıcı yazım hatası için ham bir Node
 * traceback görür. Bir yazım hatası, çökme gibi görünmemeli.
 */
export function readPeriodOrExit(argv) {
  try {
    return readPeriod(argv);
  } catch (err) {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  }
}
