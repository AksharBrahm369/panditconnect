"use client";

import { useEffect, useState } from "react";
import { ConsultationPanel } from "./consultation-panel";
import { PanditUrgentAlarm } from "./pandit-urgent-alarm";
import { readJson } from "@/lib/http";

type GuidanceProfile = { consultation_online?: boolean; consultation_rate_5min?: number };

export function PanditGuidanceSettings() {
  const [profile, setProfile] = useState<GuidanceProfile | null>(null);
  const [rate, setRate] = useState(99);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [urgentChatIds, setUrgentChatIds] = useState<string[]>([]);

  async function load() {
    const response = await fetch("/api/pandit/profile", { cache: "no-store" });
    const data = await readJson<{ profile?: GuidanceProfile; error?: string }>(response);
    if (!response.ok) return setMessage(data.error ?? "Unable to load online guidance settings.");
    setProfile(data.profile ?? {});
    setRate(Number(data.profile?.consultation_rate_5min) || 99);
  }

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, []);

  async function save(enabled: boolean) {
    setBusy(true); setMessage("");
    const response = await fetch("/api/pandit/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ consultationOnline: enabled, consultationRate5Min: rate }) });
    const data = await readJson<{ error?: string }>(response);
    setMessage(response.ok ? enabled ? "You are available for online guidance." : "Online guidance is paused." : data.error ?? "Unable to update online guidance.");
    if (response.ok) await load();
    setBusy(false);
  }

  if (!profile) return <div className="loading-card">Loading your guidance settings…</div>;
  return <div className="pandit-guidance-settings">
    <section className="settings-card">
      <div><h2>Online guidance</h2><p>Offer a private five-minute chat when you are ready. This does not affect your availability for home visits.</p></div>
      <label>Charge for 5 minutes<input type="text" inputMode="numeric" value={rate} onChange={(event) => setRate(Number(event.target.value.replace(/\D/g, "").slice(0, 4)) || 0)} /></label>
      <button className="btn btn-primary" disabled={busy || rate < 20} onClick={() => void save(!profile.consultation_online)}>{profile.consultation_online ? "Pause online guidance" : "Start online guidance"}</button>
      {message && <p className="settings-message" role="status">{message}</p>}
    </section>
    {profile.consultation_online && <><PanditUrgentAlarm pujaRequests={0} chatRequests={urgentChatIds.length}/><ConsultationPanel role="PANDIT" onUrgentItemsChange={setUrgentChatIds}/></>}
  </div>;
}
