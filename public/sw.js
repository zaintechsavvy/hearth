/* Hearth's service worker: an offline page for navigations, and notifications pushed by the server. */
const CACHE = "hearth-shell-v1";
const OFFLINE = "/offline.html";

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([OFFLINE, "/icon.svg"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE)));
});

self.addEventListener("push", event => {
  let message = { title: "Hearth", body: "" };
  try {
    message = { ...message, ...event.data.json() };
  } catch {
    message.body = event.data ? event.data.text() : "";
  }
  event.waitUntil(self.registration.showNotification(message.title, {
    body: message.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: message.tag,
    renotify: Boolean(message.tag),
    data: { url: message.url || "/dashboard" },
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url || "/dashboard";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(windows => {
    const open = windows.find(client => new URL(client.url).pathname.startsWith("/"));
    if (open) return open.focus().then(client => client.navigate(url));
    return self.clients.openWindow(url);
  }));
});
