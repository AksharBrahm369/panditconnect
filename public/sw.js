self.addEventListener("push", (event) => {
  let data = { title: "PanditConnect", body: "You have a new update.", url: "/" };
  try { data = { ...data, ...event.data.json() }; } catch {}
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: "/favicon.svg", badge: "/favicon.svg", data: { url: data.url }, tag: data.eventType || "panditconnect-update", renotify: true }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => { const existing = windows.find((client) => client.url.startsWith(self.location.origin)); if (existing) { existing.navigate(url); return existing.focus(); } return clients.openWindow(url); }));
});
