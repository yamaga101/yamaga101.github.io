/**
 * Keeps the app openable when the machine serving it is asleep.
 *
 * The page is served off the operator's Mac through Tailscale, so the Mac being shut or
 * sleeping takes the app down — which is exactly when a phone at the bedside wants it
 * (2026-09-14). Nothing here touches YouTube: the players still need the network. What this
 * saves is the shell, so the app opens and its controls work instead of showing a dead page.
 *
 * No version constant lives here on purpose. The app's version has one home, package.json
 * (rules/standards.md §8), and a second copy would drift. Freshness comes from the strategy
 * instead: built assets carry a content hash in their name and never change under the same
 * URL, so they are safe to serve from cache forever; the page itself is fetched fresh when
 * the network answers and falls back to cache when it does not.
 */

const CACHE = 'yt-dual-shell';
const NAVIGATION_TIMEOUT_MS = 2500;

/**
 * The one file that must never come from the cache.
 *
 * It is what the update button compares against, so a cached copy would answer "you are up to
 * date" forever — the exact failure the button exists to end.
 */
const ALWAYS_FRESH = '/version.json';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add('/'))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * The update button, having found a newer build, asks the waiting worker to take over now
 * rather than at some later cold start — which in an installed app may never come.
 */
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') void self.skipWaiting();
});

/** Resolves to null rather than rejecting, so the caller can fall back without a try block. */
function fetchWithin(request, timeoutMs) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    fetch(request)
      .then((response) => {
        clearTimeout(timer);
        resolve(response);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(null);
      });
  });
}

async function handleNavigation(request) {
  const fresh = await fetchWithin(request, NAVIGATION_TIMEOUT_MS);
  if (fresh?.ok) {
    const cache = await caches.open(CACHE);
    await cache.put('/', fresh.clone());
    return fresh;
  }

  const cached = await caches.match('/');
  if (cached !== undefined) return cached;

  return new Response('オフラインで、保存された画面もありません。', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

async function handleAsset(request) {
  const cached = await caches.match(request);
  if (cached !== undefined) return cached;

  const fresh = await fetch(request);
  if (fresh.ok) {
    const cache = await caches.open(CACHE);
    await cache.put(request, fresh.clone());
  }
  return fresh;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Only our own files. YouTube's player must always talk to YouTube.
  if (url.origin !== self.location.origin) return;
  // Straight to the network, uncached, so the update check sees what the server has today.
  if (url.pathname === ALWAYS_FRESH) return;

  event.respondWith(request.mode === 'navigate' ? handleNavigation(request) : handleAsset(request));
});
