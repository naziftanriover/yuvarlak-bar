// Adisyon cekirdek is mantigi.
// Tasarim ilkesi: SILME YOK. Sipariş ve iptal, olay (kayit) olarak eklenir.
// Ciro/maliyet/kar, tum hareketlerin isaretli (EKLE=+, IPTAL=-) toplamindan gelir.
// Boylece hicbir kayit yok edilmez; patron her hareketi denetleyebilir ve
// farkli cihazlardan gelen kayitlar ileride cakismadan birlesir.

import {
  SiparisHareketi,
  Odeme,
  AdisyonSatiri,
  AdisyonOzeti,
  AdisyonHatasi,
  HATA_KODU,
  HAREKET_TIPI,
  EN_AZ_ADET,
} from "./tipler";
import { pozitifTamSayiMi, negatifOlmayanTamSayiMi, metinDoluMu } from "./dogrulama";

// Bir adisyonun durumu.
export const ADISYON_DURUMU = {
  ACIK: "ACIK",
  KAPALI: "KAPALI",
} as const;

export type AdisyonDurumu = (typeof ADISYON_DURUMU)[keyof typeof ADISYON_DURUMU];

// Bir masaya acilan hesap (adisyon) kaydi. Siparis hareketleri ve odemeler
// bu adisyona baglidir.
export interface Adisyon {
  id: string;
  masaId: string;
  durum: AdisyonDurumu;
  acanKullaniciId: string;
  acilisZamani: string; // ISO 8601
  kapanisZamani: string | null; // kapatilinca dolar
}

// Yeni adisyon acarken gelen alanlar.
export interface AdisyonAcGirdi {
  id: string;
  masaId: string;
  acanKullaniciId: string;
  zaman: string;
}

// Bir iptal hareketi olusturmak icin disaridan gelen girdi.
export interface IptalGirdi {
  id: string;
  urunId: string;
  urunAdi: string;
  adet: number;
  birimFiyatKurus: number;
  birimMaliyetKurus: number;
  sebep: string;
  kullaniciId: string;
  zaman: string;
}

// --- Kucuk, tek is yapan yardimcilar ---

// Bir hareketin isaretli adedi: EKLE ise +, IPTAL ise -.
function isaretliAdet(hareket: SiparisHareketi): number {
  return hareket.tip === HAREKET_TIPI.IPTAL ? -hareket.adet : hareket.adet;
}

// Ayni urun+fiyat kombinasyonunu gruplamak icin anahtar.
function satirAnahtari(urunId: string, birimFiyatKurus: number): string {
  return `${urunId}|${birimFiyatKurus}`;
}

// --- Dogrulama (kullanicidan gelen her veri guvenilmez sayilir) ---

// Tek bir sipariş hareketini dogrular. Gecersizse anlamli AdisyonHatasi firlatir.
export function siparisHareketiDogrula(hareket: SiparisHareketi): void {
  if (hareket.tip !== HAREKET_TIPI.EKLE && hareket.tip !== HAREKET_TIPI.IPTAL) {
    throw new AdisyonHatasi(HATA_KODU.GECERSIZ_TIP, "Gecersiz hareket tipi.");
  }
  if (!pozitifTamSayiMi(hareket.adet) || hareket.adet < EN_AZ_ADET) {
    throw new AdisyonHatasi(HATA_KODU.GECERSIZ_ADET, "Adet en az 1 ve tam sayi olmali.");
  }
  if (!negatifOlmayanTamSayiMi(hareket.birimFiyatKurus)) {
    throw new AdisyonHatasi(HATA_KODU.GECERSIZ_FIYAT, "Birim fiyat gecersiz.");
  }
  if (!negatifOlmayanTamSayiMi(hareket.birimMaliyetKurus)) {
    throw new AdisyonHatasi(HATA_KODU.GECERSIZ_FIYAT, "Birim maliyet gecersiz.");
  }
  if (hareket.tip === HAREKET_TIPI.IPTAL && !metinDoluMu(hareket.sebep)) {
    throw new AdisyonHatasi(HATA_KODU.IPTAL_SEBEBI_GEREKLI, "Iptal icin sebep girilmeli.");
  }
}

// Tum hareketleri tek tek dogrular.
function tumHareketleriDogrula(hareketler: SiparisHareketi[]): void {
  for (const hareket of hareketler) {
    siparisHareketiDogrula(hareket);
  }
}

// --- Hesaplamalar ---

// Bir alan (fiyat veya maliyet) uzerinden isaretli toplami hesaplar.
function isaretliToplam(
  hareketler: SiparisHareketi[],
  alan: "birimFiyatKurus" | "birimMaliyetKurus",
): number {
  tumHareketleriDogrula(hareketler);
  return hareketler.reduce((toplam, hareket) => toplam + isaretliAdet(hareket) * hareket[alan], 0);
}

// Toplam satis (ciro), kurus.
export function ciroHesapla(hareketler: SiparisHareketi[]): number {
  return isaretliToplam(hareketler, "birimFiyatKurus");
}

// Toplam maliyet, kurus.
export function maliyetHesapla(hareketler: SiparisHareketi[]): number {
  return isaretliToplam(hareketler, "birimMaliyetKurus");
}

// Kar = ciro - maliyet, kurus.
export function karHesapla(hareketler: SiparisHareketi[]): number {
  return ciroHesapla(hareketler) - maliyetHesapla(hareketler);
}

// Adisyonda o an duran satirlari (net adedi > 0 olanlari) uretir.
export function adisyonSatirlari(hareketler: SiparisHareketi[]): AdisyonSatiri[] {
  tumHareketleriDogrula(hareketler);

  const gruplar = new Map<string, AdisyonSatiri>();

  for (const hareket of hareketler) {
    const anahtar = satirAnahtari(hareket.urunId, hareket.birimFiyatKurus);
    const mevcut = gruplar.get(anahtar);
    const yeniNetAdet = (mevcut?.netAdet ?? 0) + isaretliAdet(hareket);

    if (yeniNetAdet < 0) {
      throw new AdisyonHatasi(HATA_KODU.FAZLA_IPTAL, "Var olandan fazla iptal edilemez.");
    }

    gruplar.set(anahtar, {
      urunId: hareket.urunId,
      urunAdi: hareket.urunAdi,
      netAdet: yeniNetAdet,
      birimFiyatKurus: hareket.birimFiyatKurus,
      araToplamKurus: yeniNetAdet * hareket.birimFiyatKurus,
    });
  }

  return [...gruplar.values()].filter((satir) => satir.netAdet > 0);
}

// Belirli bir urun+fiyat icin su an iptal edilebilecek en fazla adedi dondurur.
function iptalEdilebilirAdet(hareketler: SiparisHareketi[], urunId: string, birimFiyatKurus: number): number {
  const anahtar = satirAnahtari(urunId, birimFiyatKurus);
  return hareketler
    .filter((h) => satirAnahtari(h.urunId, h.birimFiyatKurus) === anahtar)
    .reduce((toplam, h) => toplam + isaretliAdet(h), 0);
}

// Bir iptal hareketi olusturur: once dogrular, sonra "fazla iptal" kontrolu yapar.
// Silme yerine bu IPTAL kaydi eklenir.
export function iptalHareketiOlustur(
  mevcutHareketler: SiparisHareketi[],
  girdi: IptalGirdi,
): SiparisHareketi {
  const iptal: SiparisHareketi = {
    id: girdi.id,
    urunId: girdi.urunId,
    urunAdi: girdi.urunAdi,
    adet: girdi.adet,
    birimFiyatKurus: girdi.birimFiyatKurus,
    birimMaliyetKurus: girdi.birimMaliyetKurus,
    tip: HAREKET_TIPI.IPTAL,
    sebep: girdi.sebep,
    kullaniciId: girdi.kullaniciId,
    zaman: girdi.zaman,
  };

  siparisHareketiDogrula(iptal);

  const kalanAdet = iptalEdilebilirAdet(mevcutHareketler, girdi.urunId, girdi.birimFiyatKurus);
  if (girdi.adet > kalanAdet) {
    throw new AdisyonHatasi(HATA_KODU.FAZLA_IPTAL, "Var olandan fazla iptal edilemez.");
  }

  return iptal;
}

// --- Odeme ---

// Bir odemeyi dogrular.
function odemeyiDogrula(odeme: Odeme): void {
  if (!pozitifTamSayiMi(odeme.tutarKurus)) {
    throw new AdisyonHatasi(HATA_KODU.GECERSIZ_TUTAR, "Odeme tutari gecersiz.");
  }
}

// Alinan odemelerin toplami, kurus.
export function odenenToplam(odemeler: Odeme[]): number {
  return odemeler.reduce((toplam, odeme) => {
    odemeyiDogrula(odeme);
    return toplam + odeme.tutarKurus;
  }, 0);
}

// Kalan bakiye = ciro - odenen, kurus.
export function kalanBakiye(hareketler: SiparisHareketi[], odemeler: Odeme[]): number {
  return ciroHesapla(hareketler) - odenenToplam(odemeler);
}

// --- Ozet ---

// Bir adisyonun tam ozetini uretir.
export function adisyonOzeti(hareketler: SiparisHareketi[], odemeler: Odeme[]): AdisyonOzeti {
  const ciroKurus = ciroHesapla(hareketler);
  const maliyetKurus = maliyetHesapla(hareketler);
  const odenenKurus = odenenToplam(odemeler);

  return {
    satirlar: adisyonSatirlari(hareketler),
    ciroKurus,
    maliyetKurus,
    karKurus: ciroKurus - maliyetKurus,
    odenenKurus,
    kalanKurus: ciroKurus - odenenKurus,
  };
}

// --- Adisyon acma / kapatma ---

// Yeni bir adisyon acar (ACIK durumda). Alanlari dogrular.
export function adisyonAc(girdi: AdisyonAcGirdi): Adisyon {
  if (!metinDoluMu(girdi.masaId)) {
    throw new AdisyonHatasi(HATA_KODU.GECERSIZ_ADISYON, "Masa kimligi gecersiz.");
  }
  if (!metinDoluMu(girdi.acanKullaniciId)) {
    throw new AdisyonHatasi(HATA_KODU.GECERSIZ_ADISYON, "Acan kullanici gecersiz.");
  }
  return {
    id: girdi.id,
    masaId: girdi.masaId,
    durum: ADISYON_DURUMU.ACIK,
    acanKullaniciId: girdi.acanKullaniciId,
    acilisZamani: girdi.zaman,
    kapanisZamani: null,
  };
}

// Adisyonu kapatir. Zaten kapaliysa anlamli hata verir.
export function adisyonKapat(adisyon: Adisyon, zaman: string): Adisyon {
  if (adisyon.durum === ADISYON_DURUMU.KAPALI) {
    throw new AdisyonHatasi(HATA_KODU.ADISYON_ZATEN_KAPALI, "Bu adisyon zaten kapali.");
  }
  return { ...adisyon, durum: ADISYON_DURUMU.KAPALI, kapanisZamani: zaman };
}
