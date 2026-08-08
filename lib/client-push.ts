"use client";

function decodeKey(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob((value + padding).replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0));
}

function sameKey(current: ArrayBuffer | null, expected: Uint8Array) {
  if (!current) return false;
  const bytes = new Uint8Array(current);
  return bytes.length === expected.length && bytes.every((value, index) => value === expected[index]);
}

export async function connectDeviceToPush(publicKey: string, askPermission: boolean) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window) || !publicKey) return false;
  let permission = Notification.permission;
  if (askPermission && permission === "default") permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const installed = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await installed.update().catch(() => undefined);
  const registration = await navigator.serviceWorker.ready;
  const expectedKey = decodeKey(publicKey);
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && !sameKey(subscription.options.applicationServerKey, expectedKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: expectedKey });
  const response = await fetch("/api/notifications/subscription", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(subscription.toJSON()),
  });
  return response.ok;
}
