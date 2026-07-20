// Sunucu yapilandirmasi. Gizli bilgiler (token sirri) KOD ICINE YAZILMAZ;
// ortam degiskenlerinden (environment variables) okunur.

import { AdisyonHatasi, HATA_KODU } from "../cekirdek/index";

const VARSAYILAN_PORT = 3000;
const VARSAYILAN_VERITABANI = "yuvarlak-bar.db";
const VARSAYILAN_TOKEN_SAAT = 12;
const EN_AZ_SIR_UZUNLUGU = 16;
const SAAT_MS = 60 * 60 * 1000;

export interface Yapilandirma {
  port: number;
  veritabaniYolu: string;
  tokenSirri: string;
  tokenSuresiMs: number;
}

// Ortam degiskenlerinden yapilandirmayi olusturur. Token sirri yoksa/zayifsa
// sunucu guvensiz calismasin diye acilista hata verir.
export function ortamdanYapilandir(ortam: Record<string, string | undefined> = process.env): Yapilandirma {
  const tokenSirri = ortam.YB_TOKEN_SIRRI;
  if (!tokenSirri || tokenSirri.length < EN_AZ_SIR_UZUNLUGU) {
    throw new AdisyonHatasi(
      HATA_KODU.OTURUM_GECERSIZ,
      `YB_TOKEN_SIRRI ortam degiskeni en az ${EN_AZ_SIR_UZUNLUGU} karakter olmali.`,
    );
  }

  const port = Number(ortam.YB_PORT ?? VARSAYILAN_PORT);
  const tokenSaat = Number(ortam.YB_TOKEN_SAAT ?? VARSAYILAN_TOKEN_SAAT);

  return {
    port: Number.isFinite(port) ? port : VARSAYILAN_PORT,
    veritabaniYolu: ortam.YB_VERITABANI ?? VARSAYILAN_VERITABANI,
    tokenSirri,
    tokenSuresiMs: (Number.isFinite(tokenSaat) ? tokenSaat : VARSAYILAN_TOKEN_SAAT) * SAAT_MS,
  };
}
