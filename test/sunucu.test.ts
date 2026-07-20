import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { veritabaniAc, BELLEK_VERITABANI, kullaniciDeposuOlustur } from "../src/veri/index";
import { kullaniciOlustur, ROL } from "../src/cekirdek/index";
import { bagimliliklariKur, sunucuOlustur } from "../src/api/sunucu";
import type { Saglayicilar } from "../src/servis/index";

const TOKEN_SIR = "test-sunucu-gizli-anahtari-uzun";

function testSaglayici(): Saglayicilar {
  let sayac = 0;
  return {
    yeniKimlik: () => `id-${++sayac}`,
    simdiIso: () => "2026-07-18T20:00:00Z",
    simdiMs: () => 1_000_000,
  };
}

let sunucu: Server;
let taban: string;
let patronToken: string;
let garsonToken: string;

// Kucuk istemci yardimcisi.
async function istek(
  metot: string,
  yol: string,
  secenek: { token?: string; govde?: unknown } = {},
): Promise<{ durum: number; veri: any }> {
  const basliklar: Record<string, string> = { "Content-Type": "application/json" };
  if (secenek.token) {
    basliklar["Authorization"] = `Bearer ${secenek.token}`;
  }
  const cevap = await fetch(`${taban}${yol}`, {
    method: metot,
    headers: basliklar,
    body: secenek.govde === undefined ? undefined : JSON.stringify(secenek.govde),
  });
  return { durum: cevap.status, veri: await cevap.json() };
}

beforeAll(async () => {
  const db = veritabaniAc(BELLEK_VERITABANI);
  const kdepo = kullaniciDeposuOlustur(db);
  kdepo.ekle(
    await kullaniciOlustur({ id: "p1", ad: "Patron", kullaniciAdi: "patron", sifre: "patron12345", rol: ROL.PATRON }),
  );
  kdepo.ekle(
    await kullaniciOlustur({ id: "g1", ad: "Garson", kullaniciAdi: "garson", sifre: "garson12345", rol: ROL.GARSON }),
  );

  const bag = bagimliliklariKur(
    db,
    { tokenSirri: TOKEN_SIR, tokenSuresiMs: 3_600_000 },
    testSaglayici(),
  );
  sunucu = sunucuOlustur(bag);
  await new Promise<void>((coz) => sunucu.listen(0, coz));
  const adres = sunucu.address() as AddressInfo;
  taban = `http://127.0.0.1:${adres.port}`;
});

afterAll(() => {
  sunucu.close();
});

describe("web sayfalari (statik servis)", () => {
  it("kok yol giris sayfasini (HTML) doner", async () => {
    const cevap = await fetch(`${taban}/`);
    expect(cevap.status).toBe(200);
    expect(cevap.headers.get("content-type")).toContain("text/html");
    const html = await cevap.text();
    expect(html).toContain("Yuvarlak");
  });

  it("stil dosyasini doner", async () => {
    const cevap = await fetch(`${taban}/stil.css`);
    expect(cevap.status).toBe(200);
    expect(cevap.headers.get("content-type")).toContain("text/css");
  });

  it("dizin disina cikma (..) reddedilir", async () => {
    const cevap = await fetch(`${taban}/..%2f..%2fpackage.json`);
    expect(cevap.status).toBeGreaterThanOrEqual(400);
  });
});

describe("saglik ve giris", () => {
  it("saglik ucu acik ve calisiyor", async () => {
    const { durum, veri } = await istek("GET", "/saglik");
    expect(durum).toBe(200);
    expect(veri.durum).toBe("iyi");
  });

  it("yanlis sifre 401 doner", async () => {
    const { durum } = await istek("POST", "/giris", { govde: { kullaniciAdi: "patron", sifre: "yanlis" } });
    expect(durum).toBe(401);
  });

  it("dogru giris token doner", async () => {
    const patron = await istek("POST", "/giris", { govde: { kullaniciAdi: "patron", sifre: "patron12345" } });
    expect(patron.durum).toBe(200);
    expect(patron.veri.token).toBeTruthy();
    patronToken = patron.veri.token;

    const garson = await istek("POST", "/giris", { govde: { kullaniciAdi: "garson", sifre: "garson12345" } });
    garsonToken = garson.veri.token;
    expect(garsonToken).toBeTruthy();
  });
});

describe("yetki ve korumali uclar", () => {
  it("tokensiz istek 401", async () => {
    const { durum } = await istek("GET", "/urunler");
    expect(durum).toBe(401);
  });

  it("patron urun ekler, garson ekleyemez (403)", async () => {
    const urun = {
      id: "bira",
      ad: "Efes",
      kategori: "Bira",
      satisFiyatiKurus: 5000,
      maliyetKurus: 3000,
      stokAdedi: 100,
    };
    const ekle = await istek("POST", "/urunler", { token: patronToken, govde: urun });
    expect(ekle.durum).toBe(200);

    const garsonEkle = await istek("POST", "/urunler", {
      token: garsonToken,
      govde: { ...urun, id: "bira2" },
    });
    expect(garsonEkle.durum).toBe(403);
  });

  it("bilinmeyen API adresi 404", async () => {
    const { durum } = await istek("POST", "/olmayan", { token: patronToken, govde: {} });
    expect(durum).toBe(404);
  });
});

describe("bastan sona satis akisi (HTTP)", () => {
  it("masa ac, siparis gir, ozet al, odeme, kapat", async () => {
    // Masa ekle (patron)
    await istek("POST", "/masalar", { token: patronToken, govde: { id: "m1", ad: "Masa 1" } });

    // Garson masaya adisyon acar
    const ac = await istek("POST", "/adisyon/ac", { token: garsonToken, govde: { masaId: "m1" } });
    expect(ac.durum).toBe(200);
    const adisyonId = ac.veri.id;

    // Garson 3 bira girer
    const siparis = await istek("POST", "/adisyon/siparis", {
      token: garsonToken,
      govde: { adisyonId, urunId: "bira", adet: 3 },
    });
    expect(siparis.durum).toBe(200);

    // Ozet: ciro 15000, kar 6000
    const ozet = await istek("POST", "/adisyon/ozet", { token: garsonToken, govde: { adisyonId } });
    expect(ozet.veri.ciroKurus).toBe(15000);
    expect(ozet.veri.karKurus).toBe(6000);

    // Garson odeme alamaz (403)
    const garsonOdeme = await istek("POST", "/adisyon/odeme", {
      token: garsonToken,
      govde: { adisyonId, tutarKurus: 15000, yontem: "NAKIT" },
    });
    expect(garsonOdeme.durum).toBe(403);

    // Patron odeme alir ve kapatir
    const odeme = await istek("POST", "/adisyon/odeme", {
      token: patronToken,
      govde: { adisyonId, tutarKurus: 15000, yontem: "NAKIT" },
    });
    expect(odeme.durum).toBe(200);

    const kapat = await istek("POST", "/adisyon/kapat", { token: patronToken, govde: { adisyonId } });
    expect(kapat.durum).toBe(200);
    expect(kapat.veri.durum).toBe("KAPALI");
  });
});
