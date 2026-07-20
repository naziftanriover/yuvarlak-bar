// Ilk kurulum yardimcisi. Hic kullanici yoksa, ortam degiskenlerinden
// ilk PATRON kullanicisini olusturur (sifre koda yazilmaz, ortamdan gelir).

import type { DatabaseSync } from "node:sqlite";
import { kullaniciOlustur, ROL } from "../cekirdek/index";
import { kullaniciDeposuOlustur } from "../veri/index";
import type { Saglayicilar } from "../servis/index";

export async function ilkPatronuSagla(
  db: DatabaseSync,
  saglayici: Saglayicilar,
  ortam: Record<string, string | undefined> = process.env,
): Promise<void> {
  const depo = kullaniciDeposuOlustur(db);
  if (depo.hepsi().length > 0) {
    return; // zaten kullanici var
  }

  const kullaniciAdi = ortam.YB_PATRON_KULLANICI;
  const sifre = ortam.YB_PATRON_SIFRE;
  if (!kullaniciAdi || !sifre) {
    console.warn(
      "Uyari: Hic kullanici yok. Ilk patron icin YB_PATRON_KULLANICI ve YB_PATRON_SIFRE ayarlayin.",
    );
    return;
  }

  const patron = await kullaniciOlustur({
    id: saglayici.yeniKimlik(),
    ad: "Patron",
    kullaniciAdi,
    sifre,
    rol: ROL.PATRON,
  });
  depo.ekle(patron);
  console.log(`Ilk patron kullanicisi olusturuldu: ${kullaniciAdi}`);
}
