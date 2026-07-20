import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import {
  veritabaniAc,
  BELLEK_VERITABANI,
  kullaniciDeposuOlustur,
  urunDeposuOlustur,
  masaDeposuOlustur,
  adisyonDeposuOlustur,
  denetimDeposuOlustur,
} from "../src/veri/index";
import { kullaniciOlustur, ROL, ODEME_YONTEMI, AdisyonHatasi, HATA_KODU } from "../src/cekirdek/index";
import {
  kimlikServisiOlustur,
  urunServisiOlustur,
  masaServisiOlustur,
  adisyonServisiOlustur,
  Saglayicilar,
  Aktor,
} from "../src/servis/index";

const TOKEN_SIR = "test-sunucu-gizli-anahtari";
const patron: Aktor = { kullaniciId: "p1", rol: ROL.PATRON };
const mudur: Aktor = { kullaniciId: "md1", rol: ROL.MUDUR };
const garson: Aktor = { kullaniciId: "g1", rol: ROL.GARSON };

// Testte tahmin edilebilir kimlik ve zaman.
function testSaglayici(): Saglayicilar {
  let sayac = 0;
  return {
    yeniKimlik: () => `id-${++sayac}`,
    simdiIso: () => "2026-07-18T20:00:00Z",
    simdiMs: () => 1_000_000,
  };
}

let db: DatabaseSync;
let kullaniciDepo: ReturnType<typeof kullaniciDeposuOlustur>;
let urunDepo: ReturnType<typeof urunDeposuOlustur>;
let masaDepo: ReturnType<typeof masaDeposuOlustur>;
let adisyonDepo: ReturnType<typeof adisyonDeposuOlustur>;
let denetimDepo: ReturnType<typeof denetimDeposuOlustur>;
let saglayici: Saglayicilar;

beforeEach(() => {
  db = veritabaniAc(BELLEK_VERITABANI);
  kullaniciDepo = kullaniciDeposuOlustur(db);
  urunDepo = urunDeposuOlustur(db);
  masaDepo = masaDeposuOlustur(db);
  adisyonDepo = adisyonDeposuOlustur(db);
  denetimDepo = denetimDeposuOlustur(db);
  saglayici = testSaglayici();
});

describe("kimlikServisi - giris", () => {
  it("dogru bilgiyle token dondurur, yanlis bilgiyle hata verir", async () => {
    const kullanici = await kullaniciOlustur({
      id: "md1",
      ad: "Veli",
      kullaniciAdi: "veli",
      sifre: "gizli12345",
      rol: ROL.MUDUR,
    });
    kullaniciDepo.ekle(kullanici);
    const servis = kimlikServisiOlustur(kullaniciDepo, saglayici, TOKEN_SIR, 60_000);

    const sonuc = await servis.giris("veli", "gizli12345");
    expect(sonuc.token).toContain(".");
    expect(sonuc.kullanici).not.toHaveProperty("sifreHash");

    await expect(servis.giris("veli", "yanlis")).rejects.toBeInstanceOf(AdisyonHatasi);
    await expect(servis.giris("yok", "gizli12345")).rejects.toBeInstanceOf(AdisyonHatasi);
  });
});

describe("urunServisi - yetki", () => {
  it("garson urun ekleyemez, patron ekleyebilir", () => {
    const servis = urunServisiOlustur(urunDepo, denetimDepo, saglayici);
    const girdi = {
      id: "u1",
      ad: "Efes",
      kategori: "Bira",
      satisFiyatiKurus: 5000,
      maliyetKurus: 3000,
      stokAdedi: 100,
    };

    try {
      servis.ekle(garson, girdi);
      throw new Error("hata beklenmisti");
    } catch (hata) {
      expect((hata as AdisyonHatasi).kod).toBe(HATA_KODU.YETKISIZ);
    }

    const urun = servis.ekle(patron, girdi);
    expect(urun.aktif).toBe(true);
    expect(servis.listele()).toHaveLength(1);
  });
});

describe("adisyonServisi - tam satis akisi ve yetkiler", () => {
  function hazirla() {
    urunServisiOlustur(urunDepo, denetimDepo, saglayici).ekle(patron, {
      id: "bira",
      ad: "Efes",
      kategori: "Bira",
      satisFiyatiKurus: 5000,
      maliyetKurus: 3000,
      stokAdedi: 100,
    });
    masaServisiOlustur(masaDepo).ekle(patron, { id: "m1", ad: "Masa 1" });
    return adisyonServisiOlustur(adisyonDepo, masaDepo, urunDepo, saglayici);
  }

  it("garson masa acar, siparis girer; ozet dogru hesaplanir", () => {
    const servis = hazirla();
    const adisyon = servis.masayaAdisyonAc(garson, "m1");
    servis.siparisEkle(garson, adisyon.id, "bira", 3);

    const ozet = servis.ozet(garson, adisyon.id);
    expect(ozet.ciroKurus).toBe(15000);
    expect(ozet.karKurus).toBe(6000); // 3 * (5000-3000)
    expect(masaDepo.idIleGetir("m1")!.durum).toBe("DOLU");
  });

  it("garson odeme alamaz, mudur alabilir", () => {
    const servis = hazirla();
    const adisyon = servis.masayaAdisyonAc(garson, "m1");
    servis.siparisEkle(garson, adisyon.id, "bira", 2);

    expect(() => servis.odemeAl(garson, adisyon.id, 10000, ODEME_YONTEMI.NAKIT)).toThrowError(
      AdisyonHatasi,
    );
    const odeme = servis.odemeAl(mudur, adisyon.id, 10000, ODEME_YONTEMI.NAKIT);
    expect(odeme.tutarKurus).toBe(10000);

    const ozet = servis.ozet(mudur, adisyon.id);
    expect(ozet.kalanKurus).toBe(0);
  });

  it("iptal kayit olarak eklenir ve ciroyu dusurur (silme yok)", () => {
    const servis = hazirla();
    const adisyon = servis.masayaAdisyonAc(garson, "m1");
    servis.siparisEkle(garson, adisyon.id, "bira", 3);
    servis.siparisIptalEt(garson, adisyon.id, "bira", 1, "Musteri vazgecti");

    const ozet = servis.ozet(garson, adisyon.id);
    expect(ozet.ciroKurus).toBe(10000); // 2 bira kaldi
    // hareket sayisi 2 (ekle + iptal), iptal silinmedi
    expect(adisyonDepo.hareketleriGetir(adisyon.id)).toHaveLength(2);
  });

  it("hesabi mudur kapatir, masa tekrar bos olur; kapali adisyona siparis girilemez", () => {
    const servis = hazirla();
    const adisyon = servis.masayaAdisyonAc(garson, "m1");
    servis.siparisEkle(garson, adisyon.id, "bira", 1);

    expect(() => servis.hesabiKapat(garson, adisyon.id)).toThrowError(AdisyonHatasi); // garson yetkisiz
    servis.hesabiKapat(mudur, adisyon.id);
    expect(masaDepo.idIleGetir("m1")!.durum).toBe("BOS");

    // kapali adisyona siparis eklenemez
    try {
      servis.siparisEkle(garson, adisyon.id, "bira", 1);
      throw new Error("hata beklenmisti");
    } catch (hata) {
      expect((hata as AdisyonHatasi).kod).toBe(HATA_KODU.GECERSIZ_ADISYON);
    }
  });

  it("dolu masaya ikinci adisyon acilamaz", () => {
    const servis = hazirla();
    servis.masayaAdisyonAc(garson, "m1");
    try {
      servis.masayaAdisyonAc(garson, "m1");
      throw new Error("hata beklenmisti");
    } catch (hata) {
      expect((hata as AdisyonHatasi).kod).toBe(HATA_KODU.MASA_DOLU);
    }
  });
});
