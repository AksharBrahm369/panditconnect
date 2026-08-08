"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, BellRing, Check, ChevronRight, Clock3, IndianRupee, KeyRound, MapPin, MessageCircle, Navigation, Power, Star } from "lucide-react";
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

export function PanditPortal({ userName }: { userName?: string | null }) {
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

  if (!profile) return <AppShell role="Pandit" userName={userName} title="Loading your portal…" subtitle="Preparing your profile and requests."><div className="loading-card">Loading…</div></AppShell>;
  const awaitingReview = ["PENDING", "SUBMITTED", "UNDER_REVIEW"].includes(profile.verification_status);
  const incomplete = ["INCOMPLETE", "CHANGES_REQUESTED", "REJECTED"].includes(profile.verification_status);
  const active = bookings.filter((b) => !["COMPLETED", "DECLINED", "CANCELLED"].includes(b.status));
  const completed = bookings.filter((b) => b.status === "COMPLETED").slice(0, 6);
  const waitingRequests = active.filter((booking) => booking.status === "REQUESTED").length;

  return (
    <AppShell role="Pandit" userName={profile.name ?? userName} title={awaitingReview ? "Application under admin review" : incomplete ? "Complete your verified Pandit profile" : `Namaste, ${profile.name ?? "Pandit ji"}`} subtitle={awaitingReview ? "Your details were submitted successfully. Please check again later." : incomplete ? "A trusted profile helps customers book with confidence." : "See what needs your attention today."}>
      {notice && <div className="alert success">{notice}</div>}
      {profile.verification_status === "CHANGES_REQUESTED" && <div className="alert error">Admin requested changes: {profile.review_note ?? "Please review and update your profile."}</div>}
      {profile.verification_status === "REJECTED" && <div className="alert error">Your application was not approved: {profile.review_note ?? "Review your information and contact support if you need help."}</div>}
      {awaitingReview ? <section className="review-pending-screen" aria-live="polite"><span className="review-pending-icon"><Clock3 /></span><span className="eyebrow">Submitted successfully</span><h2>Your request is pending with Admin</h2><p>The verification team will review your identity, documents, references, knowledge and payout information. Please recheck later.</p><div className="pending-status"><i /><span><strong>{profile.verification_status === "UNDER_REVIEW" ? "Admin review in progress" : "Waiting for admin review"}</strong><small>This page checks for updates automatically every few seconds.</small></span></div><div className="pending-notification-note"><BellRing /><span><strong>Approval or rejection alert</strong><small>Enable notifications from the bell icon above. You will receive an in-app message and notification sound when Admin makes a decision.</small></span></div><button className="btn btn-primary" disabled={busy} onClick={() => void loadProfile(false)}>{busy ? "Checking…" : "Check status now"}</button></section> : incomplete ? <PanditOnboarding status={profile.verification_status} reviewNote={profile.review_note} onSaved={() => void loadProfile(true)} /> : <div className="pandit-simple-home">
        <section className={`role-action-banner pandit-today-card ${profile.is_online ? "online" : ""}`}>
          <span className="role-action-icon"><Power /></span>
          <div><span className="pandit-greeting">Namaste, {profile.name ?? "Pandit ji"}</span><span className="eyebrow">Today&apos;s work</span><h2>{profile.is_online ? "You are ready for nearby Puja requests" : "Go online when you are ready to work"}</h2><p>{profile.is_online ? "Your live location is active. We will alert you when a customer needs you." : "Tap once to share your location and start receiving nearby requests."}</p></div>
          <button className={`btn ${profile.is_online ? "btn-ghost" : "btn-primary"}`} onClick={toggleOnline} disabled={busy || locationBusy}>{busy || locationBusy ? "Please wait…" : profile.is_online ? "Go offline" : "Go online"}</button>
        </section>
        <section className="stat-grid" id="pandit-status">
          <article className={waitingRequests ? "needs-attention" : ""}><BellRing /><span>New requests</span><strong>{waitingRequests}</strong><small>{waitingRequests ? "Please respond now" : "Nothing waiting"}</small></article>
          <article><Star /><span>Your rating</span><strong>{profile.rating_count ? profile.rating : "New"}</strong><small>{profile.rating_count ? `${profile.rating_count} customer rating${profile.rating_count === 1 ? "" : "s"}` : "No rating yet"}</small></article>
          <article><BadgeCheck /><span>Pujas completed</span><strong>{profile.completed_jobs}</strong><small>Verified through bookings</small></article>
        </section>
        <section className={`consultation-availability ${profile.consultation_online ? "online" : ""}`}>
          <span><MessageCircle /></span>
          <div><span className="eyebrow">Online guidance</span><h2>{profile.consultation_online ? "You are available for chat" : "Answer questions from home"}</h2><p>Turn this on only when you are ready to reply to customers.</p></div>
          <label>Rate for 5 minutes<input aria-label="Rate for 5 minutes" type="number" min="20" max="5000" value={consultationRate} onChange={(event) => setConsultationRate(Number(event.target.value))} /></label>
          <button className={`btn ${profile.consultation_online ? "btn-ghost" : "btn-primary"}`} disabled={busy} onClick={toggleConsultation}>{profile.consultation_online ? "Stop taking chats" : "Start taking chats"}</button>
        </section>
        <ConsultationPanel role="PANDIT" />
        <section className="history pandit-request-section" id="pandit-requests"><div className="section-title"><div><span className="eyebrow">Puja requests</span><h2>{active.length ? "What needs your attention" : "No active requests"}</h2><p>{active.length ? "Follow the highlighted next step on each request." : "Stay online. New nearby requests will appear automatically."}</p></div><span className="live-pill"><i /> {active.length} active</span></div>
          {active.length ? <div className="request-grid">{active.map((b) => { const locationVisible = b.status !== "REQUESTED" && b.customer_latitude != null && b.customer_longitude != null; return <article className="request-card" key={b.id}><div className="request-top"><span className="service-icon">ॐ</span><div><strong>{b.service_name}</strong><small><Clock3 size={13} /> {b.request_type.replaceAll("_", " ")}</small></div><b>₹{b.amount.toLocaleString("en-IN")}</b></div>
            {b.situation && <div className="request-context"><span>Customer&apos;s situation</span><p>{b.situation}</p></div>}
            <div className="request-tags"><span>{b.preferred_language ?? "Any language"}</span><span>{b.materials_option.replaceAll("_", " ")}</span></div>
            <div className={`customer-location-card ${locationVisible ? "visible" : "protected"}`}><MapPin size={19} /><div><span>{locationVisible ? "Customer service address" : "Address protected"}</span><strong>{b.address}</strong>{b.status === "REQUESTED" && <small>Accept this request to unlock directions.</small>}</div>{locationVisible && <a className="btn btn-ghost" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${b.customer_latitude},${b.customer_longitude}`}><Navigation size={16} /> Open directions</a>}</div><div className="pandit-request-status"><span className="status">{b.status.replaceAll("_", " ")}</span><small>{b.status === "REQUESTED" ? "Accept only if you can go now" : b.status === "ACCEPTED" ? "Tell the customer when you leave" : b.status === "ON_THE_WAY" ? "Mark arrived at the address" : b.status === "ARRIVED" ? "Ask for the customer&apos;s code" : "Finish after the Puja is complete"}</small></div><div className="button-row">
            {b.status === "REQUESTED" && <><button className="btn btn-ghost" disabled={busy} onClick={() => transition(b.id, "DECLINED")}>Not available</button><button className="btn btn-primary" disabled={busy} onClick={() => transition(b.id, "ACCEPTED")}><Check size={16} /> Accept request</button></>}
            {b.status === "ACCEPTED" && <button className="btn btn-primary btn-block" disabled={busy} onClick={() => transition(b.id, "ON_THE_WAY")}><Navigation size={17} /> I am leaving now <ChevronRight size={17} /></button>}
            {b.status === "ON_THE_WAY" && <button className="btn btn-primary btn-block" disabled={busy} onClick={() => transition(b.id, "ARRIVED")}><MapPin size={17} /> I have arrived <ChevronRight size={17} /></button>}
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
                <button className="btn btn-primary" disabled={busy || (arrivalOtps[b.id]?.length ?? 0) !== 6} onClick={() => transition(b.id, "IN_PROGRESS", arrivalOtps[b.id])}>Verify code & start Puja</button>
              </div>
            </div>}
            {b.status === "IN_PROGRESS" && <button className="btn btn-primary btn-block" disabled={busy} onClick={() => transition(b.id, "COMPLETED")}><Check size={17} /> Puja is complete</button>}
          </div>{actionErrors[b.id] && <div className="inline-action-error">{actionErrors[b.id]}</div>}</article>; })}</div> : <div className="empty"><BellRing size={26} /><strong>No active requests</strong><span>Stay online. New urgent bookings will appear here automatically.</span></div>}
        </section>
        <section className="history pandit-payment-section" id="completed-pujas"><div className="section-title"><div><span className="eyebrow">Completed work</span><h2>Payment choices</h2><p>After a Puja, the customer confirms how they will pay you.</p></div><IndianRupee /></div>
          {completed.length ? <div className="completed-payment-list">{completed.map((booking) => <article key={booking.id}><div><strong>{booking.service_name}</strong><span>{booking.customer_name ?? "Customer"} · ₹{booking.amount.toLocaleString("en-IN")}</span>{booking.payment_status !== "CONFIRMED" && <small>Waiting for the customer. Cash, UPI and Card options are shown only on the customer&apos;s completed booking.</small>}</div><span className={`status ${booking.payment_status === "CONFIRMED" ? "paid" : ""}`}>{booking.payment_status === "CONFIRMED" ? booking.payment_method === "CASH" ? "Customer chose Cash" : "Customer arranged payment" : "Customer choosing payment"}</span></article>)}</div> : <div className="empty compact">No completed Puja yet.</div>}
        </section>
        <SupportCenter bookings={bookings.map(({id,service_name,status})=>({id,service_name,status}))} />
      </div>}
    </AppShell>
  );
}
