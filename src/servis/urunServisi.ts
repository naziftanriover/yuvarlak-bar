// Urun servisi: urun listeleme ve yonetimi (yetki kontrollu).
// Fiyat degisiklikleri denetim kaydina yazilir (patron gorebilsin).

import {
  urunOlustur,
  satisFiyatiGuncelle,
  aktifUrunler,
  kurusuBicimlendir,
  yetkiDogrula,
  IZIN,
  DENETIM_TURU,
  AdisyonHatasi,
  HATA_KODU,
} from "../cekirdek/index";
import type { Urun, UrunGirdi, DenetimKaydi } from "../cekirdek/index";
import type { UrunDeposu, DenetimDeposu } from "../veri/index";
import type { Aktor, Saglayicilar } from "./saglayicilar";

export interface UrunServisi {
  listele(): Urun[];
  aktifleriListele(): Urun[];
  ekle(aktor: Aktor, girdi: UrunGirdi): Urun;
  fiyatGuncelle(aktor: Aktor, urunId: string, yeniFiyatKurus: number): Urun;
}

export function urunServisiOlustur(
  urunDepo: UrunDeposu,
  denetimDepo: DenetimDeposu,
  saglayici: Saglayicilar,
): UrunServisi {
  return {
    listele() {
      return urunDepo.hepsi();
    },
    aktifleriListele() {
      return aktifUrunler(urunDepo.hepsi());
    },
    ekle(aktor, girdi) {
      yetkiDogrula(aktor.rol, IZIN.URUN_YONET);
      const urun = urunOlustur(girdi);
      urunDepo.ekle(urun);
      return urun;
    },
    fiyatGuncelle(aktor, urunId, yeniFiyatKurus) {
      yetkiDogrula(aktor.rol, IZIN.FIYAT_DEGISTIR);
      const mevcut = urunDepo.idIleGetir(urunId);
      if (!mevcut) {
        throw new AdisyonHatasi(HATA_KODU.BULUNAMADI, "Urun bulunamadi.");
      }
      const yeni = satisFiyatiGuncelle(mevcut, yeniFiyatKurus);
      urunDepo.guncelle(yeni);

      // Fiyat degisikligini denetim kaydina yaz.
      const kayit: DenetimKaydi = {
        id: saglayici.yeniKimlik(),
        tur: DENETIM_TURU.FIYAT_DEGISIKLIGI,
        aciklama: `${mevcut.ad}: ${kurusuBicimlendir(mevcut.satisFiyatiKurus)} -> ${kurusuBicimlendir(yeniFiyatKurus)}`,
        kullaniciId: aktor.kullaniciId,
        zaman: saglayici.simdiIso(),
      };
      denetimDepo.ekle(kayit);

      return yeni;
    },
  };
}
