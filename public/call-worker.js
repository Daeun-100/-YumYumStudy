/* Notification-only service worker: never caches app pages or API/auth responses. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let payload;
    try { payload = event.data?.json(); } catch { return; }
    if (!payload || typeof payload.title !== 'string' || typeof payload.body !== 'string' || ![0, 1].includes(payload.roomId)) return;
    await self.registration.showNotification(payload.title.slice(0, 80), {
      body: payload.body.slice(0, 160), icon: '/call-logo.png', badge: '/call-badge.png',
      tag: `friend-call-${payload.callId}`, data: { roomId: payload.roomId },
    });
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const room = event.notification.data?.roomId;
  if (![0, 1].includes(room)) return;
  const target = new URL(`/?friendCallRoom=${room}`, self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.navigate(target);
        await client.focus();
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
