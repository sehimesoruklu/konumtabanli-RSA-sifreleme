/**
 * Konum Tabanlı Deterministik RSA Şifreleme Sistemi
 * Frontend (BigInt) implementasyonu
 *
 * Koordinatlardan deterministik olarak RSA anahtar çifti üretir.
 * Aynı koordinat her zaman aynı p, q, n, e, d değerlerini üretir.
 */

// LCG sabitleri
const K = 6364136223846793005n;
const C_LCG = 1442695040888963407n;
const M_MOD = 2n ** 512n; // 512-bit modül (performans için)

// Miller-Rabin witness'ları (512-bit için yeterli)
const MR_WITNESSES = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n];

/**
 * Modüler üs alma: base^exp mod mod
 */
export function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  if (mod === 1n) return 0n;
  let result = 1n;
  base = base % mod;
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % mod;
    exp >>= 1n;
    base = (base * base) % mod;
  }
  return result;
}

/**
 * Miller-Rabin asallık testi
 */
export function millerRabin(n: bigint): boolean {
  if (n < 2n) return false;
  if (n === 2n || n === 3n) return true;
  if (n % 2n === 0n) return false;

  // Küçük asal çarpanlar ile hızlı eleme
  const smallPrimes = [3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n, 43n, 47n];
  for (const sp of smallPrimes) {
    if (n === sp) return true;
    if (n % sp === 0n) return false;
  }

  let r = 0n;
  let d = n - 1n;
  while (d % 2n === 0n) {
    d /= 2n;
    r++;
  }

  for (const a of MR_WITNESSES) {
    if (a >= n) continue;
    let x = modPow(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    let composite = true;
    for (let i = 0n; i < r - 1n; i++) {
      x = (x * x) % n;
      if (x === n - 1n) {
        composite = false;
        break;
      }
    }
    if (composite) return false;
  }
  return true;
}

/**
 * Koordinatları çekirdek sayılara dönüştür
 */
export function coordinatesToSeed(lat: number, lng: number): { seedP: bigint; seedQ: bigint } {
  // 4 ondalık basamak hassasiyeti
  const latNorm = Math.round(lat * 10000) / 10000;
  const lngNorm = Math.round(lng * 10000) / 10000;

  const latInt = BigInt(Math.round(Math.abs(latNorm) * 1e8));
  const lngInt = BigInt(Math.round(Math.abs(lngNorm) * 1e8));

  const latSign = lat >= 0 ? 1n : 3n;
  const lngSign = lng >= 0 ? 7n : 9n;

  // Np çekirdeği (enlem tabanlı)
  const seedP = (latInt * 1000n + latSign * 100n + lngSign * 10n + 1n) % 10000000000000000n + 4000000000000000n;
  // Nq çekirdeği (boylam tabanlı)
  const seedQ = (lngInt * 1000n + lngSign * 100n + latSign * 10n + 7n) % 10000000000000000n + 3970000000000000n;

  return { seedP, seedQ };
}

/**
 * Çekirdekten asal sayı üret (LCG + Miller-Rabin)
 * targetBits: 512 (performans) veya 1024 (güvenlik)
 */
export function generatePrime(seed: bigint, targetBits: number = 512): bigint {
  let candidate = seed;
  let iter = 0;

  while (true) {
    // LCG: N_{i+1} = (N_i * K + C) mod M
    candidate = (candidate * K + C_LCG) % M_MOD;

    // Hedef bit uzunluğuna ayarla
    const bitLen = candidate.toString(2).length;
    if (bitLen < targetBits - 5) {
      candidate = candidate | (1n << BigInt(targetBits - 1));
    }

    // Tek sayı yap
    if (candidate % 2n === 0n) candidate += 1n;

    const curBits = candidate.toString(2).length;
    if (curBits >= targetBits - 3 && curBits <= targetBits + 3) {
      if (millerRabin(candidate)) {
        return candidate;
      }
    }

    iter++;
    if (iter > 5000) {
      candidate = (candidate * K + C_LCG + BigInt(iter * 7)) % M_MOD;
      iter = 0;
    }
  }
}

/**
 * Genişletilmiş Öklid
 */
function extGcd(a: bigint, b: bigint): [bigint, bigint, bigint] {
  if (b === 0n) return [a, 1n, 0n];
  const [g, x, y] = extGcd(b, a % b);
  return [g, y, x - (a / b) * y];
}

/**
 * Modüler ters
 */
export function modInverse(a: bigint, m: bigint): bigint {
  const [g, x] = extGcd(((a % m) + m) % m, m);
  if (g !== 1n) throw new Error("Modüler ters mevcut değil");
  return ((x % m) + m) % m;
}

function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

export interface RSAKeyParams {
  p: string;
  q: string;
  n: string;
  phi: string;
  e: string;
  d: string;
  bitLength: number;
  latitude: number;
  longitude: number;
  seedP: string;
  seedQ: string;
  nSummary: string;
  pSummary: string;
  qSummary: string;
  dSummary: string;
  pBits: number;
  qBits: number;
}

function summarize(n: bigint, chars = 24): string {
  const s = n.toString();
  if (s.length <= chars * 2) return s;
  return `${s.slice(0, chars)}...${s.slice(-chars)}`;
}

/**
 * Koordinatlardan deterministik RSA anahtar çifti üret
 */
export function generateRSAFromCoordinates(lat: number, lng: number, bits: number = 512): RSAKeyParams {
  const { seedP, seedQ } = coordinatesToSeed(lat, lng);

  const p = generatePrime(seedP, bits);
  const q = generatePrime(seedQ, bits);

  const n = p * q;
  const phi = (p - 1n) * (q - 1n);

  let e = 65537n;
  while (gcd(e, phi) !== 1n) e += 2n;

  const d = modInverse(e, phi);

  return {
    p: p.toString(),
    q: q.toString(),
    n: n.toString(),
    phi: phi.toString(),
    e: e.toString(),
    d: d.toString(),
    bitLength: n.toString(2).length,
    latitude: lat,
    longitude: lng,
    seedP: seedP.toString(),
    seedQ: seedQ.toString(),
    nSummary: summarize(n),
    pSummary: summarize(p),
    qSummary: summarize(q),
    dSummary: summarize(d),
    pBits: p.toString(2).length,
    qBits: q.toString(2).length,
  };
}

/**
 * RSA Şifreleme (blok tabanlı)
 * Format: [...data_bytes, len_hi, len_lo]
 * Uzunluk bilgisi sona eklenir - baştaki sıfır padding'den etkilenmez
 */
export function rsaEncrypt(message: string, eStr: string, nStr: string): string {
  if (!message) throw new Error("Boş mesaj şifrelenemez");
  const e = BigInt(eStr);
  const n = BigInt(nStr);
  const encoder = new TextEncoder();
  const bytes = encoder.encode(message);

  const nBits = n.toString(2).length;
  const nBytes = Math.ceil(nBits / 8);
  // Blok boyutu: n'den 3 byte küçük (2 byte uzunluk + 1 byte güvenlik)
  const blockSize = Math.max(1, nBytes - 3);

  const blocks: string[] = [];
  for (let i = 0; i < bytes.length; i += blockSize) {
    const block = bytes.slice(i, i + blockSize);
    const len = block.length;

    // [...data, len_hi, len_lo] - uzunluk sona
    const lenHi = (len >> 8) & 0xff;
    const lenLo = len & 0xff;
    const combined = [...block, lenHi, lenLo];

    let m = 0n;
    for (const byte of combined) m = (m << 8n) | BigInt(byte);

    const c = modPow(m, e, n);
    blocks.push(c.toString(16).padStart(nBytes * 2, "0"));
  }

  return blocks.join(":");
}

/**
 * RSA Şifre Çözme
 */
export function rsaDecrypt(ciphertext: string, dStr: string, nStr: string): string {
  if (!ciphertext || !ciphertext.trim()) throw new Error("Boş şifreli metin");
  const d = BigInt(dStr);
  const n = BigInt(nStr);

  const nBits = n.toString(2).length;
  const nBytes = Math.ceil(nBits / 8);

  const blocks = ciphertext.trim().split(":");
  if (blocks.length === 0) throw new Error("Geçersiz şifreli metin formatı");

  const allBytes: number[] = [];

  for (const block of blocks) {
    if (!block.trim()) continue;
    if (!/^[0-9a-fA-F]+$/.test(block.trim())) {
      throw new Error("Geçersiz hex karakter: " + block.slice(0, 10));
    }
    const c = BigInt("0x" + block.trim());
    if (c >= n) throw new Error("Blok değeri n'den büyük - yanlış koordinat?");

    const m = modPow(c, d, n);

    // m'yi byte dizisine çevir (nBytes uzunluğunda, başa sıfır doldur)
    const mHex = m.toString(16).padStart(nBytes * 2, "0");
    const mBytes: number[] = [];
    for (let i = 0; i < mHex.length; i += 2) {
      mBytes.push(parseInt(mHex.slice(i, i + 2), 16));
    }

    // Son 2 byte uzunluk bilgisi
    if (mBytes.length < 2) throw new Error("Geçersiz blok formatı");
    const lenHi = mBytes[mBytes.length - 2];
    const lenLo = mBytes[mBytes.length - 1];
    const len = (lenHi << 8) | lenLo;
    if (len > mBytes.length - 2) throw new Error("Geçersiz blok uzunluğu - yanlış koordinat?");

    // Veri byte'ları: son 2 byte'tan önceki `len` byte
    const dataBytes = mBytes.slice(mBytes.length - 2 - len, mBytes.length - 2);
    allBytes.push(...dataBytes);
  }

  const decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    return decoder.decode(new Uint8Array(allBytes));
  } catch {
    throw new Error("UTF-8 çözümleme hatası - yanlış koordinat kullanıldı olabilir");
  }
}
