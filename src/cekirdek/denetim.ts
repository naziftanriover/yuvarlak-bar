// Denetim kaydi: patronun "kim, ne zaman, ne yapti" sorusuna cevap veren iz.
// Ornek: fiyat degisikligi. (Iptaller ayrica siparis hareketi olarak da durur.)

export const DENETIM_TURU = {
  FIYAT_DEGISIKLIGI: "FIYAT_DEGISIKLIGI",
} as const;

export type DenetimTuru = (typeof DENETIM_TURU)[keyof typeof DENETIM_TURU];

export interface DenetimKaydi {
  id: string;
  tur: DenetimTuru;
  aciklama: string; // insan okur: "Efes fiyati 150,00 ₺ -> 160,00 ₺"
  kullaniciId: string;
  zaman: string; // ISO 8601
}
