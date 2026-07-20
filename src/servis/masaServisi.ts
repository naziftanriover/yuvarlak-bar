// Masa servisi: masa listeleme ve ekleme (yetki kontrollu).

import { masaOlustur, yetkiDogrula, IZIN } from "../cekirdek/index";
import type { Masa, MasaGirdi } from "../cekirdek/index";
import type { MasaDeposu } from "../veri/index";
import type { Aktor } from "./saglayicilar";

export interface MasaServisi {
  listele(): Masa[];
  ekle(aktor: Aktor, girdi: MasaGirdi): Masa;
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
  };
}
