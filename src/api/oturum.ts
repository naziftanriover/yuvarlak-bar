// Oturum (token) modulu.
// Giris basarili olunca kullaniciya imzali bir "token" verilir. Her istekte bu
// token gonderilir; sunucu imzayi ve suresini kontrol edip kullaniciyi taniyabilir.
//
// Guvenlik: token icerigi imzayla (HMAC-SHA256) korunur. Icerik degistirilirse
// imza tutmaz. Imza icin gizli anahtar (sir) kod icine YAZILMAZ, disaridan gelir.

import { createHmac, timingSafeEqual } from "node:crypto";
import { AdisyonHatasi, HATA_KODU } from "../cekirdek/index";
import type { Rol } from "../cekirdek/index";

const AYIRICI = ".";

// Token icinde tasinan bilgi.
export interface TokenIcerigi {
  kullaniciId: string;
  rol: Rol;
  bitisMs: number; // gecerlilik bitisi (epoch milisaniye)
}

function base64urlKodla(metin: string): string {
  return Buffer.from(metin, "utf8").toString("base64url");
}

function base64urlCoz(b64: string): string {
  return Buffer.from(b64, "base64url").toString("utf8");
}

function imzala(veri: string, sir: string): string {
  return createHmac("sha256", sir).update(veri).digest("base64url");
}

// Iki imzayi zamanlama-guvenli karsilastirir.
function imzalarEsit(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// Verilen icerikten imzali bir token uretir.
export function tokenOlustur(icerik: TokenIcerigi, sir: string): string {
  if (typeof sir !== "string" || sir.length === 0) {
    throw new AdisyonHatasi(HATA_KODU.OTURUM_GECERSIZ, "Sunucu yapilandirmasi eksik.");
  }
  const govde = base64urlKodla(JSON.stringify(icerik));
  const imza = imzala(govde, sir);
  return `${govde}${AYIRICI}${imza}`;
}

// Tokeni dogrular: imza tutmali VE suresi gecmemis olmali. Basarisizsa hata verir.
export function tokenDogrula(token: string, sir: string, simdiMs: number): TokenIcerigi {
  if (typeof token !== "string" || !token.includes(AYIRICI)) {
    throw new AdisyonHatasi(HATA_KODU.OTURUM_GECERSIZ, "Oturum gecersiz.");
  }
  const parcalar = token.split(AYIRICI);
  const govde = parcalar[0];
  const imza = parcalar[1];
  if (parcalar.length !== 2 || !govde || !imza) {
    throw new AdisyonHatasi(HATA_KODU.OTURUM_GECERSIZ, "Oturum gecersiz.");
  }

  const beklenenImza = imzala(govde, sir);
  if (!imzalarEsit(imza, beklenenImza)) {
    throw new AdisyonHatasi(HATA_KODU.OTURUM_GECERSIZ, "Oturum gecersiz.");
  }

  let icerik: TokenIcerigi;
  try {
    icerik = JSON.parse(base64urlCoz(govde)) as TokenIcerigi;
  } catch {
    throw new AdisyonHatasi(HATA_KODU.OTURUM_GECERSIZ, "Oturum gecersiz.");
  }

  if (typeof icerik.bitisMs !== "number" || icerik.bitisMs <= simdiMs) {
    throw new AdisyonHatasi(HATA_KODU.OTURUM_GECERSIZ, "Oturum suresi dolmus.");
  }
  return icerik;
}
