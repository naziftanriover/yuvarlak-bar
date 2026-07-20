// Masa servisi: masa listeleme ve ekleme (yetki kontrollu).

import { masaOlustur, yetkiDogrula, IZIN, metinDoluMu, AdisyonHatasi, HATA_KODU } from "../cekirdek/index";
import type { Masa, MasaGirdi } from "../cekirdek/index";
import type { MasaDeposu } from "../veri/index";
import type { Aktor } from "./saglayicilar";

export interface MasaServisi {
  listele(): Masa[];
  ekle(aktor: Aktor, girdi: MasaGirdi): Masa;
  adDegistir(aktor: Aktor, masaId: string, yeniAd: string): Masa;
}

export function masaServisiOlustur(masaDepo: MasaDeposu): MasaServisi {
  return {
    listele() {
      return masaDepo.hepsi();
    },
    ekle(aktor, girdi) {
      yetkiDogrula(aktor.rol, IZIN.URUN_YONET);
      const masa = masaOlustur(girdi);
      masaDepo.ekle(masa);
      return masa;
    },
    adDegistir(aktor, masaId, yeniAd) {
      yetkiDogrula(aktor.rol, IZIN.URUN_YONET);
      if (!metinDoluMu(yeniAd)) {
        throw new AdisyonHatasi(HATA_KODU.GECERSIZ_MASA, "Masa adi bos olamaz.");
      }
      const masa = masaDepo.idIleGetir(masaId);
      if (!masa) {
        throw new AdisyonHatasi(HATA_KODU.BULUNAMADI, "Masa bulunamadi.");
      }
      const yeni = { ...masa, ad: yeniAd.trim() };
      masaDepo.guncelle(yeni);
      return yeni;
    },
  };
}
