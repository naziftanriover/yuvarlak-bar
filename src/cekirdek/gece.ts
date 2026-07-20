// Gece kapanisi (Z raporu): bir gecenin toplamlarinin kilitlenmis anlik goruntusu.
// Kapatildiktan sonra degistirilemez; patron gecmis geceleri boyle gorur.

export interface GeceKapanisi {
  id: string;
  baslangic: string; // donem baslangici (ISO)
  bitis: string; // donem bitisi (ISO)
  adisyonSayisi: number;
  ciroKurus: number;
  maliyetKurus: number;
  karKurus: number;
  nakitKurus: number;
  kartKurus: number;
  kapatanKullaniciId: string;
  zaman: string; // kapatilma ani (ISO)
}
