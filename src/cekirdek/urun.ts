// Urun (menu) modulu. Urun tanimlama, fiyat/maliyet/stok yonetimi.
// Tasarim: urunler SILINMEZ, menuden kaldirmak icin "pasiflestirilir".
// Boylece gecmis satislarin baglantisi ve kayitlar bozulmaz.

import { AdisyonHatasi, HATA_KODU } from "./tipler";
import { negatifOlmayanTamSayiMi, pozitifTamSayiMi, metinDoluMu } from "./dogrulama";

export interface Urun {
  id: string;
  ad: string;
  kategori: string;
  satisFiyatiKurus: number; // satis fiyati (kurus)
  maliyetKurus: number; // alis/maliyet fiyati (kurus) - kar hesabi icin
  stokAdedi: number; // mevcut stok (tam sayi)
  aktif: boolean; // false ise menude gorunmez ama kayit durur
}

// Yeni urun olustururken disaridan gelen alanlar (aktif otomatik true).
export interface UrunGirdi {
  id: string;
  ad: string;
  kategori: string;
  satisFiyatiKurus: number;
  maliyetKurus: number;
  stokAdedi: number;
}

// Bir urunun tum alanlarini dogrular. Gecersizse anlamli hata firlatir.
export function urunDogrula(urun: Urun): void {
  if (!metinDoluMu(urun.ad)) {
    throw new AdisyonHatasi(HATA_KODU.GECERSIZ_AD, "Urun adi bos olamaz.");
  }
  if (!metinDoluMu(urun.kategori)) {
    throw new AdisyonHatasi(HATA_KODU.GECERSIZ_KATEGORI, "Kategori bos olamaz.");
  }
  if (!negatifOlmayanTamSayiMi(urun.satisFiyatiKurus)) {
    throw new AdisyonHatasi(HATA_KODU.GECERSIZ_FIYAT, "Satis fiyati gecersiz.");
  }
  if (!negatifOlmayanTamSayiMi(urun.maliyetKurus)) {
    throw new AdisyonHatasi(HATA_KODU.GECERSIZ_FIYAT, "Maliyet gecersiz.");
  }
  if (!negatifOlmayanTamSayiMi(urun.stokAdedi)) {
    throw new AdisyonHatasi(HATA_KODU.GECERSIZ_STOK, "Stok adedi gecersiz.");
  }
}

// Yeni bir urun olusturur (aktif olarak). Once dogrular.
export function urunOlustur(girdi: UrunGirdi): Urun {
  const urun: Urun = { ...girdi, aktif: true };
  urunDogrula(urun);
  return urun;
}

// Satis fiyatini gunceller. Yeni bir urun nesnesi dondurur (eskiyi degistirmez).
export function satisFiyatiGuncelle(urun: Urun, yeniFiyatKurus: number): Urun {
  if (!negatifOlmayanTamSayiMi(yeniFiyatKurus)) {
    throw new AdisyonHatasi(HATA_KODU.GECERSIZ_FIYAT, "Satis fiyati gecersiz.");
  }
  return { ...urun, satisFiyatiKurus: yeniFiyatKurus };
}

// Urunu menuden kaldirir (silmez, pasiflestirir).
export function urunuPasiflestir(urun: Urun): Urun {
  return { ...urun, aktif: false };
}

// Pasif urunu tekrar menuye alir.
export function urunuAktiflestir(urun: Urun): Urun {
  return { ...urun, aktif: true };
}

// Stok ekler (mal girisi). Yeni urun nesnesi dondurur.
export function stokEkle(urun: Urun, adet: number): Urun {
  if (!pozitifTamSayiMi(adet)) {
    throw new AdisyonHatasi(HATA_KODU.GECERSIZ_STOK, "Eklenecek stok gecersiz.");
  }
  return { ...urun, stokAdedi: urun.stokAdedi + adet };
}

// Stogu belirli bir sayiya ayarlar (fiziksel sayim sonucu). Yeni urun nesnesi dondurur.
export function stokAyarla(urun: Urun, yeniStok: number): Urun {
  if (!negatifOlmayanTamSayiMi(yeniStok)) {
    throw new AdisyonHatasi(HATA_KODU.GECERSIZ_STOK, "Sayilan stok gecersiz.");
  }
  return { ...urun, stokAdedi: yeniStok };
}

// Stok duser (satis). Yetersiz stokta anlamli hata verir.
export function stokDus(urun: Urun, adet: number): Urun {
  if (!pozitifTamSayiMi(adet)) {
    throw new AdisyonHatasi(HATA_KODU.GECERSIZ_STOK, "Dusulecek stok gecersiz.");
  }
  if (adet > urun.stokAdedi) {
    throw new AdisyonHatasi(HATA_KODU.YETERSIZ_STOK, "Stok yetersiz.");
  }
  return { ...urun, stokAdedi: urun.stokAdedi - adet };
}

// Sadece aktif (menude gorunen) urunleri dondurur.
export function aktifUrunler(urunler: Urun[]): Urun[] {
  return urunler.filter((urun) => urun.aktif);
}

// Belirli bir kategorideki aktif urunleri dondurur.
export function kategoriyeGoreUrunler(urunler: Urun[], kategori: string): Urun[] {
  return aktifUrunler(urunler).filter((urun) => urun.kategori === kategori);
}
