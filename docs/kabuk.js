// Yuvarlak Bar — uygulama kabuğu: sol menü (gezinme + ayarlar), tema (koyu/açık), mobil hamburger.
// Her sayfa <div class="uygulama"><main class="icerik">...</main></div> yapısını sağlar; kabuk sol menüyü ekler.

import { cikisYap, sifreDegistirAkisi } from "./uygulama.js";

const TEMA_ANAHTAR = "yb-tema";

// Kayıtlı temayı uygular (giriş ekranı da çağırır). Varsayılan: koyu.
export function temaUygula() {
  let t = "koyu";
  try { t = localStorage.getItem(TEMA_ANAHTAR) || "koyu"; } catch (h) { t = "koyu"; }
  document.documentElement.dataset.tema = t;
  return t;
}
function temaDegistir(dugme) {
  const yeni = document.documentElement.dataset.tema === "koyu" ? "acik" : "koyu";
  document.documentElement.dataset.tema = yeni;
  try { localStorage.setItem(TEMA_ANAHTAR, yeni); } catch (h) { /* depolama yoksa yoksay */ }
  temaDugmeMetni(dugme);
}
function temaDugmeMetni(dugme) {
  const koyu = document.documentElement.dataset.tema === "koyu";
  dugme.innerHTML = '<span class="ikon">' + (koyu ? "🌙" : "☀️") + "</span> Tema: " + (koyu ? "Koyu" : "Açık");
}

// Rol → menü. url'de sorgu varsa (örn stok) o bölümü ayırt etmek için kullanılır.
const NAV = [
  { ad: "Ana Sayfa", ikon: "🏠", url: "bugun.html", roller: ["PATRON", "MUDUR"] },
  { ad: "Satış", ikon: "🍹", url: "satis.html", roller: ["PATRON", "MUDUR"] },
  { ad: "Sipariş", ikon: "🧾", url: "siparis.html", roller: ["GARSON"] },
  { ad: "Stoklar", ikon: "📦", url: "stoklar.html", roller: ["PATRON", "MUDUR"] },
  { ad: "Aylık Rapor", ikon: "📊", url: "rapor.html", roller: ["PATRON"] },
  { ad: "Kullanıcılar", ikon: "👥", url: "kullanicilar.html", roller: ["PATRON"] },
  { ad: "Ayarlar", ikon: "⚙️", url: "ayarlar.html", roller: ["PATRON", "MUDUR"] },
];

export function kabukKur(profil) {
  temaUygula();
  const uygulama = document.querySelector(".uygulama");
  if (!uygulama) return;

  const aktifDosya = location.pathname.split("/").pop() || "index.html";
  const aktifSorgu = location.search; // "?stok" gibi

  const yan = document.createElement("aside");
  yan.className = "yan-menu";

  const kapat = document.createElement("button");
  kapat.className = "yan-kapat"; kapat.textContent = "✕";
  kapat.onclick = () => uygulama.classList.remove("menu-acik");

  const marka = document.createElement("div");
  marka.className = "yan-marka"; marka.innerHTML = 'LEGEND OF THE <span>WEST</span>';

  const kim = document.createElement("div");
  kim.className = "yan-kim"; kim.textContent = profil.ad + " · " + profil.rol;

  const nav = document.createElement("nav");
  nav.className = "yan-nav";
  for (const oge of NAV) {
    if (!oge.roller.includes(profil.rol)) continue;
    const [dosya, sorgu] = oge.url.split("?");
    const a = document.createElement("a");
    a.className = "yan-link";
    a.href = oge.url;
    a.innerHTML = '<span class="ikon">' + oge.ikon + "</span> " + oge.ad;
    // Etkin sayfa vurgusu: dosya adı eşleşir ve (bağlantıda sorgu yoksa mevcut sayfada da yok) / (sorgu eşleşir)
    const dosyaEsit = dosya === aktifDosya;
    const sorguEsit = sorgu ? aktifSorgu.includes(sorgu) : aktifSorgu === "";
    if (dosyaEsit && sorguEsit) a.classList.add("aktif");
    nav.appendChild(a);
  }

  const ayar = document.createElement("div");
  ayar.className = "yan-ayar";
  const ayarBaslik = document.createElement("div");
  ayarBaslik.className = "yan-baslik"; ayarBaslik.textContent = "Ayarlar";
  const tema = document.createElement("button");
  tema.className = "yan-link"; temaDugmeMetni(tema);
  tema.onclick = () => temaDegistir(tema);
  const sifre = document.createElement("button");
  sifre.className = "yan-link"; sifre.innerHTML = '<span class="ikon">🔑</span> Şifre';
  sifre.onclick = sifreDegistirAkisi;
  const cikis = document.createElement("button");
  cikis.className = "yan-link"; cikis.innerHTML = '<span class="ikon">🚪</span> Çıkış';
  cikis.onclick = cikisYap;
  ayar.append(ayarBaslik, tema, sifre, cikis);

  const imza = document.createElement("div");
  imza.className = "yan-imza";
  imza.textContent = "Nazif Tanrıöver tarafından tasarlanmıştır";

  yan.append(kapat, marka, kim, nav, ayar, imza);
  uygulama.prepend(yan);

  // Mobil hamburger
  const ham = document.createElement("button");
  ham.className = "hamburger"; ham.innerHTML = "☰"; ham.setAttribute("aria-label", "Menü");
  ham.onclick = () => uygulama.classList.toggle("menu-acik");
  document.body.appendChild(ham);
  // Menüden bir bağlantıya tıklanınca mobilde menüyü kapat
  nav.addEventListener("click", () => uygulama.classList.remove("menu-acik"));
}
