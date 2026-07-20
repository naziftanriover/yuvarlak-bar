// Ortak yardimcilar: oturum saklama, API cagirma, para bicimleme.
// Not: token tarayicida localStorage'da tutulur (gercek web uygulamasi).

const ANAHTAR_TOKEN = "yb_token";
const ANAHTAR_ROL = "yb_rol";
const ANAHTAR_AD = "yb_ad";

function tokenAl() {
  return localStorage.getItem(ANAHTAR_TOKEN);
}
function rolAl() {
  return localStorage.getItem(ANAHTAR_ROL);
}
function adAl() {
  return localStorage.getItem(ANAHTAR_AD);
}

function oturumKaydet(token, kullanici) {
  localStorage.setItem(ANAHTAR_TOKEN, token);
  localStorage.setItem(ANAHTAR_ROL, kullanici.rol);
  localStorage.setItem(ANAHTAR_AD, kullanici.ad);
}

function cikisYap() {
  localStorage.clear();
  window.location.href = "/giris.html";
}

// Oturum yoksa giris sayfasina yollar. Korumali sayfalarin basinda cagrilir.
function korumaKontrol() {
  if (!tokenAl()) {
    window.location.href = "/giris.html";
  }
}

// API cagirir. Hata olursa anlamli mesajla Error firlatir.
async function apiCagir(metot, yol, govde) {
  const basliklar = { "Content-Type": "application/json" };
  const token = tokenAl();
  if (token) {
    basliklar["Authorization"] = "Bearer " + token;
  }
  let cevap;
  try {
    cevap = await fetch(yol, {
      method: metot,
      headers: basliklar,
      body: govde === undefined ? undefined : JSON.stringify(govde),
    });
  } catch (e) {
    throw new Error("Sunucuya ulasilamadi. Internet baglantisini kontrol edin.");
  }

  let veri = {};
  try {
    veri = await cevap.json();
  } catch (e) {
    veri = {};
  }

  if (!cevap.ok) {
    // Oturum gecersizse girise don.
    if (cevap.status === 401) {
      cikisYap();
    }
    throw new Error(veri.hata || "Bir hata olustu.");
  }
  return veri;
}

// Kurusu okunabilir TL metnine cevirir. Ornek: 15000 -> "150,00 ₺"
function kurusYaz(kurus) {
  return (kurus / 100).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " ₺";
}

// Şifre değiştirme akışı (her panelde kullanılır).
async function sifreDegistirAkisi() {
  const eski = window.prompt("Mevcut şifreniz:");
  if (!eski) return;
  const yeni = window.prompt("Yeni şifre (en az 8 karakter):");
  if (!yeni) return;
  try {
    await apiCagir("POST", "/sifre-degistir", { eskiSifre: eski, yeniSifre: yeni });
    window.alert("Şifreniz değiştirildi.");
  } catch (hata) {
    window.alert("Hata: " + hata.message);
  }
}

// Basit mesaj gosterimi (hata veya bilgi).
function mesajGoster(kutuId, metin, tur) {
  const kutu = document.getElementById(kutuId);
  if (!kutu) return;
  kutu.textContent = metin;
  kutu.className = "mesaj " + (tur || "bilgi");
  kutu.classList.remove("gizli");
}
function mesajGizle(kutuId) {
  const kutu = document.getElementById(kutuId);
  if (kutu) kutu.classList.add("gizli");
}
