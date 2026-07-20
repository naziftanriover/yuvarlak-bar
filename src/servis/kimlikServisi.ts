// Kimlik servisi: giris islemi. Basarili girise imzali token verir.

import { girisKontrol } from "../cekirdek/index";
import type { GuvenliKullanici } from "../cekirdek/index";
import { AdisyonHatasi, HATA_KODU } from "../cekirdek/index";
import type { KullaniciDeposu } from "../veri/index";
import { tokenOlustur } from "../api/oturum";
import type { Saglayicilar } from "./saglayicilar";

export interface GirisSonucu {
  token: string;
  kullanici: GuvenliKullanici;
}

export interface KimlikServisi {
  giris(kullaniciAdi: string, sifre: string): Promise<GirisSonucu>;
}

export function kimlikServisiOlustur(
  kullaniciDepo: KullaniciDeposu,
  saglayici: Saglayicilar,
  tokenSirri: string,
  tokenSuresiMs: number,
): KimlikServisi {
  return {
    async giris(kullaniciAdi, sifre) {
      const kullanici = kullaniciDepo.kullaniciAdiylaGetir(kullaniciAdi);
      if (!kullanici) {
        // Kullanici yoksa da tek tip mesaj (kullanici adi mi sifre mi belli olmasin).
        throw new AdisyonHatasi(HATA_KODU.GIRIS_BASARISIZ, "Kullanici adi veya sifre hatali.");
      }
      const guvenli = await girisKontrol(kullanici, sifre);
      const bitisMs = saglayici.simdiMs() + tokenSuresiMs;
      const token = tokenOlustur(
        { kullaniciId: guvenli.id, rol: guvenli.rol, bitisMs },
        tokenSirri,
      );
      return { token, kullanici: guvenli };
    },
  };
}
