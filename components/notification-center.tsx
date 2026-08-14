"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellRing, Check, ShieldCheck, X } from "lucide-react";
import { readJson } from "@/lib/http";
import { connectDeviceToPush } from "@/lib/client-push";

type Item = { id: string; title: string; body: string; url: string; event_type: string; read_at: string | null; created_at: string };
type PortalRole = "Customer" | "Pandit" | "Admin";

const ONBOARDING_KEY = "panditconnect-notification-onboarding-v2";
const PROMPT_AFTER_KEY = "panditconnect-notification-prompt-after";
const PANDIT_ALARM_KEY = "panditconnect-pandit-loud-alarm";
const PANDIT_ALARM_EVENTS = new Set(["BOOKING_REQUESTED", "CONSULTATION_STARTED", "SCHEDULED_PUJA_GUIDANCE_REQUIRED", "SCHEDULED_PUJA_REMINDER", "BOOKING_SCHEDULE_UPDATED", "PANDIT_APPROVED", "PANDIT_REJECTED", "PANDIT_CHANGES_REQUESTED"]);
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

async function playPanditDecisionAlarm() {
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  alertAudioContext ??= new AudioContextClass();
  if (alertAudioContext.state === "suspended") await alertAudioContext.resume();
  const startedAt = alertAudioContext.currentTime;
  [[0, 880], [0.2, 1180], [0.4, 880], [0.7, 1320], [0.95, 1040], [1.2, 1320]].forEach(([delay, frequency]) => {
    const oscillator = alertAudioContext!.createOscillator();
    const gain = alertAudioContext!.createGain();
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(frequency, startedAt + delay);
    gain.gain.setValueAtTime(0.0001, startedAt + delay);
    gain.gain.exponentialRampToValueAtTime(0.42, startedAt + delay + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, startedAt + delay + 0.17);
    oscillator.connect(gain).connect(alertAudioContext!.destination);
    oscillator.start(startedAt + delay);
    oscillator.stop(startedAt + delay + 0.19);
  });
  if ("vibrate" in navigator) navigator.vibrate([500, 120, 500, 120, 700]);
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
  const [decisionAlert, setDecisionAlert] = useState<Item | null>(null);
  const latestId = useRef<string | null>(null);
  const lastSoundAt = useRef(0);

  const alertDevice = useCallback(async (eventType?: string) => {
    if (localStorage.getItem("panditconnect-notification-sound") !== "on" || Date.now() - lastSoundAt.current < 1500) return;
    lastSoundAt.current = Date.now();
    if ("vibrate" in navigator) navigator.vibrate([180, 80, 180]);
    await (role === "Pandit" && eventType && PANDIT_ALARM_EVENTS.has(eventType) ? playPanditDecisionAlarm() : playAlertSound());
  }, [role]);

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
    if (latestId.current && nextItems[0]?.id && latestId.current !== nextItems[0].id) void alertDevice(nextItems[0].event_type);
    latestId.current = nextItems[0]?.id ?? latestId.current;
    setDecisionAlert(role === "Pandit" ? nextItems.find((item) => !item.read_at && PANDIT_ALARM_EVENTS.has(item.event_type)) ?? null : null);
    setItems(nextItems);
    setUnread(data.unread ?? 0);
    setKey((current) => data.vapidPublicKey || publicKey || current);
  }, [alertDevice, role]);

  useEffect(() => {
    const onPush = (event: MessageEvent) => {
      if (event.data?.type !== "PANDITCONNECT_PUSH") return;
      void alertDevice(event.data.eventType);
      void load();
    };
    const initial = window.setTimeout(() => {
      void load();
    }, 0);
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").then((registration) => registration.update());
    navigator.serviceWorker?.addEventListener("message", onPush);
    const timer = window.setInterval(() => {if(document.visibilityState==="visible")void load();}, 30_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      navigator.serviceWorker?.removeEventListener("message", onPush);
    };
  }, [alertDevice, load]);

  useEffect(() => {
    if (role !== "Pandit" || !decisionAlert || localStorage.getItem("panditconnect-notification-sound") !== "on") return;
    void playPanditDecisionAlarm().catch(() => undefined);
    const timer = window.setInterval(() => void playPanditDecisionAlarm().catch(() => undefined), 8_000);
    return () => window.clearInterval(timer);
  }, [decisionAlert, role]);

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
        setMessage("Notifications are not available on this device right now.");
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

  async function show() {
    setOpen(true);
    if (unread) {
      await fetch("/api/notifications", { method: "PATCH" });
      setUnread(0);
      setItems((old) => old.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })));
      setDecisionAlert(null);
    }
  }

  async function acknowledgeDecision() {
    await fetch("/api/notifications", { method: "PATCH" });
    setUnread(0);
    setItems((old) => old.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })));
    setDecisionAlert(null);
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
          : <div className="notification-enabled"><p className="notification-message"><Check size={14} />Device alerts are on.</p></div>}
        {message && <p className="notification-message"><Check size={14} />{message}</p>}
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

    {role === "Pandit" && decisionAlert && <div className="pandit-decision-alert-backdrop" role="presentation">
      <section className={`pandit-decision-alert ${decisionAlert.event_type === "PANDIT_APPROVED" ? "is-approved" : "is-attention"}`} role="alertdialog" aria-modal="true" aria-labelledby="pandit-decision-title">
        <span className="pandit-decision-alert-icon">{decisionAlert.event_type === "PANDIT_APPROVED" ? <Check /> : <BellRing />}</span>
        <span className="eyebrow">Admin decision</span>
        <h2 id="pandit-decision-title">{decisionAlert.title}</h2>
        <p>{decisionAlert.body}</p>
        <a className="btn btn-primary" href={decisionAlert.url} onClick={() => void acknowledgeDecision()}>Open my Pandit portal</a>
        <button className="pandit-decision-acknowledge" onClick={() => void acknowledgeDecision()}>I have read this</button>
      </section>
    </div>}
  </>;
}
