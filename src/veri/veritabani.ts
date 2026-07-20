// Veritabani baglantisi ve semasi (SQLite - Node'un kendi surumu, dis bagimlilik yok).
// Depolar (kullaniciDeposu, urunDeposu, ...) bu baglantiyi kullanir.
//
// NOT: node:sqlite su an "deneysel" isaretli; API'yi tek yerde (burada) tuttugumuz
// icin ileride baska bir veritabanina gecmek gerekirse degisiklik bu katmanda kalir.

import type { DatabaseSync } from "node:sqlite";

// node:sqlite deneysel oldugu icin bazi paketleyiciler onu cozemez.
// Modulu dogrudan Node'dan aliyoruz (paketleyiciyi devre disi birakir).
const { DatabaseSync: DatabaseSyncSinifi } = process.getBuiltinModule("node:sqlite");

// Bellekte calisan test veritabani icin ozel yol.
export const BELLEK_VERITABANI = ":memory:";

// Tum tablolarin semasi. "IF NOT EXISTS" sayesinde tekrar acilista bozmaz.
const SEMA = `
CREATE TABLE IF NOT EXISTS kullanici (
  id             TEXT PRIMARY KEY,
  ad             TEXT NOT NULL,
  kullaniciAdi   TEXT NOT NULL UNIQUE,
  sifreHash      TEXT NOT NULL,
  rol            TEXT NOT NULL,
  aktif          INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS urun (
  id                TEXT PRIMARY KEY,
  ad                TEXT NOT NULL,
  kategori          TEXT NOT NULL,
  satisFiyatiKurus  INTEGER NOT NULL,
  maliyetKurus      INTEGER NOT NULL,
  stokAdedi         INTEGER NOT NULL,
  aktif             INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS masa (
  id             TEXT PRIMARY KEY,
  ad             TEXT NOT NULL,
  durum          TEXT NOT NULL,
  acikAdisyonId  TEXT
);

CREATE TABLE IF NOT EXISTS adisyon (
  id              TEXT PRIMARY KEY,
  masaId          TEXT NOT NULL,
  durum           TEXT NOT NULL,
  acanKullaniciId TEXT NOT NULL,
  acilisZamani    TEXT NOT NULL,
  kapanisZamani   TEXT
);

CREATE TABLE IF NOT EXISTS siparis_hareketi (
  id                 TEXT PRIMARY KEY,
  adisyonId          TEXT NOT NULL,
  urunId             TEXT NOT NULL,
  urunAdi            TEXT NOT NULL,
  adet               INTEGER NOT NULL,
  birimFiyatKurus    INTEGER NOT NULL,
  birimMaliyetKurus  INTEGER NOT NULL,
  tip                TEXT NOT NULL,
  sebep              TEXT,
  kullaniciId        TEXT NOT NULL,
  zaman              TEXT NOT NULL,
  FOREIGN KEY (adisyonId) REFERENCES adisyon(id)
);

CREATE TABLE IF NOT EXISTS odeme (
  id           TEXT PRIMARY KEY,
  adisyonId    TEXT NOT NULL,
  tutarKurus   INTEGER NOT NULL,
  yontem       TEXT NOT NULL,
  kullaniciId  TEXT NOT NULL,
  zaman        TEXT NOT NULL,
  FOREIGN KEY (adisyonId) REFERENCES adisyon(id)
);

CREATE TABLE IF NOT EXISTS denetim_kaydi (
  id           TEXT PRIMARY KEY,
  tur          TEXT NOT NULL,
  aciklama     TEXT NOT NULL,
  kullaniciId  TEXT NOT NULL,
  zaman        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gece_kapanisi (
  id                  TEXT PRIMARY KEY,
  baslangic           TEXT NOT NULL,
  bitis               TEXT NOT NULL,
  adisyonSayisi       INTEGER NOT NULL,
  ciroKurus           INTEGER NOT NULL,
  maliyetKurus        INTEGER NOT NULL,
  karKurus            INTEGER NOT NULL,
  nakitKurus          INTEGER NOT NULL,
  kartKurus           INTEGER NOT NULL,
  kapatanKullaniciId  TEXT NOT NULL,
  zaman               TEXT NOT NULL
);
`;

// Veritabanini acar, gerekli ayarlari ve semayi hazirlar.
export function veritabaniAc(yol: string): DatabaseSync {
  const db = new DatabaseSyncSinifi(yol);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SEMA);
  return db;
}
