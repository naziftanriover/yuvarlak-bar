// Masa modulu. Her masa ayridir; ayni anda tek acik adisyonu olur.
// Bir masaya adisyon acilinca DOLU, hesap kapatilinca BOS olur.

import { AdisyonHatasi, HATA_KODU } from "./tipler";
import { metinDoluMu } from "./dogrulama";

export const MASA_DURUMU = {
  BOS: "BOS",
  DOLU: "DOLU",
} as const;

export type MasaDurumu = (typeof MASA_DURUMU)[keyof typeof MASA_DURUMU];

export interface Masa {
  id: string;
  ad: string; // "Masa 1", "Bar 3", "Bahce 2" gibi
  durum: MasaDurumu;
  acikAdisyonId: string | null; // masada acik adisyon varsa onun kimligi
}

// Yeni masa olustururken gelen alanlar.
export interface MasaGirdi {
  id: string;
  ad: string;
}

// Yeni bir masa olusturur (bos olarak). Adi bos olamaz.
export function masaOlustur(girdi: MasaGirdi): Masa {
  if (!metinDoluMu(girdi.ad)) {
    throw new AdisyonHatasi(HATA_KODU.GECERSIZ_MASA, "Masa adi bos olamaz.");
  }
  return {
    id: girdi.id,
    ad: girdi.ad,
    durum: MASA_DURUMU.BOS,
    acikAdisyonId: null,
  };
}

// Masaya adisyon acar (DOLU yapar). Zaten doluysa hata verir.
export function masaAc(masa: Masa, adisyonId: string): Masa {
  if (!metinDoluMu(adisyonId)) {
    throw new AdisyonHatasi(HATA_KODU.GECERSIZ_MASA, "Adisyon kimligi gecersiz.");
  }
  if (masa.durum === MASA_DURUMU.DOLU) {
    throw new AdisyonHatasi(HATA_KODU.MASA_DOLU, "Bu masa zaten dolu.");
  }
  return { ...masa, durum: MASA_DURUMU.DOLU, acikAdisyonId: adisyonId };
}

// Masanin hesabini kapatir (BOS yapar). Zaten bossa hata verir.
export function masaKapat(masa: Masa): Masa {
  if (masa.durum === MASA_DURUMU.BOS) {
    throw new AdisyonHatasi(HATA_KODU.MASA_ZATEN_BOS, "Bu masa zaten bos.");
  }
  return { ...masa, durum: MASA_DURUMU.BOS, acikAdisyonId: null };
}

// Bos masalari dondurur.
export function bosMasalar(masalar: Masa[]): Masa[] {
  return masalar.filter((masa) => masa.durum === MASA_DURUMU.BOS);
}

// Dolu masalari dondurur.
export function doluMasalar(masalar: Masa[]): Masa[] {
  return masalar.filter((masa) => masa.durum === MASA_DURUMU.DOLU);
}
