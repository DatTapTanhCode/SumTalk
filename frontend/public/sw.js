// Service worker: keeps the app shell cached so the recorder opens without a connection.
// API calls are never cached - offline audio lives in IndexedDB and is synced by the app.
const CACHE = 'sumtalk-v1'
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg', '/pcm-worklet.js']

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      await cache.addAll(SHELL)
      // Also cache the hashed JS/CSS bundles that index.html references.
      const html = await (await fetch('/', { cache: 'no-store' })).text()
      const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1])
      await cache.addAll(assets)
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key)
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    // Network first so updates show up; any route falls back to the cached single-page app.
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) (await caches.open(CACHE)).put('/', response.clone())
          return response
        })
        .catch(async () => (await caches.match('/')) || Response.error()),
    )
    return
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request)
      if (cached && url.pathname.startsWith('/assets/')) return cached // hashed file names never change
      try {
        const response = await fetch(request)
        if (response.ok) (await caches.open(CACHE)).put(request, response.clone())
        return response
      } catch {
        return cached || Response.error()
      }
    })(),
  )
})
