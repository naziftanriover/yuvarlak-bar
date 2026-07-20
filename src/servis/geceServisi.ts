// Gece servisi: geceyi kapatir (Z raporu) ve gecmis kapanislari listeler.
// Kapatma: o donemin toplamlari hesaplanip kilitli bir kayit olarak saklanir.

import { gecelikHesapla, yetkiDogrula, IZIN } from "../cekirdek/index";
import type { GeceKapanisi, AdisyonVerisi } from "../cekirdek/index";
import type { AdisyonDeposu, GeceDeposu } from "../veri/index";
import type { Aktor, Saglayicilar } from "./saglayicilar";

export interface GeceServisi {
  geceyiKapat(aktor: Aktor, baslangicIso: string, bitisIso: string): GeceKapanisi;
  gecmis(aktor: Aktor): GeceKapanisi[];
}

export function geceServisiOlustur(
  adisyonDepo: AdisyonDeposu,
  geceDepo: GeceDeposu,
  saglayici: Saglayicilar,
): GeceServisi {
  function kapananVeriler(baslangicIso: string, bitisIso: string): AdisyonVerisi[] {
    return adisyonDepo.kapananAdisyonlar(baslangicIso, bitisIso).map((adisyon) => ({
      hareketler: adisyonDepo.hareketleriGetir(adisyon.id),
      odemeler: adisyonDepo.odemeleriGetir(adisyon.id),
    }));
  }

  return {
    geceyiKapat(aktor, baslangicIso, bitisIso) {
      yetkiDogrula(aktor.rol, IZIN.GECE_KAPAT);
      const ozet = gecelikHesapla(kapananVeriler(baslangicIso, bitisIso));

      const kapanis: GeceKapanisi = {
        id: saglayici.yeniKimlik(),
        baslangic: baslangicIso,
        bitis: bitisIso,
        adisyonSayisi: ozet.adisyonSayisi,
        ciroKurus: ozet.ciroKurus,
        maliyetKurus: ozet.maliyetKurus,
        karKurus: ozet.karKurus,
        nakitKurus: ozet.nakitKurus,
        kartKurus: ozet.kartKurus,
        kapatanKullaniciId: aktor.kullaniciId,
        zaman: saglayici.simdiIso(),
      };
      geceDepo.ekle(kapanis);
      return kapanis;
    },
    gecmis(aktor) {
      yetkiDogrula(aktor.rol, IZIN.RAPOR_GOR);
      return geceDepo.hepsi();
    },
  };
}
