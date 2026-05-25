const CACHE_NAME = "salesflow-v2"; // Jag har döpt om den till v2 för att tvinga bort den gamla direkt
const URLS_TO_CACHE = [
  "/SalesFlow/",
  "/SalesFlow/index.html",
  "/SalesFlow/manifest.json",
  "/SalesFlow/icon-192.png",
  "/SalesFlow/icon-512.png"
];

// INSTALLATION: Tvinga omedelbar installation av ny version
self.addEventListener("install", event => {
  self.skipWaiting(); // Viktigt! Säger åt appen att inte vänta på nästa omstart
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(URLS_TO_CACHE))
  );
});

// AKTIVERING: Rensa ut gamla cachar (som v1) och ta kontroll direkt
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  return self.clients.claim(); // Tvingar appen att använda den nya koden direkt
});

// FETCH: "Network-First" strategi
self.addEventListener("fetch", event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Om vi har internet och får en bra fil tillbaka, uppdatera cachen i bakgrunden
        if (response && response.status === 200 && response.type === 'basic') {
          let responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response; // Visa den allra senaste koden
      })
      .catch(() => {
        // Om du är offline (eller servern ligger nere), använd den sparade cachen
        return caches.match(event.request);
      })
  );
});
