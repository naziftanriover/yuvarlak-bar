// Kullanici saklama modulu (depo). Kullanicilari veritabaninda tutar ve getirir.

import type { DatabaseSync } from "node:sqlite";
import type { Kullanici, Rol } from "../cekirdek/index";

export interface KullaniciDeposu {
  ekle(kullanici: Kullanici): void;
  guncelle(kullanici: Kullanici): void;
  idIleGetir(id: string): Kullanici | null;
  kullaniciAdiylaGetir(kullaniciAdi: string): Kullanici | null;
  hepsi(): Kullanici[];
}

// Veritabani satirini Kullanici nesnesine cevirir.
function satiriKullaniciyaCevir(satir: Record<string, unknown>): Kullanici {
  return {
    id: String(satir.id),
    ad: String(satir.ad),
    kullaniciAdi: String(satir.kullaniciAdi),
    sifreHash: String(satir.sifreHash),
    rol: String(satir.rol) as Rol,
    aktif: satir.aktif === 1,
  };
}

export function kullaniciDeposuOlustur(db: DatabaseSync): KullaniciDeposu {
  const ekleSorgu = db.prepare(
    `INSERT INTO kullanici (id, ad, kullaniciAdi, sifreHash, rol, aktif)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const guncelleSorgu = db.prepare(
    `UPDATE kullanici SET ad = ?, kullaniciAdi = ?, sifreHash = ?, rol = ?, aktif = ?
     WHERE id = ?`,
  );
  const idSorgu = db.prepare(`SELECT * FROM kullanici WHERE id = ?`);
  const kullaniciAdiSorgu = db.prepare(`SELECT * FROM kullanici WHERE kullaniciAdi = ?`);
  const hepsiSorgu = db.prepare(`SELECT * FROM kullanici ORDER BY ad`);

  return {
    ekle(kullanici) {
      ekleSorgu.run(
        kullanici.id,
        kullanici.ad,
        kullanici.kullaniciAdi,
        kullanici.sifreHash,
        kullanici.rol,
        kullanici.aktif ? 1 : 0,
      );
    },
    guncelle(kullanici) {
      guncelleSorgu.run(
        kullanici.ad,
        kullanici.kullaniciAdi,
        kullanici.sifreHash,
        kullanici.rol,
        kullanici.aktif ? 1 : 0,
        kullanici.id,
      );
    },
    idIleGetir(id) {
      const satir = idSorgu.get(id) as Record<string, unknown> | undefined;
      return satir ? satiriKullaniciyaCevir(satir) : null;
    },
    kullaniciAdiylaGetir(kullaniciAdi) {
      const satir = kullaniciAdiSorgu.get(kullaniciAdi) as Record<string, unknown> | undefined;
      return satir ? satiriKullaniciyaCevir(satir) : null;
    },
    hepsi() {
      const satirlar = hepsiSorgu.all() as Record<string, unknown>[];
      return satirlar.map(satiriKullaniciyaCevir);
    },
  };
}
