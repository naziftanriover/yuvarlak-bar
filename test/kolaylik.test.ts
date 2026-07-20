import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import {
  veritabaniAc,
  BELLEK_VERITABANI,
  urunDeposuOlustur,
  masaDeposuOlustur,
  adisyonDeposuOlustur,
  denetimDeposuOlustur,
} from "../src/veri/index";
import { ROL, MASA_DURUMU, AdisyonHatasi, HATA_KODU } from "../src/cekirdek/index";
import {
  urunServisiOlustur,
  masaServisiOlustur,
  adisyonServisiOlustur,
  Saglayicilar,
  Aktor,
} from "../src/servis/index";

const patron: Aktor = { kullaniciId: "p1", rol: ROL.PATRON };
const garson: Aktor = { kullaniciId: "g1", rol: ROL.GARSON };

function testSaglayici(): Saglayicilar {
  let s = 0;
  return { yeniKimlik: () => `id-${++s}`, simdiIso: () => "2026-07-18T20:00:00Z", simdiMs: () => 1_000_000 };
}

let db: DatabaseSync;
let masaS: ReturnType<typeof masaServisiOlustur>;
let adisyonS: ReturnType<typeof adisyonServisiOlustur>;
let masaDepo: ReturnType<typeof masaDeposuOlustur>;

beforeEach(() => {
  db = veritabaniAc(BELLEK_VERITABANI);
  const urunDepo = urunDeposuOlustur(db);
  masaDepo = masaDeposuOlustur(db);
  const adisyonDepo = adisyonDeposuOlustur(db);
  const denetimDepo = denetimDeposuOlustur(db);
  const saglayici = testSaglayici();
  masaS = masaServisiOlustur(masaDepo);
  adisyonS = adisyonServisiOlustur(adisyonDepo, masaDepo, urunDepo, saglayici);

  masaS.ekle(patron, { id: "m1", ad: "Masa 1" });
  masaS.ekle(patron, { id: "m2", ad: "Masa 2" });
});

describe("masa adi degistirme", () => {
  it("patron masanin adini degistirir", () => {
    const yeni = masaS.adDegistir(patron, "m1", "Bahçe 1");
    expect(yeni.ad).toBe("Bahçe 1");
    expect(masaDepo.idIleGetir("m1")!.ad).toBe("Bahçe 1");
  });

  it("garson masa adini degistiremez (yetkisiz)", () => {
    expect(() => masaS.adDegistir(garson, "m1", "X")).toThrowError(AdisyonHatasi);
  });

  it("bos ad reddedilir", () => {
    expect(() => masaS.adDegistir(patron, "m1", "  ")).toThrowError(AdisyonHatasi);
  });

  it("olmayan masa BULUNAMADI verir", () => {
    try {
      masaS.adDegistir(patron, "yok", "X");
      throw new Error("hata beklenmisti");
    } catch (hata) {
      expect((hata as AdisyonHatasi).kod).toBe(HATA_KODU.BULUNAMADI);
    }
  });
});

describe("masa tasima", () => {
  it("acik adisyonu bos masaya tasir", () => {
    const adisyon = adisyonS.masayaAdisyonAc(garson, "m1");
    const tasinmis = adisyonS.masaTasi(garson, adisyon.id, "m2");

    expect(tasinmis.masaId).toBe("m2");
    expect(masaDepo.idIleGetir("m1")!.durum).toBe(MASA_DURUMU.BOS);
    expect(masaDepo.idIleGetir("m2")!.durum).toBe(MASA_DURUMU.DOLU);
    expect(masaDepo.idIleGetir("m2")!.acikAdisyonId).toBe(adisyon.id);
  });

  it("dolu masaya tasinamaz", () => {
    const a1 = adisyonS.masayaAdisyonAc(garson, "m1");
    adisyonS.masayaAdisyonAc(garson, "m2"); // m2 dolu
    try {
      adisyonS.masaTasi(garson, a1.id, "m2");
      throw new Error("hata beklenmisti");
    } catch (hata) {
      expect((hata as AdisyonHatasi).kod).toBe(HATA_KODU.MASA_DOLU);
    }
  });

  it("olmayan hedef masa BULUNAMADI verir", () => {
    const a1 = adisyonS.masayaAdisyonAc(garson, "m1");
    expect(() => adisyonS.masaTasi(garson, a1.id, "yok")).toThrowError(AdisyonHatasi);
  });
});
