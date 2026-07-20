// Rapor cekirdegi: birden cok (kapanmis) adisyonun toplamlarini hesaplar.
// Saf fonksiyon: veriyi disaridan alir, veritabani/aga bakmaz -> kolay test edilir.

import { ciroHesapla, maliyetHesapla } from "./adisyon";
import { ODEME_YONTEMI } from "./tipler";
import type { SiparisHareketi, Odeme } from "./tipler";

// Tek bir adisyonun ham verisi (hareketler + odemeler).
export interface AdisyonVerisi {
  hareketler: SiparisHareketi[];
  odemeler: Odeme[];
}

// Bir donemin (gecenin) ozeti.
export interface GecelikOzet {
  adisyonSayisi: number;
  ciroKurus: number;
  maliyetKurus: number;
  karKurus: number;
  nakitKurus: number;
  kartKurus: number;
}

// Verilen adisyonlarin toplamini hesaplar.
export function gecelikHesapla(veriler: AdisyonVerisi[]): GecelikOzet {
  let ciro = 0;
  let maliyet = 0;
  let nakit = 0;
  let kart = 0;

  for (const veri of veriler) {
    ciro += ciroHesapla(veri.hareketler);
    maliyet += maliyetHesapla(veri.hareketler);
    for (const odeme of veri.odemeler) {
      if (odeme.yontem === ODEME_YONTEMI.NAKIT) {
        nakit += odeme.tutarKurus;
      } else if (odeme.yontem === ODEME_YONTEMI.KART) {
        kart += odeme.tutarKurus;
      }
    }
  }

  return {
    adisyonSayisi: veriler.length,
    ciroKurus: ciro,
    maliyetKurus: maliyet,
    karKurus: ciro - maliyet,
    nakitKurus: nakit,
    kartKurus: kart,
  };
}
