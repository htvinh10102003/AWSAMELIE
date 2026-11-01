// Service worker cho WMS, chỉ để Chrome đủ điều kiện cho "Cài đặt ứng dụng".
// An toàn với dữ liệu: mọi request tới Supabase, auth và mọi request POST
// đều đi thẳng mạng, không bao giờ đọc từ cache. Trang điều hướng cũng
// network-first để không bao giờ kẹt bản cũ sau khi deploy.
const CACHE_NAME = 'wms-static-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET') return;
  if (url.hostname.includes('supabase.co')) return;
  if (url.pathname.startsWith('/auth')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }
  const isStatic = /\.(js|css|png|svg|jpg|jpeg|webp|woff2?|ttf)$/i.test(url.pathname);
  if (!isStatic) return;
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
