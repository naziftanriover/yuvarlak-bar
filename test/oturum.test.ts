import { describe, it, expect } from "vitest";
import { tokenOlustur, tokenDogrula, TokenIcerigi } from "../src/api/oturum";
import { ROL } from "../src/cekirdek/kullanici";
import { AdisyonHatasi, HATA_KODU } from "../src/cekirdek/tipler";

const SIR = "test-gizli-anahtar";

function icerik(bitisMs: number): TokenIcerigi {
  return { kullaniciId: "k1", rol: ROL.MUDUR, bitisMs };
}

describe("token uret / dogrula", () => {
  it("gecerli tokeni uretip geri dogrular", () => {
    const token = tokenOlustur(icerik(2000), SIR);
    const cozulen = tokenDogrula(token, SIR, 1000); // simdi < bitis
    expect(cozulen.kullaniciId).toBe("k1");
    expect(cozulen.rol).toBe(ROL.MUDUR);
  });

  it("yanlis sir ile dogrulanamaz", () => {
    const token = tokenOlustur(icerik(2000), SIR);
    expect(() => tokenDogrula(token, "baska-sir", 1000)).toThrowError(AdisyonHatasi);
  });

  it("suresi gecmis token reddedilir", () => {
    const token = tokenOlustur(icerik(1000), SIR);
    try {
      tokenDogrula(token, SIR, 5000); // simdi > bitis
      throw new Error("hata beklenmisti");
    } catch (hata) {
      expect(hata).toBeInstanceOf(AdisyonHatasi);
      expect((hata as AdisyonHatasi).kod).toBe(HATA_KODU.OTURUM_GECERSIZ);
    }
  });

  it("kurcalanmis token reddedilir", () => {
    const token = tokenOlustur(icerik(2000), SIR);
    const bozuk = token.slice(0, -2) + "xy"; // imzayi boz
    expect(() => tokenDogrula(bozuk, SIR, 1000)).toThrowError(AdisyonHatasi);
  });

  it("bicimsiz token reddedilir", () => {
    expect(() => tokenDogrula("saçmalık", SIR, 1000)).toThrowError(AdisyonHatasi);
  });
});
