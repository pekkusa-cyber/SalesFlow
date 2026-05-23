self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Krävs för PWA-installation, lämnas öppen för nätverksanrop så att Supabase fungerar direkt
});
