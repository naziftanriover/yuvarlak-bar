// Legend of the West — servis işçisi.
// Amaç: uygulamanın "kurulabilir uygulama" (PWA) sayılması için bir fetch dinleyicisi sağlamak.
// ÖNEMLİ: Hiçbir şey ÖNBELLEĞE ALINMIYOR — her istek doğrudan ağdan gelir,
// böylece kod güncellemeleri anında yansır (eski sürüm takılı kalmaz).
self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => self.clients.claim());
self.addEventListener("fetch", (e) => {
  // Ağdan getir; önbellek yok.
  e.respondWith(fetch(e.request));
});
