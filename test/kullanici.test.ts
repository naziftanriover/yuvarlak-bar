import { describe, it, expect } from "vitest";
import {
  ROL,
  IZIN,
  rolGecerliMi,
  yetkiVarMi,
  yetkiDogrula,
  sifreHashle,
  sifreDogrula,
  kullaniciOlustur,
  kullaniciyiGizle,
  girisKontrol,
  Kullanici,
} from "../src/cekirdek/kullanici";
import { AdisyonHatasi, HATA_KODU } from "../src/cekirdek/tipler";

function girdi(ozel: Partial<{ id: string; ad: string; kullaniciAdi: string; sifre: string; rol: any }> = {}) {
  return {
    id: ozel.id ?? "k1",
    ad: ozel.ad ?? "Ali",
    kullaniciAdi: ozel.kullaniciAdi ?? "ali",
    sifre: ozel.sifre ?? "gizli12345",
    rol: ozel.rol ?? ROL.GARSON,
  };
}

describe("sifre hash ve dogrulama", () => {
  it("ayni sifre icin farkli hash uretir (tuz rastgele)", async () => {
    const h1 = await sifreHashle("gizli12345");
    const h2 = await sifreHashle("gizli12345");
    expect(h1).not.toBe(h2);
    expect(h1).not.toContain("gizli12345"); // duz sifre hash icinde yok
  });

  it("dogru sifreyi dogrular, yanlisi reddeder", async () => {
    const hash = await sifreHashle("gizli12345");
    expect(await sifreDogrula("gizli12345", hash)).toBe(true);
    expect(await sifreDogrula("yanlis", hash)).toBe(false);
  });

  it("bozuk hash formatinda false doner (cokmez)", async () => {
    expect(await sifreDogrula("gizli12345", "bozuk-hash")).toBe(false);
  });
});

describe("kullaniciOlustur", () => {
  it("gecerli kullaniciyi olusturur ve sifreyi hash'ler", async () => {
    const k = await kullaniciOlustur(girdi());
    expect(k.aktif).toBe(true);
    expect(k.sifreHash).not.toBe("gizli12345"); // duz tutulmaz
    expect(await sifreDogrula("gizli12345", k.sifreHash)).toBe(true);
  });

  it("zayif sifreyi reddeder", async () => {
    await expect(kullaniciOlustur(girdi({ sifre: "123" }))).rejects.toBeInstanceOf(AdisyonHatasi);
  });

  it("gecersiz rolu reddeder", async () => {
    await expect(kullaniciOlustur(girdi({ rol: "SEF" }))).rejects.toBeInstanceOf(AdisyonHatasi);
  });

  it("bos kullanici adini reddeder", async () => {
    await expect(kullaniciOlustur(girdi({ kullaniciAdi: "  " }))).rejects.toBeInstanceOf(AdisyonHatasi);
  });
});

describe("rol ve yetki", () => {
  it("rol gecerliligini dogru soyler", () => {
    expect(rolGecerliMi(ROL.PATRON)).toBe(true);
    expect(rolGecerliMi("SEF")).toBe(false);
  });

  it("garson sadece siparis girebilir", () => {
    expect(yetkiVarMi(ROL.GARSON, IZIN.SIPARIS_GIR)).toBe(true);
    expect(yetkiVarMi(ROL.GARSON, IZIN.ODEME_AL)).toBe(false);
    expect(yetkiVarMi(ROL.GARSON, IZIN.RAPOR_GOR)).toBe(false);
  });

  it("mudur odeme alir ama patron raporlarini goremez", () => {
    expect(yetkiVarMi(ROL.MUDUR, IZIN.ODEME_AL)).toBe(true);
    expect(yetkiVarMi(ROL.MUDUR, IZIN.RAPOR_GOR)).toBe(false);
  });

  it("patron her seyi yapabilir", () => {
    expect(yetkiVarMi(ROL.PATRON, IZIN.RAPOR_GOR)).toBe(true);
    expect(yetkiVarMi(ROL.PATRON, IZIN.FIYAT_DEGISTIR)).toBe(true);
  });

  it("yetkiDogrula yetkisizde YETKISIZ hatasi verir", () => {
    try {
      yetkiDogrula(ROL.GARSON, IZIN.RAPOR_GOR);
      throw new Error("hata beklenmisti");
    } catch (hata) {
      expect(hata).toBeInstanceOf(AdisyonHatasi);
      expect((hata as AdisyonHatasi).kod).toBe(HATA_KODU.YETKISIZ);
    }
    expect(() => yetkiDogrula(ROL.MUDUR, IZIN.ODEME_AL)).not.toThrow();
  });
});

describe("kullaniciyiGizle ve girisKontrol", () => {
  it("gizlenen kullanicida sifre hash'i olmaz", async () => {
    const k = await kullaniciOlustur(girdi());
    const guvenli = kullaniciyiGizle(k) as Record<string, unknown>;
    expect(guvenli.sifreHash).toBeUndefined();
    expect(guvenli.kullaniciAdi).toBe("ali");
  });

  it("dogru sifreyle giris guvenli kullaniciyi dondurur", async () => {
    const k = await kullaniciOlustur(girdi());
    const oturum = await girisKontrol(k, "gizli12345") as Record<string, unknown>;
    expect(oturum.sifreHash).toBeUndefined();
    expect(oturum.rol).toBe(ROL.GARSON);
  });

  it("yanlis sifrede tek tip hata verir", async () => {
    const k = await kullaniciOlustur(girdi());
    try {
      await girisKontrol(k, "yanlis");
      throw new Error("hata beklenmisti");
    } catch (hata) {
      expect(hata).toBeInstanceOf(AdisyonHatasi);
      expect((hata as AdisyonHatasi).kod).toBe(HATA_KODU.GIRIS_BASARISIZ);
    }
  });

  it("pasif kullanici dogru sifreyle bile giremez", async () => {
    const k: Kullanici = { ...(await kullaniciOlustur(girdi())), aktif: false };
    await expect(girisKontrol(k, "gizli12345")).rejects.toBeInstanceOf(AdisyonHatasi);
  });
});
