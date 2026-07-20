// Gece kapanisi saklama modulu. Kapanislar eklenir (silinmez/degistirilmez).

import type { DatabaseSync } from "node:sqlite";
import type { GeceKapanisi } from "../cekirdek/index";

export interface GeceDeposu {
  ekle(kapanis: GeceKapanisi): void;
  hepsi(): GeceKapanisi[];
}

function satiriKapanisaCevir(satir: Record<string, unknown>): GeceKapanisi {
  return {
    id: String(satir.id),
    baslangic: String(satir.baslangic),
    bitis: String(satir.bitis),
    adisyonSayisi: Number(satir.adisyonSayisi),
    ciroKurus: Number(satir.ciroKurus),
    maliyetKurus: Number(satir.maliyetKurus),
    karKurus: Number(satir.karKurus),
    nakitKurus: Number(satir.nakitKurus),
    kartKurus: Number(satir.kartKurus),
    kapatanKullaniciId: String(satir.kapatanKullaniciId),
    zaman: String(satir.zaman),
  };
}

export function geceDeposuOlustur(db: DatabaseSync): GeceDeposu {
  const ekleSorgu = db.prepare(
    `INSERT INTO gece_kapanisi
       (id, baslangic, bitis, adisyonSayisi, ciroKurus, maliyetKurus, karKurus, nakitKurus, kartKurus, kapatanKullaniciId, zaman)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const hepsiSorgu = db.prepare(`SELECT * FROM gece_kapanisi ORDER BY zaman DESC`);

  return {
    ekle(kapanis) {
      ekleSorgu.run(
        kapanis.id,
        kapanis.baslangic,
        kapanis.bitis,
        kapanis.adisyonSayisi,
        kapanis.ciroKurus,
        kapanis.maliyetKurus,
        kapanis.karKurus,
        kapanis.nakitKurus,
        kapanis.kartKurus,
        kapanis.kapatanKullaniciId,
        kapanis.zaman,
      );
    },
    hepsi() {
      const satirlar = hepsiSorgu.all() as Record<string, unknown>[];
      return satirlar.map(satiriKapanisaCevir);
    },
  };
}
