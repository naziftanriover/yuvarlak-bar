// Masa saklama modulu (depo).

import type { DatabaseSync } from "node:sqlite";
import type { Masa, MasaDurumu } from "../cekirdek/index";

export interface MasaDeposu {
  ekle(masa: Masa): void;
  guncelle(masa: Masa): void;
  idIleGetir(id: string): Masa | null;
  hepsi(): Masa[];
}

function satiriMasayaCevir(satir: Record<string, unknown>): Masa {
  const acikAdisyonId = satir.acikAdisyonId;
  return {
    id: String(satir.id),
    ad: String(satir.ad),
    durum: String(satir.durum) as MasaDurumu,
    acikAdisyonId: acikAdisyonId === null || acikAdisyonId === undefined ? null : String(acikAdisyonId),
  };
}

export function masaDeposuOlustur(db: DatabaseSync): MasaDeposu {
  const ekleSorgu = db.prepare(
    `INSERT INTO masa (id, ad, durum, acikAdisyonId) VALUES (?, ?, ?, ?)`,
  );
  const guncelleSorgu = db.prepare(
    `UPDATE masa SET ad = ?, durum = ?, acikAdisyonId = ? WHERE id = ?`,
  );
  const idSorgu = db.prepare(`SELECT * FROM masa WHERE id = ?`);
  const hepsiSorgu = db.prepare(`SELECT * FROM masa ORDER BY ad`);

  return {
    ekle(masa) {
      ekleSorgu.run(masa.id, masa.ad, masa.durum, masa.acikAdisyonId);
    },
    guncelle(masa) {
      guncelleSorgu.run(masa.ad, masa.durum, masa.acikAdisyonId, masa.id);
    },
    idIleGetir(id) {
      const satir = idSorgu.get(id) as Record<string, unknown> | undefined;
      return satir ? satiriMasayaCevir(satir) : null;
    },
    hepsi() {
      const satirlar = hepsiSorgu.all() as Record<string, unknown>[];
      return satirlar.map(satiriMasayaCevir);
    },
  };
}
