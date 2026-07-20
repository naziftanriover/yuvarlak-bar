// Yuvarlak Bar - Cekirdek tip tanimlari, sabitler ve hata sinifi.
// NOT: Para her zaman KURUS (tam sayi) olarak tutulur. 1 TL = 100 kurus.
// Boylece ondalik (float) yuvarlama hatalari olusmaz; paranin bir kurusu bile kaybolmaz.

// --- SABITLER (kod icine gomulmez, hepsi burada) ---

export const HAREKET_TIPI = {
  EKLE: "EKLE",
  IPTAL: "IPTAL",
} as const;

export const ODEME_YONTEMI = {
  NAKIT: "NAKIT",
  KART: "KART",
} as const;

// Bir sipariste girilebilecek en az adet.
export const EN_AZ_ADET = 1;

// Hata kodlari (kullaniciya kod degil, mesaj gosterilir; kod ic kullanim icindir).
export const HATA_KODU = {
  // Adisyon / para
  GECERSIZ_TIP: "GECERSIZ_TIP",
  GECERSIZ_ADET: "GECERSIZ_ADET",
  GECERSIZ_FIYAT: "GECERSIZ_FIYAT",
  GECERSIZ_TUTAR: "GECERSIZ_TUTAR",
  IPTAL_SEBEBI_GEREKLI: "IPTAL_SEBEBI_GEREKLI",
  FAZLA_IPTAL: "FAZLA_IPTAL",
  // Urun
  GECERSIZ_AD: "GECERSIZ_AD",
  GECERSIZ_KATEGORI: "GECERSIZ_KATEGORI",
  GECERSIZ_STOK: "GECERSIZ_STOK",
  YETERSIZ_STOK: "YETERSIZ_STOK",
  // Masa
  GECERSIZ_MASA: "GECERSIZ_MASA",
  MASA_DOLU: "MASA_DOLU",
  MASA_ZATEN_BOS: "MASA_ZATEN_BOS",
  // Kullanici / yetki / giris
  GECERSIZ_KULLANICI_ADI: "GECERSIZ_KULLANICI_ADI",
  ZAYIF_SIFRE: "ZAYIF_SIFRE",
  GECERSIZ_ROL: "GECERSIZ_ROL",
  GIRIS_BASARISIZ: "GIRIS_BASARISIZ",
  YETKISIZ: "YETKISIZ",
  KULLANICI_ADI_ALINMIS: "KULLANICI_ADI_ALINMIS",
  KENDINI_PASIFLESTIREMEZ: "KENDINI_PASIFLESTIREMEZ",
  // Adisyon (acik/kapali hesap)
  GECERSIZ_ADISYON: "GECERSIZ_ADISYON",
  ADISYON_ZATEN_KAPALI: "ADISYON_ZATEN_KAPALI",
  // Oturum / API
  OTURUM_GECERSIZ: "OTURUM_GECERSIZ",
  BULUNAMADI: "BULUNAMADI",
  GECERSIZ_ISTEK: "GECERSIZ_ISTEK",
} as const;

// --- TIPLER ---

export type HareketTipi = (typeof HAREKET_TIPI)[keyof typeof HAREKET_TIPI];
export type OdemeYontemi = (typeof ODEME_YONTEMI)[keyof typeof ODEME_YONTEMI];

// Bir adisyona yapilan tek bir hareket (sipraris ekleme veya iptal).
// Silme YOKTUR: iptal de bir EKLE gibi kayit olarak eklenir, boylece
// hicbir sey gizlice yok edilemez ve patron her hareketi gorebilir.
export interface SiparisHareketi {
  id: string;
  urunId: string;
  urunAdi: string; // o anki urun adi (sonradan urun adi degisse bile kayit korunur)
  adet: number; // her zaman pozitif tam sayi
  birimFiyatKurus: number; // satis birim fiyati (kurus)
  birimMaliyetKurus: number; // birim maliyet/alis fiyati (kurus) - kar hesabi icin
  tip: HareketTipi;
  sebep?: string; // IPTAL icin zorunlu
  kullaniciId: string;
  zaman: string; // ISO 8601 tarih-saat
}

// Bir odeme kaydi (adisyon kapatilirken alinir).
export interface Odeme {
  id: string;
  tutarKurus: number; // pozitif tam sayi
  yontem: OdemeYontemi;
  kullaniciId: string;
  zaman: string;
}

// Adisyonda o an duran bir satir (ekranda gosterilecek hali).
export interface AdisyonSatiri {
  urunId: string;
  urunAdi: string;
  netAdet: number; // eklenen - iptal edilen
  birimFiyatKurus: number;
  araToplamKurus: number; // netAdet * birimFiyatKurus
}

// Bir adisyonun tam ozeti.
export interface AdisyonOzeti {
  satirlar: AdisyonSatiri[];
  ciroKurus: number; // toplam satis
  maliyetKurus: number; // toplam maliyet
  karKurus: number; // ciro - maliyet
  odenenKurus: number; // alinan odemeler toplami
  kalanKurus: number; // ciro - odenen
}

// Tek, anlamli hata tipi. Kullaniciya mesaj gosterilir; ic detay sizdirilmaz.
export class AdisyonHatasi extends Error {
  readonly kod: string;

  constructor(kod: string, mesaj: string) {
    super(mesaj);
    this.name = "AdisyonHatasi";
    this.kod = kod;
  }
}
