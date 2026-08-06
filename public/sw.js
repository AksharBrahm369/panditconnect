self.addEventListener("push", (event) => {
  let data = { title: "PanditConnect", body: "You have a new update.", url: "/" };
  try { data = { ...data, ...event.data.json() }; } catch {}
  event.waitUntil(Promise.all([
    self.registration.showNotification(data.title, { body: data.body, icon: "/icon-192.png", badge: "/notification-badge.png", data: { url: data.url }, tag: data.eventType || "panditconnect-update", renotify: true, silent: false, requireInteraction: data.eventType === "BOOKING_REQUESTED", vibrate: [180, 80, 180] }),
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => windows.forEach((client) => client.postMessage({ type: "PANDITCONNECT_PUSH", eventType: data.eventType }))),
  ]));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => { const existing = windows.find((client) => client.url.startsWith(self.location.origin)); if (existing) { existing.navigate(url); return existing.focus(); } return clients.openWindow(url); }));
});
