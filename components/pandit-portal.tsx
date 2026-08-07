"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, BellRing, Check, Clock3, KeyRound, MapPin, MessageCircle, Power } from "lucide-react";
import { AppShell } from "./app-shell";
import { ConsultationPanel } from "./consultation-panel";
import { readJson } from "@/lib/http";
import { getCurrentCoordinates, type BrowserCoordinates } from "@/lib/browser-location";
import { PanditOnboarding } from "./pandit-onboarding";
import { SupportCenter } from "./support-center";

type Profile = { name: string | null; city: string | null; experience_years: number; languages: string[]; specialities: string[]; bio: string | null; verification_status: string; review_note?: string | null; is_online: boolean; rating: string; rating_count: number; completed_jobs: number; latitude: number | null; longitude: number | null; consultation_online: boolean; consultation_rate_5min: number };
type Booking = {
  id: string; status: string; service_name: string; customer_name: string | null; amount: number;
  address: string; created_at: string; request_type: string; situation: string | null;
  preferred_language: string | null; materials_option: string;
  customer_latitude: number | null; customer_longitude: number | null;
  payment_method: "CASH" | "UPI" | "CARD" | "OTHER" | null; payment_status: "NOT_SELECTED" | "CONFIRMED"; payment_confirmed_at: string | null;
};

export function PanditPortal() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [arrivalOtps, setArrivalOtps] = useState<Record<string, string>>({});
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const [consultationRate, setConsultationRate] = useState(99);

  async function loadProfile(syncForm = false) {
    const response = await fetch(`/api/pandit/profile?fresh=${Date.now()}`, { cache: "no-store" });
    const data = await readJson<{ profile?: Profile & { base_charge?: number } }>(response);
    if (!data.profile) return;
    setProfile(data.profile);
    setConsultationRate(data.profile.consultation_rate_5min ?? 99);
    void syncForm;
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
    const initial = window.setTimeout(() => load(true), 0);
    const refresh = () => { load(false); };
    const timer = window.setInterval(refresh, 5_000);
    const onVisibility = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // load is intentionally stable for the lifetime of this mounted portal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setNotice(`GPS location detected within about ${Math.round(current.accuracy)} metres.`);
      return current;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to detect your location.");
      return null;
    } finally {
      setLocationBusy(false);
    }
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
    } else if (status === "COMPLETED") {
      setNotice("Puja completed. The payment options are now visible on the customer's phone. You will see their choice below.");
    }
    await loadBookings();
    setBusy(false);
  }

  async function toggleConsultation() {
    if (!profile) return;
    setBusy(true); setNotice("");
    const response = await fetch("/api/pandit/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        consultationOnline: !profile.consultation_online,
        consultationRate5Min: consultationRate,
      }),
    });
    const data = await readJson<{ error?: string }>(response);
    setNotice(response.ok
      ? profile.consultation_online ? "Online guidance is now paused." : "You are now available for live beta guidance."
      : data.error ?? "Unable to update consultation availability.");
    setBusy(false);
    await loadProfile(false);
  }

  if (!profile) return <AppShell role="Pandit" title="Loading your portal…" subtitle="Preparing your profile and requests."><div className="loading-card">Loading…</div></AppShell>;
  const incomplete = ["INCOMPLETE", "PENDING", "SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED", "REJECTED"].includes(profile.verification_status);
  const active = bookings.filter((b) => !["COMPLETED", "DECLINED", "CANCELLED"].includes(b.status));
  const completed = bookings.filter((b) => b.status === "COMPLETED").slice(0, 6);

  return (
    <AppShell role="Pandit" title={incomplete ? "Complete your verified Pandit profile" : `Namaste, ${profile.name ?? "Pandit ji"}`} subtitle={incomplete ? "A trusted profile helps customers book with confidence." : "Manage availability and urgent requests from one screen."}>
      {notice && <div className="alert success">{notice}</div>}
      {profile.verification_status === "CHANGES_REQUESTED" && <div className="alert error">Admin requested changes: {profile.review_note ?? "Please review and update your profile."}</div>}
      {incomplete ? <PanditOnboarding status={profile.verification_status} reviewNote={profile.review_note} onSaved={() => void loadProfile(true)} /> : <>
        <section className={`role-action-banner ${profile.is_online ? "online" : ""}`}>
          <span className="role-action-icon"><Power /></span>
          <div><span className="eyebrow">Your availability</span><h2>{profile.is_online ? "You are visible to nearby customers" : "Go online when you are ready for requests"}</h2><p>{profile.is_online ? "Keep this page open. New urgent requests appear automatically with a sound-ready action card." : "Your GPS location is captured only when you choose to go online."}</p></div>
          <button className={`btn ${profile.is_online ? "btn-ghost" : "btn-primary"}`} onClick={toggleOnline} disabled={busy || locationBusy}>{profile.is_online ? "Go offline" : "Go online now"}</button>
        </section>
        <section className="stat-grid" id="pandit-status">
          <article><span>Availability</span><strong className={profile.is_online ? "green" : ""}>{profile.is_online ? "Online" : "Offline"}</strong><button className={`switch ${profile.is_online ? "on" : ""}`} onClick={toggleOnline} disabled={busy || locationBusy}><i /><Power size={14} /></button><small><MapPin size={14} /> {profile.is_online ? "Live GPS location active" : "Location refreshes when you go online"}</small></article>
          <article><span>Verification</span><strong>{profile.verification_status.replaceAll("_", " ")}</strong><small><BadgeCheck size={14} /> Admin review status</small></article>
          <article><span>Customer rating</span><strong>{profile.rating_count ? `${profile.rating} ★` : "New"}</strong><small>{profile.rating_count ? `${profile.rating_count} verified rating${profile.rating_count === 1 ? "" : "s"}` : "No customer ratings yet"} · {profile.completed_jobs} completed Puja visits</small></article>
        </section>
        <section className={`consultation-availability ${profile.consultation_online ? "online" : ""}`}>
          <span><MessageCircle /></span>
          <div><span className="eyebrow">Remote guidance</span><h2>{profile.consultation_online ? "You are available for live chat" : "Offer online guidance"}</h2><p>Free during beta. Your future five-minute rate is saved for when secure payments launch.</p></div>
          <label>Future rate per 5 minutes<input type="number" min="20" max="5000" value={consultationRate} onChange={(event) => setConsultationRate(Number(event.target.value))} /></label>
          <button className={`btn ${profile.consultation_online ? "btn-ghost" : "btn-primary"}`} disabled={busy} onClick={toggleConsultation}>{profile.consultation_online ? "Pause live chat" : "Go online for chat"}</button>
        </section>
        <ConsultationPanel role="PANDIT" />
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
        <section className="history" id="completed-pujas"><div className="section-title"><div><h2>Customer payment status</h2><p>The customer chooses the payment method from their phone after you complete the Puja.</p></div></div>
          {completed.length ? <div className="completed-payment-list">{completed.map((booking) => <article key={booking.id}><div><strong>{booking.service_name}</strong><span>{booking.customer_name ?? "Customer"} · ₹{booking.amount.toLocaleString("en-IN")}</span>{booking.payment_status !== "CONFIRMED" && <small>Waiting for the customer. Cash, UPI and Card options are shown only on the customer&apos;s completed booking.</small>}</div><span className={`status ${booking.payment_status === "CONFIRMED" ? "paid" : ""}`}>{booking.payment_status === "CONFIRMED" ? booking.payment_method === "CASH" ? "Customer chose Cash" : "Customer arranged payment" : "Customer choosing payment"}</span></article>)}</div> : <div className="empty compact">No completed Puja yet.</div>}
        </section>
        <SupportCenter bookings={bookings.map(({id,service_name,status})=>({id,service_name,status}))} />
      </>}
    </AppShell>
  );
}
