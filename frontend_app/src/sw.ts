/// <reference lib="webworker" />

// Hand-written service worker (loaded via vite-plugin-pwa's injectManifest
// strategy). Keeps the Workbox runtime caching that previously lived in
// vite.config.ts, then adds Web Push event handlers for the class-times
// notification feature.

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, setDefaultHandler, NavigationRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// ── Precache + Workbox routing ──────────────────────────────────────────────

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST ?? []);

// Auto-activate new SW immediately — don't wait for all tabs to close.
// The client-side registerSW({ onNeedRefresh }) sends a SKIP_WAITING
// message; this listener picks it up and takes control of all clients
// so the new code is live on the next navigation without a manual refresh.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Claim all open clients immediately after activation so the new SW
// controls existing tabs without requiring a reload.
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Google Fonts CSS
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({
    cacheName: 'google-fonts-css',
    plugins: [new ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 365 * 24 * 60 * 60 })],
  }),
);

// Google Fonts WOFF2
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-woff',
    plugins: [
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

// API GET — NetworkFirst so the user always gets the freshest data online,
// but stale-cached on bad networks.
registerRoute(
  ({ url, request }) => url.pathname.startsWith('/api/') && request.method === 'GET',
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

// Navigation fallback — SPA shell.
const navHandler = new NetworkFirst({ cacheName: 'navigation', networkTimeoutSeconds: 3 });
const navRoute = new NavigationRoute(navHandler, {
  denylist: [/^\/api/, /^\/auth/],
});
registerRoute(navRoute);

setDefaultHandler(new NetworkFirst());

// ── Web Push ─────────────────────────────────────────────────────────────────
//
// Payload contract from the backend (see lib/notificationScheduler.ts):
//   { kind, title, body, url, scheduleId }
//
// `url` is a relative path the user lands on after tapping. For the drive-home
// log notification it's `/quick-log?from=class&class=<id>&kind=drive_home`.

interface PushPayload {
  kind: 'pre_class' | 'intention_check' | 'drive_home_log';
  title: string;
  body: string;
  url: string;
  scheduleId?: string;
}

function parsePayload(event: PushEvent): PushPayload | null {
  if (!event.data) return null;
  try {
    return event.data.json() as PushPayload;
  } catch {
    return null;
  }
}

self.addEventListener('push', (event) => {
  const payload = parsePayload(event);
  if (!payload) return;

  // 1–2 simple actions per Apple HIG. Pre-class is informational only.
  // `actions` isn't in the standard NotificationOptions DOM lib type, but
  // is widely supported on Android/desktop browsers — cast through `unknown`.
  const actions = payload.kind === 'pre_class'
    ? []
    : [
        { action: 'log',  title: 'Open log' },
        { action: 'skip', title: 'Skip' },
      ];

  const options = {
    body: payload.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.kind,                  // collapse repeated kinds — newest wins
    data: { url: payload.url, scheduleId: payload.scheduleId, kind: payload.kind },
    actions,
  } as unknown as NotificationOptions;

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', (event) => {
  const action = event.action;
  const data = (event.notification.data ?? {}) as { url?: string };
  event.notification.close();
  if (action === 'skip') return;

  const targetUrl = data.url ?? '/home';

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Reuse an existing window if open; navigate it to the target URL.
    for (const client of allClients) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) {
          try { await (client as WindowClient).navigate(targetUrl); } catch { /* cross-origin */ }
        }
        return;
      }
    }
    if (self.clients.openWindow) {
      await self.clients.openWindow(targetUrl);
    }
  })());
});

// Apple recommends acting on `pushsubscriptionchange` to re-subscribe when iOS
// rotates the endpoint. We can't re-subscribe without VAPID + server context
// here; the client app catches this on next foreground load via pushClient.
self.addEventListener('pushsubscriptionchange', () => {
  // No-op — handled by the client on next foreground.
});
