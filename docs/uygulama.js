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
  const liste = anlik.docs.map((d) => ({ id: d.id, ...d.data() }));
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
export function ozetHesapla(hareketler, odemeler) {
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
  const satirlar = [...gruplar.values()].filter((g) => g.netAdet > 0).map((g) => ({ ...g, araToplamKurus: g.netAdet * g.birimFiyatKurus }));
  return { satirlar, ciroKurus: ciro, maliyetKurus: maliyet, karKurus: ciro - maliyet, odenenKurus: odenen, kalanKurus: ciro - odenen };
}
export async function adisyonOzet(adisyonId) {
  const [h, o] = await Promise.all([hareketleriGetir(adisyonId), odemeleriGetir(adisyonId)]);
  return ozetHesapla(h, o);
}
// Porsiyonlu sipariş: secenek {ad, satisFiyatiKurus, maliyetKurus} ya da null; not isteğe bağlı.
export async function siparisEkle(aktor, adisyonId, urun, adet, secenek, not) {
  if (!(adet >= 1)) throw new Error("Adet en az 1 olmalı.");
  const fiyat = secenek ? secenek.satisFiyatiKurus : urun.satisFiyatiKurus;
  const maliyet = secenek ? secenek.maliyetKurus : urun.maliyetKurus;
  const stokTakip = urun.stokTakip !== false;
  if (stokTakip && adet > urun.stokAdedi) throw new Error("Stok yetersiz.");
  const hareket = {
    urunId: urun.id, urunAdi: urun.ad, adet, birimFiyatKurus: fiyat,
    birimMaliyetKurus: maliyet, tip: "EKLE", kullaniciId: aktor.uid, zaman: simdi(),
  };
  if (secenek && secenek.ad) hareket.secenek = secenek.ad;
  const notMetni = (not || "").trim();
  if (notMetni) hareket.not = notMetni;
  await addDoc(collection(db, "adisyonlar", adisyonId, "hareketler"), hareket);
  if (stokTakip) await updateDoc(doc(db, "urunler", urun.id), { stokAdedi: increment(-adet) });
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
  const stokTakip = urunAnlik.exists() ? urunAnlik.data().stokTakip !== false : true;
  if (stokTakip) await updateDoc(doc(db, "urunler", satir.urunId), { stokAdedi: increment(adet) });
}
export async function odemeAl(aktor, adisyonId, tutarKurus, yontem) {
  if (!(tutarKurus > 0)) throw new Error("Geçerli tutar girin.");
  await addDoc(collection(db, "adisyonlar", adisyonId, "odemeler"), { tutarKurus, yontem, kullaniciId: aktor.uid, zaman: simdi() });
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

// --- Rapor / denetim / gece ---
export async function gecelikOzet(bas, bit) {
  const s = query(collection(db, "adisyonlar"), where("durum", "==", "KAPALI"), where("kapanisZamani", ">=", bas), where("kapanisZamani", "<=", bit));
  const anlik = await getDocs(s);
  let adisyonSayisi = 0, ciro = 0, maliyet = 0, nakit = 0, kart = 0;
  for (const d of anlik.docs) {
    adisyonSayisi++;
    const [h, o] = await Promise.all([hareketleriGetir(d.id), odemeleriGetir(d.id)]);
    const oz = ozetHesapla(h, o);
    ciro += oz.ciroKurus; maliyet += oz.maliyetKurus;
    for (const od of o) {
      if (od.yontem === "NAKIT") nakit += od.tutarKurus;
      else if (od.yontem === "KART") kart += od.tutarKurus;
    }
  }
  return { adisyonSayisi, ciroKurus: ciro, maliyetKurus: maliyet, karKurus: ciro - maliyet, nakitKurus: nakit, kartKurus: kart };
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
