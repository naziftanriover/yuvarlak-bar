// Adisyon saklama modulu (depo).
// Adisyonun kendisini, siparis hareketlerini ve odemelerini tutar.
// Hareketler ve odemeler bir adisyona baglidir (adisyonId ile).

import type { DatabaseSync } from "node:sqlite";
import type {
  Adisyon,
  AdisyonDurumu,
  SiparisHareketi,
  HareketTipi,
  Odeme,
  OdemeYontemi,
} from "../cekirdek/index";

export interface AdisyonDeposu {
  adisyonEkle(adisyon: Adisyon): void;
  adisyonGuncelle(adisyon: Adisyon): void;
  adisyonGetir(id: string): Adisyon | null;
  // Bir siparis hareketini (ekle veya iptal) adisyona baglayarak saklar.
  hareketEkle(adisyonId: string, hareket: SiparisHareketi): void;
  hareketleriGetir(adisyonId: string): SiparisHareketi[];
  // Bir odemeyi adisyona baglayarak saklar.
  odemeEkle(adisyonId: string, odeme: Odeme): void;
  odemeleriGetir(adisyonId: string): Odeme[];
  // Rapor icin: belirli bir zaman araliginda KAPANMIS adisyonlar.
  kapananAdisyonlar(baslangicIso: string, bitisIso: string): Adisyon[];
  // Denetim icin: belirli bir araliktaki tum IPTAL hareketleri.
  iptalHareketleriAralik(baslangicIso: string, bitisIso: string): SiparisHareketi[];
}

function satiriAdisyonaCevir(satir: Record<string, unknown>): Adisyon {
  const kapanis = satir.kapanisZamani;
  return {
    id: String(satir.id),
    masaId: String(satir.masaId),
    durum: String(satir.durum) as AdisyonDurumu,
    acanKullaniciId: String(satir.acanKullaniciId),
    acilisZamani: String(satir.acilisZamani),
    kapanisZamani: kapanis === null || kapanis === undefined ? null : String(kapanis),
  };
}

function satiriHareketeCevir(satir: Record<string, unknown>): SiparisHareketi {
  const sebep = satir.sebep;
  return {
    id: String(satir.id),
    urunId: String(satir.urunId),
    urunAdi: String(satir.urunAdi),
    adet: Number(satir.adet),
    birimFiyatKurus: Number(satir.birimFiyatKurus),
    birimMaliyetKurus: Number(satir.birimMaliyetKurus),
    tip: String(satir.tip) as HareketTipi,
    sebep: sebep === null || sebep === undefined ? undefined : String(sebep),
    kullaniciId: String(satir.kullaniciId),
    zaman: String(satir.zaman),
  };
}

function satiriOdemeyeCevir(satir: Record<string, unknown>): Odeme {
  return {
    id: String(satir.id),
    tutarKurus: Number(satir.tutarKurus),
    yontem: String(satir.yontem) as OdemeYontemi,
    kullaniciId: String(satir.kullaniciId),
    zaman: String(satir.zaman),
  };
}

export function adisyonDeposuOlustur(db: DatabaseSync): AdisyonDeposu {
  const adisyonEkleSorgu = db.prepare(
    `INSERT INTO adisyon (id, masaId, durum, acanKullaniciId, acilisZamani, kapanisZamani)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const adisyonGuncelleSorgu = db.prepare(
    `UPDATE adisyon SET masaId = ?, durum = ?, acanKullaniciId = ?, acilisZamani = ?, kapanisZamani = ?
     WHERE id = ?`,
  );
  const adisyonGetirSorgu = db.prepare(`SELECT * FROM adisyon WHERE id = ?`);

  const hareketEkleSorgu = db.prepare(
    `INSERT INTO siparis_hareketi
       (id, adisyonId, urunId, urunAdi, adet, birimFiyatKurus, birimMaliyetKurus, tip, sebep, kullaniciId, zaman)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const hareketleriGetirSorgu = db.prepare(
    `SELECT * FROM siparis_hareketi WHERE adisyonId = ? ORDER BY zaman, id`,
  );

  const odemeEkleSorgu = db.prepare(
    `INSERT INTO odeme (id, adisyonId, tutarKurus, yontem, kullaniciId, zaman)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const odemeleriGetirSorgu = db.prepare(
    `SELECT * FROM odeme WHERE adisyonId = ? ORDER BY zaman, id`,
  );
  const kapananlarSorgu = db.prepare(
    `SELECT * FROM adisyon
     WHERE durum = 'KAPALI' AND kapanisZamani >= ? AND kapanisZamani <= ?
     ORDER BY kapanisZamani`,
  );
  const iptallerSorgu = db.prepare(
    `SELECT * FROM siparis_hareketi
     WHERE tip = 'IPTAL' AND zaman >= ? AND zaman <= ?
     ORDER BY zaman`,
  );

  return {
    adisyonEkle(adisyon) {
      adisyonEkleSorgu.run(
        adisyon.id,
        adisyon.masaId,
        adisyon.durum,
        adisyon.acanKullaniciId,
        adisyon.acilisZamani,
        adisyon.kapanisZamani,
      );
    },
    adisyonGuncelle(adisyon) {
      adisyonGuncelleSorgu.run(
        adisyon.masaId,
        adisyon.durum,
        adisyon.acanKullaniciId,
        adisyon.acilisZamani,
        adisyon.kapanisZamani,
        adisyon.id,
      );
    },
    adisyonGetir(id) {
      const satir = adisyonGetirSorgu.get(id) as Record<string, unknown> | undefined;
      return satir ? satiriAdisyonaCevir(satir) : null;
    },
    hareketEkle(adisyonId, hareket) {
      hareketEkleSorgu.run(
        hareket.id,
        adisyonId,
        hareket.urunId,
        hareket.urunAdi,
        hareket.adet,
        hareket.birimFiyatKurus,
        hareket.birimMaliyetKurus,
        hareket.tip,
        hareket.sebep ?? null,
        hareket.kullaniciId,
        hareket.zaman,
      );
    },
    hareketleriGetir(adisyonId) {
      const satirlar = hareketleriGetirSorgu.all(adisyonId) as Record<string, unknown>[];
      return satirlar.map(satiriHareketeCevir);
    },
    odemeEkle(adisyonId, odeme) {
      odemeEkleSorgu.run(
        odeme.id,
        adisyonId,
        odeme.tutarKurus,
        odeme.yontem,
        odeme.kullaniciId,
        odeme.zaman,
      );
    },
    odemeleriGetir(adisyonId) {
      const satirlar = odemeleriGetirSorgu.all(adisyonId) as Record<string, unknown>[];
      return satirlar.map(satiriOdemeyeCevir);
    },
    kapananAdisyonlar(baslangicIso, bitisIso) {
      const satirlar = kapananlarSorgu.all(baslangicIso, bitisIso) as Record<string, unknown>[];
      return satirlar.map(satiriAdisyonaCevir);
    },
    iptalHareketleriAralik(baslangicIso, bitisIso) {
      const satirlar = iptallerSorgu.all(baslangicIso, bitisIso) as Record<string, unknown>[];
      return satirlar.map(satiriHareketeCevir);
    },
  };
}
