// Yuvarlak Bar — Firebase sürümü ortak katman (Auth + Firestore + iş mantığı).
// Tarayıcıda modüler Firebase SDK (CDN) kullanır; derleme/araç gerektirmez.

import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword, updatePassword, EmailAuthProvider, reauthenticateWithCredential,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, collectionGroup, doc, getDoc, getDocs, addDoc, setDoc, updateDoc,
  query, where, orderBy, increment,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

export const ROL = { PATRON: "PATRON", MUDUR: "MUDUR", GARSON: "GARSON" };
export const ODEME_YONTEMI = { NAKIT: "NAKIT", KART: "KART" };
const EPOSTA_SONEKI = "@yuvarlakbar.app";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Yardımcılar ---
export function kurusYaz(kurus) {
  return (kurus / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺";
}
// Stok sayısını okunur yazar (kesirli olabilir: açık şişe → 9,85 gibi).
export function stokYaz(n) {
  return (Number(n) || 0).toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}
function simdi() { return new Date().toISOString(); }
function epostaYap(kullaniciAdi) { return kullaniciAdi.trim().toLowerCase() + EPOSTA_SONEKI; }

// --- Oturum ---
export function girisYap(kullaniciAdi, sifre) {
  return signInWithEmailAndPassword(auth, epostaYap(kullaniciAdi), sifre);
}
export function cikisYap() {
  signOut(auth).finally(() => { window.location.href = "giris.html"; });
}
async function profilGetir(uid) {
  const anlik = await getDoc(doc(db, "kullanicilar", uid));
  return anlik.exists() ? { uid, ...anlik.data() } : null;
}
// Sayfa koruması: profili döndürür ya da girişe yollar. Pasif kullanıcıyı atar.
export function korumaVeProfil() {
  return new Promise((coz) => {
    onAuthStateChanged(auth, async (kullanici) => {
      if (!kullanici) { window.location.href = "giris.html"; return; }
      const profil = await profilGetir(kullanici.uid);
      if (!profil || profil.aktif === false) { cikisYap(); return; }
      coz(profil);
    });
  });
}

// Mevcut profili döndürür (yönlendirmeden). Giriş sayfası kullanır.
export function mevcutProfil() {
  return new Promise((coz) => {
    onAuthStateChanged(auth, async (kullanici) => {
      coz(kullanici ? await profilGetir(kullanici.uid) : null);
    });
  });
}

// Rol → izinler (istemci UI için; Firestore kuralları ayrıca zorunlu kılar).
const ROL_IZIN = {
  PATRON: ["SIPARIS", "ODEME", "URUN", "FIYAT", "GECE", "RAPOR", "KULLANICI"],
  MUDUR: ["SIPARIS", "ODEME", "URUN", "FIYAT", "GECE"],
  GARSON: ["SIPARIS"],
};
export function yetkiVar(rol, izin) { return (ROL_IZIN[rol] || []).includes(izin); }

// --- Ürünler ---
export async function urunleriGetir(sadeceAktif) {
  const anlik = await getDocs(collection(db, "urunler"));
  const liste = anlik.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => !u.silik);
  liste.sort((a, b) => (a.kategori + a.ad).localeCompare(b.kategori + b.ad, "tr"));
  return sadeceAktif ? liste.filter((u) => u.aktif) : liste;
}
export async function urunEkle(g) {
  await addDoc(collection(db, "urunler"), {
    ad: g.ad, kategori: g.kategori, satisFiyatiKurus: g.satisFiyatiKurus,
    maliyetKurus: g.maliyetKurus, stokAdedi: g.stokAdedi, aktif: true,
    // stokTakip yoksa true kabul edilir (eski ürünlerle uyum). İçkiler için kapatılabilir.
    stokTakip: g.stokTakip !== false,
    // Porsiyonlar (tek/duble/şişe...). Boşsa ürün tek fiyatlıdır.
    secenekler: Array.isArray(g.secenekler) ? g.secenekler : [],
  });
}
// Bir ürünün porsiyonlarını (tek/duble/şişe...) günceller ve denetime yazar.
export async function urunSeceneklerGuncelle(aktor, urun, secenekler) {
  const liste = Array.isArray(secenekler) ? secenekler : [];
  await updateDoc(doc(db, "urunler", urun.id), { secenekler: liste });
  await denetimEkle(aktor, "PORSIYON_DEGISIKLIGI", `${urun.ad}: porsiyonlar güncellendi (${liste.length} adet)`);
}
async function denetimEkle(aktor, tur, aciklama) {
  await addDoc(collection(db, "denetim"), { tur, aciklama, kullaniciId: aktor.uid, zaman: simdi() });
}
export async function fiyatGuncelle(aktor, urun, yeniFiyatKurus) {
  await updateDoc(doc(db, "urunler", urun.id), { satisFiyatiKurus: yeniFiyatKurus });
  await denetimEkle(aktor, "FIYAT_DEGISIKLIGI", `${urun.ad}: ${kurusYaz(urun.satisFiyatiKurus)} -> ${kurusYaz(yeniFiyatKurus)}`);
}
export async function malGirisi(aktor, urun, adet) {
  await updateDoc(doc(db, "urunler", urun.id), { stokAdedi: increment(adet) });
  await denetimEkle(aktor, "STOK_GIRISI", `${urun.ad}: +${adet} mal girişi (yeni: ${urun.stokAdedi + adet})`);
}
export async function stokSayimi(aktor, urun, sayilan, sebep) {
  const fark = sayilan - urun.stokAdedi;
  await updateDoc(doc(db, "urunler", urun.id), { stokAdedi: sayilan });
  const farkMetni = (fark >= 0 ? "+" : "") + fark;
  await denetimEkle(aktor, "STOK_SAYIMI", `${urun.ad}: sayım ${urun.stokAdedi} -> ${sayilan} (fark ${farkMetni})${sebep ? " - " + sebep : ""}`);
}
export async function urunDurum(urun, aktif) {
  await updateDoc(doc(db, "urunler", urun.id), { aktif });
}
// Ürünü sil: her yerden (satış, stok, yönetim) kalkar. Kayıt korunur (silik=true),
// geçmiş satışlar kendi ürün adını/fiyatını sakladığı için etkilenmez.
export async function urunSil(aktor, urun) {
  await updateDoc(doc(db, "urunler", urun.id), { aktif: false, silik: true });
  await denetimEkle(aktor, "URUN_SILME", `${urun.ad} silindi`);
}
// Ürünün temel bilgilerini düzenler (ad/kategori/satış/maliyet/stok takip).
export async function urunGuncelle(aktor, urun, g) {
  const yeni = {};
  if (g.ad != null) yeni.ad = g.ad;
  if (g.kategori != null) yeni.kategori = g.kategori;
  if (g.satisFiyatiKurus != null) yeni.satisFiyatiKurus = g.satisFiyatiKurus;
  if (g.maliyetKurus != null) yeni.maliyetKurus = g.maliyetKurus;
  if (g.stokTakip != null) yeni.stokTakip = g.stokTakip;
  await updateDoc(doc(db, "urunler", urun.id), yeni);
  await denetimEkle(aktor, "URUN_DUZENLEME", `${urun.ad} düzenlendi`);
}

// --- Kategoriler ---
// Tanımlı kategoriler (sıralı). Ürün formu bundan seçtirir; POS barı bu sırayı kullanır.
export async function kategorileriGetir(sadeceAktif) {
  let anlik;
  try { anlik = await getDocs(collection(db, "kategoriler")); }
  catch (h) { if (h && h.code === "permission-denied") return []; throw h; }
  const liste = anlik.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.sira ?? 0) - (b.sira ?? 0) || a.ad.localeCompare(b.ad, "tr"));
  return sadeceAktif ? liste.filter((k) => k.aktif !== false) : liste;
}
export async function kategoriEkle(ad) {
  const t = (ad || "").trim();
  if (!t) throw new Error("Kategori adı boş olamaz.");
  const mevcut = await kategorileriGetir(false);
  if (mevcut.some((k) => k.ad.toLocaleLowerCase("tr") === t.toLocaleLowerCase("tr")))
    throw new Error("Bu kategori zaten var.");
  const sira = mevcut.length ? Math.max(...mevcut.map((k) => k.sira ?? 0)) + 1 : 0;
  await addDoc(collection(db, "kategoriler"), { ad: t, sira, aktif: true });
}
export async function kategoriAdDegistir(aktor, kategori, yeniAd) {
  const t = (yeniAd || "").trim();
  if (!t) throw new Error("Kategori adı boş olamaz.");
  await updateDoc(doc(db, "kategoriler", kategori.id), { ad: t });
  // Eski ada sahip ürünleri de yeni ada taşı (tutarlılık; "icecek/İçecek" çiftini önler).
  const anlik = await getDocs(query(collection(db, "urunler"), where("kategori", "==", kategori.ad)));
  for (const d of anlik.docs) await updateDoc(doc(db, "urunler", d.id), { kategori: t });
  await denetimEkle(aktor, "KATEGORI_DEGISIKLIGI", `${kategori.ad} -> ${t} (${anlik.size} ürün güncellendi)`);
}
export async function kategoriDurum(kategori, aktif) {
  await updateDoc(doc(db, "kategoriler", kategori.id), { aktif });
}
// yon: -1 yukarı, +1 aşağı. Tüm sıraları yeni konuma göre yeniden yazar.
export async function kategoriSirala(kategori, yon) {
  const liste = await kategorileriGetir(false);
  const i = liste.findIndex((k) => k.id === kategori.id);
  const j = i + yon;
  if (i < 0 || j < 0 || j >= liste.length) return;
  const yeni = [...liste];
  [yeni[i], yeni[j]] = [yeni[j], yeni[i]];
  await Promise.all(yeni.map((k, idx) => updateDoc(doc(db, "kategoriler", k.id), { sira: idx })));
}
// Mevcut ürünlerdeki kategori adlarını tanımlı listeye ekler (bir defalık kurulum kolaylığı).
export async function kategorileriIceAktar() {
  const [urunler, tanimli] = await Promise.all([urunleriGetir(false), kategorileriGetir(false)]);
  const varOlan = new Set(tanimli.map((k) => k.ad.toLocaleLowerCase("tr")));
  const yeniAdlar = [...new Set(urunler.map((u) => (u.kategori || "").trim()).filter(Boolean))]
    .filter((ad) => !varOlan.has(ad.toLocaleLowerCase("tr")));
  let sira = tanimli.length ? Math.max(...tanimli.map((k) => k.sira ?? 0)) + 1 : 0;
  for (const ad of yeniAdlar) await addDoc(collection(db, "kategoriler"), { ad, sira: sira++, aktif: true });
  return yeniAdlar.length;
}

// --- Masalar ---
export async function masalariGetir() {
  const anlik = await getDocs(collection(db, "masalar"));
  return anlik.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
}
export async function masaEkle(ad) {
  await addDoc(collection(db, "masalar"), { ad, durum: "BOS", acikAdisyonId: null });
}
export async function masaAdDegistir(masa, yeniAd) {
  await updateDoc(doc(db, "masalar", masa.id), { ad: yeniAd });
}

// --- Adisyon ---
export async function masayaAdisyonAc(aktor, masa) {
  if (masa.durum === "DOLU") throw new Error("Bu masa zaten dolu.");
  const ref = await addDoc(collection(db, "adisyonlar"), {
    masaId: masa.id, durum: "ACIK", acanKullaniciId: aktor.uid, acilisZamani: simdi(), kapanisZamani: null,
  });
  await updateDoc(doc(db, "masalar", masa.id), { durum: "DOLU", acikAdisyonId: ref.id });
  return ref.id;
}
function isaretli(h) { return h.tip === "IPTAL" ? -h.adet : h.adet; }

export async function hareketleriGetir(adisyonId) {
  const anlik = await getDocs(collection(db, "adisyonlar", adisyonId, "hareketler"));
  return anlik.docs.map((d) => d.data());
}
export async function odemeleriGetir(adisyonId) {
  const anlik = await getDocs(collection(db, "adisyonlar", adisyonId, "odemeler"));
  return anlik.docs.map((d) => d.data());
}
export function ozetHesapla(hareketler, odemeler, iskontoKurus = 0) {
  let ciro = 0, maliyet = 0;
  const gruplar = new Map();
  for (const h of hareketler) {
    const s = isaretli(h);
    ciro += s * h.birimFiyatKurus;
    maliyet += s * h.birimMaliyetKurus;
    const secenek = h.secenek || "";
    const not = h.not || "";
    const anahtar = h.urunId + "|" + h.birimFiyatKurus + "|" + secenek + "|" + not;
    const g = gruplar.get(anahtar) || { urunId: h.urunId, urunAdi: h.urunAdi, secenek, not, netAdet: 0, birimFiyatKurus: h.birimFiyatKurus, birimMaliyetKurus: h.birimMaliyetKurus };
    g.netAdet += s;
    gruplar.set(anahtar, g);
  }
  const odenen = odemeler.reduce((t, o) => t + o.tutarKurus, 0);
  const nakit = odemeler.filter((o) => o.yontem === "NAKIT").reduce((t, o) => t + o.tutarKurus, 0);
  const kart = odemeler.filter((o) => o.yontem === "KART").reduce((t, o) => t + o.tutarKurus, 0);
  const satirlar = [...gruplar.values()].filter((g) => g.netAdet > 0).map((g) => ({ ...g, araToplamKurus: g.netAdet * g.birimFiyatKurus }));
  const odemeGecmisi = [...odemeler].sort((a, b) => (a.zaman || "").localeCompare(b.zaman || ""));
  const isk = iskontoKurus || 0;
  const netTutar = ciro - isk; // iskonto sonrası ödenecek tutar
  return {
    satirlar, ciroKurus: ciro, iskontoKurus: isk, netTutarKurus: netTutar,
    maliyetKurus: maliyet, karKurus: netTutar - maliyet,
    odenenKurus: odenen, nakitKurus: nakit, kartKurus: kart,
    kalanKurus: netTutar - odenen, odemeler: odemeGecmisi,
  };
}
export async function adisyonOzet(adisyonId) {
  const [snap, h, o] = await Promise.all([
    getDoc(doc(db, "adisyonlar", adisyonId)), hareketleriGetir(adisyonId), odemeleriGetir(adisyonId),
  ]);
  const iskonto = snap.exists() ? (snap.data().iskontoKurus || 0) : 0;
  return ozetHesapla(h, o, iskonto);
}

// İskonto (TL bazlı indirim): adisyona yazılır, günün cirosu/kârı fark kadar düşer, denetime kaydolur.
export async function iskontoUygula(aktor, adisyonId, yeniIskontoKurus) {
  if (!(yeniIskontoKurus >= 0)) throw new Error("Geçerli iskonto tutarı girin.");
  const ref = doc(db, "adisyonlar", adisyonId);
  const snap = await getDoc(ref);
  const eski = (snap.exists() && snap.data().iskontoKurus) ? snap.data().iskontoKurus : 0;
  if (yeniIskontoKurus === eski) return;
  await updateDoc(ref, { iskontoKurus: yeniIskontoKurus });
  const fark = yeniIskontoKurus - eski; // ciro/kâr bu kadar düşer
  await gunArtir({ ciroKurus: increment(-fark), karKurus: increment(-fark) });
  await denetimEkle(aktor, "ISKONTO", `İskonto: ${kurusYaz(eski)} → ${kurusYaz(yeniIskontoKurus)}`);
}

// Müşteri ekranı (2. monitör) için canlı durum. ekran/aktif dokümanına yazar;
// müşteri ekranı bu dokümanı canlı dinler (giriş gerektirmeyen public okuma).
export async function ekranYaz(veri) {
  try { await setDoc(doc(db, "ekran", "aktif"), { ...veri, guncelleme: simdi() }); }
  catch (h) { /* kurallar yayınlanmadıysa müşteri ekranı yine markayı gösterir */ }
}
// Porsiyonlu sipariş: secenek {ad, satisFiyatiKurus, maliyetKurus} ya da null; not isteğe bağlı.
export async function siparisEkle(aktor, adisyonId, urun, adet, secenek, not) {
  if (!(adet >= 1)) throw new Error("Adet en az 1 olmalı.");
  const fiyat = secenek ? secenek.satisFiyatiKurus : urun.satisFiyatiKurus;
  const maliyet = secenek ? secenek.maliyetKurus : urun.maliyetKurus;
  const stokTakip = urun.stokTakip !== false;
  // Şişe oranı: porsiyonda siseOrani varsa stoktan adet/orani düşer (10 duble = 1 şişe).
  const stokDususu = secenek && secenek.siseOrani > 0 ? Math.round((adet / secenek.siseOrani) * 1000) / 1000 : adet;
  if (stokTakip && stokDususu > urun.stokAdedi) throw new Error("Stok yetersiz.");
  const hareket = {
    urunId: urun.id, urunAdi: urun.ad, adet, birimFiyatKurus: fiyat,
    birimMaliyetKurus: maliyet, tip: "EKLE", kullaniciId: aktor.uid, zaman: simdi(),
  };
  if (secenek && secenek.ad) hareket.secenek = secenek.ad;
  const notMetni = (not || "").trim();
  if (notMetni) hareket.not = notMetni;
  await addDoc(collection(db, "adisyonlar", adisyonId, "hareketler"), hareket);
  if (stokTakip) await updateDoc(doc(db, "urunler", urun.id), { stokAdedi: increment(-stokDususu) });
  // Bugünün cirosu anlık artsın.
  await gunArtir({
    ciroKurus: increment(fiyat * adet), maliyetKurus: increment(maliyet * adet),
    karKurus: increment((fiyat - maliyet) * adet), siparisAdedi: increment(adet),
  });
}
export async function siparisIptal(aktor, adisyonId, satir, adet, sebep) {
  if (!sebep || !sebep.trim()) throw new Error("İptal için sebep girilmeli.");
  const hareketler = await hareketleriGetir(adisyonId);
  // Aynı satır = aynı ürün + fiyat + porsiyon + not (özet gruplamasıyla birebir).
  const ayniSatir = (h) =>
    h.urunId === satir.urunId &&
    h.birimFiyatKurus === satir.birimFiyatKurus &&
    (h.secenek || "") === (satir.secenek || "") &&
    (h.not || "") === (satir.not || "");
  const net = hareketler.filter(ayniSatir).reduce((t, h) => t + isaretli(h), 0);
  if (adet > net) throw new Error("Var olandan fazla iptal edilemez.");
  const hareket = {
    urunId: satir.urunId, urunAdi: satir.urunAdi, adet, birimFiyatKurus: satir.birimFiyatKurus,
    birimMaliyetKurus: satir.birimMaliyetKurus, tip: "IPTAL", sebep: sebep.trim(), kullaniciId: aktor.uid, zaman: simdi(),
  };
  if (satir.secenek) hareket.secenek = satir.secenek;
  if (satir.not) hareket.not = satir.not;
  await addDoc(collection(db, "adisyonlar", adisyonId, "hareketler"), hareket);
  // Stok takibi kapalı ürünlerde iptalde de stok değişmez.
  const urunAnlik = await getDoc(doc(db, "urunler", satir.urunId));
  const urunData = urunAnlik.exists() ? urunAnlik.data() : null;
  const stokTakip = urunData ? urunData.stokTakip !== false : true;
  // İptalde stok, o porsiyonun şişe oranına göre geri döner.
  let orani = 1;
  if (satir.secenek && urunData && Array.isArray(urunData.secenekler)) {
    const p = urunData.secenekler.find((s) => s.ad === satir.secenek);
    if (p && p.siseOrani > 0) orani = p.siseOrani;
  }
  const stokArtis = Math.round((adet / orani) * 1000) / 1000;
  if (stokTakip) await updateDoc(doc(db, "urunler", satir.urunId), { stokAdedi: increment(stokArtis) });
  // İptal, bugünün cirosundan düşülsün.
  await gunArtir({
    ciroKurus: increment(-satir.birimFiyatKurus * adet), maliyetKurus: increment(-satir.birimMaliyetKurus * adet),
    karKurus: increment(-(satir.birimFiyatKurus - satir.birimMaliyetKurus) * adet),
    siparisAdedi: increment(-adet), iptalAdedi: increment(adet),
  });
}
export async function odemeAl(aktor, adisyonId, tutarKurus, yontem, not) {
  if (!(tutarKurus > 0)) throw new Error("Geçerli tutar girin.");
  const kayit = { tutarKurus, yontem, kullaniciId: aktor.uid, zaman: simdi() };
  const notMetni = (not || "").trim();
  if (notMetni) kayit.not = notMetni;
  await addDoc(collection(db, "adisyonlar", adisyonId, "odemeler"), kayit);
  // Günün nakit/kart toplamı (kasa mutabakatı için).
  await gunArtir(yontem === ODEME_YONTEMI.NAKIT ? { nakitKurus: increment(tutarKurus) } : { kartKurus: increment(tutarKurus) });
}
export async function hesapKapat(adisyonId, masaId) {
  await updateDoc(doc(db, "adisyonlar", adisyonId), { durum: "KAPALI", kapanisZamani: simdi() });
  await updateDoc(doc(db, "masalar", masaId), { durum: "BOS", acikAdisyonId: null });
}
export async function masaTasi(adisyonId, eskiMasaId, hedefMasa) {
  if (hedefMasa.durum === "DOLU") throw new Error("Hedef masa dolu.");
  await updateDoc(doc(db, "adisyonlar", adisyonId), { masaId: hedefMasa.id });
  await updateDoc(doc(db, "masalar", eskiMasaId), { durum: "BOS", acikAdisyonId: null });
  await updateDoc(doc(db, "masalar", hedefMasa.id), { durum: "DOLU", acikAdisyonId: adisyonId });
}
// Sipariş girilmemiş (boş) masayı boşaltır — "dolu ama boş" kalmasını önler.
export async function masaBosalt(adisyonId, masaId) {
  await updateDoc(doc(db, "adisyonlar", adisyonId), { durum: "BOSALTILDI", kapanisZamani: simdi() });
  await updateDoc(doc(db, "masalar", masaId), { durum: "BOS", acikAdisyonId: null });
}
// Masayı taşı ya da birleştir: hedef boşsa taşır, doluysa iki adisyonu birleştirir.
export async function masaBirlestir(kaynakAdisyonId, kaynakMasaId, hedefMasa) {
  if (hedefMasa.id === kaynakMasaId) throw new Error("Aynı masa.");
  if (hedefMasa.durum !== "DOLU" || !hedefMasa.acikAdisyonId) {
    return masaTasi(kaynakAdisyonId, kaynakMasaId, hedefMasa); // hedef boş → taşı
  }
  const hedefId = hedefMasa.acikAdisyonId;
  // Kaynağın hareket + ödemelerini hedefe kopyala (append-only; stok/bugün toplamı zaten sayıldı).
  const [hareketler, odemeler] = await Promise.all([
    getDocs(collection(db, "adisyonlar", kaynakAdisyonId, "hareketler")),
    getDocs(collection(db, "adisyonlar", kaynakAdisyonId, "odemeler")),
  ]);
  for (const h of hareketler.docs) await addDoc(collection(db, "adisyonlar", hedefId, "hareketler"), h.data());
  for (const o of odemeler.docs) await addDoc(collection(db, "adisyonlar", hedefId, "odemeler"), o.data());
  // Kaynağı "birleştirildi" işaretle (rapora KAPALI gibi girmesin) ve masasını boşalt.
  await updateDoc(doc(db, "adisyonlar", kaynakAdisyonId), { durum: "BIRLESTIRILDI", kapanisZamani: simdi() });
  await updateDoc(doc(db, "masalar", kaynakMasaId), { durum: "BOS", acikAdisyonId: null });
}

// --- İş günü (bugün) ---
// Tek canlı gün: gunler/aktif. Saat bağımsız — "Günü kapat" ile arşivlenip sıfırlanana kadar
// aynı gün devam eder (gece yarısını geçse de). Toplamlar her siparişte increment ile artar.
const AKTIF_GUN_ID = "aktif";
function bosGun() {
  return { durum: "ACIK", baslangic: simdi(), ciroKurus: 0, maliyetKurus: 0, karKurus: 0, siparisAdedi: 0, iptalAdedi: 0, nakitKurus: 0, kartKurus: 0 };
}
export async function bugunGetir() {
  const ref = doc(db, "gunler", AKTIF_GUN_ID);
  try {
    const anlik = await getDoc(ref);
    if (!anlik.exists()) { const yeni = bosGun(); await setDoc(ref, yeni); return { id: AKTIF_GUN_ID, ...yeni }; }
    const d = anlik.data();
    if (!d.baslangic) await setDoc(ref, { durum: "ACIK", baslangic: simdi() }, { merge: true });
    return { id: AKTIF_GUN_ID, ...d };
  } catch (h) {
    if (h && h.code === "permission-denied") return { id: AKTIF_GUN_ID, ...bosGun() };
    throw h;
  }
}
// Günün toplamlarını artırır/azaltır. Kural henüz yayınlanmadıysa siparişi engellememek için izin hatasını yutar.
async function gunArtir(alanlar) {
  try { await setDoc(doc(db, "gunler", AKTIF_GUN_ID), alanlar, { merge: true }); }
  catch (h) { if (!(h && h.code === "permission-denied")) throw h; }
}
export async function gunuKapat(aktor) {
  const ref = doc(db, "gunler", AKTIF_GUN_ID);
  const anlik = await getDoc(ref);
  const d = anlik.exists() ? anlik.data() : bosGun();
  const kayit = {
    baslangic: d.baslangic || simdi(), kapanis: simdi(),
    ciroKurus: d.ciroKurus || 0, maliyetKurus: d.maliyetKurus || 0, karKurus: d.karKurus || 0,
    siparisAdedi: d.siparisAdedi || 0, iptalAdedi: d.iptalAdedi || 0,
    nakitKurus: d.nakitKurus || 0, kartKurus: d.kartKurus || 0,
    kapatanKullaniciId: aktor.uid, zaman: simdi(),
  };
  await addDoc(collection(db, "gunKapanislari"), kayit);
  await setDoc(ref, bosGun()); // yeni gün sıfırdan
  return kayit;
}
export async function gunKapanislariGetir() {
  const anlik = await getDocs(collection(db, "gunKapanislari"));
  return anlik.docs.map((x) => x.data()).sort((a, b) => (b.kapanis || "").localeCompare(a.kapanis || ""));
}

// --- Rapor / denetim / gece ---
export async function gecelikOzet(bas, bit) {
  const s = query(collection(db, "adisyonlar"), where("durum", "==", "KAPALI"), where("kapanisZamani", ">=", bas), where("kapanisZamani", "<=", bit));
  const anlik = await getDocs(s);
  let adisyonSayisi = 0, ciro = 0, maliyet = 0, iskonto = 0, nakit = 0, kart = 0;
  for (const d of anlik.docs) {
    adisyonSayisi++;
    const isk = d.data().iskontoKurus || 0;
    const [h, o] = await Promise.all([hareketleriGetir(d.id), odemeleriGetir(d.id)]);
    const oz = ozetHesapla(h, o, isk);
    ciro += oz.netTutarKurus; maliyet += oz.maliyetKurus; iskonto += oz.iskontoKurus; // ciro = iskonto sonrası net
    for (const od of o) {
      if (od.yontem === "NAKIT") nakit += od.tutarKurus;
      else if (od.yontem === "KART") kart += od.tutarKurus;
    }
  }
  return { adisyonSayisi, ciroKurus: ciro, iskontoKurus: iskonto, maliyetKurus: maliyet, karKurus: ciro - maliyet, nakitKurus: nakit, kartKurus: kart };
}
export async function iptalDenetimi(bas, bit) {
  const s = query(collectionGroup(db, "hareketler"), where("tip", "==", "IPTAL"), where("zaman", ">=", bas), where("zaman", "<=", bit));
  const anlik = await getDocs(s);
  return anlik.docs.map((d) => d.data());
}
export async function denetimKayitlari(bas, bit) {
  const s = query(collection(db, "denetim"), where("zaman", ">=", bas), where("zaman", "<=", bit), orderBy("zaman", "desc"));
  const anlik = await getDocs(s);
  return anlik.docs.map((d) => d.data());
}
export async function geceKapat(aktor, bas, bit) {
  const oz = await gecelikOzet(bas, bit);
  await addDoc(collection(db, "geceKapanislari"), { baslangic: bas, bitis: bit, ...oz, kapatanKullaniciId: aktor.uid, zaman: simdi() });
  return oz;
}
export async function geceGecmis() {
  const s = query(collection(db, "geceKapanislari"), orderBy("zaman", "desc"));
  const anlik = await getDocs(s);
  return anlik.docs.map((d) => d.data());
}

// --- Kullanıcı yönetimi ---
export async function kullanicilariGetir() {
  const anlik = await getDocs(collection(db, "kullanicilar"));
  return anlik.docs.map((d) => ({ uid: d.id, ...d.data() }));
}
export async function kullaniciEkle(g) {
  // Yeni kullanıcıyı ikincil bir uygulama örneğiyle oluştururuz ki patronun oturumu bozulmasın.
  const ikincil = initializeApp(firebaseConfig, "ikincil-" + Date.now());
  const ikincilAuth = getAuth(ikincil);
  try {
    const cred = await createUserWithEmailAndPassword(ikincilAuth, epostaYap(g.kullaniciAdi), g.sifre);
    await setDoc(doc(db, "kullanicilar", cred.user.uid), {
      ad: g.ad, kullaniciAdi: g.kullaniciAdi.trim().toLowerCase(), rol: g.rol, aktif: true,
    });
  } finally {
    await signOut(ikincilAuth).catch(() => {});
    await deleteApp(ikincil).catch(() => {});
  }
}
export async function kullaniciDurum(uid, aktif) {
  await updateDoc(doc(db, "kullanicilar", uid), { aktif });
}
export async function sifremiDegistir(eski, yeni) {
  const kullanici = auth.currentUser;
  if (!kullanici) throw new Error("Oturum yok.");
  const kimlik = EmailAuthProvider.credential(kullanici.email, eski);
  await reauthenticateWithCredential(kullanici, kimlik);
  await updatePassword(kullanici, yeni);
}
export function sifreDegistirAkisi() {
  const eski = window.prompt("Mevcut şifreniz:");
  if (!eski) return;
  const yeni = window.prompt("Yeni şifre (en az 6 karakter):");
  if (!yeni) return;
  sifremiDegistir(eski, yeni)
    .then(() => window.alert("Şifreniz değiştirildi."))
    .catch((h) => window.alert("Hata: " + (h.message || h)));
}
