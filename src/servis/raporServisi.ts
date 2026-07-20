// Rapor servisi: gecelik ozet, iptal denetimi ve denetim kayitlari.
// Hepsi RAPOR_GOR yetkisi ister (yani sadece patron).

import { gecelikHesapla, yetkiDogrula, IZIN } from "../cekirdek/index";
import type { GecelikOzet, AdisyonVerisi, SiparisHareketi, DenetimKaydi } from "../cekirdek/index";
import type { AdisyonDeposu, DenetimDeposu } from "../veri/index";
import type { Aktor } from "./saglayicilar";

export interface RaporServisi {
  gecelikOzet(aktor: Aktor, baslangicIso: string, bitisIso: string): GecelikOzet;
  iptalDenetimi(aktor: Aktor, baslangicIso: string, bitisIso: string): SiparisHareketi[];
  denetimKayitlari(aktor: Aktor, baslangicIso: string, bitisIso: string): DenetimKaydi[];
}

export function raporServisiOlustur(
  adisyonDepo: AdisyonDeposu,
  denetimDepo: DenetimDeposu,
): RaporServisi {
  // Bir aralikta kapanmis adisyonlarin ham verisini toplar.
  function kapananVeriler(baslangicIso: string, bitisIso: string): AdisyonVerisi[] {
    const adisyonlar = adisyonDepo.kapananAdisyonlar(baslangicIso, bitisIso);
    return adisyonlar.map((adisyon) => ({
      hareketler: adisyonDepo.hareketleriGetir(adisyon.id),
      odemeler: adisyonDepo.odemeleriGetir(adisyon.id),
    }));
  }

  return {
    gecelikOzet(aktor, baslangicIso, bitisIso) {
      yetkiDogrula(aktor.rol, IZIN.RAPOR_GOR);
      return gecelikHesapla(kapananVeriler(baslangicIso, bitisIso));
    },
    iptalDenetimi(aktor, baslangicIso, bitisIso) {
      yetkiDogrula(aktor.rol, IZIN.RAPOR_GOR);
      return adisyonDepo.iptalHareketleriAralik(baslangicIso, bitisIso);
    },
    denetimKayitlari(aktor, baslangicIso, bitisIso) {
      yetkiDogrula(aktor.rol, IZIN.RAPOR_GOR);
      return denetimDepo.aralik(baslangicIso, bitisIso);
    },
  };
}
