// Servislerin ihtiyac duydugu "dis dunya" saglayicilari: benzersiz kimlik ve zaman.
// Bunlari disaridan vermek, servisleri testte sabit/tahmin edilebilir yapar.

import { randomUUID } from "node:crypto";
import type { Rol } from "../cekirdek/index";

// Bir istegi yapan kullanicinin kimligi ve rolu (tokenden gelir).
export interface Aktor {
  kullaniciId: string;
  rol: Rol;
}

export interface Saglayicilar {
  yeniKimlik(): string; // benzersiz id
  simdiIso(): string; // ISO zaman metni
  simdiMs(): number; // epoch milisaniye
}

// Gercek calismada kullanilan saglayicilar (rastgele id + gercek saat).
export function varsayilanSaglayicilar(): Saglayicilar {
  return {
    yeniKimlik: () => randomUUID(),
    simdiIso: () => new Date().toISOString(),
    simdiMs: () => Date.now(),
  };
}
