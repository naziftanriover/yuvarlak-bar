// Sunucuyu baslatan giris dosyasi.
// Calistirmak icin: npm run basla  (once ortam degiskenlerini ayarlayin)

import { ortamdanYapilandir } from "./api/yapilandirma";
import { veritabaniAc } from "./veri/index";
import { varsayilanSaglayicilar } from "./servis/index";
import { bagimliliklariKur, sunucuOlustur } from "./api/sunucu";
import { ilkPatronuSagla } from "./api/kurulum";

async function baslat(): Promise<void> {
  const yapilandirma = ortamdanYapilandir();
  const db = veritabaniAc(yapilandirma.veritabaniYolu);
  const saglayici = varsayilanSaglayicilar();

  await ilkPatronuSagla(db, saglayici);

  const bagimliliklar = bagimliliklariKur(db, yapilandirma, saglayici);
  const sunucu = sunucuOlustur(bagimliliklar);

  sunucu.listen(yapilandirma.port, () => {
    console.log(`Yuvarlak Bar sunucusu ${yapilandirma.port} portunda calisiyor.`);
  });
}

baslat().catch((hata) => {
  const mesaj = hata instanceof Error ? hata.message : String(hata);
  console.error("Sunucu baslatilamadi:", mesaj);
  process.exit(1);
});
