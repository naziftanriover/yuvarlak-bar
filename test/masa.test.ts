import { describe, it, expect } from "vitest";
import {
  masaOlustur,
  masaAc,
  masaKapat,
  bosMasalar,
  doluMasalar,
  MASA_DURUMU,
} from "../src/cekirdek/masa";
import { AdisyonHatasi, HATA_KODU } from "../src/cekirdek/tipler";

describe("masaOlustur", () => {
  it("yeni masayi bos olarak olusturur", () => {
    const masa = masaOlustur({ id: "m1", ad: "Masa 1" });
    expect(masa.durum).toBe(MASA_DURUMU.BOS);
    expect(masa.acikAdisyonId).toBeNull();
  });

  it("adi bos masayi reddeder", () => {
    expect(() => masaOlustur({ id: "m1", ad: "  " })).toThrowError(AdisyonHatasi);
  });
});

describe("masaAc / masaKapat", () => {
  it("masaya adisyon acinca DOLU olur", () => {
    const masa = masaOlustur({ id: "m1", ad: "Masa 1" });
    const acik = masaAc(masa, "adisyon-1");
    expect(acik.durum).toBe(MASA_DURUMU.DOLU);
    expect(acik.acikAdisyonId).toBe("adisyon-1");
  });

  it("dolu masa tekrar acilamaz", () => {
    const masa = masaAc(masaOlustur({ id: "m1", ad: "Masa 1" }), "adisyon-1");
    try {
      masaAc(masa, "adisyon-2");
      throw new Error("hata beklenmisti");
    } catch (hata) {
      expect(hata).toBeInstanceOf(AdisyonHatasi);
      expect((hata as AdisyonHatasi).kod).toBe(HATA_KODU.MASA_DOLU);
    }
  });

  it("hesap kapatilinca masa tekrar BOS olur", () => {
    const acik = masaAc(masaOlustur({ id: "m1", ad: "Masa 1" }), "adisyon-1");
    const kapali = masaKapat(acik);
    expect(kapali.durum).toBe(MASA_DURUMU.BOS);
    expect(kapali.acikAdisyonId).toBeNull();
  });

  it("bos masa kapatilamaz", () => {
    const masa = masaOlustur({ id: "m1", ad: "Masa 1" });
    expect(() => masaKapat(masa)).toThrowError(AdisyonHatasi);
  });
});

describe("bos / dolu masa listeleme", () => {
  it("bos ve dolu masalari ayirir", () => {
    const masalar = [
      masaOlustur({ id: "m1", ad: "Masa 1" }),
      masaAc(masaOlustur({ id: "m2", ad: "Masa 2" }), "adisyon-1"),
      masaOlustur({ id: "m3", ad: "Masa 3" }),
    ];
    expect(bosMasalar(masalar).map((m) => m.id)).toEqual(["m1", "m3"]);
    expect(doluMasalar(masalar).map((m) => m.id)).toEqual(["m2"]);
  });
});
