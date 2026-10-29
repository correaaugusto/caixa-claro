// Service worker simples: guarda os arquivos do app para abrir sem internet
// e permite mostrar a notificação do aviso diário.
const CACHE = 'caixa-claro-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  // Rede primeiro; se estiver sem internet, usa a cópia guardada.
  e.respondWith(
    fetch(e.request)
      .then((resp) => {
        const copia = resp.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copia));
        return resp;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('/'))),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((abertas) =>
      abertas.length ? abertas[0].focus() : self.clients.openWindow('/'),
    ),
  );
});
