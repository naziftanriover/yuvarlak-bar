import { chromium } from "playwright";
const TABAN = "http://127.0.0.1:4603";
const CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
async function api(m,y,t,g){const h={"Content-Type":"application/json"};if(t)h.Authorization="Bearer "+t;const c=await fetch(TABAN+y,{method:m,headers:h,body:g?JSON.stringify(g):undefined});const v=await c.json();if(!c.ok)throw new Error(y+" -> "+(v.hata||c.status));return v;}
const id=()=>crypto.randomUUID();
const {token:t}=await api("POST","/giris",null,{kullaniciAdi:"patron",sifre:"patron12345"});
await api("POST","/urunler",t,{id:id(),ad:"Efes",kategori:"Bira",satisFiyatiKurus:15000,maliyetKurus:9000,stokAdedi:48});
await api("POST","/urunler",t,{id:id(),ad:"Kırmızı Şarap",kategori:"Şarap",satisFiyatiKurus:22000,maliyetKurus:13000,stokAdedi:6});
await api("POST","/urunler",t,{id:id(),ad:"Humus",kategori:"Meze",satisFiyatiKurus:8000,maliyetKurus:3500,stokAdedi:20});
await api("POST","/masalar",t,{id:id(),ad:"Masa 1"});
const b=await chromium.launch({executablePath:CHROME});
const s=await b.newPage({viewport:{width:960,height:1000}});
await s.goto(TABAN+"/giris.html");
await s.fill("#kullaniciAdi","patron");await s.fill("#sifre","patron12345");
await s.click("button[type=submit]");await s.waitForURL("**/rapor.html");
await s.goto(TABAN+"/satis.html");await s.waitForTimeout(1200);
await s.screenshot({path:"/tmp/ss-urunyonet.png",fullPage:true});
await b.close();console.log("HAZIR");
