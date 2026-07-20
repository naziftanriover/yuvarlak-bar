// Denetim kaydi saklama modulu.

import type { DatabaseSync } from "node:sqlite";
import type { DenetimKaydi, DenetimTuru } from "../cekirdek/index";

export interface DenetimDeposu {
  ekle(kayit: DenetimKaydi): void;
  aralik(baslangicIso: string, bitisIso: string): DenetimKaydi[];
}

function satiriKayitaCevir(satir: Record<string, unknown>): DenetimKaydi {
  return {
    id: String(satir.id),
    tur: String(satir.tur) as DenetimTuru,
    aciklama: String(satir.aciklama),
    kullaniciId: String(satir.kullaniciId),
    zaman: String(satir.zaman),
  };
}

export function denetimDeposuOlustur(db: DatabaseSync): DenetimDeposu {
  const ekleSorgu = db.prepare(
    `INSERT INTO denetim_kaydi (id, tur, aciklama, kullaniciId, zaman) VALUES (?, ?, ?, ?, ?)`,
  );
  const aralikSorgu = db.prepare(
    `SELECT * FROM denetim_kaydi WHERE zaman >= ? AND zaman <= ? ORDER BY zaman DESC`,
  );

  return {
    ekle(kayit) {
      ekleSorgu.run(kayit.id, kayit.tur, kayit.aciklama, kayit.kullaniciId, kayit.zaman);
    },
    aralik(baslangicIso, bitisIso) {
      const satirlar = aralikSorgu.all(baslangicIso, bitisIso) as Record<string, unknown>[];
      return satirlar.map(satiriKayitaCevir);
    },
  };
}
