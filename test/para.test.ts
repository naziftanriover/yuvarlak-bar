import { describe, it, expect } from "vitest";
import { tlDenKurusa, kurusuBicimlendir } from "../src/cekirdek/para";
import { AdisyonHatasi } from "../src/cekirdek/tipler";

describe("para - tlDenKurusa", () => {
  it("TL'yi kurusa cevirir", () => {
    expect(tlDenKurusa(12.34)).toBe(1234);
    expect(tlDenKurusa(100)).toBe(10000);
    expect(tlDenKurusa(0)).toBe(0);
  });

  it("ondalik yuvarlama hatasini onler", () => {
    // 0.1 + 0.2 float dunyasinda 0.30000000000000004'tur; kurus dunyasinda 30.
    expect(tlDenKurusa(0.1) + tlDenKurusa(0.2)).toBe(30);
  });

  it("gecersiz tutarda anlamli hata verir", () => {
    expect(() => tlDenKurusa(NaN)).toThrowError(AdisyonHatasi);
  });
});

describe("para - kurusuBicimlendir", () => {
  it("kurusu okunabilir TL metnine cevirir", () => {
    expect(kurusuBicimlendir(123456)).toBe("1.234,56 ₺");
    expect(kurusuBicimlendir(500)).toBe("5,00 ₺");
    expect(kurusuBicimlendir(0)).toBe("0,00 ₺");
  });

  it("negatif tutari dogru gosterir", () => {
    expect(kurusuBicimlendir(-250)).toBe("-2,50 ₺");
  });
});
