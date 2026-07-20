# Yuvarlak Bar — Satış Otomasyonu

Bir bar için satış otomasyonu. İçki/yemek satışı, masa (adisyon) takibi, ödeme, rapor ve
uzaktan denetim. Uzaktaki patronun anlık satış, gecelik kâr ve tüm hareketleri şeffaf
görebilmesi (güven/denetim) projenin kalbidir.

## Özellikler

- **Roller:** Patron (her şey + kullanıcı yönetimi), Müdür (satış/ödeme/gece kapatma), Garson (sipariş).
- **Adisyon:** masa aç/kapat, sipariş ekle, **silme yok** — iptal = sebepli kayıt.
- **Ürün + stok**, maliyet ile gerçek kâr (kâr = satış − maliyet).
- **Ödeme:** nakit/kart. Para her zaman kuruş (tam sayı) tutulur.
- **Rapor:** anlık açık masalar; gecelik ciro/kâr/nakit/kart; iptal ve fiyat değişikliği denetimi.
- **Gece kapanışı (Z raporu):** kilitli, değiştirilemez.
- **Güvenlik:** şifreler scrypt ile hash'lenir; oturum HMAC imzalı token; gizli anahtar ortam değişkeninden.

## Çalıştırma

Gereksinim: Node.js 22+

```bash
npm install

# Ortam değişkenleri (ilk açılışta patron kullanıcısı bunlardan oluşur):
export YB_TOKEN_SIRRI="en-az-16-karakter-guclu-gizli-anahtar"
export YB_PATRON_KULLANICI="patron"
export YB_PATRON_SIFRE="guclu-bir-sifre"
export YB_PORT=3000
export YB_VERITABANI="yuvarlak-bar.db"

npm run basla
# Tarayıcıda: http://localhost:3000
```

## Test

```bash
npm test            # tüm testler (Vitest)
npm run tip-denetimi # TypeScript tip denetimi
```

## Klasör yapısı

- `src/cekirdek/` — iş mantığı (para, adisyon, urun, masa, kullanici, rapor, denetim, gece).
- `src/veri/` — SQLite saklama (depolar).
- `src/servis/` — yetki kontrollü işlemler.
- `src/api/` — HTTP sunucu, oturum, yapılandırma.
- `genel/` — web sayfaları (giris, satis, siparis, rapor, kullanicilar).
- `test/` — testler.

## API uçları

`/saglik`, `/giris`, `/kullanicilar`, `/urunler`, `/masalar`,
`/adisyon/{ac,siparis,iptal,odeme,ozet,kapat}`,
`/rapor/{gecelik,iptaller,denetim}`, `/gece/kapat`, `GET /gece/gecmis`.

## Notlar

- Mimari kararlar ve yol haritası: proje belgesinde tutulur.
- Güvenlik: hiçbir gizli bilgi (şifre/anahtar) koda yazılmaz; hepsi ortam değişkeninden gelir.
