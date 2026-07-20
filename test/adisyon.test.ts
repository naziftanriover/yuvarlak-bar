import { describe, it, expect } from "vitest";
import {
  siparisHareketiDogrula,
  iptalHareketiOlustur,
  ciroHesapla,
  maliyetHesapla,
  karHesapla,
  odenenToplam,
  kalanBakiye,
  adisyonSatirlari,
  adisyonOzeti,
  adisyonAc,
  adisyonKapat,
  ADISYON_DURUMU,
} from "../src/cekirdek/adisyon";
import {
  SiparisHareketi,
  Odeme,
  AdisyonHatasi,
  HAREKET_TIPI,
  ODEME_YONTEMI,
  HATA_KODU,
} from "../src/cekirdek/tipler";

// Testlerde tekrar tekrar hareket kurmamak icin kucuk yardimci.
function ekle(
  ozel: Partial<SiparisHareketi> & Pick<SiparisHareketi, "urunId" | "adet" | "birimFiyatKurus">,
): SiparisHareketi {
  return {
    id: ozel.id ?? "h1",
    urunAdi: ozel.urunAdi ?? "Efes",
    birimMaliyetKurus: ozel.birimMaliyetKurus ?? 0,
    tip: HAREKET_TIPI.EKLE,
    kullaniciId: ozel.kullaniciId ?? "garson-1",
    zaman: ozel.zaman ?? "2026-07-18T20:00:00Z",
    ...ozel,
  };
}

describe("siparisHareketiDogrula", () => {
  it("gecerli EKLE hareketini kabul eder", () => {
    expect(() => siparisHareketiDogrula(ekle({ urunId: "u1", adet: 2, birimFiyatKurus: 5000 }))).not.toThrow();
  });

  it("adet sifir veya negatifse hata verir", () => {
    expect(() => siparisHareketiDogrula(ekle({ urunId: "u1", adet: 0, birimFiyatKurus: 5000 }))).toThrowError(
      AdisyonHatasi,
    );
  });

  it("adet tam sayi degilse hata verir", () => {
    expect(() => siparisHareketiDogrula(ekle({ urunId: "u1", adet: 1.5, birimFiyatKurus: 5000 }))).toThrowError(
      AdisyonHatasi,
    );
  });

  it("negatif fiyata izin vermez", () => {
    expect(() => siparisHareketiDogrula(ekle({ urunId: "u1", adet: 1, birimFiyatKurus: -1 }))).toThrowError(
      AdisyonHatasi,
    );
  });

  it("IPTAL hareketi sebep olmadan reddedilir", () => {
    const iptal = ekle({ urunId: "u1", adet: 1, birimFiyatKurus: 5000, tip: HAREKET_TIPI.IPTAL });
    try {
      siparisHareketiDogrula(iptal);
      throw new Error("hata beklenmisti");
    } catch (hata) {
      expect(hata).toBeInstanceOf(AdisyonHatasi);
      expect((hata as AdisyonHatasi).kod).toBe(HATA_KODU.IPTAL_SEBEBI_GEREKLI);
    }
  });
});

describe("ciro / maliyet / kar hesabi", () => {
  const hareketler: SiparisHareketi[] = [
    ekle({ id: "h1", urunId: "bira", urunAdi: "Efes", adet: 2, birimFiyatKurus: 5000, birimMaliyetKurus: 3000 }),
    ekle({ id: "h2", urunId: "meze", urunAdi: "Humus", adet: 1, birimFiyatKurus: 8000, birimMaliyetKurus: 3500 }),
  ];

  it("ciroyu dogru toplar", () => {
    // 2*5000 + 1*8000 = 18000
    expect(ciroHesapla(hareketler)).toBe(18000);
  });

  it("maliyeti dogru toplar", () => {
    // 2*3000 + 1*3500 = 9500
    expect(maliyetHesapla(hareketler)).toBe(9500);
  });

  it("kar = ciro - maliyet", () => {
    expect(karHesapla(hareketler)).toBe(18000 - 9500);
  });
});

describe("iptalHareketiOlustur (silme yok, sebepli iptal)", () => {
  const mevcut: SiparisHareketi[] = [
    ekle({ id: "h1", urunId: "bira", urunAdi: "Efes", adet: 3, birimFiyatKurus: 5000, birimMaliyetKurus: 3000 }),
  ];

  it("gecerli iptal hareketi uretir ve ciroyu dusurur", () => {
    const iptal = iptalHareketiOlustur(mevcut, {
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
    expect(iptal.tip).toBe(HAREKET_TIPI.IPTAL);

    const hepsi = [...mevcut, iptal];
    // Kalan net: 2 bira -> 2*5000 = 10000
    expect(ciroHesapla(hepsi)).toBe(10000);
  });

  it("var olandan fazla iptal edilemez", () => {
    try {
      iptalHareketiOlustur(mevcut, {
        id: "h2",
        urunId: "bira",
        urunAdi: "Efes",
        adet: 5, // sadece 3 var
        birimFiyatKurus: 5000,
        birimMaliyetKurus: 3000,
        sebep: "yanlislikla",
        kullaniciId: "mudur-1",
        zaman: "2026-07-18T20:05:00Z",
      });
      throw new Error("hata beklenmisti");
    } catch (hata) {
      expect(hata).toBeInstanceOf(AdisyonHatasi);
      expect((hata as AdisyonHatasi).kod).toBe(HATA_KODU.FAZLA_IPTAL);
    }
  });

  it("sebep bos ise iptal olmaz", () => {
    expect(() =>
      iptalHareketiOlustur(mevcut, {
        id: "h2",
        urunId: "bira",
        urunAdi: "Efes",
        adet: 1,
        birimFiyatKurus: 5000,
        birimMaliyetKurus: 3000,
        sebep: "   ",
        kullaniciId: "mudur-1",
        zaman: "2026-07-18T20:05:00Z",
      }),
    ).toThrowError(AdisyonHatasi);
  });
});

describe("adisyonSatirlari", () => {
  it("iptal edilmis satiri gizler, kalan net adedi gosterir", () => {
    const hareketler: SiparisHareketi[] = [
      ekle({ id: "h1", urunId: "bira", urunAdi: "Efes", adet: 3, birimFiyatKurus: 5000 }),
      ekle({
        id: "h2",
        urunId: "bira",
        urunAdi: "Efes",
        adet: 1,
        birimFiyatKurus: 5000,
        tip: HAREKET_TIPI.IPTAL,
        sebep: "iade",
      }),
    ];
    const satirlar = adisyonSatirlari(hareketler);
    expect(satirlar).toHaveLength(1);
    expect(satirlar[0]!.netAdet).toBe(2);
    expect(satirlar[0]!.araToplamKurus).toBe(10000);
  });

  it("tamamen iptal edilmis urun satirlarda gorunmez", () => {
    const hareketler: SiparisHareketi[] = [
      ekle({ id: "h1", urunId: "bira", urunAdi: "Efes", adet: 1, birimFiyatKurus: 5000 }),
      ekle({
        id: "h2",
        urunId: "bira",
        urunAdi: "Efes",
        adet: 1,
        birimFiyatKurus: 5000,
        tip: HAREKET_TIPI.IPTAL,
        sebep: "iade",
      }),
    ];
    expect(adisyonSatirlari(hareketler)).toHaveLength(0);
  });
});

describe("odeme ve bakiye", () => {
  const hareketler: SiparisHareketi[] = [
    ekle({ id: "h1", urunId: "bira", urunAdi: "Efes", adet: 2, birimFiyatKurus: 5000, birimMaliyetKurus: 3000 }),
  ];

  it("odenen toplami hesaplar", () => {
    const odemeler: Odeme[] = [
      { id: "o1", tutarKurus: 6000, yontem: ODEME_YONTEMI.NAKIT, kullaniciId: "mudur-1", zaman: "2026-07-18T21:00:00Z" },
      { id: "o2", tutarKurus: 2000, yontem: ODEME_YONTEMI.KART, kullaniciId: "mudur-1", zaman: "2026-07-18T21:01:00Z" },
    ];
    expect(odenenToplam(odemeler)).toBe(8000);
  });

  it("kalan bakiye = ciro - odenen", () => {
    const odemeler: Odeme[] = [
      { id: "o1", tutarKurus: 4000, yontem: ODEME_YONTEMI.NAKIT, kullaniciId: "mudur-1", zaman: "2026-07-18T21:00:00Z" },
    ];
    // ciro 10000, odenen 4000 -> kalan 6000
    expect(kalanBakiye(hareketler, odemeler)).toBe(6000);
  });

  it("negatif odeme tutari reddedilir", () => {
    const odemeler: Odeme[] = [
      { id: "o1", tutarKurus: -100, yontem: ODEME_YONTEMI.NAKIT, kullaniciId: "mudur-1", zaman: "2026-07-18T21:00:00Z" },
    ];
    expect(() => odenenToplam(odemeler)).toThrowError(AdisyonHatasi);
  });
});

describe("adisyonOzeti", () => {
  it("tum ozeti tek seferde dogru verir", () => {
    const hareketler: SiparisHareketi[] = [
      ekle({ id: "h1", urunId: "bira", urunAdi: "Efes", adet: 2, birimFiyatKurus: 5000, birimMaliyetKurus: 3000 }),
      ekle({ id: "h2", urunId: "meze", urunAdi: "Humus", adet: 1, birimFiyatKurus: 8000, birimMaliyetKurus: 3500 }),
    ];
    const odemeler: Odeme[] = [
      { id: "o1", tutarKurus: 10000, yontem: ODEME_YONTEMI.NAKIT, kullaniciId: "mudur-1", zaman: "2026-07-18T21:00:00Z" },
    ];
    const ozet = adisyonOzeti(hareketler, odemeler);
    expect(ozet.ciroKurus).toBe(18000);
    expect(ozet.maliyetKurus).toBe(9500);
    expect(ozet.karKurus).toBe(8500);
    expect(ozet.odenenKurus).toBe(10000);
    expect(ozet.kalanKurus).toBe(8000);
    expect(ozet.satirlar).toHaveLength(2);
  });
});

describe("adisyonAc / adisyonKapat", () => {
  const acGirdi = {
    id: "a1",
    masaId: "m1",
    acanKullaniciId: "garson-1",
    zaman: "2026-07-18T20:00:00Z",
  };

  it("yeni adisyonu ACIK durumda acar", () => {
    const adisyon = adisyonAc(acGirdi);
    expect(adisyon.durum).toBe(ADISYON_DURUMU.ACIK);
    expect(adisyon.kapanisZamani).toBeNull();
  });

  it("masasi olmayan adisyonu reddeder", () => {
    expect(() => adisyonAc({ ...acGirdi, masaId: "" })).toThrowError(AdisyonHatasi);
  });

  it("adisyonu kapatir ve kapanis zamanini yazar", () => {
    const acik = adisyonAc(acGirdi);
    const kapali = adisyonKapat(acik, "2026-07-18T22:00:00Z");
    expect(kapali.durum).toBe(ADISYON_DURUMU.KAPALI);
    expect(kapali.kapanisZamani).toBe("2026-07-18T22:00:00Z");
  });

  it("zaten kapali adisyon tekrar kapatilamaz", () => {
    const kapali = adisyonKapat(adisyonAc(acGirdi), "2026-07-18T22:00:00Z");
    try {
      adisyonKapat(kapali, "2026-07-18T23:00:00Z");
      throw new Error("hata beklenmisti");
    } catch (hata) {
      expect(hata).toBeInstanceOf(AdisyonHatasi);
      expect((hata as AdisyonHatasi).kod).toBe(HATA_KODU.ADISYON_ZATEN_KAPALI);
    }
  });
});
