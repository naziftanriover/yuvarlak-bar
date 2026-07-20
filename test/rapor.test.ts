import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import {
  veritabaniAc,
  BELLEK_VERITABANI,
  urunDeposuOlustur,
  masaDeposuOlustur,
  adisyonDeposuOlustur,
  denetimDeposuOlustur,
  geceDeposuOlustur,
} from "../src/veri/index";
import {
  gecelikHesapla,
  ROL,
  ODEME_YONTEMI,
  HAREKET_TIPI,
  DENETIM_TURU,
  AdisyonHatasi,
  HATA_KODU,
} from "../src/cekirdek/index";
import type { AdisyonVerisi } from "../src/cekirdek/index";
import {
  urunServisiOlustur,
  masaServisiOlustur,
  adisyonServisiOlustur,
  raporServisiOlustur,
  geceServisiOlustur,
  Saglayicilar,
  Aktor,
} from "../src/servis/index";

const patron: Aktor = { kullaniciId: "p1", rol: ROL.PATRON };
const garson: Aktor = { kullaniciId: "g1", rol: ROL.GARSON };
const PENCERE: [string, string] = ["2026-07-18T00:00:00Z", "2026-07-19T00:00:00Z"];

function testSaglayici(): Saglayicilar {
  let sayac = 0;
  return {
    yeniKimlik: () => `id-${++sayac}`,
    simdiIso: () => "2026-07-18T20:00:00Z",
    simdiMs: () => 1_000_000,
  };
}

describe("gecelikHesapla (saf)", () => {
  it("birden cok adisyonun toplamini dogru hesaplar", () => {
    const veriler: AdisyonVerisi[] = [
      {
        hareketler: [
          {
            id: "h1", urunId: "bira", urunAdi: "Efes", adet: 2,
            birimFiyatKurus: 5000, birimMaliyetKurus: 3000,
            tip: HAREKET_TIPI.EKLE, kullaniciId: "g1", zaman: "2026-07-18T20:00:00Z",
          },
        ],
        odemeler: [
          { id: "o1", tutarKurus: 10000, yontem: ODEME_YONTEMI.NAKIT, kullaniciId: "m1", zaman: "z" },
        ],
      },
      {
        hareketler: [
          {
            id: "h2", urunId: "meze", urunAdi: "Humus", adet: 1,
            birimFiyatKurus: 8000, birimMaliyetKurus: 3500,
            tip: HAREKET_TIPI.EKLE, kullaniciId: "g1", zaman: "2026-07-18T20:00:00Z",
          },
        ],
        odemeler: [
          { id: "o2", tutarKurus: 8000, yontem: ODEME_YONTEMI.KART, kullaniciId: "m1", zaman: "z" },
        ],
      },
    ];
    const ozet = gecelikHesapla(veriler);
    expect(ozet.adisyonSayisi).toBe(2);
    expect(ozet.ciroKurus).toBe(18000);
    expect(ozet.maliyetKurus).toBe(9500);
    expect(ozet.karKurus).toBe(8500);
    expect(ozet.nakitKurus).toBe(10000);
    expect(ozet.kartKurus).toBe(8000);
  });

  it("bos donemde sifir doner", () => {
    const ozet = gecelikHesapla([]);
    expect(ozet.adisyonSayisi).toBe(0);
    expect(ozet.ciroKurus).toBe(0);
    expect(ozet.karKurus).toBe(0);
  });
});

describe("rapor ve gece servisleri", () => {
  let db: DatabaseSync;
  let urunS: ReturnType<typeof urunServisiOlustur>;
  let masaS: ReturnType<typeof masaServisiOlustur>;
  let adisyonS: ReturnType<typeof adisyonServisiOlustur>;
  let raporS: ReturnType<typeof raporServisiOlustur>;
  let geceS: ReturnType<typeof geceServisiOlustur>;

  beforeEach(() => {
    db = veritabaniAc(BELLEK_VERITABANI);
    const saglayici = testSaglayici();
    const urunDepo = urunDeposuOlustur(db);
    const masaDepo = masaDeposuOlustur(db);
    const adisyonDepo = adisyonDeposuOlustur(db);
    const denetimDepo = denetimDeposuOlustur(db);
    const geceDepo = geceDeposuOlustur(db);

    urunS = urunServisiOlustur(urunDepo, denetimDepo, saglayici);
    masaS = masaServisiOlustur(masaDepo);
    adisyonS = adisyonServisiOlustur(adisyonDepo, masaDepo, urunDepo, saglayici);
    raporS = raporServisiOlustur(adisyonDepo, denetimDepo);
    geceS = geceServisiOlustur(adisyonDepo, geceDepo, saglayici);

    urunS.ekle(patron, {
      id: "bira", ad: "Efes", kategori: "Bira",
      satisFiyatiKurus: 15000, maliyetKurus: 9000, stokAdedi: 100,
    });
    masaS.ekle(patron, { id: "m1", ad: "Masa 1" });
  });

  // Kapanmis bir hesap uretir: 3 bira, nakit odeme, kapat.
  function birHesapKapat() {
    const adisyon = adisyonS.masayaAdisyonAc(patron, "m1");
    adisyonS.siparisEkle(patron, adisyon.id, "bira", 3);
    adisyonS.odemeAl(patron, adisyon.id, 45000, ODEME_YONTEMI.NAKIT);
    adisyonS.hesabiKapat(patron, adisyon.id);
    return adisyon;
  }

  it("gecelik ozet kapanmis hesaplardan dogru hesaplanir", () => {
    birHesapKapat();
    const ozet = raporS.gecelikOzet(patron, PENCERE[0], PENCERE[1]);
    expect(ozet.adisyonSayisi).toBe(1);
    expect(ozet.ciroKurus).toBe(45000);
    expect(ozet.maliyetKurus).toBe(27000);
    expect(ozet.karKurus).toBe(18000);
    expect(ozet.nakitKurus).toBe(45000);
    expect(ozet.kartKurus).toBe(0);
  });

  it("garson rapor goremez (yetkisiz)", () => {
    try {
      raporS.gecelikOzet(garson, PENCERE[0], PENCERE[1]);
      throw new Error("hata beklenmisti");
    } catch (hata) {
      expect((hata as AdisyonHatasi).kod).toBe(HATA_KODU.YETKISIZ);
    }
  });

  it("fiyat degisikligi denetim kaydina yazilir", () => {
    urunS.fiyatGuncelle(patron, "bira", 16000);
    const kayitlar = raporS.denetimKayitlari(patron, PENCERE[0], PENCERE[1]);
    expect(kayitlar).toHaveLength(1);
    expect(kayitlar[0]!.tur).toBe(DENETIM_TURU.FIYAT_DEGISIKLIGI);
    expect(kayitlar[0]!.aciklama).toContain("Efes");
  });

  it("iptaller denetimde sebebiyle gorunur", () => {
    const adisyon = adisyonS.masayaAdisyonAc(patron, "m1");
    adisyonS.siparisEkle(patron, adisyon.id, "bira", 2);
    adisyonS.siparisIptalEt(patron, adisyon.id, "bira", 1, "Yanlis girildi");

    const iptaller = raporS.iptalDenetimi(patron, PENCERE[0], PENCERE[1]);
    expect(iptaller).toHaveLength(1);
    expect(iptaller[0]!.sebep).toBe("Yanlis girildi");
  });

  it("gece kapatilir, kilitli kayit olusur ve gecmiste gorunur", () => {
    birHesapKapat();
    const kapanis = geceS.geceyiKapat(patron, PENCERE[0], PENCERE[1]);
    expect(kapanis.ciroKurus).toBe(45000);
    expect(kapanis.karKurus).toBe(18000);
    expect(kapanis.nakitKurus).toBe(45000);

    const gecmis = geceS.gecmis(patron);
    expect(gecmis).toHaveLength(1);
    expect(gecmis[0]!.ciroKurus).toBe(45000);
  });

  it("garson geceyi kapatamaz (yetkisiz)", () => {
    expect(() => geceS.geceyiKapat(garson, PENCERE[0], PENCERE[1])).toThrowError(AdisyonHatasi);
  });
});
