// =========================================================================
// SERVICE WORKER — maakt van de site een installeerbare app die offline werkt.
// Toegevoegd 11-10-2026 op verzoek van Ivo ("kan er een Android-app van?").
//
// Strategie, bewust twee verschillende:
//   * de pagina zelf  → NETWERK EERST, met de cache als vangnet. Zo zie je na
//     een upload naar GitHub meteen de nieuwe versie, en werkt het zonder
//     internet toch gewoon door.
//   * iconen/manifest → CACHE EERST. Die veranderen bijna nooit en hoeven
//     geen netwerkronde te kosten.
//
// ⚠️ Verhoog VERSIE bij elke nieuwe upload waarin dit bestand zelf verandert.
// De pagina-cache hoeft dat niet: die wordt bij elk online bezoek ververst.
// =========================================================================
const VERSIE = 'ptcomigo-v1';
const SCHIL = ['./', './index.html', './manifest.webmanifest',
               './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', (e) => {
  // addAll faalt in zijn geheel als één bestand ontbreekt; daarom per stuk,
  // zodat een ontbrekend icoon de hele installatie niet onderuit haalt.
  e.waitUntil((async () => {
    const cache = await caches.open(VERSIE);
    await Promise.all(SCHIL.map(u => cache.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const namen = await caches.keys();
    await Promise.all(namen.filter(n => n !== VERSIE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;   // nooit externe verzoeken onderscheppen

  const isPagina = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('index.html');

  if(isPagina){
    e.respondWith((async () => {
      try{
        const vers = await fetch(req);
        const cache = await caches.open(VERSIE);
        cache.put('./index.html', vers.clone());
        return vers;
      }catch(err){
        const cache = await caches.open(VERSIE);
        return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const cache = await caches.open(VERSIE);
    const uitCache = await cache.match(req);
    if(uitCache) return uitCache;
    try{
      const vers = await fetch(req);
      if(vers && vers.ok) cache.put(req, vers.clone());
      return vers;
    }catch(err){
      return Response.error();
    }
  })());
});
