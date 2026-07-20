import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import {
  veritabaniAc,
  BELLEK_VERITABANI,
  kullaniciDeposuOlustur,
  urunDeposuOlustur,
  masaDeposuOlustur,
  adisyonDeposuOlustur,
} from "../src/veri/index";
import { kullaniciOlustur, ROL } from "../src/cekirdek/kullanici";
import { urunOlustur, urunuPasiflestir } from "../src/cekirdek/urun";
import { masaOlustur, masaAc, MASA_DURUMU } from "../src/cekirdek/masa";
import {
  adisyonAc,
  adisyonKapat,
  iptalHareketiOlustur,
  adisyonOzeti,
  HAREKET_TIPI,
  ODEME_YONTEMI,
  SiparisHareketi,
  Odeme,
} from "../src/cekirdek/index";

let db: DatabaseSync;

beforeEach(() => {
  // Her test icin temiz, bellekte calisan bir veritabani.
  db = veritabaniAc(BELLEK_VERITABANI);
});

describe("kullaniciDeposu", () => {
  it("kullaniciyi kaydeder ve geri getirir (sifre hash korunur)", async () => {
    const depo = kullaniciDeposuOlustur(db);
    const kullanici = await kullaniciOlustur({
      id: "k1",
      ad: "Ali",
      kullaniciAdi: "ali",
      sifre: "gizli12345",
      rol: ROL.MUDUR,
    });
    depo.ekle(kullanici);

    const getirilen = depo.kullaniciAdiylaGetir("ali");
    expect(getirilen).not.toBeNull();
    expect(getirilen!.rol).toBe(ROL.MUDUR);
    expect(getirilen!.aktif).toBe(true);
    expect(getirilen!.sifreHash).toBe(kullanici.sifreHash);
  });

  it("olmayan kullanicida null doner", () => {
    const depo = kullaniciDeposuOlustur(db);
    expect(depo.idIleGetir("yok")).toBeNull();
  });
});

describe("urunDeposu", () => {
  it("urunu kaydeder, gunceller ve pasiflestirmeyi saklar", () => {
    const depo = urunDeposuOlustur(db);
    const urun = urunOlustur({
      id: "u1",
      ad: "Efes",
      kategori: "Bira",
      satisFiyatiKurus: 5000,
      maliyetKurus: 3000,
      stokAdedi: 100,
    });
    depo.ekle(urun);

    const getirilen = depo.idIleGetir("u1");
    expect(getirilen!.satisFiyatiKurus).toBe(5000);
    expect(getirilen!.aktif).toBe(true);

    depo.guncelle(urunuPasiflestir(getirilen!));
    expect(depo.idIleGetir("u1")!.aktif).toBe(false);
  });
});

describe("masaDeposu", () => {
  it("masayi kaydeder ve durum degisimini saklar", () => {
    const depo = masaDeposuOlustur(db);
    const masa = masaOlustur({ id: "m1", ad: "Masa 1" });
    depo.ekle(masa);
    expect(depo.idIleGetir("m1")!.durum).toBe(MASA_DURUMU.BOS);

    depo.guncelle(masaAc(masa, "a1"));
    const dolu = depo.idIleGetir("m1")!;
    expect(dolu.durum).toBe(MASA_DURUMU.DOLU);
    expect(dolu.acikAdisyonId).toBe("a1");
  });
});

describe("adisyonDeposu - tam akis", () => {
  it("adisyon + hareketler + odeme saklanir, ozet dogru hesaplanir", () => {
    const depo = adisyonDeposuOlustur(db);

    const adisyon = adisyonAc({
      id: "a1",
      masaId: "m1",
      acanKullaniciId: "garson-1",
      zaman: "2026-07-18T20:00:00Z",
    });
    depo.adisyonEkle(adisyon);

    const ekle: SiparisHareketi = {
      id: "h1",
      urunId: "bira",
      urunAdi: "Efes",
      adet: 3,
      birimFiyatKurus: 5000,
      birimMaliyetKurus: 3000,
      tip: HAREKET_TIPI.EKLE,
      kullaniciId: "garson-1",
      zaman: "2026-07-18T20:01:00Z",
    };
    depo.hareketEkle("a1", ekle);

    // 1 bira iptal (silme yok, kayit olarak eklenir)
    const iptal = iptalHareketiOlustur([ekle], {
      id: "h2",
      urunId: "bira",
      urunAdi: "Efes",
      adet: 1,
      birimFiyatKurus: 5000,
      birimMaliyetKurus: 3000,
      sebep: "Musteri vazgecti",
      kullaniciId: "mudur-1",
      zaman: "2026-07-18T20:05:00Z",
    });
    depo.hareketEkle("a1", iptal);

    const odeme: Odeme = {
      id: "o1",
      tutarKurus: 4000,
      yontem: ODEME_YONTEMI.NAKIT,
      kullaniciId: "mudur-1",
      zaman: "2026-07-18T21:00:00Z",
    };
    depo.odemeEkle("a1", odeme);

    // Veritabanindan geri oku
    const hareketler = depo.hareketleriGetir("a1");
    const odemeler = depo.odemeleriGetir("a1");
    expect(hareketler).toHaveLength(2); // iptal de kayit olarak duruyor
    expect(odemeler).toHaveLength(1);

    const ozet = adisyonOzeti(hareketler, odemeler);
    // net 2 bira -> ciro 10000, maliyet 6000, kar 4000, odenen 4000, kalan 6000
    expect(ozet.ciroKurus).toBe(10000);
    expect(ozet.karKurus).toBe(4000);
    expect(ozet.kalanKurus).toBe(6000);

    // Iptal kaydinin sebebi korunmus mu?
    const iptalKaydi = hareketler.find((h) => h.tip === HAREKET_TIPI.IPTAL);
    expect(iptalKaydi!.sebep).toBe("Musteri vazgecti");
  });

  it("adisyonu kapatinca durum ve kapanis zamani saklanir", () => {
    const depo = adisyonDeposuOlustur(db);
    const adisyon = adisyonAc({
      id: "a2",
      masaId: "m1",
      acanKullaniciId: "garson-1",
      zaman: "2026-07-18T20:00:00Z",
    });
    depo.adisyonEkle(adisyon);
    depo.adisyonGuncelle(adisyonKapat(adisyon, "2026-07-18T22:00:00Z"));

    const getirilen = depo.adisyonGetir("a2");
    expect(getirilen!.durum).toBe("KAPALI");
    expect(getirilen!.kapanisZamani).toBe("2026-07-18T22:00:00Z");
  });
});
