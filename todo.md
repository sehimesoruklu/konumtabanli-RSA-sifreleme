# GeoEncryption RSA - Todo

## Veritabanı & Backend
- [x] Konum geçmişi tablosu (location_history) oluştur
- [x] RSA anahtar üretim algoritması (deterministik, koordinat → p, q, n, e, d) - client-side BigInt
- [x] Şifreleme fonksiyonu (public key ile) - client-side
- [x] Şifre çözme fonksiyonu (private key ile) - client-side
- [x] Konum geçmişi kaydetme/listeleme prosídürü

## Algoritma (BigInt tabanlı, deterministik)
- [x] Koordinat → çekirdek sayı (seed) dönüşümü- [x] Modüler fonksiyon ile asal aday üretimi (N_{i+1} = (N_i \* K + C) mod M)
- [x] Miller-Rabin asallık testi implementasyonu
- [x] RSA parametreleri hesaplama (n=p\*q, φ(n), e, d)- [x] Modüler üs alma (şifreleme/çözme)

## Frontend Sayfaları
- [x] Ana sayfa / uygulama layout'u (zarif dark tema)
- [x] Harita bileşeni (konum seçimi, tıklama, arama)
- [x] Manuel koordinat giriş formu
- [x] Anahtar bilgileri paneli (n, e, d, p, q, bit uzunluğu)
- [x] Şifreleme ekranı (metin giriş + şifreli çıktı)
- [x] Şifre çözme ekranı (şifreli metin giriş + çözülen çıktı))
- [x] Konum geçmişi listesi (sidebar veya panel)

## Stil & UX
- [x] Zarif dark tema (derin koyu arka plan, altın/yeşil aksanlar)
- [x] Animasyonlar ve geçişler (framer-motion)
- [x] Responsive tasarım - mobil layout iyileştirmesi tamamlandı
- [x] Kopyalama butonları (clipboard)
- [x] Loading state'leri

## Test
- [x] RSA algoritması birim testleri (deterministik doğrulama)
- [x] Şifreleme/çözme round-trip testi

## Vercel Deployment Uyumluluğu
- [x] vercel.json yapılandırma dosyası oluştur
- [x] Express sunucusunu Vercel Serverless Function olarak api/index.ts'e taşı
- [x] Vite frontend build çıktısını Vercel static serving ile uyumlu hale getir
- [x] package.json build scriptini Vercel için güncelle
- [x] Ortam değişkenleri (env) listesini VERCEL_DEPLOY.md olarak dokümante et
- [x] Vercel uyumlu ZIP paketi oluştur

## Vercel Doğrulama
- [x] Vercel serverless entrypoint'i doğrula - /api/trpc, OAuth, storage proxy ve SPA fallback
- [x] Ortam değişkenlerini VERCEL_DEPLOY.md'de tam listele
