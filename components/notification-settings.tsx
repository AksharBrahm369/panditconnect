"use client";

import { useEffect, useState } from "react";
import { BellRing, Save } from "lucide-react";
import { readJson } from "@/lib/http";

type Preferences = { booking_updates: boolean; chat_updates: boolean; service_updates: boolean; marketing: boolean };
const initial: Preferences = { booking_updates: true, chat_updates: true, service_updates: true, marketing: false };
export function NotificationSettings() {
  const [preferences, setPreferences] = useState(initial); const [saving, setSaving] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  useEffect(() => { void fetch("/api/notification-preferences", { cache: "no-store" }).then(async (response) => { const data = await readJson<{ preferences?: Preferences }>(response); if (data.preferences) setPreferences(data.preferences); }); }, []);
  async function save() { setSaving(true); setMessage(""); setError(""); const response = await fetch("/api/notification-preferences", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ bookingUpdates: preferences.booking_updates, chatUpdates: preferences.chat_updates, serviceUpdates: preferences.service_updates, marketing: preferences.marketing }) }); if (response.ok) setMessage("Notification preferences saved."); else setError("Unable to save notification preferences."); setSaving(false); }
  const toggle = (key: keyof Preferences) => setPreferences((current) => ({ ...current, [key]: !current[key] }));
  return <section className="private-settings-card"><div className="private-card-heading"><span><BellRing /></span><div><h2>Notification preferences</h2><p>Control which account alerts you receive.</p></div></div><div className="settings-toggle-list">
    <label><span><strong>Urgent booking updates</strong><small>New requests, cancellations and customer status changes</small></span><input type="checkbox" checked={preferences.booking_updates} onChange={() => toggle("booking_updates")} /></label>
    <label><span><strong>Live chat updates</strong><small>Guidance requests and new chat messages</small></span><input type="checkbox" checked={preferences.chat_updates} onChange={() => toggle("chat_updates")} /></label>
    <label><span><strong>Account and review updates</strong><small>Verification, payout and service updates</small></span><input type="checkbox" checked={preferences.service_updates} onChange={() => toggle("service_updates")} /></label>
    <label><span><strong>Tips and announcements</strong><small>Optional product news and platform guidance</small></span><input type="checkbox" checked={preferences.marketing} onChange={() => toggle("marketing")} /></label>
  </div>{error && <div className="alert error">{error}</div>}{message && <div className="alert success">{message}</div>}<button className="btn btn-primary settings-save" disabled={saving} onClick={save}><Save size={17} />{saving ? "Saving..." : "Save preferences"}</button></section>;
}
