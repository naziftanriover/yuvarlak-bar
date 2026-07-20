# Yayına Alma Rehberi (Firebase — Plan A)

Bu dosya, Yuvarlak Bar'ı Firebase'e yayınlamak için birlikte yapacağımız adımları anlatır.
Çoğu hazırlık kodda tamam; burada **senin hesabınla** yapılacak kısımlar var.

## Durum

- ✅ Çalışan uygulama (Node + SQLite sürümü) — referans, 119 test.
- ✅ Firebase güvenlik kuralları (`firestore.rules`), yapılandırma (`firebase.json`, `firestore.indexes.json`).
- ⏳ Firebase sürümüne geçiş (arayüzün Firestore + Firebase Auth kullanması) — yapım aşamasında.
- ⏳ Firebase projesi oluşturma + yayına alma — birlikte (senin girişin gerekir).

## Senden gereken 2 şey (birlikte, ~10 dk)

### 1) Firebase projesi + web yapılandırması
1. https://console.firebase.google.com → **Proje ekle** → isim: `yuvarlak-bar` → oluştur.
2. Sol üstte **⚙️ (Proje ayarları)** → aşağıda **"Uygulamalarınız"** → **Web (`</>`)** simgesi.
3. Takma ad ver, kaydet. Çıkan `firebaseConfig` bloğunu (apiKey, projectId… içeren) kopyala.
4. Bu bloğu bana ver → arayüze yerleştireceğim.
5. Sol menü → **Build → Authentication → Başla → Sign-in method → E-posta/Şifre'yi etkinleştir**.
6. Sol menü → **Build → Firestore Database → Veritabanı oluştur** (production modu).

### 2) Firebase CLI ile giriş (yayın için)
- Yayın komutu `firebase deploy` senin hesabınla kimlik ister. Bunu ya senin bilgisayarında
  ya da bana geçici bir yetki (CI token) vererek yaparız — döndüğünde en kolayını seçeriz.

## Yayın komutları (hazır olunca)

```bash
npm install -g firebase-tools
firebase login          # senin Google hesabın
firebase use --add      # yuvarlak-bar projesini seç
firebase deploy         # kurallar + indeksler + web sitesi
```

Yayından sonra site şu adreste olur: `https://<proje-kimligi>.web.app`

## GitHub'a yükleme

Yerel git deposu hazır (v1.0 etiketli). Yüklemek için GitHub'da boş bir depo aç
(`yuvarlak-bar`), sonra ya bana adresini + geçici erişim ver, ya da:

```bash
git remote add origin https://github.com/<kullanici>/yuvarlak-bar.git
git push -u origin main --tags
```
