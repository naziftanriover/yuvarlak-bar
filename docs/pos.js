// Yuvarlak Bar — ortak POS ekranı (kategori barı + renkli ürün ızgarası +
// porsiyon/not penceresi + canlı adisyon). satis.html ve siparis.html birlikte kullanır.
// Amaç: gerçek bir bar POS'u gibi dokunmatik, hızlı ve az hatalı bir arayüz.

import { kurusYaz, siparisEkle } from "./uygulama.js";

const TUMU = "Tümü";
// Kategori renkleri: sabit palet; aynı kategori her zaman aynı renk (POSSAFE gibi).
const PALET = [
  "#8a5a2b", "#2f6d3a", "#2b5a86", "#6a3a86", "#a06a1f",
  "#8a2f42", "#3f7a3a", "#2f6a6a", "#7a4530", "#4a4f8a",
];
export function kategoriRengi(kategori) {
  const s = kategori || "Genel";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALET[h % PALET.length];
}

// Adisyon satırının okunur etiketi: "Votka · Duble (buzsuz)".
export function satirEtiketi(satir) {
  let t = satir.urunAdi || "";
  if (satir.secenek) t += " · " + satir.secenek;
  if (satir.not) t += " (" + satir.not + ")";
  return t;
}

// --- Genel modal (katman) yardımcısı ---
function katmanAc() {
  const katman = document.createElement("div");
  katman.className = "katman";
  const kutu = document.createElement("div");
  kutu.className = "pencere";
  katman.appendChild(kutu);
  document.body.appendChild(katman);
  const kapat = () => katman.remove();
  // Arka plana tıklayınca kapat (kutu içi tıklamalar sayılmaz).
  katman.addEventListener("mousedown", (e) => { if (e.target === katman) kapat(); });
  return { katman, kutu, kapat };
}

// --- Porsiyon + adet + not seçme penceresi ---
// urun.secenekler varsa porsiyon butonları çıkar. Söz: {secenek, not, adet} ya da null.
function porsiyonNotPenceresi(urun) {
  return new Promise((coz) => {
    const { kutu, kapat } = katmanAc();
    const secenekler = Array.isArray(urun.secenekler) ? urun.secenekler : [];
    let seciliPorsiyon = secenekler.length ? secenekler[0] : null;
    let adet = 1;

    const baslik = document.createElement("h3");
    baslik.className = "pencere-baslik";
    baslik.textContent = urun.ad;
    kutu.appendChild(baslik);

    // Porsiyon butonları
    if (secenekler.length) {
      const et = document.createElement("div"); et.className = "pencere-etiket"; et.textContent = "Porsiyon";
      kutu.appendChild(et);
      const iz = document.createElement("div"); iz.className = "porsiyon-izgara";
      const butonlar = [];
      secenekler.forEach((s) => {
        const b = document.createElement("button");
        b.className = "porsiyon-dugme";
        b.innerHTML = '<span class="ad">' + s.ad + '</span><span class="fiyat">' + kurusYaz(s.satisFiyatiKurus) + "</span>";
        b.onclick = () => { seciliPorsiyon = s; butonlar.forEach((x) => x.classList.remove("secili")); b.classList.add("secili"); };
        butonlar.push(b); iz.appendChild(b);
      });
      butonlar[0].classList.add("secili");
      kutu.appendChild(iz);
    } else {
      const fy = document.createElement("div"); fy.className = "pencere-fiyat";
      fy.textContent = kurusYaz(urun.satisFiyatiKurus);
      kutu.appendChild(fy);
    }

    // Adet -/+
    const etA = document.createElement("div"); etA.className = "pencere-etiket"; etA.textContent = "Adet";
    kutu.appendChild(etA);
    const adetSatir = document.createElement("div"); adetSatir.className = "adet-satir";
    const eksi = document.createElement("button"); eksi.className = "adet-dugme"; eksi.textContent = "−";
    const gost = document.createElement("span"); gost.className = "adet-gost"; gost.textContent = "1";
    const arti = document.createElement("button"); arti.className = "adet-dugme"; arti.textContent = "+";
    eksi.onclick = () => { if (adet > 1) { adet--; gost.textContent = String(adet); } };
    arti.onclick = () => { adet++; gost.textContent = String(adet); };
    adetSatir.append(eksi, gost, arti);
    kutu.appendChild(adetSatir);

    // Not
    const etN = document.createElement("div"); etN.className = "pencere-etiket"; etN.textContent = "Not (isteğe bağlı)";
    kutu.appendChild(etN);
    const not = document.createElement("input");
    not.className = "pencere-giris"; not.placeholder = "örn: buzsuz, az soslu";
    kutu.appendChild(not);

    // Butonlar
    const alt = document.createElement("div"); alt.className = "pencere-alt";
    const vaz = document.createElement("button"); vaz.className = "dugme"; vaz.textContent = "Vazgeç";
    const ekle = document.createElement("button"); ekle.className = "dugme-vurgu"; ekle.textContent = "Ekle";
    vaz.onclick = () => { kapat(); coz(null); };
    ekle.onclick = () => { kapat(); coz({ secenek: seciliPorsiyon, not: not.value, adet }); };
    alt.append(vaz, ekle);
    kutu.appendChild(alt);
    not.focus();
  });
}

// --- Kategori barı + ürün ızgarası ---
// cfg: { profil, adisyonId, urunler, kategoriKok, izgaraKok, sonrasi(), hata(mesaj), kategoriAdlari? }
// kategoriAdlari: tanımlı kategoriler (sıralı). Üründe olup listede olmayanlar sona eklenir.
export function posUrunPaneli(cfg) {
  const { kategoriKok, izgaraKok } = cfg;
  const tanimli = Array.isArray(cfg.kategoriAdlari) ? cfg.kategoriAdlari : [];
  const urunKats = [...new Set(cfg.urunler.map((u) => u.kategori || "Genel"))];
  const ekstra = urunKats.filter((k) => !tanimli.includes(k)).sort((a, b) => a.localeCompare(b, "tr"));
  const kategoriler = [TUMU, ...tanimli, ...ekstra];
  let seciliKat = TUMU;

  function izgaraCiz() {
    const liste = seciliKat === TUMU ? cfg.urunler : cfg.urunler.filter((u) => (u.kategori || "Genel") === seciliKat);
    izgaraKok.innerHTML = liste.length ? "" : '<div class="bos-not">Bu kategoride ürün yok.</div>';
    for (const urun of liste) {
      const secenekli = Array.isArray(urun.secenekler) && urun.secenekler.length > 0;
      const tukendi = urun.stokTakip !== false && urun.stokAdedi <= 0;
      const b = document.createElement("button");
      b.className = "urun-kutu" + (tukendi ? " tukendi" : "");
      b.style.background = kategoriRengi(urun.kategori);
      const fiyatMetni = secenekli
        ? kurusYaz(urun.secenekler[0].satisFiyatiKurus) + " +"
        : kurusYaz(urun.satisFiyatiKurus);
      b.innerHTML = '<span class="urun-ad">' + urun.ad + "</span>" +
        '<span class="urun-fiyat">' + (tukendi ? "Tükendi" : fiyatMetni) + "</span>";
      b.disabled = tukendi;
      b.onclick = () => uruneTikla(urun);
      izgaraKok.appendChild(b);
    }
  }

  async function uruneTikla(urun) {
    const secim = await porsiyonNotPenceresi(urun);
    if (!secim) return;
    try {
      await siparisEkle(cfg.profil, cfg.adisyonId, urun, secim.adet, secim.secenek, secim.not);
      if (urun.stokTakip !== false) urun.stokAdedi -= secim.adet;
      izgaraCiz();
      await cfg.sonrasi();
    } catch (h) { cfg.hata(h.message || String(h)); }
  }

  kategoriKok.innerHTML = "";
  const katButonlari = [];
  kategoriler.forEach((kat) => {
    const b = document.createElement("button");
    b.className = "kategori-dugme";
    b.textContent = kat;
    if (kat !== TUMU) b.style.borderLeftColor = kategoriRengi(kat);
    b.onclick = () => { seciliKat = kat; katButonlari.forEach((x) => x.classList.remove("secili")); b.classList.add("secili"); izgaraCiz(); };
    katButonlari.push(b);
    kategoriKok.appendChild(b);
  });
  katButonlari[0].classList.add("secili");
  izgaraCiz();
}

// --- Canlı adisyon listesi ---
// cfg: { iptalEt(satir) }  (iptalEt yoksa iptal butonu çıkmaz)
export function posAdisyonCiz(kok, satirlar, cfg = {}) {
  kok.innerHTML = satirlar.length ? "" : '<div class="bos-not">Henüz sipariş yok.</div>';
  for (const satir of satirlar) {
    const el = document.createElement("div");
    el.className = "adisyon-satir";
    const sol = document.createElement("div"); sol.className = "adisyon-sol";
    sol.innerHTML = '<span class="adisyon-adet">' + satir.netAdet + "×</span> " +
      '<span class="adisyon-ad">' + satirEtiketi(satir) + "</span>";
    const sag = document.createElement("div"); sag.className = "adisyon-sag";
    sag.innerHTML = '<span class="adisyon-tutar">' + kurusYaz(satir.araToplamKurus) + "</span>";
    if (cfg.iptalEt) {
      const b = document.createElement("button");
      b.className = "dugme-kirmizi dugme-kucuk"; b.textContent = "İptal";
      b.onclick = () => cfg.iptalEt(satir);
      sag.appendChild(b);
    }
    el.append(sol, sag);
    kok.appendChild(el);
  }
}

// --- Porsiyon düzenleme penceresi (ürün ekleme/yönetim için) ---
// baslik: pencere başlığı; mevcut: [{ad,satisFiyatiKurus,maliyetKurus}]
// Söz: yeni dizi ya da null (vazgeç). Boş bırakılan satırlar atlanır.
export function seceneklerDuzenlePenceresi(baslik, mevcut) {
  return new Promise((coz) => {
    const { kutu, kapat } = katmanAc();
    kutu.classList.add("pencere-genis");
    const h = document.createElement("h3"); h.className = "pencere-baslik"; h.textContent = baslik;
    kutu.appendChild(h);
    const bilgi = document.createElement("div"); bilgi.className = "pencere-etiket";
    bilgi.textContent = "Porsiyon adı + satış ve maliyet (TL). Boş bırakırsan ürün tek fiyatlı olur.";
    kutu.appendChild(bilgi);

    const liste = document.createElement("div"); liste.className = "porsiyon-duzen-liste";
    kutu.appendChild(liste);

    function satirEkle(s = {}) {
      const satir = document.createElement("div"); satir.className = "porsiyon-duzen-satir";
      const ad = document.createElement("input"); ad.placeholder = "Porsiyon (örn: Duble)"; ad.value = s.ad || "";
      const sat = document.createElement("input"); sat.type = "number"; sat.step = "0.01"; sat.min = "0"; sat.placeholder = "Satış ₺";
      if (s.satisFiyatiKurus != null) sat.value = (s.satisFiyatiKurus / 100).toFixed(2);
      const mal = document.createElement("input"); mal.type = "number"; mal.step = "0.01"; mal.min = "0"; mal.placeholder = "Maliyet ₺";
      if (s.maliyetKurus != null) mal.value = (s.maliyetKurus / 100).toFixed(2);
      const sil = document.createElement("button"); sil.className = "dugme-kirmizi dugme-kucuk"; sil.textContent = "Sil";
      sil.onclick = () => satir.remove();
      satir.append(ad, sat, mal, sil);
      liste.appendChild(satir);
    }
    (Array.isArray(mevcut) && mevcut.length ? mevcut : []).forEach(satirEkle);

    const alt = document.createElement("div"); alt.className = "pencere-alt";
    const yeni = document.createElement("button"); yeni.className = "dugme"; yeni.textContent = "+ Porsiyon";
    yeni.onclick = () => satirEkle();
    const vaz = document.createElement("button"); vaz.className = "dugme"; vaz.textContent = "Vazgeç";
    const kaydet = document.createElement("button"); kaydet.className = "dugme-vurgu"; kaydet.textContent = "Kaydet";
    const hataEl = document.createElement("div"); hataEl.className = "pencere-hata gizli";

    vaz.onclick = () => { kapat(); coz(null); };
    kaydet.onclick = () => {
      const sonuc = [];
      for (const satir of liste.querySelectorAll(".porsiyon-duzen-satir")) {
        const [ad, sat, mal] = satir.querySelectorAll("input");
        const adT = ad.value.trim();
        if (!adT && !sat.value && !mal.value) continue; // tamamen boş satır: atla
        const sf = parseFloat(sat.value), mf = parseFloat(mal.value);
        if (!adT) { hataEl.textContent = "Porsiyon adı boş olamaz."; hataEl.classList.remove("gizli"); return; }
        if (!(sf >= 0)) { hataEl.textContent = adT + ": geçerli satış fiyatı girin."; hataEl.classList.remove("gizli"); return; }
        if (!(mf >= 0)) { hataEl.textContent = adT + ": geçerli maliyet girin."; hataEl.classList.remove("gizli"); return; }
        sonuc.push({ ad: adT, satisFiyatiKurus: Math.round(sf * 100), maliyetKurus: Math.round(mf * 100) });
      }
      kapat(); coz(sonuc);
    };
    alt.append(yeni, vaz, kaydet);
    kutu.appendChild(hataEl);
    kutu.appendChild(alt);
  });
}
