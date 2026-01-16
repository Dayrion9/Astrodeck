/* public/sw.js */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || "Astrodeck";
  const options = {
    body: data.body || "",
    tag: data.tag,
    data: { url: data.url || "/" },
    icon: data.icon || "/push-icon.png",
    badge: data.badge || "/push-badge.png",
    image: data.image || undefined,
    actions: Array.isArray(data.actions) ? data.actions : undefined,
    renotify: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification?.data?.url || "/";
  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of allClients) {
        if ("focus" in c) {
          c.focus();
          try {
            c.navigate(url);
          } catch {}
          return;
        }
      }
      if (clients.openWindow) {
        await clients.openWindow(url);
      }
    })()
  );
});
