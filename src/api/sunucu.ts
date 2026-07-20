// HTTP API sunucusu. Cihazlar (bar bilgisayari, garson/patron telefonu) buraya
// baglanir. Her korumali istek "Authorization: Bearer <token>" ile gelir.
//
// Tasarim: yonlendirme (routing) sade tutuldu (tam yol eslesme + JSON govde).
// Hatalar tek yerde HTTP durumuna cevrilir; bilinmeyen hatada ic detay sizmaz.

import { createServer } from "node:http";
import type { Server, IncomingMessage, ServerResponse } from "node:http";
import type { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { AdisyonHatasi, HATA_KODU } from "../cekirdek/index";
import type { OdemeYontemi } from "../cekirdek/index";
import {
  kullaniciDeposuOlustur,
  urunDeposuOlustur,
  masaDeposuOlustur,
  adisyonDeposuOlustur,
  denetimDeposuOlustur,
  geceDeposuOlustur,
} from "../veri/index";
import {
  kimlikServisiOlustur,
  kullaniciServisiOlustur,
  urunServisiOlustur,
  masaServisiOlustur,
  adisyonServisiOlustur,
  raporServisiOlustur,
  geceServisiOlustur,
} from "../servis/index";
import type {
  KimlikServisi,
  KullaniciServisi,
  UrunServisi,
  MasaServisi,
  AdisyonServisi,
  RaporServisi,
  GeceServisi,
  Aktor,
  Saglayicilar,
} from "../servis/index";
import { tokenDogrula } from "./oturum";

const EN_FAZLA_GOVDE_BAYT = 1_000_000; // asiri buyuk istek govdesini engelle

// Sunucunun ihtiyac duydugu her sey.
export interface Bagimliliklar {
  kimlik: KimlikServisi;
  kullanici: KullaniciServisi;
  urun: UrunServisi;
  masa: MasaServisi;
  adisyon: AdisyonServisi;
  rapor: RaporServisi;
  gece: GeceServisi;
  tokenSirri: string;
  simdiMs: () => number;
}

// Acik bir veritabani + saglayicilardan tum servisleri kurup bagimliliklari uretir.
export function bagimliliklariKur(
  db: DatabaseSync,
  ayar: { tokenSirri: string; tokenSuresiMs: number },
  saglayici: Saglayicilar,
): Bagimliliklar {
  const kullaniciDepo = kullaniciDeposuOlustur(db);
  const urunDepo = urunDeposuOlustur(db);
  const masaDepo = masaDeposuOlustur(db);
  const adisyonDepo = adisyonDeposuOlustur(db);
  const denetimDepo = denetimDeposuOlustur(db);
  const geceDepo = geceDeposuOlustur(db);

  return {
    kimlik: kimlikServisiOlustur(kullaniciDepo, saglayici, ayar.tokenSirri, ayar.tokenSuresiMs),
    kullanici: kullaniciServisiOlustur(kullaniciDepo, saglayici),
    urun: urunServisiOlustur(urunDepo, denetimDepo, saglayici),
    masa: masaServisiOlustur(masaDepo),
    adisyon: adisyonServisiOlustur(adisyonDepo, masaDepo, urunDepo, saglayici),
    rapor: raporServisiOlustur(adisyonDepo, denetimDepo),
    gece: geceServisiOlustur(adisyonDepo, geceDepo, saglayici),
    tokenSirri: ayar.tokenSirri,
    simdiMs: saglayici.simdiMs,
  };
}

// Istek govdesini (metin) okur, boyutu sinirlar.
function govdeOku(req: IncomingMessage): Promise<string> {
  return new Promise((coz, reddet) => {
    let veri = "";
    req.on("data", (parca: Buffer) => {
      veri += parca.toString();
      if (veri.length > EN_FAZLA_GOVDE_BAYT) {
        reddet(new AdisyonHatasi(HATA_KODU.GECERSIZ_ISTEK, "Istek cok buyuk."));
        req.destroy();
      }
    });
    req.on("end", () => coz(veri));
    req.on("error", () => reddet(new AdisyonHatasi(HATA_KODU.GECERSIZ_ISTEK, "Istek okunamadi.")));
  });
}

// Govdeyi JSON nesnesine cevirir. Bicimsizse anlamli hata verir.
async function govdeJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const ham = await govdeOku(req);
  if (ham.trim().length === 0) {
    return {};
  }
  try {
    const nesne = JSON.parse(ham);
    if (typeof nesne !== "object" || nesne === null) {
      throw new Error("nesne degil");
    }
    return nesne as Record<string, unknown>;
  } catch {
    throw new AdisyonHatasi(HATA_KODU.GECERSIZ_ISTEK, "Gecersiz istek govdesi.");
  }
}

// Authorization basligindan tokeni cozer, kullaniciyi (aktor) dondurur.
function aktoruCoz(req: IncomingMessage, bag: Bagimliliklar): Aktor {
  const baslik = req.headers["authorization"];
  if (typeof baslik !== "string" || !baslik.startsWith("Bearer ")) {
    throw new AdisyonHatasi(HATA_KODU.OTURUM_GECERSIZ, "Oturum gerekli.");
  }
  const token = baslik.slice("Bearer ".length);
  const icerik = tokenDogrula(token, bag.tokenSirri, bag.simdiMs());
  return { kullaniciId: icerik.kullaniciId, rol: icerik.rol };
}

// Istegi ilgili servise yonlendirir ve sonucu (JSON'lanacak veri) dondurur.
async function yonlendir(req: IncomingMessage, bag: Bagimliliklar): Promise<unknown> {
  const yol = (req.url ?? "").split("?")[0];
  const anahtar = `${req.method ?? "GET"} ${yol}`;

  // --- Herkese acik uclar ---
  if (anahtar === "GET /saglik") {
    return { durum: "iyi" };
  }
  if (anahtar === "POST /giris") {
    const g = await govdeJson(req);
    return bag.kimlik.giris(String(g.kullaniciAdi ?? ""), String(g.sifre ?? ""));
  }

  // --- Buradan sonrasi token ister ---
  const aktor = aktoruCoz(req, bag);

  switch (anahtar) {
    case "GET /urunler":
      return bag.urun.aktifleriListele();
    case "POST /urunler": {
      const g = await govdeJson(req);
      return bag.urun.ekle(aktor, g as never);
    }
    case "GET /masalar":
      return bag.masa.listele();
    case "POST /masalar": {
      const g = await govdeJson(req);
      return bag.masa.ekle(aktor, g as never);
    }
    case "POST /adisyon/ac": {
      const g = await govdeJson(req);
      return bag.adisyon.masayaAdisyonAc(aktor, String(g.masaId ?? ""));
    }
    case "POST /adisyon/siparis": {
      const g = await govdeJson(req);
      return bag.adisyon.siparisEkle(aktor, String(g.adisyonId ?? ""), String(g.urunId ?? ""), Number(g.adet));
    }
    case "POST /adisyon/iptal": {
      const g = await govdeJson(req);
      return bag.adisyon.siparisIptalEt(
        aktor,
        String(g.adisyonId ?? ""),
        String(g.urunId ?? ""),
        Number(g.adet),
        String(g.sebep ?? ""),
      );
    }
    case "POST /adisyon/odeme": {
      const g = await govdeJson(req);
      return bag.adisyon.odemeAl(aktor, String(g.adisyonId ?? ""), Number(g.tutarKurus), g.yontem as OdemeYontemi);
    }
    case "POST /adisyon/ozet": {
      const g = await govdeJson(req);
      return bag.adisyon.ozet(aktor, String(g.adisyonId ?? ""));
    }
    case "POST /adisyon/kapat": {
      const g = await govdeJson(req);
      return bag.adisyon.hesabiKapat(aktor, String(g.adisyonId ?? ""));
    }
    case "POST /rapor/gecelik": {
      const g = await govdeJson(req);
      return bag.rapor.gecelikOzet(aktor, String(g.baslangic ?? ""), String(g.bitis ?? ""));
    }
    case "POST /rapor/iptaller": {
      const g = await govdeJson(req);
      return bag.rapor.iptalDenetimi(aktor, String(g.baslangic ?? ""), String(g.bitis ?? ""));
    }
    case "POST /rapor/denetim": {
      const g = await govdeJson(req);
      return bag.rapor.denetimKayitlari(aktor, String(g.baslangic ?? ""), String(g.bitis ?? ""));
    }
    case "POST /gece/kapat": {
      const g = await govdeJson(req);
      return bag.gece.geceyiKapat(aktor, String(g.baslangic ?? ""), String(g.bitis ?? ""));
    }
    case "GET /gece/gecmis":
      return bag.gece.gecmis(aktor);
    case "GET /kullanicilar":
      return bag.kullanici.listele(aktor);
    case "POST /kullanicilar": {
      const g = await govdeJson(req);
      return bag.kullanici.ekle(aktor, g as never);
    }
    case "POST /kullanicilar/durum": {
      const g = await govdeJson(req);
      return bag.kullanici.aktiflikDegistir(aktor, String(g.id ?? ""), Boolean(g.aktif));
    }
    default:
      throw new AdisyonHatasi(HATA_KODU.BULUNAMADI, "Boyle bir adres yok.");
  }
}

// Bir hatayi HTTP durum kodu + guvenli mesaja cevirir.
function hatayiEsle(hata: unknown): { durum: number; mesaj: string } {
  if (hata instanceof AdisyonHatasi) {
    const durumlar: Record<string, number> = {
      [HATA_KODU.OTURUM_GECERSIZ]: 401,
      [HATA_KODU.GIRIS_BASARISIZ]: 401,
      [HATA_KODU.YETKISIZ]: 403,
      [HATA_KODU.BULUNAMADI]: 404,
    };
    return { durum: durumlar[hata.kod] ?? 400, mesaj: hata.message };
  }
  // Bilinmeyen hata: ic detay sizdirma.
  return { durum: 500, mesaj: "Beklenmeyen bir hata olustu." };
}

// JSON cevabi yazar.
function cevapYaz(res: ServerResponse, durum: number, veri: unknown): void {
  res.writeHead(durum, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(veri));
}

// --- Statik dosya servisi (web panelleri) ---

// Web sayfalari bu klasorde (proje kokundeki "genel").
const GENEL_DIZIN = fileURLToPath(new URL("../../genel", import.meta.url));

// GET olan API yollari; bunlarin disindaki GET istekleri statik dosya sayilir.
const API_GET_YOLLARI = new Set(["/saglik", "/urunler", "/masalar", "/gece/gecmis", "/kullanicilar"]);

const ICERIK_TIPLERI: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

// Bir dosyanin icerik tipini uzantisindan bulur.
function icerikTipi(dosya: string): string {
  return ICERIK_TIPLERI[extname(dosya)] ?? "application/octet-stream";
}

// Statik bir web dosyasini gonderir. Bilinmeyen dosyada 404 verir.
// Guvenlik: ".." iceren yollar (dizin disina cikma) reddedilir.
async function statikSun(res: ServerResponse, yol: string): Promise<void> {
  const dosyaAdi = yol === "/" ? "/giris.html" : yol;
  if (dosyaAdi.includes("..")) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Gecersiz yol");
    return;
  }
  try {
    const icerik = await readFile(join(GENEL_DIZIN, dosyaAdi));
    res.writeHead(200, { "Content-Type": icerikTipi(dosyaAdi) });
    res.end(icerik);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Sayfa bulunamadi");
  }
}

// Tek bir istegi isleyen fonksiyonu uretir.
export function istekIsleyiciOlustur(bag: Bagimliliklar) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const yol = (req.url ?? "/").split("?")[0] ?? "/";
    const metot = req.method ?? "GET";

    // API disindaki GET istekleri web sayfasi (statik dosya) olarak sunulur.
    if (metot === "GET" && !API_GET_YOLLARI.has(yol)) {
      await statikSun(res, yol);
      return;
    }

    try {
      const sonuc = await yonlendir(req, bag);
      cevapYaz(res, 200, sonuc);
    } catch (hata) {
      const { durum, mesaj } = hatayiEsle(hata);
      cevapYaz(res, durum, { hata: mesaj });
    }
  };
}

// Calismaya hazir bir HTTP sunucusu olusturur (henuz dinlemez).
export function sunucuOlustur(bag: Bagimliliklar): Server {
  return createServer(istekIsleyiciOlustur(bag));
}
