// Urun saklama modulu (depo).

import type { DatabaseSync } from "node:sqlite";
import type { Urun } from "../cekirdek/index";

export interface UrunDeposu {
  ekle(urun: Urun): void;
  guncelle(urun: Urun): void;
  idIleGetir(id: string): Urun | null;
  hepsi(): Urun[];
}

function satiriUruneCevir(satir: Record<string, unknown>): Urun {
  return {
    id: String(satir.id),
    ad: String(satir.ad),
    kategori: String(satir.kategori),
    satisFiyatiKurus: Number(satir.satisFiyatiKurus),
    maliyetKurus: Number(satir.maliyetKurus),
    stokAdedi: Number(satir.stokAdedi),
    aktif: satir.aktif === 1,
  };
}

export function urunDeposuOlustur(db: DatabaseSync): UrunDeposu {
  const ekleSorgu = db.prepare(
    `INSERT INTO urun (id, ad, kategori, satisFiyatiKurus, maliyetKurus, stokAdedi, aktif)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const guncelleSorgu = db.prepare(
    `UPDATE urun SET ad = ?, kategori = ?, satisFiyatiKurus = ?, maliyetKurus = ?, stokAdedi = ?, aktif = ?
     WHERE id = ?`,
  );
  const idSorgu = db.prepare(`SELECT * FROM urun WHERE id = ?`);
  const hepsiSorgu = db.prepare(`SELECT * FROM urun ORDER BY kategori, ad`);

  return {
    ekle(urun) {
      ekleSorgu.run(
        urun.id,
        urun.ad,
        urun.kategori,
        urun.satisFiyatiKurus,
        urun.maliyetKurus,
        urun.stokAdedi,
        urun.aktif ? 1 : 0,
      );
    },
    guncelle(urun) {
      guncelleSorgu.run(
        urun.ad,
        urun.kategori,
        urun.satisFiyatiKurus,
        urun.maliyetKurus,
        urun.stokAdedi,
        urun.aktif ? 1 : 0,
        urun.id,
      );
    },
    idIleGetir(id) {
      const satir = idSorgu.get(id) as Record<string, unknown> | undefined;
      return satir ? satiriUruneCevir(satir) : null;
    },
    hepsi() {
      const satirlar = hepsiSorgu.all() as Record<string, unknown>[];
      return satirlar.map(satiriUruneCevir);
    },
  };
}
