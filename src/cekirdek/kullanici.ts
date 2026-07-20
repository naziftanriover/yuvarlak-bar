// Kullanici, rol, yetki ve giris guvenligi modulu.
//
// Guvenlik ilkeleri:
// - Sifreler ASLA duz metin tutulmaz. node:crypto scrypt ile tuzlanip hash'lenir.
// - Sifre karsilastirmasi zamanlama saldirisina karsi guvenli yapilir.
// - Giris hatasinda "kullanici adi mi sifre mi yanlis" belli edilmez (tek mesaj).
// - Disari verilecek kullanicida sifre hash'i bulunmaz.

import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { AdisyonHatasi, HATA_KODU } from "./tipler";
import { metinDoluMu } from "./dogrulama";

const scryptAsync = promisify(scrypt);

// --- SABITLER ---

export const ROL = {
  PATRON: "PATRON",
  MUDUR: "MUDUR",
  GARSON: "GARSON",
} as const;

export const IZIN = {
  SIPARIS_GIR: "SIPARIS_GIR", // masaya siparis ekleme
  ODEME_AL: "ODEME_AL", // hesabi kapatip odeme alma
  GECE_KAPAT: "GECE_KAPAT", // gece kapanisi
  FIYAT_DEGISTIR: "FIYAT_DEGISTIR", // urun fiyati degistirme (loglanir)
  URUN_YONET: "URUN_YONET", // urun ekleme/pasiflestirme, stok
  RAPOR_GOR: "RAPOR_GOR", // patron raporlari ve denetim kaydi
  KULLANICI_YONET: "KULLANICI_YONET", // kullanici ekleme/pasiflestirme
} as const;

export type Rol = (typeof ROL)[keyof typeof ROL];
export type Izin = (typeof IZIN)[keyof typeof IZIN];

// Her rolun sahip oldugu yetkiler. Tek dogruluk kaynagi burasidir.
const ROL_IZINLERI: Record<Rol, readonly Izin[]> = {
  [ROL.PATRON]: [
    IZIN.SIPARIS_GIR,
    IZIN.ODEME_AL,
    IZIN.GECE_KAPAT,
    IZIN.FIYAT_DEGISTIR,
    IZIN.URUN_YONET,
    IZIN.RAPOR_GOR,
    IZIN.KULLANICI_YONET,
  ],
  [ROL.MUDUR]: [IZIN.SIPARIS_GIR, IZIN.ODEME_AL, IZIN.GECE_KAPAT, IZIN.FIYAT_DEGISTIR, IZIN.URUN_YONET],
  [ROL.GARSON]: [IZIN.SIPARIS_GIR],
};

// scrypt ayarlari
const TUZ_BAYT = 16;
const ANAHTAR_BAYT = 64;
const HASH_AYIRICI = ":";

// En az sifre uzunlugu
export const EN_AZ_SIFRE_UZUNLUGU = 8;

// --- TIPLER ---

export interface Kullanici {
  id: string;
  ad: string;
  kullaniciAdi: string;
  sifreHash: string; // "tuz:hash" formatinda
  rol: Rol;
  aktif: boolean;
}

// Disari (istemciye) verilecek guvenli kullanici: sifre hash'i YOK.
export type GuvenliKullanici = Omit<Kullanici, "sifreHash">;

// Yeni kullanici olustururken gelen alanlar (duz sifre ile).
export interface KullaniciGirdi {
  id: string;
  ad: string;
  kullaniciAdi: string;
  sifre: string; // duz sifre; hash'lenip saklanacak
  rol: Rol;
}

// --- ROL / YETKI ---

export function rolGecerliMi(rol: unknown): rol is Rol {
  return rol === ROL.PATRON || rol === ROL.MUDUR || rol === ROL.GARSON;
}

// Bir rolun belirli bir izne sahip olup olmadigini soyler.
export function yetkiVarMi(rol: Rol, izin: Izin): boolean {
  const izinler = ROL_IZINLERI[rol];
  return izinler !== undefined && izinler.includes(izin);
}

// Bir islemi korumak icin: yetki yoksa anlamli hata firlatir.
export function yetkiDogrula(rol: Rol, izin: Izin): void {
  if (!yetkiVarMi(rol, izin)) {
    throw new AdisyonHatasi(HATA_KODU.YETKISIZ, "Bu islem icin yetkiniz yok.");
  }
}

// --- SIFRE ---

// Duz sifreyi tuzlayip hash'ler. Sonuc "tuz:hash" (hex) metnidir.
export async function sifreHashle(sifre: string): Promise<string> {
  if (!metinDoluMu(sifre)) {
    throw new AdisyonHatasi(HATA_KODU.ZAYIF_SIFRE, "Sifre bos olamaz.");
  }
  const tuz = randomBytes(TUZ_BAYT).toString("hex");
  const turetilmis = (await scryptAsync(sifre, tuz, ANAHTAR_BAYT)) as Buffer;
  return `${tuz}${HASH_AYIRICI}${turetilmis.toString("hex")}`;
}

// Verilen sifrenin saklanan hash ile eslesip eslesmedigini guvenli sekilde kontrol eder.
export async function sifreDogrula(sifre: string, saklananHash: string): Promise<boolean> {
  const parcalar = saklananHash.split(HASH_AYIRICI);
  const tuz = parcalar[0];
  const anahtarHex = parcalar[1];
  if (parcalar.length !== 2 || !tuz || !anahtarHex) {
    return false;
  }
  const anahtar = Buffer.from(anahtarHex, "hex");
  const turetilmis = (await scryptAsync(sifre, tuz, anahtar.length)) as Buffer;
  return anahtar.length === turetilmis.length && timingSafeEqual(anahtar, turetilmis);
}

// Sifrenin en az kurala uyup uymadigini kontrol eder (dogrudan hata firlatir).
export function sifreGucunuDogrula(sifre: string): void {
  if (typeof sifre !== "string" || sifre.length < EN_AZ_SIFRE_UZUNLUGU) {
    throw new AdisyonHatasi(
      HATA_KODU.ZAYIF_SIFRE,
      `Sifre en az ${EN_AZ_SIFRE_UZUNLUGU} karakter olmali.`,
    );
  }
}

// --- KULLANICI ---

// Kullanicidan sifre hash'ini cikarir (istemciye gonderilecek guvenli hali).
export function kullaniciyiGizle(kullanici: Kullanici): GuvenliKullanici {
  const { sifreHash: _sifreHash, ...guvenli } = kullanici;
  return guvenli;
}

// Yeni kullanici olusturur: alanlari dogrular, sifreyi hash'ler.
export async function kullaniciOlustur(girdi: KullaniciGirdi): Promise<Kullanici> {
  if (!metinDoluMu(girdi.ad)) {
    throw new AdisyonHatasi(HATA_KODU.GECERSIZ_KULLANICI_ADI, "Ad bos olamaz.");
  }
  if (!metinDoluMu(girdi.kullaniciAdi)) {
    throw new AdisyonHatasi(HATA_KODU.GECERSIZ_KULLANICI_ADI, "Kullanici adi bos olamaz.");
  }
  if (!rolGecerliMi(girdi.rol)) {
    throw new AdisyonHatasi(HATA_KODU.GECERSIZ_ROL, "Gecersiz rol.");
  }
  sifreGucunuDogrula(girdi.sifre);

  const sifreHash = await sifreHashle(girdi.sifre);
  return {
    id: girdi.id,
    ad: girdi.ad,
    kullaniciAdi: girdi.kullaniciAdi.trim(),
    sifreHash,
    rol: girdi.rol,
    aktif: true,
  };
}

// Giris kontrolu: sifre dogru VE kullanici aktif ise guvenli kullaniciyi dondurur.
// Basarisizsa tek tip mesajla hata verir (kullanici mi sifre mi belli edilmez).
export async function girisKontrol(
  kullanici: Kullanici,
  verilenSifre: string,
): Promise<GuvenliKullanici> {
  // Sifre kontrolu her zaman calisir (zamanlama farkini azaltmak icin).
  const sifreDogru = await sifreDogrula(verilenSifre, kullanici.sifreHash);
  if (!kullanici.aktif || !sifreDogru) {
    throw new AdisyonHatasi(HATA_KODU.GIRIS_BASARISIZ, "Kullanici adi veya sifre hatali.");
  }
  return kullaniciyiGizle(kullanici);
}
