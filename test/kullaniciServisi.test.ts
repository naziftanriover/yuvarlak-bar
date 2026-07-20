import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { veritabaniAc, BELLEK_VERITABANI, kullaniciDeposuOlustur } from "../src/veri/index";
import { kullaniciOlustur, ROL, AdisyonHatasi, HATA_KODU } from "../src/cekirdek/index";
import { kullaniciServisiOlustur, Saglayicilar, Aktor } from "../src/servis/index";

const patron: Aktor = { kullaniciId: "p1", rol: ROL.PATRON };
const garson: Aktor = { kullaniciId: "g1", rol: ROL.GARSON };

function testSaglayici(): Saglayicilar {
  let sayac = 0;
  return {
    yeniKimlik: () => `id-${++sayac}`,
    simdiIso: () => "2026-07-18T20:00:00Z",
    simdiMs: () => 1_000_000,
  };
}

let db: DatabaseSync;
let depo: ReturnType<typeof kullaniciDeposuOlustur>;
let servis: ReturnType<typeof kullaniciServisiOlustur>;

beforeEach(async () => {
  db = veritabaniAc(BELLEK_VERITABANI);
  depo = kullaniciDeposuOlustur(db);
  servis = kullaniciServisiOlustur(depo, testSaglayici());
  // Aktor patron'un gercekten var olmasi icin (kendini pasiflestirme testi) ekle.
  depo.ekle(
    await kullaniciOlustur({ id: "p1", ad: "Patron", kullaniciAdi: "patron", sifre: "patron12345", rol: ROL.PATRON }),
  );
});

describe("kullaniciServisi - ekleme", () => {
  it("patron yeni garson ekler, sifre hash'i disari sizmaz", async () => {
    const yeni = await servis.ekle(patron, { ad: "Ali", kullaniciAdi: "ali", sifre: "gizli12345", rol: ROL.GARSON });
    expect(yeni.rol).toBe(ROL.GARSON);
    expect(yeni.aktif).toBe(true);
    expect(yeni).not.toHaveProperty("sifreHash");
  });

  it("garson kullanici ekleyemez (yetkisiz)", async () => {
    await expect(
      servis.ekle(garson, { ad: "X", kullaniciAdi: "x", sifre: "gizli12345", rol: ROL.GARSON }),
    ).rejects.toBeInstanceOf(AdisyonHatasi);
  });

  it("ayni kullanici adi ikinci kez eklenemez", async () => {
    await servis.ekle(patron, { ad: "Ali", kullaniciAdi: "ali", sifre: "gizli12345", rol: ROL.GARSON });
    try {
      await servis.ekle(patron, { ad: "Ali 2", kullaniciAdi: "ali", sifre: "gizli12345", rol: ROL.MUDUR });
      throw new Error("hata beklenmisti");
    } catch (hata) {
      expect((hata as AdisyonHatasi).kod).toBe(HATA_KODU.KULLANICI_ADI_ALINMIS);
    }
  });

  it("zayif sifre reddedilir", async () => {
    await expect(
      servis.ekle(patron, { ad: "Ali", kullaniciAdi: "ali", sifre: "123", rol: ROL.GARSON }),
    ).rejects.toBeInstanceOf(AdisyonHatasi);
  });
});

describe("kullaniciServisi - listeleme ve aktiflik", () => {
  it("listede sifre hash'i olmaz", async () => {
    await servis.ekle(patron, { ad: "Ali", kullaniciAdi: "ali", sifre: "gizli12345", rol: ROL.GARSON });
    const liste = servis.listele(patron);
    expect(liste.length).toBe(2); // patron + ali
    expect(liste.every((k) => !("sifreHash" in k))).toBe(true);
  });

  it("garson listeleyemez (yetkisiz)", () => {
    expect(() => servis.listele(garson)).toThrowError(AdisyonHatasi);
  });

  it("kullaniciyi pasiflestirir", async () => {
    const ali = await servis.ekle(patron, { ad: "Ali", kullaniciAdi: "ali", sifre: "gizli12345", rol: ROL.GARSON });
    const pasif = servis.aktiflikDegistir(patron, ali.id, false);
    expect(pasif.aktif).toBe(false);
  });

  it("kisi kendi hesabini pasiflestiremez", () => {
    try {
      servis.aktiflikDegistir(patron, "p1", false);
      throw new Error("hata beklenmisti");
    } catch (hata) {
      expect((hata as AdisyonHatasi).kod).toBe(HATA_KODU.KENDINI_PASIFLESTIREMEZ);
    }
  });
});
