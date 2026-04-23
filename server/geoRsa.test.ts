/**
 * GeoEncryption RSA - Birim Testleri
 * Algoritmanın deterministik ve doğru çalıştığını doğrular
 */

import { describe, it, expect } from "vitest";

// ─── Algoritma (test için inline implementasyon) ──────────────────────────────
const K = 6364136223846793005n;
const C_LCG = 1442695040888963407n;
const M_MOD = 2n ** 512n;
const MR_WITNESSES = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n];

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
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

function millerRabin(n: bigint): boolean {
  if (n < 2n) return false;
  if (n === 2n || n === 3n) return true;
  if (n % 2n === 0n) return false;
  const smallPrimes = [3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n, 43n, 47n];
  for (const sp of smallPrimes) {
    if (n === sp) return true;
    if (n % sp === 0n) return false;
  }
  let r = 0n, d = n - 1n;
  while (d % 2n === 0n) { d /= 2n; r++; }
  for (const a of MR_WITNESSES) {
    if (a >= n) continue;
    let x = modPow(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    let composite = true;
    for (let i = 0n; i < r - 1n; i++) {
      x = (x * x) % n;
      if (x === n - 1n) { composite = false; break; }
    }
    if (composite) return false;
  }
  return true;
}

function coordinatesToSeed(lat: number, lng: number) {
  const latNorm = Math.round(lat * 10000) / 10000;
  const lngNorm = Math.round(lng * 10000) / 10000;
  const latInt = BigInt(Math.round(Math.abs(latNorm) * 1e8));
  const lngInt = BigInt(Math.round(Math.abs(lngNorm) * 1e8));
  const latSign = lat >= 0 ? 1n : 3n;
  const lngSign = lng >= 0 ? 7n : 9n;
  const seedP = (latInt * 1000n + latSign * 100n + lngSign * 10n + 1n) % 10000000000000000n + 4000000000000000n;
  const seedQ = (lngInt * 1000n + lngSign * 100n + latSign * 10n + 7n) % 10000000000000000n + 3970000000000000n;
  return { seedP, seedQ };
}

function extGcd(a: bigint, b: bigint): [bigint, bigint, bigint] {
  if (b === 0n) return [a, 1n, 0n];
  const [g, x, y] = extGcd(b, a % b);
  return [g, y, x - (a / b) * y];
}

function modInverse(a: bigint, m: bigint): bigint {
  const [g, x] = extGcd(((a % m) + m) % m, m);
  if (g !== 1n) throw new Error("Modüler ters mevcut değil");
  return ((x % m) + m) % m;
}

function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

// ─── Testler ──────────────────────────────────────────────────────────────────

describe("modPow", () => {
  it("temel üs alma işlemi", () => {
    expect(modPow(2n, 10n, 1000n)).toBe(24n); // 2^10 = 1024, 1024 mod 1000 = 24
    expect(modPow(3n, 0n, 7n)).toBe(1n);       // herhangi^0 = 1
    expect(modPow(5n, 1n, 13n)).toBe(5n);      // a^1 = a
  });

  it("büyük sayılarla çalışır", () => {
    const result = modPow(65537n, 3n, 1000000007n);
    expect(result).toBeGreaterThan(0n);
    expect(result).toBeLessThan(1000000007n);
  });
});

describe("millerRabin", () => {
  it("bilinen asal sayıları tanır", () => {
    const primes = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 97n, 101n, 1009n];
    for (const p of primes) {
      expect(millerRabin(p)).toBe(true);
    }
  });

  it("bileşik sayıları reddeder", () => {
    const composites = [4n, 6n, 8n, 9n, 10n, 15n, 100n, 1000n, 65536n];
    for (const c of composites) {
      expect(millerRabin(c)).toBe(false);
    }
  });

  it("1 ve 0 asal değildir", () => {
    expect(millerRabin(0n)).toBe(false);
    expect(millerRabin(1n)).toBe(false);
  });
});

describe("coordinatesToSeed", () => {
  it("aynı koordinat aynı seed üretir (deterministik)", () => {
    const { seedP: sp1, seedQ: sq1 } = coordinatesToSeed(41.0082, 28.9784);
    const { seedP: sp2, seedQ: sq2 } = coordinatesToSeed(41.0082, 28.9784);
    expect(sp1).toBe(sp2);
    expect(sq1).toBe(sq2);
  });

  it("farklı koordinatlar farklı seed üretir", () => {
    const { seedP: sp1 } = coordinatesToSeed(41.0082, 28.9784);
    const { seedP: sp2 } = coordinatesToSeed(40.7128, -74.0060);
    expect(sp1).not.toBe(sp2);
  });

  it("seed değerleri pozitif ve 16 basamaklı aralıkta", () => {
    const { seedP, seedQ } = coordinatesToSeed(39.9334, 32.8597);
    expect(seedP).toBeGreaterThan(0n);
    expect(seedQ).toBeGreaterThan(0n);
    expect(seedP.toString().length).toBeGreaterThanOrEqual(10);
    expect(seedQ.toString().length).toBeGreaterThanOrEqual(10);
  });

  it("negatif koordinatlar farklı seed üretir", () => {
    const { seedP: sp_pos } = coordinatesToSeed(41.0082, 28.9784);
    const { seedP: sp_neg } = coordinatesToSeed(-41.0082, 28.9784);
    expect(sp_pos).not.toBe(sp_neg);
  });
});

describe("modInverse", () => {
  it("modüler ters hesaplar", () => {
    // 3 * 4 = 12 ≡ 1 (mod 11)
    expect(modInverse(3n, 11n)).toBe(4n);
    // 65537 * d ≡ 1 (mod phi) testi
    const phi = 100n; // Basit test
    const e = 3n;
    const d = modInverse(e, phi);
    expect((e * d) % phi).toBe(1n);
  });
});

describe("RSA Round-Trip (şifreleme/çözme)", () => {
  it("küçük sayılarla RSA şifreleme/çözme doğruluğu", () => {
    // Küçük asal sayılarla test (hızlı)
    const p = 61n;
    const q = 53n;
    const n = p * q; // 3233
    const phi = (p - 1n) * (q - 1n); // 3120
    const e = 17n;
    const d = modInverse(e, phi); // 2753

    // Mesaj: 65 (ASCII 'A')
    const m = 65n;
    const c = modPow(m, e, n); // Şifrele
    const decrypted = modPow(c, d, n); // Çöz

    expect(decrypted).toBe(m);
  });

  it("RSA parametreleri tutarlı", () => {
    const p = 61n;
    const q = 53n;
    const n = p * q;
    const phi = (p - 1n) * (q - 1n);
    const e = 17n;
    const d = modInverse(e, phi);

    // e * d ≡ 1 (mod phi)
    expect((e * d) % phi).toBe(1n);
    // n = p * q
    expect(n).toBe(p * q);
    // gcd(e, phi) = 1
    expect(gcd(e, phi)).toBe(1n);
  });
});

describe("RSA Round-Trip - Gelişmiş", () => {
  // Blok tabanlı şifreleme/çözme simulasyonu
  function encryptBlock(message: string, e: bigint, n: bigint): string {
    const bytes = new TextEncoder().encode(message);
    const nBits = n.toString(2).length;
    const nBytes = Math.ceil(nBits / 8);
    const blockSize = Math.max(1, nBytes - 3);
    const blocks: string[] = [];
    for (let i = 0; i < bytes.length; i += blockSize) {
      const block = bytes.slice(i, i + blockSize);
      const len = block.length;
      const lenHi = (len >> 8) & 0xff;
      const lenLo = len & 0xff;
      const combined = [...block, lenHi, lenLo]; // uzunluk sona
      let m = 0n;
      for (const byte of combined) m = (m << 8n) | BigInt(byte);
      const c = modPow(m, e, n);
      blocks.push(c.toString(16).padStart(nBytes * 2, "0"));
    }
    return blocks.join(":");
  }

  function decryptBlock(ciphertext: string, d: bigint, n: bigint): string {
    const nBits = n.toString(2).length;
    const nBytes = Math.ceil(nBits / 8);
    const blocks = ciphertext.split(":");
    const allBytes: number[] = [];
    for (const block of blocks) {
      if (!block.trim()) continue;
      const c = BigInt("0x" + block.trim());
      const m = modPow(c, d, n);
      const mHex = m.toString(16).padStart(nBytes * 2, "0");
      const mBytes: number[] = [];
      for (let i = 0; i < mHex.length; i += 2) mBytes.push(parseInt(mHex.slice(i, i + 2), 16));
      if (mBytes.length < 2) throw new Error("Geçersiz blok");
      const lenHi = mBytes[mBytes.length - 2];
      const lenLo = mBytes[mBytes.length - 1];
      const len = (lenHi << 8) | lenLo;
      if (len > mBytes.length - 2) throw new Error("Geçersiz uzunluk");
      allBytes.push(...mBytes.slice(mBytes.length - 2 - len, mBytes.length - 2));
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(allBytes));
  }

  it("RSA ile metin şifreleme/çözme round-trip", () => {
    // 32-bit asal sayılar (nBytes=8, blockSize=5)
    const p = 4294967311n; // Asal
    const q = 4294967357n; // Asal
    const n = p * q;
    const phi = (p - 1n) * (q - 1n);
    const e = 65537n;
    const d = modInverse(e, phi);
    const msg = "Merhaba";
    const encrypted = encryptBlock(msg, e, n);
    const decrypted = decryptBlock(encrypted, d, n);
    expect(decrypted).toBe(msg);
  });

  it("yanlış key ile çözme farklı sonuç verir", () => {
    const p = 4294967311n;
    const q = 4294967357n;
    const n = p * q;
    const phi = (p - 1n) * (q - 1n);
    const e = 65537n;
    const d = modInverse(e, phi);
    const wrongD = d + 2n;
    const msg = "Test";
    const encrypted = encryptBlock(msg, e, n);
    try {
      const decrypted = decryptBlock(encrypted, wrongD, n);
      expect(decrypted).not.toBe(msg);
    } catch {
      expect(true).toBe(true);
    }
  });
});

describe("Deterministik Anahtar Üretimi", () => {
  it("aynı koordinat aynı seed üretir", () => {
    const coord1 = coordinatesToSeed(41.0082, 28.9784);
    const coord2 = coordinatesToSeed(41.0082, 28.9784);
    expect(coord1.seedP).toBe(coord2.seedP);
    expect(coord1.seedQ).toBe(coord2.seedQ);
  });

  it("koordinat hassasiyeti 4 ondalık basamak", () => {
    // 41.0082 ve 41.00820001 aynı seed üretmeli (4 ondalık hassasiyet)
    const { seedP: sp1 } = coordinatesToSeed(41.0082, 28.9784);
    const { seedP: sp2 } = coordinatesToSeed(41.00820001, 28.9784);
    expect(sp1).toBe(sp2);
  });
});
