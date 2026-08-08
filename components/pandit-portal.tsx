"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, BellRing, Check, ChevronRight, Clock3, IndianRupee, KeyRound, MapPin, MessageCircle, Navigation, Power, Star } from "lucide-react";
import { AppShell } from "./app-shell";
import { ConsultationPanel } from "./consultation-panel";
import { readJson } from "@/lib/http";
import { getCurrentCoordinates, type BrowserCoordinates } from "@/lib/browser-location";
import { PanditOnboarding } from "./pandit-onboarding";
import { SupportCenter } from "./support-center";
import { PanditUrgentAlarm } from "./pandit-urgent-alarm";

type Profile = { name: string | null; city: string | null; experience_years: number; languages: string[]; specialities: string[]; bio: string | null; verification_status: string; review_note?: string | null; is_online: boolean; rating: string; rating_count: number; completed_jobs: number; latitude: number | null; longitude: number | null; consultation_online: boolean; consultation_rate_5min: number };
type Booking = {
  id: string; status: string; service_name: string; customer_name: string | null; amount: number;
  address: string; created_at: string; request_type: string; scheduled_at: string | null; situation: string | null;
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
  const [urgentChatIds, setUrgentChatIds] = useState<string[]>([]);
  const updateUrgentChats = useCallback((ids: string[]) => setUrgentChatIds(ids), []);

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
      {profile.verification_status === "APPROVED" && <PanditUrgentAlarm pujaRequests={bookings.filter((booking) => booking.status === "REQUESTED").length} chatRequests={urgentChatIds.length} />}
      {profile.verification_status === "CHANGES_REQUESTED" && <div className="alert error">Admin requested changes: {profile.review_note ?? "Please review and update your profile."}</div>}
      {profile.verification_status === "REJECTED" && <div className="alert error">Your application was not approved: {profile.review_note ?? "Review your information and contact support if you need help."}</div>}
      {awaitingReview ? <section className="review-pending-screen" aria-live="polite"><span className="review-pending-icon"><Clock3 /></span><span className="eyebrow">Submitted successfully</span><h2>Your request is pending with Admin</h2><p>The verification team will review your identity, documents, references, knowledge and payout information. Please recheck later.</p><div className="pending-status"><i /><span><strong>{profile.verification_status === "UNDER_REVIEW" ? "Admin review in progress" : "Waiting for admin review"}</strong><small>This page checks for updates automatically every few seconds.</small></span></div><div className="pending-notification-note"><BellRing /><span><strong>Approval or rejection alert</strong><small>Enable notifications from the bell icon above. You will receive an in-app message and notification sound when Admin makes a decision.</small></span></div><button className="btn btn-primary" disabled={busy} onClick={() => void loadProfile(false)}>{busy ? "Checking…" : "Check status now"}</button></section> : incomplete ? <PanditOnboarding status={profile.verification_status} reviewNote={profile.review_note} onSaved={() => void loadProfile(true)} /> : <div className="pandit-workdesk">
        <section className={`pandit-command-centre ${profile.is_online ? "is-online" : ""}`} id="pandit-status">
          <div className="pandit-command-welcome"><span>ॐ</span><div><small>Namaste</small><h1>{profile.name ?? "Pandit ji"}</h1><p>Everything you need for today is on this screen.</p></div></div>
          <div className="pandit-command-status"><span className="eyebrow">Today&apos;s work</span><strong>{profile.is_online ? "Available for Puja requests" : "Not receiving requests"}</strong><small><MapPin size={15} /> {profile.is_online ? "Live location is active" : "Location is shared only after you go online"}</small></div>
          <button className="pandit-presence-button" onClick={toggleOnline} disabled={busy || locationBusy} aria-pressed={profile.is_online}><Power size={24} /><span><strong>{busy || locationBusy ? "Please wait…" : profile.is_online ? "Go offline" : "Go online now"}</strong><small>{profile.is_online ? "Stop receiving new work" : "Start receiving nearby work"}</small></span></button>
        </section>

        <section className="pandit-jobs" id="pandit-requests">
          <header><div><span className="eyebrow">Your next step</span><h2>{active.length ? "What needs your attention" : "You are all caught up"}</h2><p>{active.length ? "Complete only the orange action shown on each request." : profile.is_online ? "Keep this page open. We will alert you about new nearby work." : "Go online above whenever you are ready to receive work."}</p></div><span className={`pandit-job-count ${waitingRequests ? "has-new" : ""}`}><BellRing /> <strong>{active.length}</strong><small>active</small></span></header>
          {active.length ? <div className="pandit-job-list">{active.map((b) => { const locationVisible = b.status !== "REQUESTED" && b.customer_latitude != null && b.customer_longitude != null; return <article className={`pandit-job status-${b.status.toLowerCase()}`} key={b.id}>
            <div className="pandit-job-title"><span className="pandit-job-om">ॐ</span><div><small>{b.request_type.replaceAll("_", " ")}</small><h3>{b.service_name}</h3><p>{b.customer_name ?? "Customer"}</p></div><strong>₹{b.amount.toLocaleString("en-IN")}</strong></div>
            {b.scheduled_at && <div className="pandit-job-note scheduled"><small>Scheduled date and time</small><p><strong>{new Date(b.scheduled_at).toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short" })}</strong></p></div>}
            <div className="pandit-job-facts"><span><MessageCircle /><small>Language</small><strong>{b.preferred_language ?? "Any language"}</strong></span><span><BadgeCheck /><small>Materials</small><strong>{b.materials_option.replaceAll("_", " ")}</strong></span></div>
            {b.situation && <div className="pandit-job-note"><small>Customer says</small><p>{b.situation}</p></div>}
            <div className={`pandit-job-address ${locationVisible ? "is-open" : "is-locked"}`}><MapPin /><div><small>{locationVisible ? "Customer service address" : "Address protected"}</small><strong>{b.address}</strong><p>{locationVisible ? "Use directions when you are ready to leave." : "Accept the request first to see directions."}</p></div>{locationVisible && <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${b.customer_latitude},${b.customer_longitude}`}><Navigation /> Open directions</a>}</div>
            <div className="pandit-job-next"><div><small>Current step</small><strong>{b.status === "REQUESTED" ? "Decide if you can accept" : b.status === "ACCEPTED" ? "Leave for the customer" : b.status === "ON_THE_WAY" ? "Reach the customer" : b.status === "ARRIVED" ? "Verify arrival code" : "Finish the Puja"}</strong></div>
              {b.status === "REQUESTED" && <div className="pandit-decision"><button disabled={busy} onClick={() => transition(b.id, "DECLINED")}>Not available</button><button className="primary" disabled={busy} onClick={() => transition(b.id, "ACCEPTED")}><Check /> Accept request</button></div>}
              {b.status === "ACCEPTED" && <button className="pandit-next-button" disabled={busy} onClick={() => transition(b.id, "ON_THE_WAY")}><Navigation /> I am leaving now <ChevronRight /></button>}
              {b.status === "ON_THE_WAY" && <button className="pandit-next-button" disabled={busy} onClick={() => transition(b.id, "ARRIVED")}><MapPin /> I have arrived <ChevronRight /></button>}
              {b.status === "ARRIVED" && <div className="pandit-code-step"><label htmlFor={`arrival-otp-${b.id}`}>Enter customer&apos;s 6-digit code</label><div><input id={`arrival-otp-${b.id}`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={arrivalOtps[b.id] ?? ""} onChange={(event) => setArrivalOtps((current) => ({ ...current, [b.id]: event.target.value.replace(/\D/g, "").slice(0, 6) }))}/><button disabled={busy || (arrivalOtps[b.id]?.length ?? 0) !== 6} onClick={() => transition(b.id, "IN_PROGRESS", arrivalOtps[b.id])}><KeyRound /> Verify code & start Puja</button></div></div>}
              {b.status === "IN_PROGRESS" && <button className="pandit-next-button" disabled={busy} onClick={() => transition(b.id, "COMPLETED")}><Check /> Puja is complete</button>}
            </div>{actionErrors[b.id] && <div className="inline-action-error">{actionErrors[b.id]}</div>}
          </article>; })}</div> : <div className="pandit-rest-state"><span><BellRing /></span><strong>No request needs action</strong><p>{profile.is_online ? "You can keep your phone nearby. New requests will appear here automatically." : "Go online above whenever you are ready."}</p></div>}
        </section>

        <section className="pandit-tools">
          <article className={`pandit-chat-tool ${profile.consultation_online ? "is-online" : ""}`} id="online-guidance"><span><MessageCircle /></span><div><small>Online guidance</small><h2>{profile.consultation_online ? "Chat is open" : "Answer from home"}</h2><p>Turn on chat only when you can reply.</p></div><label>5-minute rate <b>₹</b><input aria-label="Rate for 5 minutes" type="number" min="20" max="5000" value={consultationRate} onChange={(event) => setConsultationRate(Number(event.target.value))}/></label><button disabled={busy} onClick={toggleConsultation}>{profile.consultation_online ? "Stop chats" : "Start chats"}</button></article>
          <article className="pandit-scorecard"><span className="eyebrow">Your work record</span><div><span><Star /><strong>{profile.rating_count ? profile.rating : "New"}</strong><small>{profile.rating_count ? `${profile.rating_count} ratings` : "No ratings"}</small></span><span><BadgeCheck /><strong>{profile.completed_jobs}</strong><small>Pujas done</small></span><span><BellRing /><strong>{waitingRequests}</strong><small>New requests</small></span></div></article>
        </section>
        <ConsultationPanel role="PANDIT" onUrgentItemsChange={updateUrgentChats} />
        <section className="pandit-money" id="completed-pujas"><header><span><IndianRupee /></span><div><small>Completed work</small><h2>Customer payment choices</h2><p>This records how each customer plans to pay you.</p></div></header>{completed.length ? <div className="completed-payment-list">{completed.map((booking) => <article key={booking.id}><div><strong>{booking.service_name}</strong><span>{booking.customer_name ?? "Customer"} · ₹{booking.amount.toLocaleString("en-IN")}</span></div><span className={`status ${booking.payment_status === "CONFIRMED" ? "paid" : ""}`}>{booking.payment_status === "CONFIRMED" ? booking.payment_method === "CASH" ? "Cash selected" : "Payment arranged" : "Waiting for customer"}</span></article>)}</div> : <p className="pandit-no-money">Completed Pujas will appear here.</p>}</section>
        <SupportCenter bookings={bookings.map(({id,service_name,status})=>({id,service_name,status}))} />
      </div>}
    </AppShell>
  );
}
