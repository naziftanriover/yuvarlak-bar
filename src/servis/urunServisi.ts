// Urun servisi: urun listeleme ve yonetimi (yetki kontrollu).
// Fiyat degisiklikleri denetim kaydina yazilir (patron gorebilsin).

import {
  urunOlustur,
  satisFiyatiGuncelle,
  stokEkle,
  stokAyarla,
  urunuPasiflestir,
  urunuAktiflestir,
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
  malGirisi(aktor: Aktor, urunId: string, adet: number): Urun;
  stokSayimi(aktor: Aktor, urunId: string, sayilanAdet: number, sebep: string): Urun;
  durumDegistir(aktor: Aktor, urunId: string, aktif: boolean): Urun;
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

    malGirisi(aktor, urunId, adet) {
      yetkiDogrula(aktor.rol, IZIN.URUN_YONET);
      const mevcut = urunGetir(urunId);
      const yeni = stokEkle(mevcut, adet);
      urunDepo.guncelle(yeni);
      denetimDepo.ekle({
        id: saglayici.yeniKimlik(),
        tur: DENETIM_TURU.STOK_GIRISI,
        aciklama: `${mevcut.ad}: +${adet} mal girişi (yeni stok: ${yeni.stokAdedi})`,
        kullaniciId: aktor.kullaniciId,
        zaman: saglayici.simdiIso(),
      });
      return yeni;
    },

    stokSayimi(aktor, urunId, sayilanAdet, sebep) {
      yetkiDogrula(aktor.rol, IZIN.URUN_YONET);
      const mevcut = urunGetir(urunId);
      const fark = sayilanAdet - mevcut.stokAdedi;
      const yeni = stokAyarla(mevcut, sayilanAdet);
      urunDepo.guncelle(yeni);
      const farkMetni = fark >= 0 ? `+${fark}` : `${fark}`;
      const sebepMetni = sebep && sebep.trim() ? ` - ${sebep.trim()}` : "";
      denetimDepo.ekle({
        id: saglayici.yeniKimlik(),
        tur: DENETIM_TURU.STOK_SAYIMI,
        aciklama: `${mevcut.ad}: sayım ${mevcut.stokAdedi} -> ${sayilanAdet} (fark ${farkMetni})${sebepMetni}`,
        kullaniciId: aktor.kullaniciId,
        zaman: saglayici.simdiIso(),
      });
      return yeni;
    },

    durumDegistir(aktor, urunId, aktif) {
      yetkiDogrula(aktor.rol, IZIN.URUN_YONET);
      const mevcut = urunGetir(urunId);
      const yeni = aktif ? urunuAktiflestir(mevcut) : urunuPasiflestir(mevcut);
      urunDepo.guncelle(yeni);
      return yeni;
    },
  };

  // Urunu getirir, yoksa anlamli hata verir.
  function urunGetir(urunId: string): Urun {
    const urun = urunDepo.idIleGetir(urunId);
    if (!urun) {
      throw new AdisyonHatasi(HATA_KODU.BULUNAMADI, "Urun bulunamadi.");
    }
    return urun;
  }
}
