"use client";
import { useEffect, useRef, useState } from "react";
import { Bell, BellRing, Check, X } from "lucide-react";
import { readJson } from "@/lib/http";

type Item = { id: string; title: string; body: string; url: string; read_at: string | null; created_at: string };
function decodeKey(value: string) { const padding = "=".repeat((4 - value.length % 4) % 4); return Uint8Array.from(atob((value + padding).replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0)); }
function sameKey(current: ArrayBuffer | null, expected: Uint8Array) { if (!current) return false; const bytes = new Uint8Array(current); return bytes.length === expected.length && bytes.every((value, index) => value === expected[index]); }

async function connectDevice(publicKey: string, askPermission: boolean) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !publicKey) return false;
  let permission = Notification.permission;
  if (askPermission && permission === "default") permission = await Notification.requestPermission();
  if (permission !== "granted") return false;
  const registration = await navigator.serviceWorker.ready; const expectedKey = decodeKey(publicKey); let subscription = await registration.pushManager.getSubscription();
  if (subscription && !sameKey(subscription.options.applicationServerKey, expectedKey)) { await subscription.unsubscribe(); subscription = null; }
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: expectedKey });
  const response = await fetch("/api/notifications/subscription", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(subscription.toJSON()) });
  return response.ok;
}

let alertAudioContext: AudioContext | null = null;
async function playAlertSound() {
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  alertAudioContext ??= new AudioContextClass();
  if (alertAudioContext.state === "suspended") await alertAudioContext.resume();
  const startedAt = alertAudioContext.currentTime;
  [[0, 740], [0.16, 940], [0.34, 1120]].forEach(([delay, frequency]) => {
    const oscillator = alertAudioContext!.createOscillator(); const gain = alertAudioContext!.createGain();
    oscillator.type = "sine"; oscillator.frequency.value = frequency; gain.gain.setValueAtTime(0.0001, startedAt + delay); gain.gain.exponentialRampToValueAtTime(0.18, startedAt + delay + 0.02); gain.gain.exponentialRampToValueAtTime(0.0001, startedAt + delay + 0.13); oscillator.connect(gain).connect(alertAudioContext!.destination); oscillator.start(startedAt + delay); oscillator.stop(startedAt + delay + 0.14);
  });
}

export function NotificationCenter() {
  const [items, setItems] = useState<Item[]>([]); const [unread, setUnread] = useState(0); const [open, setOpen] = useState(false); const [enabled, setEnabled] = useState(false); const [key, setKey] = useState(""); const [message, setMessage] = useState("");
  const latestId = useRef<string | null>(null);
  async function load() { const [response, keyResponse] = await Promise.all([fetch("/api/notifications", { cache: "no-store" }), fetch("/api/notifications/public-key")]); let publicKey = ""; if (keyResponse.ok) { const config = await readJson<{ vapidPublicKey?: string }>(keyResponse); publicKey = config.vapidPublicKey ?? ""; setKey(publicKey); if (Notification.permission === "granted") void connectDevice(publicKey, false).then(setEnabled); } if (!response.ok) return; const data = await readJson<{ notifications?: Item[]; unread?: number; vapidPublicKey?: string }>(response); const nextItems = data.notifications ?? []; if (latestId.current && nextItems[0]?.id && latestId.current !== nextItems[0].id && localStorage.getItem("panditconnect-notification-sound") === "on") void playAlertSound(); latestId.current = nextItems[0]?.id ?? latestId.current; setItems(nextItems); setUnread(data.unread ?? 0); setKey((current) => data.vapidPublicKey || publicKey || current); }
  useEffect(() => { const onPush = () => { if (localStorage.getItem("panditconnect-notification-sound") === "on") void playAlertSound(); void load(); }; const initial = window.setTimeout(() => void load(), 0); if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js"); navigator.serviceWorker?.addEventListener("message", onPush); const timer = window.setInterval(() => void load(), 15000); return () => { window.clearTimeout(initial); window.clearInterval(timer); navigator.serviceWorker?.removeEventListener("message", onPush); }; }, []);
  async function enable() { setMessage(""); await playAlertSound(); if (!("serviceWorker" in navigator) || !("PushManager" in window)) { setMessage("Push notifications are not supported in this browser."); return; } if (!key) { setMessage("Device notifications are being configured. Please try again shortly."); return; } const connected = await connectDevice(key, true); if (!connected) { setMessage(Notification.permission === "denied" ? "Notifications are blocked. Allow them in your browser settings first." : "Could not connect this device. Please try again."); return; } localStorage.setItem("panditconnect-notification-sound", "on"); setEnabled(true); setMessage("Notifications and alert sound enabled on this device."); }
  async function testAlert() { setMessage("Sending a test alert…"); await playAlertSound(); const response = await fetch("/api/notifications/test", { method: "POST" }); setMessage(response.ok ? "Test alert sent. Lock the screen to test background delivery." : "Could not send the test alert yet. Please try again."); }
  async function show() { setOpen(true); if (enabled) { localStorage.setItem("panditconnect-notification-sound", "on"); await playAlertSound(); } if (unread) { await fetch("/api/notifications", { method: "PATCH" }); setUnread(0); setItems((old) => old.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() }))); } }
  return <div className="notification-center"><button className="icon-button notification-button" onClick={() => open ? setOpen(false) : void show()} aria-label="Notifications">{unread ? <BellRing size={18} /> : <Bell size={18} />}{unread > 0 && <b>{Math.min(unread, 9)}{unread > 9 ? "+" : ""}</b>}</button>{open && <section className="notification-panel"><header><div><strong>Notifications</strong><small>Updates for this account</small></div><button className="icon-button" onClick={() => setOpen(false)} aria-label="Close notifications"><X size={16} /></button></header>{!enabled ? <div className="notification-permission"><BellRing size={19} /><div><strong>Never miss an urgent update</strong><small>Receive booking, chat and review alerts with sound on this device.</small></div><button onClick={() => void enable()}>Enable</button></div> : <div className="notification-enabled"><p className="notification-message"><Check size={14} />Device alerts and in-app sound are on.</p><button onClick={() => void testAlert()}>Test sound</button></div>}{message && <p className="notification-message"><Check size={14} />{message}</p>}<div className="notification-list">{items.length ? items.map((item) => <a href={item.url} key={item.id} className={!item.read_at ? "unread" : ""}><strong>{item.title}</strong><span>{item.body}</span><small>{new Date(item.created_at).toLocaleString("en-IN")}</small></a>) : <p className="notification-empty">No notifications yet.</p>}</div></section>}</div>;
}
