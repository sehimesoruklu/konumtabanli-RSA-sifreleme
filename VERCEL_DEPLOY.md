# GeoEncryption RSA — Vercel Deployment Rehberi

## 1. Gereksinimler

- [Vercel hesabı](https://vercel.com) (ücretsiz)
- MySQL uyumlu veritabanı (aşağıdan birini seçin):
  - **PlanetScale** (önerilen, ücretsiz tier mevcut): https://planetscale.com
  - **Neon** (PostgreSQL, ücretsiz tier): https://neon.tech
  - **TiDB Cloud** (ücretsiz tier): https://tidbcloud.com

---

## 2. Vercel'e Yükleme Adımları

### Adım 1: Kodu GitHub'a Yükle
```bash
git init
git add .
git commit -m "GeoEncryption RSA - Initial commit"
git remote add origin https://github.com/KULLANICI_ADI/geoencryption-rsa.git
git push -u origin main
```

### Adım 2: Vercel'de Proje Oluştur
1. https://vercel.com/new adresine gidin
2. GitHub reposunu seçin
3. **Framework Preset**: Other
4. **Build Command**: `pnpm run build:vercel`
5. **Output Directory**: `dist`
6. **Install Command**: `pnpm install`

### Adım 3: Ortam Değişkenlerini Ekle
Vercel Dashboard → Settings → Environment Variables bölümüne şunları ekleyin:

**Zorunlu Değişkenler:**

| Değişken | Açıklama | Örnek |
|---|---|---|
| `DATABASE_URL` | MySQL bağlantı dizesi (PlanetScale/TiDB) | `mysql://user:pass@host/db?ssl={"rejectUnauthorized":true}` |
| `JWT_SECRET` | Oturum cookie imzalama anahtarı (32+ karakter) | `my-super-secret-jwt-key-abc123` |

**Opsiyonel Değişkenler (OAuth / Bildirim):**

| Değişken | Açıklama | Varsayılan |
|---|---|---|
| `OAUTH_SERVER_URL` | OAuth sunucu adresi | `https://api.manus.im` |
| `VITE_APP_ID` | Manus OAuth uygulama ID | *(boş bırakılabilir)* |
| `OWNER_OPEN_ID` | Sahip kullanıcı ID (admin rolü için) | *(opsiyonel)* |
| `BUILT_IN_FORGE_API_KEY` | Manus dahili API anahtarı | *(opsiyonel)* |
| `BUILT_IN_FORGE_API_URL` | Manus dahili API URL | *(opsiyonel)* |

> **Not:** `DATABASE_URL` ve `JWT_SECRET` olmadan uygulama başlar ancak konum geçmişi kaydedilemez ve oturum çalışmaz. RSA şifreleme/çözme veritabanı olmadan da tam çalışır.

### Adım 4: Veritabanı Tablolarını Oluştur
Vercel deploy sonrası, veritabanında tabloları oluşturmak için aşağıdaki SQL'i çalıştırın:

```sql
CREATE TABLE IF NOT EXISTS `users` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `openId` varchar(64) NOT NULL UNIQUE,
  `name` text,
  `email` varchar(320),
  `loginMethod` varchar(64),
  `role` enum('user','admin') NOT NULL DEFAULT 'user',
  `createdAt` timestamp NOT NULL DEFAULT NOW(),
  `updatedAt` timestamp NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  `lastSignedIn` timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS `location_history` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int,
  `latitude` decimal(10,8) NOT NULL,
  `longitude` decimal(11,8) NOT NULL,
  `label` varchar(255),
  `mode` varchar(20) NOT NULL DEFAULT 'encrypt',
  `keyHash` varchar(64),
  `createdAt` timestamp NOT NULL DEFAULT NOW()
);
```

---

## 3. Google Maps Notu

Bu proje Google Maps için Manus proxy kullanmaktadır. Vercel'de haritanın çalışması için kendi Google Maps API anahtarınızı almanız gerekebilir:

1. https://console.cloud.google.com adresine gidin
2. Maps JavaScript API'yi etkinleştirin
3. API anahtarı oluşturun
4. Vercel'de `VITE_GOOGLE_MAPS_API_KEY` değişkeni olarak ekleyin

---

## 4. Önemli Notlar

- **Konum geçmişi** özelliği veritabanı gerektirmektedir. Veritabanı olmadan uygulama çalışır ancak geçmiş kaydedilmez.
- **RSA şifreleme/çözme** tamamen tarayıcıda (client-side) çalışır, sunucu gerektirmez.
- **Oturum açma** özelliği Manus OAuth kullanmaktadır. Vercel'de bu özelliği devre dışı bırakmak isterseniz `server/routers.ts` dosyasında auth prosedürlerini kaldırabilirsiniz.

---

## 5. Sorun Giderme

| Hata | Çözüm |
|---|---|
| `DATABASE_URL` bağlantı hatası | PlanetScale/Neon bağlantı dizesini kontrol edin |
| Harita yüklenmiyor | Google Maps API anahtarını ekleyin |
| `ERR_CONNECTION_RESET` | Vercel function timeout (30s) aşıldı — RSA üretimi uzun sürebilir |
| CORS hatası | `vercel.json` headers bölümünü kontrol edin |
