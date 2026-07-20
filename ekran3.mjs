import { chromium } from "playwright";
const TABAN = "http://127.0.0.1:4602";
const CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
async function api(m, y, t, g) {
  const h = { "Content-Type": "application/json" };
  if (t) h.Authorization = "Bearer " + t;
  const c = await fetch(TABAN + y, { method: m, headers: h, body: g ? JSON.stringify(g) : undefined });
  const v = await c.json(); if (!c.ok) throw new Error(y + " -> " + (v.hata || c.status)); return v;
}
const { token } = await api("POST", "/giris", null, { kullaniciAdi: "patron", sifre: "patron12345" });
await api("POST", "/kullanicilar", token, { ad: "Ahmet Yılmaz", kullaniciAdi: "ahmet", sifre: "mudur12345", rol: "MUDUR" });
await api("POST", "/kullanicilar", token, { ad: "Zeynep Kaya", kullaniciAdi: "zeynep", sifre: "garson12345", rol: "GARSON" });
await api("POST", "/kullanicilar", token, { ad: "Mehmet Demir", kullaniciAdi: "mehmet", sifre: "garson12345", rol: "GARSON" });

const b = await chromium.launch({ executablePath: CHROME });
const s = await b.newPage({ viewport: { width: 900, height: 900 } });
await s.goto(TABAN + "/giris.html");
await s.fill("#kullaniciAdi", "patron"); await s.fill("#sifre", "patron12345");
await s.click("button[type=submit]"); await s.waitForURL("**/rapor.html");
await s.goto(TABAN + "/kullanicilar.html"); await s.waitForTimeout(1000);
await s.screenshot({ path: "/tmp/ss-kullanicilar.png", fullPage: true });
await b.close();
console.log("HAZIR");
