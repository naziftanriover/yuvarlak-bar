// Adisyon servisi: masaya adisyon acma, siparis ekleme/iptal, odeme, ozet, kapatma.
// Butun para hareketleri buradan gecer; her islem yetki kontrollu ve
// cekirdegin "silme yok" kurallarina uyar.

import {
  adisyonAc,
  adisyonKapat,
  masaAc,
  masaKapat,
  siparisHareketiDogrula,
  iptalHareketiOlustur,
  adisyonOzeti,
  stokDus,
  stokEkle,
  yetkiDogrula,
  IZIN,
  HAREKET_TIPI,
  ADISYON_DURUMU,
  AdisyonHatasi,
  HATA_KODU,
} from "../cekirdek/index";
import type { Adisyon, SiparisHareketi, Odeme, AdisyonOzeti, OdemeYontemi } from "../cekirdek/index";
import type { AdisyonDeposu, MasaDeposu, UrunDeposu } from "../veri/index";
import type { Aktor, Saglayicilar } from "./saglayicilar";

export interface AdisyonServisi {
  masayaAdisyonAc(aktor: Aktor, masaId: string): Adisyon;
  siparisEkle(aktor: Aktor, adisyonId: string, urunId: string, adet: number): SiparisHareketi;
  siparisIptalEt(
    aktor: Aktor,
    adisyonId: string,
    urunId: string,
    adet: number,
    sebep: string,
  ): SiparisHareketi;
  odemeAl(aktor: Aktor, adisyonId: string, tutarKurus: number, yontem: OdemeYontemi): Odeme;
  ozet(aktor: Aktor, adisyonId: string): AdisyonOzeti;
  hesabiKapat(aktor: Aktor, adisyonId: string): Adisyon;
}

export function adisyonServisiOlustur(
  adisyonDepo: AdisyonDeposu,
  masaDepo: MasaDeposu,
  urunDepo: UrunDeposu,
  saglayici: Saglayicilar,
): AdisyonServisi {
  // Ortak: acik adisyonu getir, yoksa/kapaliysa anlamli hata ver.
  function acikAdisyonuGetir(adisyonId: string): Adisyon {
    const adisyon = adisyonDepo.adisyonGetir(adisyonId);
    if (!adisyon) {
      throw new AdisyonHatasi(HATA_KODU.BULUNAMADI, "Adisyon bulunamadi.");
    }
    if (adisyon.durum !== ADISYON_DURUMU.ACIK) {
      throw new AdisyonHatasi(HATA_KODU.GECERSIZ_ADISYON, "Bu adisyon kapali.");
    }
    return adisyon;
  }

  return {
    masayaAdisyonAc(aktor, masaId) {
      yetkiDogrula(aktor.rol, IZIN.SIPARIS_GIR);
      const masa = masaDepo.idIleGetir(masaId);
      if (!masa) {
        throw new AdisyonHatasi(HATA_KODU.BULUNAMADI, "Masa bulunamadi.");
      }
      const adisyon = adisyonAc({
        id: saglayici.yeniKimlik(),
        masaId,
        acanKullaniciId: aktor.kullaniciId,
        zaman: saglayici.simdiIso(),
      });
      // masaAc, masa zaten doluysa hata verir (cekirdek kurali).
      const doluMasa = masaAc(masa, adisyon.id);
      adisyonDepo.adisyonEkle(adisyon);
      masaDepo.guncelle(doluMasa);
      return adisyon;
    },

    siparisEkle(aktor, adisyonId, urunId, adet) {
      yetkiDogrula(aktor.rol, IZIN.SIPARIS_GIR);
      acikAdisyonuGetir(adisyonId);

      const urun = urunDepo.idIleGetir(urunId);
      if (!urun) {
        throw new AdisyonHatasi(HATA_KODU.BULUNAMADI, "Urun bulunamadi.");
      }

      const hareket: SiparisHareketi = {
        id: saglayici.yeniKimlik(),
        urunId: urun.id,
        urunAdi: urun.ad,
        adet,
        birimFiyatKurus: urun.satisFiyatiKurus,
        birimMaliyetKurus: urun.maliyetKurus,
        tip: HAREKET_TIPI.EKLE,
        kullaniciId: aktor.kullaniciId,
        zaman: saglayici.simdiIso(),
      };
      siparisHareketiDogrula(hareket);

      // Stok otomatik duser; yetersizse siparis kaydedilmez (once dusur, sonra kaydet).
      const dususSonrasi = stokDus(urun, adet);
      adisyonDepo.hareketEkle(adisyonId, hareket);
      urunDepo.guncelle(dususSonrasi);
      return hareket;
    },

    siparisIptalEt(aktor, adisyonId, urunId, adet, sebep) {
      yetkiDogrula(aktor.rol, IZIN.SIPARIS_GIR);
      acikAdisyonuGetir(adisyonId);

      const urun = urunDepo.idIleGetir(urunId);
      if (!urun) {
        throw new AdisyonHatasi(HATA_KODU.BULUNAMADI, "Urun bulunamadi.");
      }

      const mevcutHareketler = adisyonDepo.hareketleriGetir(adisyonId);
      const iptal = iptalHareketiOlustur(mevcutHareketler, {
        id: saglayici.yeniKimlik(),
        urunId: urun.id,
        urunAdi: urun.ad,
        adet,
        birimFiyatKurus: urun.satisFiyatiKurus,
        birimMaliyetKurus: urun.maliyetKurus,
        sebep,
        kullaniciId: aktor.kullaniciId,
        zaman: saglayici.simdiIso(),
      });
      adisyonDepo.hareketEkle(adisyonId, iptal);

      // Iptal edilen adet stoga geri doner.
      urunDepo.guncelle(stokEkle(urun, adet));
      return iptal;
    },

    odemeAl(aktor, adisyonId, tutarKurus, yontem) {
      yetkiDogrula(aktor.rol, IZIN.ODEME_AL);
      acikAdisyonuGetir(adisyonId);

      const odeme: Odeme = {
        id: saglayici.yeniKimlik(),
        tutarKurus,
        yontem,
        kullaniciId: aktor.kullaniciId,
        zaman: saglayici.simdiIso(),
      };
      adisyonDepo.odemeEkle(adisyonId, odeme);
      return odeme;
    },

    ozet(aktor, adisyonId) {
      yetkiDogrula(aktor.rol, IZIN.SIPARIS_GIR);
      const adisyon = adisyonDepo.adisyonGetir(adisyonId);
      if (!adisyon) {
        throw new AdisyonHatasi(HATA_KODU.BULUNAMADI, "Adisyon bulunamadi.");
      }
      const hareketler = adisyonDepo.hareketleriGetir(adisyonId);
      const odemeler = adisyonDepo.odemeleriGetir(adisyonId);
      return adisyonOzeti(hareketler, odemeler);
    },

    hesabiKapat(aktor, adisyonId) {
      yetkiDogrula(aktor.rol, IZIN.ODEME_AL);
      const adisyon = acikAdisyonuGetir(adisyonId);

      const kapali = adisyonKapat(adisyon, saglayici.simdiIso());
      adisyonDepo.adisyonGuncelle(kapali);

      const masa = masaDepo.idIleGetir(adisyon.masaId);
      if (masa) {
        masaDepo.guncelle(masaKapat(masa));
      }
      return kapali;
    },
  };
}
