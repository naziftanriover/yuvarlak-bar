// Para islemleri. Para her zaman KURUS (tam sayi) olarak tutulur.
// Bu dosyadaki fonksiyonlarin her biri tek bir is yapar.

import { AdisyonHatasi, HATA_KODU } from "./tipler";

const KURUS_CARPANI = 100; // 1 TL = 100 kurus
const PARA_SIMGESI = "₺";
const BINLIK_AYIRICI = ".";
const ONDALIK_AYIRICI = ",";

// TL cinsinden bir tutari kurusa cevirir. Ornek: 12.34 -> 1234
export function tlDenKurusa(tl: number): number {
  if (typeof tl !== "number" || !Number.isFinite(tl)) {
    throw new AdisyonHatasi(HATA_KODU.GECERSIZ_TUTAR, "Gecersiz tutar.");
  }
  return Math.round(tl * KURUS_CARPANI);
}

// Kurusu okunabilir TL metnine cevirir. Ornek: 123456 -> "1.234,56 ₺"
export function kurusuBicimlendir(kurus: number): string {
  if (!Number.isInteger(kurus)) {
    throw new AdisyonHatasi(HATA_KODU.GECERSIZ_TUTAR, "Tutar tam sayi (kurus) olmali.");
  }

  const negatif = kurus < 0;
  const mutlakDeger = Math.abs(kurus);
  const liraKismi = Math.floor(mutlakDeger / KURUS_CARPANI);
  const kurusKismi = mutlakDeger % KURUS_CARPANI;

  const liraMetni = binlikAyir(liraKismi);
  const kurusMetni = kurusKismi.toString().padStart(2, "0");
  const isaret = negatif ? "-" : "";

  return `${isaret}${liraMetni}${ONDALIK_AYIRICI}${kurusMetni} ${PARA_SIMGESI}`;
}

// Bir tam sayiya binlik ayirici ekler. Ornek: 1234 -> "1.234"
function binlikAyir(sayi: number): string {
  return sayi.toString().replace(/\B(?=(\d{3})+(?!\d))/g, BINLIK_AYIRICI);
}
