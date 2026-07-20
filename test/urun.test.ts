import { describe, it, expect } from "vitest";
import {
  urunOlustur,
  urunDogrula,
  satisFiyatiGuncelle,
  urunuPasiflestir,
  urunuAktiflestir,
  stokEkle,
  stokDus,
  aktifUrunler,
  kategoriyeGoreUrunler,
  Urun,
} from "../src/cekirdek/urun";
import { AdisyonHatasi, HATA_KODU } from "../src/cekirdek/tipler";

function ornekGirdi(ozel: Partial<Urun> = {}) {
  return {
    id: ozel.id ?? "u1",
    ad: ozel.ad ?? "Efes",
    kategori: ozel.kategori ?? "Bira",
    satisFiyatiKurus: ozel.satisFiyatiKurus ?? 5000,
    maliyetKurus: ozel.maliyetKurus ?? 3000,
    stokAdedi: ozel.stokAdedi ?? 100,
  };
}

describe("urunOlustur / urunDogrula", () => {
  it("gecerli urunu aktif olarak olusturur", () => {
    const urun = urunOlustur(ornekGirdi());
    expect(urun.aktif).toBe(true);
    expect(urun.ad).toBe("Efes");
  });

  it("adi bos urunu reddeder", () => {
    expect(() => urunOlustur(ornekGirdi({ ad: "   " }))).toThrowError(AdisyonHatasi);
  });

  it("negatif fiyati reddeder", () => {
    expect(() => urunOlustur(ornekGirdi({ satisFiyatiKurus: -1 }))).toThrowError(AdisyonHatasi);
  });

  it("negatif stogu reddeder", () => {
    expect(() => urunOlustur(ornekGirdi({ stokAdedi: -5 }))).toThrowError(AdisyonHatasi);
  });
});

describe("fiyat ve pasiflestirme (silme yok)", () => {
  it("satis fiyatini gunceller, eskiyi bozmaz", () => {
    const urun = urunOlustur(ornekGirdi());
    const yeni = satisFiyatiGuncelle(urun, 6000);
    expect(yeni.satisFiyatiKurus).toBe(6000);
    expect(urun.satisFiyatiKurus).toBe(5000); // orijinal degismedi
  });

  it("urunu pasiflestirir ve tekrar aktiflestirir", () => {
    const urun = urunOlustur(ornekGirdi());
    const pasif = urunuPasiflestir(urun);
    expect(pasif.aktif).toBe(false);
    expect(urunuAktiflestir(pasif).aktif).toBe(true);
  });
});

describe("stok yonetimi", () => {
  it("stok ekler", () => {
    const urun = urunOlustur(ornekGirdi({ stokAdedi: 10 }));
    expect(stokEkle(urun, 5).stokAdedi).toBe(15);
  });

  it("stok duser", () => {
    const urun = urunOlustur(ornekGirdi({ stokAdedi: 10 }));
    expect(stokDus(urun, 4).stokAdedi).toBe(6);
  });

  it("yetersiz stokta anlamli hata verir", () => {
    const urun = urunOlustur(ornekGirdi({ stokAdedi: 3 }));
    try {
      stokDus(urun, 5);
      throw new Error("hata beklenmisti");
    } catch (hata) {
      expect(hata).toBeInstanceOf(AdisyonHatasi);
      expect((hata as AdisyonHatasi).kod).toBe(HATA_KODU.YETERSIZ_STOK);
    }
  });
});

describe("listeleme", () => {
  const urunler = [
    urunOlustur(ornekGirdi({ id: "u1", ad: "Efes", kategori: "Bira" })),
    urunuPasiflestir(urunOlustur(ornekGirdi({ id: "u2", ad: "Tuborg", kategori: "Bira" }))),
    urunOlustur(ornekGirdi({ id: "u3", ad: "Humus", kategori: "Meze" })),
  ];

  it("sadece aktif urunleri dondurur", () => {
    expect(aktifUrunler(urunler).map((u) => u.id)).toEqual(["u1", "u3"]);
  });

  it("kategoriye gore aktif urunleri dondurur", () => {
    expect(kategoriyeGoreUrunler(urunler, "Bira").map((u) => u.id)).toEqual(["u1"]);
  });
});
