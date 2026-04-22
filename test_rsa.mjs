// RSA Algoritması Test Scripti
// Koordinat → deterministik RSA anahtar üretimi ve şifreleme/çözme testi

// Sabitler
const M = 2n ** 1024n;
const K = 6364136223846793005n;
const C = 1442695040888963407n;
const MILLER_RABIN_WITNESSES = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n];

function coordinatesToSeed(lat, lng) {
  const latNorm = Math.round(lat * 10000) / 10000;
  const lngNorm = Math.round(lng * 10000) / 10000;
  const latInt = BigInt(Math.round(Math.abs(latNorm) * 1e10));
  const lngInt = BigInt(Math.round(Math.abs(lngNorm) * 1e10));
  const latSign = lat >= 0 ? 1n : 3n;
  const lngSign = lng >= 0 ? 7n : 9n;
  const seedP = (latInt * 1000n + latSign * 100n + lngSign * 10n + 1n) % 10000000000000000n + 4000000000000000n;
  const seedQ = (lngInt * 1000n + lngSign * 100n + latSign * 10n + 7n) % 10000000000000000n + 3970000000000000n;
  return { seedP, seedQ };
}

function modPow(base, exp, mod) {
  if (mod === 1n) return 0n;
  let result = 1n;
  base = base % mod;
  while (exp > 0n) {
    if (exp % 2n === 1n) result = (result * base) % mod;
    exp = exp >> 1n;
    base = (base * base) % mod;
  }
  return result;
}

function millerRabin(n) {
  if (n < 2n) return false;
  if (n === 2n || n === 3n) return true;
  if (n % 2n === 0n) return false;
  let r = 0n, d = n - 1n;
  while (d % 2n === 0n) { d /= 2n; r++; }
  for (const a of MILLER_RABIN_WITNESSES) {
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

function generatePrime(seed, targetBits = 512) {
  let candidate = seed;
  let iterations = 0;
  while (true) {
    candidate = (candidate * K + C) % M;
    if (candidate.toString(2).length < targetBits - 10) {
      candidate = candidate | (1n << BigInt(targetBits - 1));
    }
    if (candidate % 2n === 0n) candidate += 1n;
    const currentBits = candidate.toString(2).length;
    if (currentBits >= targetBits - 2 && currentBits <= targetBits + 2) {
      if (millerRabin(candidate)) return candidate;
    }
    iterations++;
    if (iterations > 10000) {
      candidate = (candidate * K + C + BigInt(iterations)) % M;
      iterations = 0;
    }
  }
}

function extendedGcd(a, b) {
  if (b === 0n) return { gcd: a, x: 1n, y: 0n };
  const { gcd, x, y } = extendedGcd(b, a % b);
  return { gcd, x: y, y: x - (a / b) * y };
}

function modInverse(a, m) {
  const { gcd, x } = extendedGcd(a % m, m);
  if (gcd !== 1n) throw new Error("Modüler ters mevcut değil");
  return ((x % m) + m) % m;
}

function gcd(a, b) {
  while (b !== 0n) { [a, b] = [b, a % b]; }
  return a;
}

function generateRSA(lat, lng, bits = 512) {
  const { seedP, seedQ } = coordinatesToSeed(lat, lng);
  console.log(`  seedP: ${seedP}`);
  console.log(`  seedQ: ${seedQ}`);
  const p = generatePrime(seedP, bits);
  const q = generatePrime(seedQ, bits);
  const n = p * q;
  const phi = (p - 1n) * (q - 1n);
  let e = 65537n;
  while (gcd(e, phi) !== 1n) e += 2n;
  const d = modInverse(e, phi);
  return { p, q, n, phi, e, d };
}

// Test
console.log("=== Konum Tabanlı RSA Testi ===\n");
const lat = 41.0082, lng = 28.9784;
console.log(`Koordinat: (${lat}, ${lng})`);
console.log("Anahtar üretiliyor (512-bit test)...");
const start = Date.now();
const keys = generateRSA(lat, lng, 512);
console.log(`Süre: ${Date.now() - start}ms`);
console.log(`  p bit uzunluğu: ${keys.p.toString(2).length}`);
console.log(`  q bit uzunluğu: ${keys.q.toString(2).length}`);
console.log(`  n bit uzunluğu: ${keys.n.toString(2).length}`);
console.log(`  e: ${keys.e}`);
console.log(`  p (ilk 20): ${keys.p.toString().slice(0, 20)}...`);
console.log(`  q (ilk 20): ${keys.q.toString().slice(0, 20)}...`);

// Deterministik test
console.log("\n--- Deterministik Test ---");
const keys2 = generateRSA(lat, lng, 512);
console.log(`Aynı koordinat aynı p üretiyor: ${keys.p === keys2.p}`);
console.log(`Aynı koordinat aynı q üretiyor: ${keys.q === keys2.q}`);

// Şifreleme/çözme testi
console.log("\n--- Şifreleme/Çözme Testi ---");
const message = "Merhaba Dünya!";
// Basit şifreleme testi (küçük mesaj)
const msgBytes = Buffer.from(message, 'utf8');
let m = 0n;
for (const byte of msgBytes) m = (m << 8n) | BigInt(byte);
const c = modPow(m, keys.e, keys.n);
let decrypted = modPow(c, keys.d, keys.n);
const decBytes = [];
while (decrypted > 0n) { decBytes.unshift(Number(decrypted & 0xffn)); decrypted >>= 8n; }
const result = Buffer.from(decBytes).toString('utf8');
console.log(`Orijinal: "${message}"`);
console.log(`Çözülen: "${result}"`);
console.log(`Başarılı: ${message === result}`);
