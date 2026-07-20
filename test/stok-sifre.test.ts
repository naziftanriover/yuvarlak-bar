import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import {
  veritabaniAc,
  BELLEK_VERITABANI,
  urunDeposuOlustur,
  masaDeposuOlustur,
  adisyonDeposuOlustur,
  denetimDeposuOlustur,
  kullaniciDeposuOlustur,
} from "../src/veri/index";
import {
  kullaniciOlustur,
  sifreDogrula,
  ROL,
  DENETIM_TURU,
  AdisyonHatasi,
  HATA_KODU,
} from "../src/cekirdek/index";
import {
  urunServisiOlustur,
  masaServisiOlustur,
  adisyonServisiOlustur,
  kullaniciServisiOlustur,
  Saglayicilar,
  Aktor,
} from "../src/servis/index";

const patron: Aktor = { kullaniciId: "p1", rol: ROL.PATRON };

function testSaglayici(): Saglayicilar {
  let s = 0;
  return { yeniKimlik: () => `id-${++s}`, simdiIso: () => "2026-07-18T20:00:00Z", simdiMs: () => 1_000_000 };
}

let db: DatabaseSync;
let urunDepo: ReturnType<typeof urunDeposuOlustur>;
let denetimDepo: ReturnType<typeof denetimDeposuOlustur>;
let urunS: ReturnType<typeof urunServisiOlustur>;
let masaS: ReturnType<typeof masaServisiOlustur>;
let adisyonS: ReturnType<typeof adisyonServisiOlustur>;

beforeEach(() => {
  db = veritabaniAc(BELLEK_VERITABANI);
  urunDepo = urunDeposuOlustur(db);
  denetimDepo = denetimDeposuOlustur(db);
  const masaDepo = masaDeposuOlustur(db);
  const adisyonDepo = adisyonDeposuOlustur(db);
  const saglayici = testSaglayici();
  urunS = urunServisiOlustur(urunDepo, denetimDepo, saglayici);
  masaS = masaServisiOlustur(masaDepo);
  adisyonS = adisyonServisiOlustur(adisyonDepo, masaDepo, urunDepo, saglayici);

  urunS.ekle(patron, { id: "bira", ad: "Efes", kategori: "Bira", satisFiyatiKurus: 15000, maliyetKurus: 9000, stokAdedi: 5 });
  masaS.ekle(patron, { id: "m1", ad: "Masa 1" });
});

describe("stok otomatik dusme", () => {
  it("satista stok duser, iptalde geri gelir", () => {
    const adisyon = adisyonS.masayaAdisyonAc(patron, "m1");
    adisyonS.siparisEkle(patron, adisyon.id, "bira", 3);
    expect(urunDepo.idIleGetir("bira")!.stokAdedi).toBe(2); // 5 - 3

    adisyonS.siparisIptalEt(patron, adisyon.id, "bira", 1, "iade");
    expect(urunDepo.idIleGetir("bira")!.stokAdedi).toBe(3); // geri +1
  });

  it("yetersiz stokta satis engellenir (stok bozulmaz)", () => {
    const adisyon = adisyonS.masayaAdisyonAc(patron, "m1");
    try {
      adisyonS.siparisEkle(patron, adisyon.id, "bira", 9); // sadece 5 var
      throw new Error("hata beklenmisti");
    } catch (hata) {
      expect((hata as AdisyonHatasi).kod).toBe(HATA_KODU.YETERSIZ_STOK);
    }
    expect(urunDepo.idIleGetir("bira")!.stokAdedi).toBe(5); // degismedi
  });
});

describe("mal girisi ve sayim", () => {
  it("mal girisi stogu artirir ve denetime yazar", () => {
    const yeni = urunS.malGirisi(patron, "bira", 10);
    expect(yeni.stokAdedi).toBe(15);
    const kayitlar = denetimDepo.aralik("2026-07-18T00:00:00Z", "2026-07-19T00:00:00Z");
    expect(kayitlar.some((k) => k.tur === DENETIM_TURU.STOK_GIRISI)).toBe(true);
  });

  it("stok sayimi stogu ayarlar ve farki denetime yazar", () => {
    const yeni = urunS.stokSayimi(patron, "bira", 3, "gece sayimi"); // 5 -> 3, fark -2
    expect(yeni.stokAdedi).toBe(3);
    const kayit = denetimDepo
      .aralik("2026-07-18T00:00:00Z", "2026-07-19T00:00:00Z")
      .find((k) => k.tur === DENETIM_TURU.STOK_SAYIMI);
    expect(kayit).toBeTruthy();
    expect(kayit!.aciklama).toContain("fark -2");
  });

  it("urun pasiflestirilir ve aktif listeden cikar", () => {
    urunS.durumDegistir(patron, "bira", false);
    expect(urunS.aktifleriListele()).toHaveLength(0);
    expect(urunS.listele()).toHaveLength(1); // hepsi listesinde durur (silinmedi)
  });
});

describe("sifre degistirme", () => {
  let kullaniciS: ReturnType<typeof kullaniciServisiOlustur>;
  const aktor: Aktor = { kullaniciId: "u1", rol: ROL.GARSON };

  beforeEach(async () => {
    const kullaniciDepo = kullaniciDeposuOlustur(db);
    kullaniciS = kullaniciServisiOlustur(kullaniciDepo, testSaglayici());
    kullaniciDepo.ekle(
      await kullaniciOlustur({ id: "u1", ad: "Ali", kullaniciAdi: "ali", sifre: "eski12345", rol: ROL.GARSON }),
    );
  });

  it("dogru eski sifreyle degistirir, yeni sifre calisir", async () => {
    await kullaniciS.sifremiDegistir(aktor, "eski12345", "yeni67890");
    const kullaniciDepo = kullaniciDeposuOlustur(db);
    const k = kullaniciDepo.idIleGetir("u1")!;
    expect(await sifreDogrula("yeni67890", k.sifreHash)).toBe(true);
    expect(await sifreDogrula("eski12345", k.sifreHash)).toBe(false);
  });

  it("yanlis eski sifre reddedilir", async () => {
    await expect(kullaniciS.sifremiDegistir(aktor, "yanlis", "yeni67890")).rejects.toBeInstanceOf(AdisyonHatasi);
  });

  it("zayif yeni sifre reddedilir", async () => {
    await expect(kullaniciS.sifremiDegistir(aktor, "eski12345", "123")).rejects.toBeInstanceOf(AdisyonHatasi);
  });
});
