const CACHE_NAME = "salesflow-v8"; // Bumpas vid varje släpp som byter cachade filer. Aktiveringssteget nedan
// raderar alla cachar som inte matchar namnet.
const URLS_TO_CACHE = [
  "/SalesFlow/",
  "/SalesFlow/index.html",
  "/SalesFlow/manifest.json",
  "/SalesFlow/icon-192-v2.png",
  "/SalesFlow/icon-512-v2.png",
  "/SalesFlow/icon-maskable-512-v2.png"
];

// ============================================================
//  SNABBNOTISEN — appens "widget"
//  Android låter inte en PWA lägga ut widgets på hemskärmen, så det närmaste
//  vi kommer är en notis som ligger kvar i notisfältet och på låsskärmen.
//  Den visar dagens mål och hur långt du kommit, och knappen "+1000 kr"
//  skriver rakt till Supabase HÄRIFRÅN — appen behöver inte öppnas.
//
//  Sidan lämnar över en ögonblicksbild av dagen (mål, sålt, status) som
//  ligger i en egen cache, så notisen vet vad den ska visa även när appen
//  varit stängd länge och service workern hunnit dödas.
// ============================================================
const SNAP_CACHE = "sf-snapshot";       // överlever cacherensningen nedan
const SNAP_URL   = "/SalesFlow/__sf-dag";
const NOTIS_TAG  = "sf-dag";
const SB_URL = "https://xnrclzkzzthlesaftpvs.supabase.co";
const SB_KEY = "sb_publishable_EhCyGN_p4TH-rtOEuDLXOA_9hIxS7pW";

async function lasSnapshot() {
  try {
    const c = await caches.open(SNAP_CACHE);
    const r = await c.match(SNAP_URL);
    return r ? await r.json() : null;
  } catch (e) { return null; }
}
async function skrivSnapshot(o) {
  try {
    const c = await caches.open(SNAP_CACHE);
    await c.put(SNAP_URL, new Response(JSON.stringify(o), { headers: { "Content-Type": "application/json" } }));
  } catch (e) {}
}

function kr(n) { return Math.round(n).toLocaleString("sv-SE") + " kr"; }

// Skriver hela raden, precis som pushMatrixSync i appen. En upsert med bara
// några kolumner skulle nolla resten.
async function upsertDag(s) {
  const svar = await fetch(SB_URL + "/rest/v1/sales_data", {
    method: "POST",
    headers: {
      "apikey": SB_KEY,
      "Authorization": "Bearer " + SB_KEY,
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify([{
      date_key: s.k, status: s.st || "Arbete", sales: s.salt,
      is_absent: s.abs || null, raw_reason: s.raw || "",
      fk_perc: s.fk_perc === undefined ? null : s.fk_perc,
      abs_hours: s.abs_hours === undefined ? null : s.abs_hours,
      eval_data: s.eval === undefined ? null : s.eval
    }])
  });
  if (!svar.ok) throw new Error("Supabase svarade " + svar.status);
}

async function ritaNotis() {
  const s = await lasSnapshot();
  if (!s || !s.pa) return;
  const mal = (s.mal || 0) + (s.boost || 0);
  const kvar = Math.max(0, mal - s.salt);
  const klar = s.mal > 0 && s.salt >= s.mal;
  const proc = s.mal > 0 ? Math.min(100, Math.round((s.salt / s.mal) * 100)) : 0;

  let rubrik, rad;
  if (!s.mal) {
    rubrik = "SalesFlow · " + (s.datum || "Idag");
    rad = s.salt > 0 ? kr(s.salt) + " registrerat" : "Inget mål i dag";
  } else if (klar) {
    rubrik = "✓ Dagsmål klart · " + kr(s.mal);
    rad = kr(s.salt) + (kvar > 0 ? " · " + kr(kvar) + " kvar till boosten"
                                 : " · " + kr(s.salt - s.mal) + " över målet");
  } else {
    rubrik = "Dagens mål · " + kr(s.mal);
    rad = kr(s.salt) + " · " + proc + " % · " + kr(kvar) + " kvar";
  }
  if (s.osynkat > 0) rad += " · väntar på nät";

  await self.registration.showNotification(rubrik, {
    body: rad,
    tag: NOTIS_TAG,          // ersätter sig själv i stället för att stapla
    renotify: false,
    silent: true,            // ingen signal vid varje uppdatering
    icon: "/SalesFlow/icon-192-v2.png",
    badge: "/SalesFlow/icon-192-v2.png",
    data: { k: s.k },
    actions: [{ action: "plus", title: "+" + kr(s.steg || 1000) }]
  });
}

async function stangNotis() {
  const n = await self.registration.getNotifications({ tag: NOTIS_TAG });
  n.forEach(x => x.close());
}

// Lägg på ett steg och skriv igenom. Lyckas inte nätet sparas differensen i
// ögonblicksbilden, och appen skickar upp den nästa gång den startar.
async function laggTill(steg) {
  const s = await lasSnapshot();
  if (!s) return;
  s.salt = (s.salt || 0) + steg;
  try {
    await upsertDag(s);
    if (s.osynkat) s.osynkat = 0;
  } catch (e) {
    s.osynkat = (s.osynkat || 0) + steg;
  }
  await skrivSnapshot(s);
  await ritaNotis();
  // Ligger appen öppen ska den uppdatera sig direkt, inte vid nästa start.
  const klienter = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  klienter.forEach(c => c.postMessage({ typ: "sf-tillagt", k: s.k, salt: s.salt, steg }));
}

self.addEventListener("message", event => {
  const d = event.data || {};
  if (d.typ === "sf-snapshot") {
    event.waitUntil((async () => {
      await skrivSnapshot(d.snapshot);
      if (d.snapshot && d.snapshot.pa) await ritaNotis(); else await stangNotis();
    })());
  } else if (d.typ === "sf-stang") {
    event.waitUntil(stangNotis());
  }
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  if (event.action === "plus") {
    event.waitUntil((async () => {
      const s = await lasSnapshot();
      await laggTill((s && s.steg) || 1000);
    })());
    return;
  }
  // Tryck på själva notisen: hoppa in i appen i stället för att starta en ny flik.
  event.waitUntil((async () => {
    const klienter = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of klienter) {
      if (c.url.includes("/SalesFlow/") && "focus" in c) return c.focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow("/SalesFlow/");
  })());
});

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
          // Ögonblicksbilden är data, inte en kopia av en fil – den får inte
          // rensas bort när en ny version installeras.
          .filter(key => key !== CACHE_NAME && key !== SNAP_CACHE)
          .map(key => caches.delete(key))
      )
    )
  );
  return self.clients.claim(); // Tvingar appen att använda den nya koden direkt
});

// FETCH: "Network-First" strategi
self.addEventListener("fetch", event => {
  // Bara appens egna GET-hämtningar hör hemma i cachen. Skrivningar mot
  // Supabase och andra API-anrop ska gå rakt ut – de är inga filer, och
  // cache.put() på en POST kastar dessutom.
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).origin !== self.location.origin) return;
  // Ögonblicksbilden är ingen riktig fil – den ska aldrig ut på nätet.
  if (event.request.url.includes(SNAP_URL)) return;
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
