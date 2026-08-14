"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, BellRing, Check, ChevronRight, Clock3, IndianRupee, KeyRound, MapPin, MessageCircle, Navigation, Power } from "lucide-react";
import { AppShell } from "./app-shell";
import { readJson } from "@/lib/http";
import { getCurrentCoordinates, type BrowserCoordinates } from "@/lib/browser-location";
import { PanditOnboarding } from "./pandit-onboarding";
import { PanditUrgentAlarm } from "./pandit-urgent-alarm";
import { BookingChat } from "./booking-chat";

type Profile = { name: string | null; city: string | null; experience_years: number; languages: string[]; specialities: string[]; bio: string | null; verification_status: string; review_note?: string | null; is_online: boolean; rating: string; rating_count: number; completed_jobs: number; latitude: number | null; longitude: number | null; consultation_online: boolean; consultation_rate_5min: number };
type Booking = {
  id: string; status: string; service_name: string; customer_name: string | null; amount: number;
  address: string; created_at: string; request_type: string; scheduled_at: string | null; situation: string | null;
  preferred_language: string | null; materials_option: string;
  customer_latitude: number | null; customer_longitude: number | null;
  payment_method: "CASH" | "UPI" | "CARD" | "OTHER" | null; payment_status: "NOT_SELECTED" | "AWAITING_PANDIT" | "CONFIRMED" | "DISPUTED"; payment_confirmed_at: string | null;
  customer_cash_confirmed_at?:string|null;pandit_cash_confirmed_at?:string|null;
  cancellation_reason: string | null; cancelled_at: string | null; cancellation_fee?:number; cancellation_fee_status?:string;
  arrived_at?:string|null;
  proposed_amount?:number|null;price_change_reason?:string|null;price_change_status?:"NONE"|"PENDING"|"APPROVED"|"REJECTED";
};

export function PanditPortal({ userName, accessNotice }: { userName?: string | null; accessNotice?: string | null }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [arrivalOtps, setArrivalOtps] = useState<Record<string, string>>({});
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const knownBookingStatuses = useRef<Map<string, string> | null>(null);

  async function loadProfile(syncForm = false) {
    const response = await fetch(`/api/pandit/profile?fresh=${Date.now()}`, { cache: "no-store" });
    const data = await readJson<{ profile?: Profile & { base_charge?: number } }>(response);
    if (!data.profile) return;
    setProfile(data.profile);
    void syncForm;
  }

  async function loadBookings() {
    const response = await fetch(`/api/bookings?fresh=${Date.now()}`, { cache: "no-store" });
    const data = await readJson<{ bookings?: Booking[]; error?: string }>(response);
    if (response.ok) {
      const nextBookings = data.bookings ?? [];
      if (knownBookingStatuses.current) {
        const newlyCancelled = nextBookings.find((booking) => booking.status === "CANCELLED" && knownBookingStatuses.current?.get(booking.id) !== "CANCELLED");
        if (newlyCancelled) setNotice(`Customer cancelled ${newlyCancelled.service_name}. ${newlyCancelled.cancellation_reason ? `Reason: ${newlyCancelled.cancellation_reason}` : "The request has been removed from your active work."}`);
      }
      knownBookingStatuses.current = new Map(nextBookings.map((booking) => [booking.id, booking.status]));
      setBookings(nextBookings);
    }
  }

  function load(syncForm = false) {
    void loadProfile(syncForm);
    void loadBookings();
  }

  useEffect(() => {
    const initial = window.setTimeout(() => load(true), 0);
    const refresh = () => { if(document.visibilityState!=="visible")return; setCurrentTime(Date.now()); load(false); };
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
      setNotice("Current location confirmed.");
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

  async function confirmCash(bookingId:string,action:"CONFIRM_RECEIVED"|"DISPUTE"){
    if(action==="CONFIRM_RECEIVED"&&!window.confirm("Confirm only after you have actually received the cash from the customer."))return;
    if(action==="DISPUTE"&&!window.confirm("Report a cash-payment disagreement to the customer and support?"))return;
    setBusy(true);setNotice("");
    const response=await fetch(`/api/bookings/${bookingId}/payment`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action})});
    const data=await readJson<{error?:string}>(response);
    setNotice(response.ok?action==="CONFIRM_RECEIVED"?"Cash receipt confirmed by both sides.":"Payment marked disputed. Create a support case with the facts.":data.error??"Unable to update payment.");
    await loadBookings();setBusy(false);
  }
  async function reportNoShow(bookingId:string){const note=window.prompt("Describe how long you waited and your attempts to contact the customer:")?.trim();if(!note)return;setBusy(true);setNotice("");const response=await fetch(`/api/bookings/${bookingId}/no-show`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({note})});const data=await readJson<{error?:string}>(response);setNotice(response.ok?"No-show report created for Admin review. The customer can dispute it.":data.error??"Unable to report no-show.");await loadBookings();setBusy(false);}
  async function proposePriceChange(bookingId:string){const amountText=window.prompt("Enter the revised total amount in rupees:");if(!amountText)return;const reason=window.prompt("Explain exactly what changed (materials, scope or additional ritual):")?.trim();if(!reason)return;setBusy(true);const response=await fetch(`/api/bookings/${bookingId}/price-change`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({amount:Number(amountText),reason})});const data=await readJson<{error?:string}>(response);setNotice(response.ok?"Revised price sent. Do not perform extra work until the customer approves.":data.error??"Unable to request a price change.");await loadBookings();setBusy(false);}

  if (!profile) return <AppShell role="Pandit" userName={userName} title="Loading your portal…" subtitle="Preparing your profile and requests."><div className="loading-card">Loading…</div></AppShell>;
  const awaitingReview = ["PENDING", "SUBMITTED", "UNDER_REVIEW"].includes(profile.verification_status);
  const incomplete = ["INCOMPLETE", "CHANGES_REQUESTED", "REJECTED"].includes(profile.verification_status);
  const active = bookings.filter((b) => !["COMPLETED", "DECLINED", "CANCELLED"].includes(b.status));
  const paymentsNeedingAction = bookings.filter((b) => b.status === "COMPLETED" && ["AWAITING_PANDIT", "DISPUTED"].includes(b.payment_status)).slice(0, 6);

  return (
    <AppShell role="Pandit" userName={profile.name ?? userName} title={awaitingReview ? "Application under admin review" : incomplete ? "Complete your verified Pandit profile" : `Namaste, ${profile.name ?? "Pandit ji"}`} subtitle={awaitingReview ? "Your details were submitted successfully. Please check again later." : incomplete ? "A trusted profile helps customers book with confidence." : "See what needs your attention today."}>
      {accessNotice && <div className="alert success" role="status"><BadgeCheck size={18} />{accessNotice}</div>}
      {notice && <div className="alert success">{notice}</div>}
      {profile.verification_status === "APPROVED" && <PanditUrgentAlarm pujaRequests={bookings.filter((booking) => booking.status === "REQUESTED").length} chatRequests={0} />}
      {profile.verification_status === "CHANGES_REQUESTED" && <div className="alert error">Admin requested changes: {profile.review_note ?? "Please review and update your profile."}</div>}
      {profile.verification_status === "REJECTED" && <div className="alert error">Your application was not approved: {profile.review_note ?? "Review your information and contact support if you need help."}</div>}
      {awaitingReview ? <section className="review-pending-screen" aria-live="polite"><span className="review-pending-icon"><Clock3 /></span><h2>Your profile is under review</h2><p>We will notify you after the identity, experience and document checks are complete.</p><div className="pending-status"><i /><span><strong>{profile.verification_status === "UNDER_REVIEW" ? "Review in progress" : "Submitted"}</strong><small>No action is needed right now.</small></span></div></section> : incomplete ? <PanditOnboarding status={profile.verification_status} reviewNote={profile.review_note} onSaved={() => void loadProfile(true)} /> : <div className="pandit-workdesk" id="pandit-home">
        <section className={`pandit-command-centre ${profile.is_online ? "is-online" : ""}`} id="pandit-status">
          <div className="pandit-command-welcome"><span>ॐ</span><div><small>Namaste</small><h1>{profile.name ?? "Pandit ji"}</h1><p>{profile.is_online ? "You are ready to receive nearby requests." : "Go online when you are ready to work."}</p></div></div>
          <div className="pandit-command-status"><span className="eyebrow">Availability</span><strong>{profile.is_online ? "Online" : "Offline"}</strong><small><MapPin size={15} /> {profile.is_online ? "Your location updates automatically while online" : "Your current GPS location will be confirmed when you go online"}</small></div>
          <button className="pandit-presence-button" onClick={toggleOnline} disabled={busy || locationBusy} aria-pressed={profile.is_online}><Power size={24} /><span><strong>{busy || locationBusy ? "Please wait…" : profile.is_online ? "Go offline" : "Go online"}</strong><small>{profile.is_online ? "Stop new requests" : "Receive nearby requests"}</small></span></button>
        </section>

        <section className="pandit-jobs" id="pandit-requests">
          <header><div><span className="eyebrow">Requests</span><h2>{active.length ? "What needs your attention" : "No action needed"}</h2><p>{active.length ? "Each card shows one clear next step." : profile.is_online ? "We will notify you when a new request arrives." : "Go online whenever you are ready."}</p></div></header>
          {active.length ? <div className="pandit-job-list">{active.map((b) => { const locationVisible = b.status !== "REQUESTED" && b.customer_latitude != null && b.customer_longitude != null; return <article className={`pandit-job status-${b.status.toLowerCase()}`} id={`pandit-job-${b.id}`} key={b.id}>
            <div className="pandit-job-title"><span className="pandit-job-om">ॐ</span><div><small>{b.request_type === "SCHEDULED_PUJA" ? "Scheduled Puja" : b.request_type === "PANDIT_SOS" ? "Urgent request" : "Home Puja"}</small><h3>{b.service_name}</h3>{b.status !== "REQUESTED" && <p>{b.customer_name ?? "Customer"}</p>}</div><span className="pandit-job-amount"><small>{b.status === "REQUESTED" ? "Initial estimate" : "Agreed amount"}</small><strong>₹{b.amount.toLocaleString("en-IN")}</strong></span></div>
            {b.scheduled_at && <div className="pandit-job-note scheduled"><small>Scheduled date and time</small><p><strong>{new Date(b.scheduled_at).toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short" })}</strong></p></div>}
            <div className="pandit-job-facts"><span><MessageCircle /><small>Language</small><strong>{b.preferred_language ?? "Any language"}</strong></span><span><BadgeCheck /><small>Materials</small><strong>{b.materials_option === "HAVE_MATERIALS" ? "Customer has materials" : b.materials_option === "PANDIT_BRINGS" ? "You will bring materials" : "Customer needs guidance"}</strong></span></div>
            {b.situation && <div className="pandit-job-note"><small>Customer says</small><p>{b.situation}</p></div>}
            {b.status!=="REQUESTED"&&<details className="pandit-more-options"><summary>More options</summary><div className="pandit-scope-control"><span>{b.price_change_status==="PENDING"?<><small>Price change requested</small><em>Waiting for customer approval of ₹{b.proposed_amount?.toLocaleString("en-IN")}</em></>:<small>Use this only when the Puja scope changes.</small>}</span>{b.price_change_status!=="PENDING"&&<button disabled={busy} onClick={()=>void proposePriceChange(b.id)}>Request price change</button>}</div></details>}
            <div className={`pandit-job-address ${locationVisible ? "is-open" : "is-locked"}`}><MapPin /><div><small>{locationVisible ? "Customer address" : "Address protected"}</small><strong>{locationVisible ? b.address : "Available after you accept"}</strong></div>{locationVisible && <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${b.customer_latitude},${b.customer_longitude}`}><Navigation /> Directions</a>}</div>
            {b.status !== "REQUESTED" && <BookingChat bookingId={b.id} participantName={b.customer_name ?? "Customer"} role="PANDIT" />}
            <div className="pandit-job-next"><div><small>Current step</small><strong>{b.status === "REQUESTED" ? "Decide if you can accept" : b.status === "ACCEPTED" ? "Leave for the customer" : b.status === "ON_THE_WAY" ? "Reach the customer" : b.status === "ARRIVED" ? "Verify arrival code" : "Finish the Puja"}</strong></div>
              {b.status === "REQUESTED" && <div className="pandit-decision"><button disabled={busy} onClick={() => transition(b.id, "DECLINED")}>Not available</button><button className="primary" disabled={busy} onClick={() => transition(b.id, "ACCEPTED")}><Check /> Accept request</button></div>}
              {b.status === "ACCEPTED" && <button className="pandit-next-button" disabled={busy} onClick={() => transition(b.id, "ON_THE_WAY")}><Navigation /> I am leaving now <ChevronRight /></button>}
              {b.status === "ON_THE_WAY" && <button className="pandit-next-button" disabled={busy} onClick={() => transition(b.id, "ARRIVED")}><MapPin /> I have arrived <ChevronRight /></button>}
              {b.status === "ARRIVED" && <div className="pandit-code-step"><label htmlFor={`arrival-otp-${b.id}`}>Enter customer&apos;s 6-digit code</label><div><input id={`arrival-otp-${b.id}`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={arrivalOtps[b.id] ?? ""} onChange={(event) => setArrivalOtps((current) => ({ ...current, [b.id]: event.target.value.replace(/\D/g, "").slice(0, 6) }))}/><button disabled={busy || (arrivalOtps[b.id]?.length ?? 0) !== 6} onClick={() => transition(b.id, "IN_PROGRESS", arrivalOtps[b.id])}><KeyRound /> Verify code & start Puja</button></div></div>}
              {b.status === "ARRIVED"&&b.arrived_at&&currentTime-new Date(b.arrived_at).getTime()>=15*60_000&&<button className="pandit-no-show-button" disabled={busy} onClick={()=>void reportNoShow(b.id)}>Customer is not available · Report no-show</button>}
              {b.status === "IN_PROGRESS" && <button className="pandit-next-button" disabled={busy} onClick={() => transition(b.id, "COMPLETED")}><Check /> Puja is complete</button>}
            </div>{actionErrors[b.id] && <div className="inline-action-error">{actionErrors[b.id]}</div>}
          </article>; })}</div> : <div className="pandit-rest-state"><span><BellRing /></span><strong>No request needs action</strong><p>{profile.is_online ? "You can keep your phone nearby. New requests will appear here automatically." : "Go online above whenever you are ready."}</p></div>}
        </section>

        {paymentsNeedingAction.length > 0 && <section className="pandit-money" id="pandit-payments"><header><span><IndianRupee /></span><div><h2>Payment action needed</h2><p>Confirm cash only after receiving it.</p></div></header><div className="completed-payment-list">{paymentsNeedingAction.map((booking) => <article key={booking.id}><div><strong>{booking.service_name}</strong><span>₹{booking.amount.toLocaleString("en-IN")}</span></div><div className="pandit-payment-action"><span className="status">{booking.payment_status === "DISPUTED" ? "Payment disputed" : "Customer selected cash"}</span>{booking.payment_method==="CASH"&&booking.payment_status==="AWAITING_PANDIT"&&<><button disabled={busy} onClick={()=>void confirmCash(booking.id,"CONFIRM_RECEIVED")}>Cash received</button><button className="danger" disabled={busy} onClick={()=>void confirmCash(booking.id,"DISPUTE")}>Report issue</button></>}</div></article>)}</div></section>}
      </div>}
    </AppShell>
  );
}
