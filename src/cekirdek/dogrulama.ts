// Ortak dogrulama yardimcilari. Butun cekirdek moduller bunlari kullanir,
// boylece ayni kontrol tekrar tekrar yazilmaz. Her biri tek is yapar ve
// sadece dogru/yanlis dondurur (hata firlatmaz); hatayi cagiran modul verir.

export function pozitifTamSayiMi(deger: unknown): deger is number {
  return typeof deger === "number" && Number.isInteger(deger) && deger > 0;
}

export function negatifOlmayanTamSayiMi(deger: unknown): deger is number {
  return typeof deger === "number" && Number.isInteger(deger) && deger >= 0;
}

export function metinDoluMu(deger: unknown): deger is string {
  return typeof deger === "string" && deger.trim().length > 0;
}
