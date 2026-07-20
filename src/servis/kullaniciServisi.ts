// Kullanici yonetimi servisi: patron mudur/garson hesabi ekler, listeler,
// pasiflestirir. Hepsi KULLANICI_YONET yetkisi ister (yani sadece patron).

import { kullaniciOlustur, kullaniciyiGizle, yetkiDogrula, IZIN, AdisyonHatasi, HATA_KODU } from "../cekirdek/index";
import type { GuvenliKullanici, Rol } from "../cekirdek/index";
import type { KullaniciDeposu } from "../veri/index";
import type { Aktor, Saglayicilar } from "./saglayicilar";

// Yeni kullanici eklemek icin gelen alanlar (duz sifre ile).
export interface YeniKullaniciGirdi {
  ad: string;
  kullaniciAdi: string;
  sifre: string;
  rol: Rol;
}

export interface KullaniciServisi {
  ekle(aktor: Aktor, girdi: YeniKullaniciGirdi): Promise<GuvenliKullanici>;
  listele(aktor: Aktor): GuvenliKullanici[];
  aktiflikDegistir(aktor: Aktor, id: string, aktif: boolean): GuvenliKullanici;
}

export function kullaniciServisiOlustur(
  kullaniciDepo: KullaniciDeposu,
  saglayici: Saglayicilar,
): KullaniciServisi {
  return {
    async ekle(aktor, girdi) {
      yetkiDogrula(aktor.rol, IZIN.KULLANICI_YONET);

      // Ayni kullanici adi varsa anlamli hata ver (veritabani hatasi degil).
      if (kullaniciDepo.kullaniciAdiylaGetir(girdi.kullaniciAdi.trim())) {
        throw new AdisyonHatasi(HATA_KODU.KULLANICI_ADI_ALINMIS, "Bu kullanici adi zaten alinmis.");
      }

      const kullanici = await kullaniciOlustur({
        id: saglayici.yeniKimlik(),
        ad: girdi.ad,
        kullaniciAdi: girdi.kullaniciAdi,
        sifre: girdi.sifre,
        rol: girdi.rol,
      });
      kullaniciDepo.ekle(kullanici);
      return kullaniciyiGizle(kullanici);
    },

    listele(aktor) {
      yetkiDogrula(aktor.rol, IZIN.KULLANICI_YONET);
      return kullaniciDepo.hepsi().map(kullaniciyiGizle);
    },

    aktiflikDegistir(aktor, id, aktif) {
      yetkiDogrula(aktor.rol, IZIN.KULLANICI_YONET);

      // Kisi kendi hesabini pasiflestiremesin (kilitlenmeyi onler).
      if (aktor.kullaniciId === id && !aktif) {
        throw new AdisyonHatasi(HATA_KODU.KENDINI_PASIFLESTIREMEZ, "Kendi hesabinizi pasiflestiremezsiniz.");
      }

      const mevcut = kullaniciDepo.idIleGetir(id);
      if (!mevcut) {
        throw new AdisyonHatasi(HATA_KODU.BULUNAMADI, "Kullanici bulunamadi.");
      }
      const yeni = { ...mevcut, aktif };
      kullaniciDepo.guncelle(yeni);
      return kullaniciyiGizle(yeni);
    },
  };
}
