"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowLeft, BadgeHelp, CheckCircle2, ChevronRight, Clock3,
  Banknote, Compass, CreditCard, MapPin, Mic, PackageCheck, RefreshCw, ShieldCheck, Smartphone, Sparkles, Star,
} from "lucide-react";
import { AppShell } from "./app-shell";
import { ConsultationPanel } from "./consultation-panel";
import { SupportCenter } from "./support-center";
import { ProfileEditor } from "./profile-editor";
import { readJson } from "@/lib/http";
import { getCurrentCoordinates, type BrowserCoordinates } from "@/lib/browser-location";
import { recommendRitual, ritualForService, type RequestType, type RitualRecommendation } from "@/lib/ritual-guide";

type Service = { id: string; name: string; description: string; base_price: number; duration_minutes: number };
type NearbyPandit = {
  id: string; name: string; experience_years: number; languages: string[]; rating: string;
  rating_count: number; completed_jobs: number; charge: number; distance_km: string; eta_minutes: number;
};
type Booking = {
  id: string; status: string; service_name: string; pandit_name: string | null; amount: number;
  address: string; arrival_otp: string; created_at: string; request_type: RequestType;
  situation: string | null; materials_option: string; latitude: number; longitude: number;
  pandit_latitude: number | null; pandit_longitude: number | null; location_updated_at: string | null;
  customer_rating: number | null; rating_comment: string | null; rated_at: string | null;
  payment_method: "CASH" | "UPI" | "CARD" | "OTHER" | null; payment_status: "NOT_SELECTED" | "CONFIRMED"; payment_confirmed_at: string | null;
};
type SpeechRecognitionLike = {
  lang: string; interimResults: boolean; continuous: boolean;
  start(): void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

const statusOrder = ["REQUESTED", "ACCEPTED", "ON_THE_WAY", "ARRIVED", "IN_PROGRESS", "COMPLETED"];
const materialsLabels: Record<string, string> = {
  HAVE_MATERIALS: "I have the Puja materials",
  PANDIT_BRINGS: "Pandit should bring materials",
  NEED_GUIDANCE: "Help me understand what is needed",
};

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const value = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function CustomerPortal({ customerId }: { customerId: string }) {
  const [services, setServices] = useState<Service[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [requestType, setRequestType] = useState<RequestType | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [situation, setSituation] = useState("");
  const [language, setLanguage] = useState("Hindi");
  const [materialsOption, setMaterialsOption] = useState("NEED_GUIDANCE");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [coordinates, setCoordinates] = useState<BrowserCoordinates | null>(null);
  const [locationSource, setLocationSource] = useState<"GPS" | "POSTAL_CODE" | null>(null);
  const [recommendation, setRecommendation] = useState<RitualRecommendation | null>(null);
  const [guidanceError, setGuidanceError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [match, setMatch] = useState<{ name: string; distanceKm: string; etaMinutes: number } | null>(null);
  const [nearbyPandits, setNearbyPandits] = useState<NearbyPandit[] | null>(null);
  const [panditSort, setPanditSort] = useState<"NEAREST" | "RATING" | "EXPERIENCE">("NEAREST");
  const [rematchingId, setRematchingId] = useState<string | null>(null);
  const [rematchErrors, setRematchErrors] = useState<Record<string, string>>({});
  const [consultationMode, setConsultationMode] = useState(false);
  const [ratingDrafts, setRatingDrafts] = useState<Record<string, number>>({});
  const [ratingComments, setRatingComments] = useState<Record<string, string>>({});
  const [ratingBusy, setRatingBusy] = useState<string | null>(null);
  const [ratingMessages, setRatingMessages] = useState<Record<string, string>>({});
  const [paymentBusy, setPaymentBusy] = useState<string | null>(null);
  const [paymentMessages, setPaymentMessages] = useState<Record<string, string>>({});

  const refreshBookings = useCallback(async () => {
    const response = await fetch(`/api/bookings?fresh=${Date.now()}`, {
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Cache-Control": "no-cache" },
    });
    const data = await readJson<{ customerId?: string; bookings?: Booking[] }>(response);
    if (response.status === 401) {
      setBookings([]);
      window.location.assign("/login?role=customer");
      return;
    }
    if (!response.ok || data.customerId !== customerId) {
      setBookings([]);
      setMessage("Your account session changed. Please sign in again to protect your booking history.");
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      window.location.assign("/login?role=customer");
      return;
    }
    setBookings(data.bookings ?? []);
  }, [customerId]);

  useEffect(() => {
    fetch("/api/services").then((response) => readJson<{ services: Service[] }>(response))
      .then((data) => setServices(data.services ?? []));
    const initialLoad = window.setTimeout(() => void refreshBookings(), 0);
    const timer = window.setInterval(refreshBookings, 10_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
    };
  }, [refreshBookings]);

  const guidance = useMemo(
    () => recommendation ?? (serviceId ? ritualForService(serviceId) : null),
    [recommendation, serviceId],
  );
  const sortedNearbyPandits = useMemo(() => {
    if (!nearbyPandits) return [];
    return [...nearbyPandits].sort((a, b) => {
      if (panditSort === "RATING") return Number(b.rating) - Number(a.rating) || b.rating_count - a.rating_count || Number(a.distance_km) - Number(b.distance_km);
      if (panditSort === "EXPERIENCE") return b.experience_years - a.experience_years || Number(a.distance_km) - Number(b.distance_km);
      return Number(a.distance_km) - Number(b.distance_km);
    });
  }, [nearbyPandits, panditSort]);

  function choosePath(type: RequestType) {
    setRequestType(type);
    setServiceId("");
    setSituation("");
    setRecommendation(null);
    setGuidanceError("");
    setMatch(null);
    setNearbyPandits(null);
    setMessage("");
  }

  async function detectLocation() {
    setLocationBusy(true);
    setMessage("");
    try {
      const current = await getCurrentCoordinates();
      setCoordinates(current);
      setLocationSource("GPS");
      return current;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to detect your location.");
      return null;
    } finally {
      setLocationBusy(false);
    }
  }

  async function locateFromAddress() {
    const postalCode = address.match(/\b[1-9]\d{5}\b/)?.[0];
    if (!postalCode) {
      setMessage("Add the 6-digit PIN code to your address so we can match by area without GPS.");
      return null;
    }
    setLocationBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/location/geocode", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postalCode }),
      });
      const data = await readJson<{ error?: string; latitude?: number; longitude?: number }>(response);
      if (!response.ok || !Number.isFinite(data.latitude) || !Number.isFinite(data.longitude)) {
        setMessage(data.error ?? "Unable to confirm the address area.");
        return null;
      }
      const current = { latitude: data.latitude!, longitude: data.longitude!, accuracy: 5_000 };
      setCoordinates(current);
      setLocationSource("POSTAL_CODE");
      return current;
    } finally {
      setLocationBusy(false);
    }
  }

  function getGuidance() {
    if (situation.trim().length < 10) {
      setGuidanceError("Please describe the occasion or problem in at least 10 characters so we can recommend the right ritual.");
      return;
    }
    const result = recommendRitual(situation);
    setRecommendation(result);
    setServiceId(result.serviceId);
    setGuidanceError("");
    setMessage("");
  }

  function startVoiceInput() {
    const SpeechRecognition = (window as typeof window & {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    }).SpeechRecognition ?? (window as typeof window & {
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    }).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMessage("Voice input is not supported in this browser. You can type your situation instead.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = language === "Hindi" ? "hi-IN" : language === "Marathi" ? "mr-IN" : "en-IN";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      setSituation((current) => `${current} ${event.results[0][0].transcript}`.trim());
      setGuidanceError("");
    };
    recognition.onerror = () => setMessage("Voice input could not start. Check microphone permission.");
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
  }

  async function findNearbyPandits() {
    if (!requestType || !serviceId || !address.trim()) {
      setMessage("Complete the guidance, Puja and address details before continuing.");
      return;
    }
    if (requestType !== "KNOWN_PUJA" && situation.trim().length < 5) {
      setMessage("Please add a short description of what happened.");
      return;
    }
    setBusy(true);
    setMessage("");
    const current = coordinates ?? await locateFromAddress();
    if (!current) { setBusy(false); return; }
    const params = new URLSearchParams({ serviceId, lat: String(current.latitude), lng: String(current.longitude) });
    const response = await fetch(`/api/pandits/nearby?${params}`, { cache: "no-store" });
    const data = await readJson<{ error?: string; pandits?: NearbyPandit[] }>(response);
    if (!response.ok) {
      setMessage(data.error ?? "Unable to find nearby Pandits.");
      setBusy(false);
      return;
    }
    setNearbyPandits(data.pandits ?? []);
    setBusy(false);
  }

  async function sendRequest(panditId: string) {
    if (!coordinates || !requestType) return;
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        panditId, serviceId, address, notes, requestType, situation, preferredLanguage: language,
        materialsOption, latitude: coordinates.latitude, longitude: coordinates.longitude,
      }),
    });
    const data = await readJson<{ error?: string; matchedPandit?: { name: string; distanceKm: string; etaMinutes: number } }>(response);
    if (!response.ok) {
      setMessage(data.error ?? "Unable to send the request.");
      setBusy(false);
      return;
    }
    setMatch(data.matchedPandit ?? null);
    setNearbyPandits(null);
    setBusy(false);
    void refreshBookings();
  }

  async function findAnotherPandit(bookingId: string) {
    setRematchingId(bookingId);
    setRematchErrors((current) => ({ ...current, [bookingId]: "" }));
    const response = await fetch(`/api/bookings/${bookingId}/rematch`, { method: "POST" });
    const data = await readJson<{ error?: string }>(response);
    if (!response.ok) {
      setRematchErrors((current) => ({ ...current, [bookingId]: data.error ?? "Unable to find another Pandit right now." }));
      setRematchingId(null);
      return;
    }
    await refreshBookings();
    setRematchingId(null);
  }

  async function submitRating(bookingId: string) {
    const rating = ratingDrafts[bookingId] ?? 0;
    if (!rating) {
      setRatingMessages((current) => ({ ...current, [bookingId]: "Choose a star rating first." }));
      return;
    }
    setRatingBusy(bookingId);
    setRatingMessages((current) => ({ ...current, [bookingId]: "" }));
    const response = await fetch(`/api/bookings/${bookingId}/rating`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rating, comment: ratingComments[bookingId] ?? "" }),
    });
    const data = await readJson<{ error?: string }>(response);
    if (!response.ok) {
      setRatingMessages((current) => ({ ...current, [bookingId]: data.error ?? "Unable to save your rating." }));
    } else {
      await refreshBookings();
    }
    setRatingBusy(null);
  }

  async function confirmPaymentMethod(bookingId: string, method: "CASH") {
    setPaymentBusy(bookingId);
    setPaymentMessages((current) => ({ ...current, [bookingId]: "" }));
    const response = await fetch(`/api/bookings/${bookingId}/payment`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ method }),
    });
    const data = await readJson<{ error?: string }>(response);
    if (!response.ok) setPaymentMessages((current) => ({ ...current, [bookingId]: data.error ?? "Unable to save the payment method." }));
    else await refreshBookings();
    setPaymentBusy(null);
  }

  async function cancelBooking(bookingId: string) {
    const cancellationReason = window.prompt("Why are you cancelling this request?", "Plans changed")?.trim();
    if (!cancellationReason) return;
    setMessage("");
    const response = await fetch(`/api/bookings/${bookingId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "CANCELLED", cancellationReason }) });
    const data = await readJson<{ error?:string }>(response);
    if (!response.ok) setMessage(data.error ?? "Unable to cancel this request.");
    await refreshBookings();
  }

  return (
    <AppShell role="Customer" title="What religious help do you need?" subtitle="Describe the situation. We guide you and find the best available nearby Pandit.">
      {message && <div className="alert error">{message}</div>}

      {!requestType && !match && !consultationMode && (
        <section className="intent-shell" id="request-assistance">
          <div className="new-user-guide">
            <span className="guide-symbol"><Sparkles /></span>
            <div><span className="eyebrow">New here?</span><h2>Start with what you need—not the Puja name.</h2><p>Choose one option below. We will guide the ritual, preparation and nearby Pandit matching.</p></div>
            <div className="guide-steps"><span><b>1</b> Choose your situation</span><span><b>2</b> Confirm our guidance</span><span><b>3</b> Track your Pandit</span></div>
          </div>
          <div className="section-title intent-title"><div><h2>What best describes your situation?</h2><p>There is no wrong choice—you can review everything before sending.</p></div></div>
          <div className="intent-grid">
            <button className="intent-card urgent" onClick={() => choosePath("PANDIT_SOS")}><AlertTriangle /><span><b className="intent-kicker">Urgent replacement</b><strong>My Pandit cancelled</strong><small>Use the Puja details you already have and find another qualified Pandit now.</small></span><ChevronRight /></button>
            <button className="intent-card guidance-live" onClick={() => setConsultationMode(true)}><BadgeHelp /><span><b className="intent-kicker">Live online guidance</b><strong>I need guidance</strong><small>Chat privately with an available Pandit. Charges are shown per five minutes.</small></span><ChevronRight /></button>
            <button className="intent-card" onClick={() => choosePath("KNOWN_PUJA")}><Sparkles /><span><b className="intent-kicker">Fastest path</b><strong>I know the Puja</strong><small>Select the ritual directly and search for a nearby available Pandit.</small></span><ChevronRight /></button>
          </div>
          <div className="privacy-band"><ShieldCheck size={18} /><span><strong>Private by design</strong>Your phone and exact address are never shown publicly.</span></div>
        </section>
      )}

      {consultationMode && <ConsultationPanel role="CUSTOMER" onBack={() => setConsultationMode(false)} />}

      {requestType && !match && nearbyPandits === null && (
        <>
          <div className="flow-assurance"><ShieldCheck /><div><strong>You stay in control</strong><span>Nothing is sent until you review the Puja, language, materials and address.</span></div></div>
          <div className="progress"><span className="active">1 Your need</span><i /><span className={serviceId ? "active" : ""}>2 Guidance</span><i /><span>3 Match & track</span></div>
          <button className="back-review flow-back" onClick={() => setRequestType(null)}><ArrowLeft size={16} /> Choose another path</button>
          <section className="guided-workspace" id="request-assistance">
            <div className="guided-main">
              <div className="flow-heading">
                <span className="eyebrow">{requestType === "PANDIT_SOS" ? "Urgent replacement" : requestType === "NEED_GUIDANCE" ? "Ritual guidance" : "Known Puja"}</span>
                <h2>{requestType === "PANDIT_SOS" ? "Tell us what was planned" : requestType === "NEED_GUIDANCE" ? "What happened or what is the occasion?" : "Which Puja do you need?"}</h2>
              </div>

              {requestType !== "KNOWN_PUJA" && (
                <>
                  <label>Describe the situation
                    <textarea rows={5} value={situation} aria-invalid={Boolean(guidanceError)} onChange={(event) => { setSituation(event.target.value); setGuidanceError(""); }} placeholder={requestType === "PANDIT_SOS" ? "Example: Our Griha Pravesh is today at 11 AM and our Pandit cancelled." : "Example: We are opening a new shop and do not know which Puja is suitable."} />
                    <button type="button" className={`voice-button ${listening ? "active" : ""}`} onClick={startVoiceInput}><Mic size={16} /> {listening ? "Listening…" : "Speak instead of typing"}</button>
                  </label>
                  {guidanceError && <div className="field-error" role="alert">{guidanceError}</div>}
                  {!guidanceError && <p className="field-hint">For example: “We are opening a new shop” or “Our Pandit cancelled today.”</p>}
                </>
              )}

              {(requestType !== "NEED_GUIDANCE" || recommendation) && (
                <><div className="service-grid">
                  {services.map((service) => <button key={service.id} className={`select-card ${serviceId === service.id ? "selected" : ""}`} onClick={() => { setServiceId(service.id); setRecommendation(ritualForService(service.id)); }}>
                    <span className="service-icon">ॐ</span><div><strong>{service.name}</strong><small>{service.description}</small></div><b>from ₹{service.base_price.toLocaleString("en-IN")}</b>
                  </button>)}
                </div>
                {!services.length && <div className="empty"><strong>Puja services are being prepared</strong><span>Please try again shortly or contact support for urgent assistance.</span></div>}</>
              )}

              {requestType === "NEED_GUIDANCE" && !recommendation && <button className="btn btn-primary" onClick={getGuidance}><Compass size={17} /> Recommend the right ritual</button>}

              {guidance && (
                <article className="guidance-card">
                  <div className="guidance-head"><CheckCircle2 size={23} /><div><span>Recommended</span><h3>{guidance.title}</h3></div></div>
                  <p>{guidance.reason}</p>
                  <div className="checklist"><strong>Preparation checklist</strong>{guidance.checklist.map((item) => <span key={item}><CheckCircle2 size={15} /> {item}</span>)}</div>
                  <small>This is practical guidance, not a substitute for advice from a qualified Pandit. The matched Pandit will confirm the ritual.</small>
                </article>
              )}
            </div>

            <aside className="side-card sticky">
              <h3>Request details</h3>
              <label>Preferred language<select value={language} onChange={(event) => setLanguage(event.target.value)}><option>Hindi</option><option>Marathi</option><option>Gujarati</option><option>English</option><option>Sanskrit</option></select></label>
              <label>Puja materials<select value={materialsOption} onChange={(event) => setMaterialsOption(event.target.value)}>{Object.entries(materialsLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
              <label>Full service address<textarea rows={3} value={address} onChange={(event) => { setAddress(event.target.value); if (locationSource === "POSTAL_CODE") { setCoordinates(null); setLocationSource(null); } }} placeholder="Building, street, area and PIN code" /></label>
              <button className="btn btn-ghost btn-block" onClick={detectLocation} disabled={locationBusy}>{locationBusy ? "Detecting GPS…" : <><MapPin size={16} /> Use my current GPS location</>}</button>
              <button className="btn btn-ghost btn-block" onClick={locateFromAddress} disabled={locationBusy || !address.trim()}><Compass size={16} /> Confirm using PIN code area</button>
              <p className={`location-state ${coordinates ? "ready" : ""}`}>{coordinates ? locationSource === "GPS" ? `GPS detected within about ${Math.round(coordinates.accuracy)} metres` : "PIN code area confirmed. Matching and ETA will be approximate." : "GPS gives the best ETA. If unavailable, add a PIN code and confirm the area."}</p>
              <label>Additional note <em>Optional</em><textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
              <button className="btn btn-primary btn-block" disabled={busy || !serviceId} onClick={findNearbyPandits}>{busy ? "Finding nearby Pandits…" : requestType === "PANDIT_SOS" ? "Find replacement now" : "Show nearby Pandits"} <ChevronRight size={17} /></button>
              <p className="privacy-note"><ShieldCheck size={15} /> Exact address is released to the matched Pandit only after acceptance.</p>
            </aside>
          </section>
        </>
      )}

      {requestType && !match && nearbyPandits !== null && (
        <section className="nearby-chooser" id="nearby-pandits">
          <div className="section-title">
            <div><span className="eyebrow">Nearby and available</span><h2>Choose your Pandit</h2><p>{nearbyPandits.length} approved Pandit{nearbyPandits.length === 1 ? "" : "s"} can serve this Puja near your location.</p></div>
            <div className="nearby-actions"><label>Sort profiles<select value={panditSort} onChange={(event) => setPanditSort(event.target.value as typeof panditSort)}><option value="NEAREST">Nearest first</option><option value="RATING">Highest rated</option><option value="EXPERIENCE">Most experienced</option></select></label><button className="btn btn-ghost" onClick={() => setNearbyPandits(null)}><ArrowLeft size={16} /> Edit request</button></div>
          </div>
          {nearbyPandits.length ? <><p className="nearby-scope-note"><MapPin size={15} /> Only approved, online Pandits within 25 km and inside their own service radius are shown.</p><div className="nearby-pandit-grid">{sortedNearbyPandits.map((pandit) => (
            <article className="nearby-pandit-card" key={pandit.id}>
              <div className="nearby-pandit-head"><span className="pandit-avatar">{pandit.name.split(/\s+/).map((part) => part[0]).slice(0,2).join("")}</span><div><h3>{pandit.name}</h3><span className="online-label">Online now</span></div><strong>₹{pandit.charge.toLocaleString("en-IN")}</strong></div>
              <div className="nearby-pandit-stats"><span><MapPin size={16} /><b>{pandit.distance_km} km</b><small>away</small></span><span><Clock3 size={16} /><b>{pandit.eta_minutes} min</b><small>estimated</small></span><span><Star size={16} fill="currentColor" /><b>{pandit.rating_count ? Number(pandit.rating).toFixed(1) : "New"}</b><small>{pandit.rating_count ? `${pandit.rating_count} ratings` : "not rated"}</small></span></div>
              <p><b>{pandit.experience_years} years</b> experience · {pandit.completed_jobs} completed Puja{pandit.completed_jobs === 1 ? "" : "s"}</p>
              <div className="pandit-language-list">{pandit.languages.map((item) => <span key={item}>{item}</span>)}</div>
              <button className="btn btn-primary btn-block" disabled={busy} onClick={() => sendRequest(pandit.id)}>{busy ? "Sending request…" : `Send request to ${pandit.name}`} <ChevronRight size={17} /></button>
            </article>
          ))}</div></> : <div className="empty"><MapPin size={26} /><strong>No approved Pandit is online nearby</strong><span>Try again in a few minutes or edit the Puja and location details.</span><button className="btn btn-ghost" onClick={() => setNearbyPandits(null)}>Edit request</button></div>}
        </section>
      )}

      {match && (
        <section className="success-panel match-success"><CheckCircle2 size={48} /><span className="eyebrow">Request sent</span><h2>Waiting for {match.name} to accept</h2><p>Your request was sent to a Pandit {match.distanceKm} km away. This does not mean it has been accepted yet. The confirmed status will appear below.</p><button className="btn btn-primary" onClick={() => { setMatch(null); setRequestType(null); }}>View live status</button></section>
      )}

      <section className="history tracking-history" id="live-requests">
        <div className="section-title"><div><h2>Live requests</h2><p>Acceptance, journey and arrival verification in one place.</p></div><button className="icon-button" onClick={refreshBookings} aria-label="Refresh requests"><RefreshCw size={17} /></button></div>
        {bookings.length ? <div className="tracking-list">{bookings.map((booking) => {
          const activeIndex = statusOrder.indexOf(booking.status);
          const isDeclined = booking.status === "DECLINED";
          const isCancelled = booking.status === "CANCELLED";
          const hasLiveLocation = booking.pandit_latitude != null && booking.pandit_longitude != null && !["REQUESTED", "DECLINED", "CANCELLED"].includes(booking.status);
          const distance = hasLiveLocation ? distanceKm(booking.latitude, booking.longitude, booking.pandit_latitude!, booking.pandit_longitude!) : null;
          return <article className="tracking-card" key={booking.id}>
            <div className="tracking-head"><div><span className="status">{booking.request_type.replaceAll("_", " ")}</span><h3>{booking.service_name}</h3><p>{booking.pandit_name ?? "Finding a Pandit"}</p></div><strong>₹{booking.amount.toLocaleString("en-IN")}</strong></div>
            {isDeclined ? <div className="request-unavailable">
              <AlertTriangle size={22} />
              <div><strong>This Pandit is unavailable</strong><p>{booking.pandit_name ?? "The selected Pandit"} could not accept your request. No booking has been confirmed or charged. Search now for another available nearby Pandit.</p>{rematchErrors[booking.id] && <small className="rematch-error">{rematchErrors[booking.id]}</small>}</div>
              <button className="btn btn-primary" disabled={rematchingId === booking.id} onClick={() => findAnotherPandit(booking.id)}>{rematchingId === booking.id ? "Searching nearby…" : "Find another Pandit"}</button>
            </div> : isCancelled ? <div className="request-cancelled"><strong>Request cancelled</strong><p>This request is closed and no booking is active.</p></div> :
            <div className="status-track">{statusOrder.slice(0, 5).map((status, index) => <span className={index <= activeIndex ? "done" : ""} key={status}><i />{status.replaceAll("_", " ")}</span>)}</div>}
            <div className="tracking-meta">
              <span><PackageCheck size={15} /> {materialsLabels[booking.materials_option] ?? "Materials guidance requested"}</span>
              {distance != null && <span><MapPin size={15} /> Pandit is approximately {distance.toFixed(1)} km away</span>}
              {booking.status === "REQUESTED" && <span><Clock3 size={15} /> Waiting for Pandit response</span>}
              {["REQUESTED","ACCEPTED"].includes(booking.status) && <button className="text-button danger" onClick={() => void cancelBooking(booking.id)}>Cancel request</button>}
            </div>
            {hasLiveLocation && <a className="text-button map-link" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${booking.pandit_latitude},${booking.pandit_longitude}`}>Open current Pandit location</a>}
            {!["REQUESTED", "DECLINED", "CANCELLED"].includes(booking.status) && <div className="arrival-code"><span>Arrival verification code</span><code>{booking.arrival_otp}</code></div>}
            {booking.status === "COMPLETED" && <div className="booking-payment">
              <div><span className="eyebrow">Action required · Payment</span><h4>{booking.payment_status === "CONFIRMED" ? "Payment method confirmed" : "Puja completed — choose a payment method"}</h4><p>Select the method you will use. No online charge is made by the platform during beta.</p></div>
              {booking.payment_status === "CONFIRMED" ? <div className="payment-confirmed"><CheckCircle2 size={20} /><span><strong>{booking.payment_method === "CASH" ? "Cash" : "Previously recorded payment"}</strong><small>Confirmed for this completed Puja</small></span></div> : <div className="payment-method-grid">
                <button disabled={paymentBusy === booking.id} onClick={() => confirmPaymentMethod(booking.id, "CASH")}><Banknote /><span><strong>Cash</strong><small>Pay with cash after Puja</small></span></button>
                <button disabled title="Available after secure payment setup"><Smartphone /><span><strong>UPI</strong><small>Coming soon</small></span></button>
                <button disabled title="Available after secure payment setup"><CreditCard /><span><strong>Card</strong><small>Coming soon</small></span></button>
              </div>}
              {paymentMessages[booking.id] && <small className="payment-error">{paymentMessages[booking.id]}</small>}
            </div>}
            {booking.status === "COMPLETED" && (booking.customer_rating ? <div className="rating-submitted"><span><Star size={18} fill="currentColor" /> You rated this Puja <strong>{booking.customer_rating}/5</strong></span>{booking.rating_comment && <p>“{booking.rating_comment}”</p>}</div> : <div className="rate-puja">
              <div><span className="eyebrow">Puja completed</span><h4>How was your experience with {booking.pandit_name ?? "the Pandit"}?</h4><p>Your verified rating helps other families choose confidently.</p></div>
              <div className="star-picker" aria-label="Choose a rating">{[1,2,3,4,5].map((star) => <button className={star <= (ratingDrafts[booking.id] ?? 0) ? "selected" : ""} aria-label={`${star} star${star === 1 ? "" : "s"}`} onClick={() => setRatingDrafts((current) => ({ ...current, [booking.id]: star }))} key={star}><Star fill="currentColor" /></button>)}</div>
              <textarea rows={2} maxLength={500} value={ratingComments[booking.id] ?? ""} onChange={(event) => setRatingComments((current) => ({ ...current, [booking.id]: event.target.value }))} placeholder="Share a short comment (optional)" />
              {ratingMessages[booking.id] && <small className="rating-error">{ratingMessages[booking.id]}</small>}
              <button className="btn btn-primary" disabled={ratingBusy === booking.id} onClick={() => submitRating(booking.id)}>{ratingBusy === booking.id ? "Saving rating…" : "Submit rating"}</button>
            </div>)}
          </article>;
        })}</div> : <div className="empty"><Clock3 size={26} /><strong>No active help requests</strong><span>Choose one of the three paths above when you need religious assistance.</span></div>}
      </section>
      <ProfileEditor role="CUSTOMER" />
      <SupportCenter bookings={bookings.map(({id,service_name,status})=>({id,service_name,status}))} />
    </AppShell>
  );
}
