"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellRing, Check, ShieldCheck, X } from "lucide-react";
import { readJson } from "@/lib/http";
import { connectDeviceToPush } from "@/lib/client-push";

type Item = { id: string; title: string; body: string; url: string; read_at: string | null; created_at: string };
type Preferences = { booking_updates: boolean; chat_updates: boolean; service_updates: boolean; marketing: boolean };
type PortalRole = "Customer" | "Pandit" | "Admin";

const ONBOARDING_KEY = "panditconnect-notification-onboarding-v2";
const PROMPT_AFTER_KEY = "panditconnect-notification-prompt-after";
const PANDIT_ALARM_KEY = "panditconnect-pandit-loud-alarm";
let alertAudioContext: AudioContext | null = null;

async function playAlertSound() {
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  alertAudioContext ??= new AudioContextClass();
  if (alertAudioContext.state === "suspended") await alertAudioContext.resume();
  const startedAt = alertAudioContext.currentTime;
  [[0, 740], [0.16, 940], [0.34, 1120]].forEach(([delay, frequency]) => {
    const oscillator = alertAudioContext!.createOscillator();
    const gain = alertAudioContext!.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, startedAt + delay);
    gain.gain.exponentialRampToValueAtTime(0.18, startedAt + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startedAt + delay + 0.13);
    oscillator.connect(gain).connect(alertAudioContext!.destination);
    oscillator.start(startedAt + delay);
    oscillator.stop(startedAt + delay + 0.14);
  });
}

const onboardingCopy: Record<PortalRole, { title: string; body: string }> = {
  Customer: {
    title: "Get every Pandit update",
    body: "Receive an alert when your Pandit accepts, starts travelling, arrives, or changes the booking.",
  },
  Pandit: {
    title: "Never miss a Puja request",
    body: "Receive urgent Puja and live-chat alerts even when this page is not open.",
  },
  Admin: {
    title: "Stay informed about the platform",
    body: "Receive review, booking, and support alerts on this device.",
  },
};

export function NotificationCenter({ role }: { role: PortalRole }) {
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [key, setKey] = useState("");
  const [message, setMessage] = useState("");
  const [automaticPrompt, setAutomaticPrompt] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [preferences, setPreferences] = useState<Preferences>({ booking_updates: true, chat_updates: true, service_updates: true, marketing: false });
  const latestId = useRef<string | null>(null);
  const lastSoundAt = useRef(0);

  const alertDevice = useCallback(async () => {
    if (localStorage.getItem("panditconnect-notification-sound") !== "on" || Date.now() - lastSoundAt.current < 1500) return;
    lastSoundAt.current = Date.now();
    if ("vibrate" in navigator) navigator.vibrate([180, 80, 180]);
    await playAlertSound();
  }, []);

  const load = useCallback(async () => {
    const [response, keyResponse] = await Promise.all([
      fetch("/api/notifications", { cache: "no-store" }),
      fetch("/api/notifications/public-key", { cache: "no-store" }),
    ]);
    let publicKey = "";
    if (keyResponse.ok) {
      const config = await readJson<{ vapidPublicKey?: string }>(keyResponse);
      publicKey = config.vapidPublicKey ?? "";
      setKey(publicKey);
      if ("Notification" in window && Notification.permission === "granted") {
        void connectDeviceToPush(publicKey, false).then((connected) => {
          setEnabled(connected);
          if (connected) localStorage.setItem(ONBOARDING_KEY, "enabled");
        });
      }
    }
    if (!response.ok) return;
    const data = await readJson<{ notifications?: Item[]; unread?: number; vapidPublicKey?: string }>(response);
    const nextItems = data.notifications ?? [];
    if (latestId.current && nextItems[0]?.id && latestId.current !== nextItems[0].id) void alertDevice();
    latestId.current = nextItems[0]?.id ?? latestId.current;
    setItems(nextItems);
    setUnread(data.unread ?? 0);
    setKey((current) => data.vapidPublicKey || publicKey || current);
  }, [alertDevice]);

  useEffect(() => {
    const onPush = (event: MessageEvent) => {
      if (event.data?.type !== "PANDITCONNECT_PUSH") return;
      void alertDevice();
      void load();
    };
    const initial = window.setTimeout(() => {
      void load();
      void fetch("/api/notification-preferences")
        .then((response) => readJson<{ preferences?: Preferences }>(response))
        .then((data) => data.preferences && setPreferences(data.preferences));
    }, 0);
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").then((registration) => registration.update());
    navigator.serviceWorker?.addEventListener("message", onPush);
    const timer = window.setInterval(() => void load(), 10_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      navigator.serviceWorker?.removeEventListener("message", onPush);
    };
  }, [alertDevice, load]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!("Notification" in window) || Notification.permission !== "default") return;
      if (localStorage.getItem(ONBOARDING_KEY) === "enabled") return;
      const promptAfter = Number(localStorage.getItem(PROMPT_AFTER_KEY) || 0);
      if (promptAfter > Date.now()) return;
      setAutomaticPrompt(true);
    }, 900);
    return () => window.clearTimeout(timer);
  }, []);

  async function resolvePublicKey() {
    if (key) return key;
    const response = await fetch("/api/notifications/public-key", { cache: "no-store" });
    if (!response.ok) return "";
    const config = await readJson<{ vapidPublicKey?: string }>(response);
    const publicKey = config.vapidPublicKey ?? "";
    setKey(publicKey);
    return publicKey;
  }

  async function enable(fromAutomaticPrompt = false) {
    setMessage("");
    setConnecting(true);
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setMessage("This browser does not support background notifications. On iPhone, add PanditConnect to the Home Screen first.");
        return;
      }
      const publicKey = await resolvePublicKey();
      if (!publicKey) {
        setMessage("Device notifications are being configured. Please try again shortly.");
        return;
      }
      const connected = await connectDeviceToPush(publicKey, true);
      if (!connected) {
        setMessage(Notification.permission === "denied"
          ? "Notifications are blocked for this website. Allow them in your browser settings."
          : "Could not connect this device. Please try again.");
        return;
      }
      localStorage.setItem("panditconnect-notification-sound", "on");
      localStorage.setItem(ONBOARDING_KEY, "enabled");
      localStorage.removeItem(PROMPT_AFTER_KEY);
      if (role === "Pandit") localStorage.setItem(PANDIT_ALARM_KEY, "on");
      setEnabled(true);
      setAutomaticPrompt(false);
      setMessage("Notifications are ready on this device.");
      await playAlertSound();
    } finally {
      setConnecting(false);
      if (fromAutomaticPrompt && Notification.permission === "denied") setAutomaticPrompt(false);
    }
  }

  function remindLater() {
    localStorage.setItem(PROMPT_AFTER_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
    setAutomaticPrompt(false);
  }

  async function testAlert() {
    setMessage("Sending a test alert…");
    await playAlertSound();
    const response = await fetch("/api/notifications/test", { method: "POST" });
    const result = await readJson<{ delivery?: { pushConfigured?: boolean; subscriptions?: number; delivered?: number } }>(response);
    setMessage(!response.ok
      ? "Could not send the test alert yet. Please try again."
      : !result.delivery?.pushConfigured
        ? "Push configuration is incomplete. In-app sound works, but background push is unavailable."
        : !result.delivery?.subscriptions
          ? "This device has no saved push subscription. Press Enable and allow notifications."
          : result.delivery.delivered
            ? "Test push delivered. Background alerts and in-app sound are connected."
            : "Push delivery failed. The subscription exists; check browser and device notification settings.");
  }

  async function show() {
    setOpen(true);
    if (unread) {
      await fetch("/api/notifications", { method: "PATCH" });
      setUnread(0);
      setItems((old) => old.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })));
    }
  }

  async function updatePreference(preferenceKey: keyof Preferences, value: boolean) {
    const next = { ...preferences, [preferenceKey]: value };
    setPreferences(next);
    await fetch("/api/notification-preferences", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bookingUpdates: next.booking_updates, chatUpdates: next.chat_updates, serviceUpdates: next.service_updates, marketing: next.marketing }),
    });
  }

  const promptCopy = onboardingCopy[role];
  return <>
    <div className="notification-center">
      <button className="icon-button notification-button" onClick={() => open ? setOpen(false) : void show()} aria-label="Notifications">
        {unread ? <BellRing size={18} /> : <Bell size={18} />}{unread > 0 && <b>{Math.min(unread, 9)}{unread > 9 ? "+" : ""}</b>}
      </button>
      {open && <section className="notification-panel">
        <header><div><strong>Notifications</strong><small>Updates for this account</small></div><button className="icon-button" onClick={() => setOpen(false)} aria-label="Close notifications"><X size={16} /></button></header>
        {!enabled
          ? <div className="notification-permission"><BellRing size={19} /><div><strong>Never miss an urgent update</strong><small>Receive booking, chat and review alerts on this device.</small></div><button onClick={() => void enable()} disabled={connecting}>{connecting ? "Connecting…" : "Enable"}</button></div>
          : <div className="notification-enabled"><p className="notification-message"><Check size={14} />Device alerts are on.</p><button onClick={() => void testAlert()}>Test alert</button></div>}
        {message && <p className="notification-message"><Check size={14} />{message}</p>}
        <div className="notification-preferences"><strong>Alert preferences</strong><label><input type="checkbox" checked={preferences.booking_updates} onChange={(event) => void updatePreference("booking_updates", event.target.checked)} />Booking updates</label><label><input type="checkbox" checked={preferences.chat_updates} onChange={(event) => void updatePreference("chat_updates", event.target.checked)} />Chat updates</label><label><input type="checkbox" checked={preferences.service_updates} onChange={(event) => void updatePreference("service_updates", event.target.checked)} />Account and service updates</label></div>
        <div className="notification-list">{items.length ? items.map((item) => <a href={item.url} key={item.id} className={!item.read_at ? "unread" : ""}><strong>{item.title}</strong><span>{item.body}</span><small>{new Date(item.created_at).toLocaleString("en-IN")}</small></a>) : <p className="notification-empty">No notifications yet.</p>}</div>
      </section>}
    </div>

    {automaticPrompt && <div className="notification-onboarding-backdrop" role="presentation">
      <section className="notification-onboarding" role="dialog" aria-modal="true" aria-labelledby="notification-onboarding-title">
        <span className="notification-onboarding-icon"><BellRing /></span>
        <span className="eyebrow">Important alerts</span>
        <h2 id="notification-onboarding-title">{promptCopy.title}</h2>
        <p>{promptCopy.body}</p>
        <div className="notification-onboarding-trust"><ShieldCheck /><span><strong>Only useful account alerts</strong><small>You can change this later from Notifications.</small></span></div>
        {message && <p className="notification-onboarding-error">{message}</p>}
        <button className="btn btn-primary" onClick={() => void enable(true)} disabled={connecting}>{connecting ? "Connecting this device…" : "Allow notifications"}</button>
        <button className="notification-onboarding-later" onClick={remindLater} disabled={connecting}>Not now</button>
      </section>
    </div>}
  </>;
}
