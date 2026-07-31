"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, BellRing, Check, Clock3, KeyRound, MapPin, Power, Save } from "lucide-react";
import { AppShell } from "./app-shell";
import { readJson } from "@/lib/http";
import { getCurrentCoordinates, type BrowserCoordinates } from "@/lib/browser-location";

type Profile = { name: string | null; city: string | null; experience_years: number; languages: string[]; specialities: string[]; bio: string | null; verification_status: string; review_note?: string | null; is_online: boolean; rating: string; completed_jobs: number; latitude: number | null; longitude: number | null };
type Booking = {
  id: string; status: string; service_name: string; customer_name: string | null; amount: number;
  address: string; created_at: string; request_type: string; situation: string | null;
  preferred_language: string | null; materials_option: string;
  customer_latitude: number | null; customer_longitude: number | null;
};

export function PanditPortal() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [form, setForm] = useState({ name: "", city: "", experienceYears: 0, languages: "Hindi", specialities: "Ganesh Puja", bio: "", baseCharge: 1100 });
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [coordinates, setCoordinates] = useState<BrowserCoordinates | null>(null);
  const [arrivalOtps, setArrivalOtps] = useState<Record<string, string>>({});
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});

  async function loadProfile(syncForm = false) {
    const response = await fetch(`/api/pandit/profile?fresh=${Date.now()}`, { cache: "no-store" });
    const data = await readJson<{ profile?: Profile & { base_charge?: number } }>(response);
    if (!data.profile) return;
    setProfile(data.profile);
    if (syncForm) {
      setForm({ name: data.profile.name ?? "", city: data.profile.city ?? "", experienceYears: data.profile.experience_years ?? 0, languages: (data.profile.languages ?? []).join(", "), specialities: (data.profile.specialities ?? []).join(", "), bio: data.profile.bio ?? "", baseCharge: data.profile.base_charge ?? 1100 });
    }
  }

  async function loadBookings() {
    const response = await fetch(`/api/bookings?fresh=${Date.now()}`, { cache: "no-store" });
    const data = await readJson<{ bookings?: Booking[]; error?: string }>(response);
    if (response.ok) setBookings(data.bookings ?? []);
  }

  function load(syncForm = false) {
    void loadProfile(syncForm);
    void loadBookings();
  }

  useEffect(() => {
    load(true);
    const refresh = () => { load(false); };
    const timer = window.setInterval(refresh, 5_000);
    const onVisibility = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!profile?.is_online || !navigator.geolocation) return;
    let lastSentAt = 0;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (now - lastSentAt < 15_000) return;
        lastSentAt = now;
        void fetch("/api/pandit/profile", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }),
        });
      },
      () => setNotice("Live location paused. Allow location access to remain visible to nearby customers."),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 10_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [profile?.is_online]);

  async function captureLocation() {
    setLocationBusy(true);
    setNotice("");
    try {
      const current = await getCurrentCoordinates();
      setCoordinates(current);
      setNotice(`GPS location detected within about ${Math.round(current.accuracy)} metres.`);
      return current;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to detect your location.");
      return null;
    } finally {
      setLocationBusy(false);
    }
  }

  async function saveProfile() {
    setBusy(true); setNotice("");
    const response = await fetch("/api/pandit/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({
      ...form,
      languages: form.languages.split(",").map((x) => x.trim()).filter(Boolean),
      specialities: form.specialities.split(",").map((x) => x.trim()).filter(Boolean),
      latitude: coordinates?.latitude,
      longitude: coordinates?.longitude,
    }) });
    const data = await readJson<{ error?: string }>(response);
    setNotice(response.ok ? "Profile saved. It is ready for admin review." : data.error ?? "Unable to save");
    setBusy(false); load();
  }

  async function toggleOnline() {
    if (!profile) return;
    setNotice("");
    setBusy(true);
    let current: BrowserCoordinates | null = null;
    if (!profile.is_online) {
      current = await captureLocation();
      if (!current) { setBusy(false); return; }
    }
    const response = await fetch("/api/pandit/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        isOnline: !profile.is_online,
        ...(current ? { latitude: current.latitude, longitude: current.longitude } : {}),
      }),
    });
    const result = await readJson<{ error?: string }>(response);
    if (!response.ok) setNotice(result.error ?? "Unable to change availability");
    else setNotice(profile.is_online ? "You are now offline." : "You are online with your current GPS location.");
    setBusy(false);
    await loadProfile(false);
  }

  async function transition(id: string, status: string, arrivalOtp?: string) {
    setBusy(true);
    setNotice("");
    setActionErrors((current) => ({ ...current, [id]: "" }));
    const response = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, ...(arrivalOtp ? { arrivalOtp } : {}) }),
    });
    const data = await readJson<{ error?: string }>(response);
    if (!response.ok) {
      setActionErrors((current) => ({ ...current, [id]: data.error ?? "Action unavailable" }));
    } else if (status === "IN_PROGRESS") {
      setArrivalOtps((current) => ({ ...current, [id]: "" }));
    }
    await loadBookings();
    setBusy(false);
  }

  if (!profile) return <AppShell role="Pandit" title="Loading your portal…" subtitle="Preparing your profile and requests."><div className="loading-card">Loading…</div></AppShell>;
  const incomplete = ["INCOMPLETE", "CHANGES_REQUESTED"].includes(profile.verification_status);
  const active = bookings.filter((b) => !["COMPLETED", "DECLINED", "CANCELLED"].includes(b.status));

  return (
    <AppShell role="Pandit" title={incomplete ? "Complete your Pandit profile" : `Namaste, ${profile.name ?? "Pandit ji"}`} subtitle={incomplete ? "One short form replaces the confusing multi-step registration." : "Manage availability and urgent requests from one screen."}>
      {notice && <div className="alert success">{notice}</div>}
      {profile.verification_status === "CHANGES_REQUESTED" && <div className="alert error">Admin requested changes: {profile.review_note ?? "Please review and update your profile."}</div>}
      {incomplete ? <section className="onboarding-card">
        <div className="onboarding-intro"><span className="eyebrow">Simple registration</span><h2>Tell customers what matters</h2><p>Only essential information is required now. Documents and payouts can be added after the core flow is tested.</p><div className="safe-box"><BadgeCheck size={21} /><div><strong>Private by default</strong><small>Your phone and personal documents are never public.</small></div></div></div>
        <div className="form-grid">
          <label>Full name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>City<input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
          <label>Years of experience<input type="number" min="0" value={form.experienceYears} onChange={(e) => setForm({ ...form, experienceYears: Number(e.target.value) })} /></label>
          <label>Starting charge (₹)<input type="number" min="0" value={form.baseCharge} onChange={(e) => setForm({ ...form, baseCharge: Number(e.target.value) })} /></label>
          <label className="span-2">Languages <small>Separate with commas</small><input value={form.languages} onChange={(e) => setForm({ ...form, languages: e.target.value })} /></label>
          <label className="span-2">Puja specialities <small>Separate with commas</small><input value={form.specialities} onChange={(e) => setForm({ ...form, specialities: e.target.value })} /></label>
          <label className="span-2">Short introduction<textarea rows={4} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Describe your tradition, experience and approach." /></label>
          <div className="span-2 location-capture"><button className="btn btn-ghost btn-block" onClick={captureLocation} disabled={locationBusy}>{locationBusy ? "Detecting location…" : <><MapPin size={17} /> Use my current GPS location</>}</button><p className={`location-state ${coordinates ? "ready" : ""}`}>{coordinates ? `Location detected within about ${Math.round(coordinates.accuracy)} metres` : "Your exact GPS position is used only for nearby matching."}</p></div>
          <button className="btn btn-primary span-2" onClick={saveProfile} disabled={busy || !form.name || !form.city || !form.bio}>{busy ? "Saving…" : <><Save size={17} /> Save profile for review</>}</button>
        </div>
      </section> : <>
        <section className={`role-action-banner ${profile.is_online ? "online" : ""}`}>
          <span className="role-action-icon"><Power /></span>
          <div><span className="eyebrow">Your availability</span><h2>{profile.is_online ? "You are visible to nearby customers" : "Go online when you are ready for requests"}</h2><p>{profile.is_online ? "Keep this page open. New urgent requests appear automatically with a sound-ready action card." : "Your GPS location is captured only when you choose to go online."}</p></div>
          <button className={`btn ${profile.is_online ? "btn-ghost" : "btn-primary"}`} onClick={toggleOnline} disabled={busy || locationBusy}>{profile.is_online ? "Go offline" : "Go online now"}</button>
        </section>
        <section className="stat-grid" id="pandit-status">
          <article><span>Availability</span><strong className={profile.is_online ? "green" : ""}>{profile.is_online ? "Online" : "Offline"}</strong><button className={`switch ${profile.is_online ? "on" : ""}`} onClick={toggleOnline} disabled={busy || locationBusy}><i /><Power size={14} /></button><small><MapPin size={14} /> {profile.is_online ? "Live GPS location active" : "Location refreshes when you go online"}</small></article>
          <article><span>Verification</span><strong>{profile.verification_status.replaceAll("_", " ")}</strong><small><BadgeCheck size={14} /> Admin review status</small></article>
          <article><span>Rating</span><strong>{profile.rating} ★</strong><small>{profile.completed_jobs} completed Puja visits</small></article>
        </section>
        <section className="history" id="pandit-requests"><div className="section-title"><div><h2>Urgent requests</h2><p>Only clear, actionable requests appear here.</p></div><span className="live-pill"><i /> {active.length} active</span></div>
          {active.length ? <div className="request-grid">{active.map((b) => <article className="request-card" key={b.id}><div className="request-top"><span className="service-icon">ॐ</span><div><strong>{b.service_name}</strong><small><Clock3 size={13} /> {b.request_type.replaceAll("_", " ")}</small></div><b>₹{b.amount.toLocaleString("en-IN")}</b></div>
            {b.situation && <div className="request-context"><span>Customer&apos;s situation</span><p>{b.situation}</p></div>}
            <div className="request-tags"><span>{b.preferred_language ?? "Any language"}</span><span>{b.materials_option.replaceAll("_", " ")}</span></div>
            <p><MapPin size={16} /> {b.address}</p><span className="status">{b.status.replaceAll("_", " ")}</span><div className="button-row">
            {b.status === "REQUESTED" && <><button className="btn btn-ghost" disabled={busy} onClick={() => transition(b.id, "DECLINED")}>Decline</button><button className="btn btn-primary" disabled={busy} onClick={() => transition(b.id, "ACCEPTED")}><Check size={16} /> Accept</button></>}
            {b.status === "ACCEPTED" && <button className="btn btn-primary btn-block" disabled={busy} onClick={() => transition(b.id, "ON_THE_WAY")}>Start journey</button>}
            {b.status === "ON_THE_WAY" && <button className="btn btn-primary btn-block" disabled={busy} onClick={() => transition(b.id, "ARRIVED")}>Mark arrived</button>}
            {b.status === "ARRIVED" && <div className="arrival-verification">
              <label htmlFor={`arrival-otp-${b.id}`}><KeyRound size={16} /> Customer arrival OTP</label>
              <p>Ask the customer for the 6-digit code shown in their live request.</p>
              <div>
                <input
                  id={`arrival-otp-${b.id}`}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="6-digit OTP"
                  value={arrivalOtps[b.id] ?? ""}
                  onChange={(event) => setArrivalOtps((current) => ({ ...current, [b.id]: event.target.value.replace(/\D/g, "").slice(0, 6) }))}
                />
                <button className="btn btn-primary" disabled={busy || (arrivalOtps[b.id]?.length ?? 0) !== 6} onClick={() => transition(b.id, "IN_PROGRESS", arrivalOtps[b.id])}>Verify OTP & start Puja</button>
              </div>
            </div>}
            {b.status === "IN_PROGRESS" && <button className="btn btn-primary btn-block" disabled={busy} onClick={() => transition(b.id, "COMPLETED")}>Complete Puja</button>}
          </div>{actionErrors[b.id] && <div className="inline-action-error">{actionErrors[b.id]}</div>}</article>)}</div> : <div className="empty"><BellRing size={26} /><strong>No active requests</strong><span>Stay online. New urgent bookings will appear here automatically.</span></div>}
        </section>
      </>}
    </AppShell>
  );
}
