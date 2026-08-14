"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  AlertTriangle, ArrowLeft, BadgeCheck, BadgeHelp, CheckCircle2, ChevronRight, Clock3,
  Banknote, CalendarDays, CreditCard, Home, MapPin, Mic, PackageCheck, Search, ShieldCheck, Smartphone, Sparkles, Star, X,
} from "lucide-react";
import { AppShell } from "./app-shell";
import { usePortalLanguage } from "./portal-language-switcher";
import { IndianLanguageSelect } from "./indian-language-fields";
import { ConsultationPanel } from "./consultation-panel";
import { PanditAvatar } from "./pandit-avatar";
import { AvailabilityFallback, type FallbackPlan } from "./availability-fallback";
import { BookingChat } from "./booking-chat";
import { readJson } from "@/lib/http";
import { getCurrentCoordinates, type BrowserCoordinates } from "@/lib/browser-location";
import { recommendRitual, ritualForService, type RequestType, type RitualRecommendation } from "@/lib/ritual-guide";
import { translatePortalText } from "@/lib/portal-i18n";

type Service = { id: string; name: string; description: string; base_price: number; duration_minutes: number };
declare global { interface Window { Razorpay?:new(options:Record<string,unknown>)=>{open:()=>void;on:(event:string,handler:(response:unknown)=>void)=>void}; } }
type NearbyPandit = {
  id: string; name: string; experience_years: number; languages: string[]; rating: string;
  rating_count: number; completed_jobs: number; charge: number; distance_km: string; eta_minutes: number;
};
type PreparationGuide = {
  guide: { title: string; essentials: string[]; optional: string[]; confirmation: string };
  panchangStatus: "READY" | "NOT_CONFIGURED" | "UNAVAILABLE";
  message?: string;
  panchang: null | {
    date: string; tithi: string; paksha: string | null; tithiPeriod: string | null;
    nakshatra: string; nakshatraPeriod: string | null; yoga: string | null; karana: string | null;
    sunrise: string | null; sunset: string | null; abhijitMuhurat: string | null;
    brahmaMuhurat: string | null; rahuKaal: string | null;
  };
};
type Booking = {
  id: string; status: string; service_name: string; pandit_name: string | null; amount: number;
  address: string; arrival_otp: string; created_at: string; request_type: RequestType; scheduled_at: string | null;
  situation: string | null; materials_option: string; latitude: number; longitude: number;
  pandit_latitude: number | null; pandit_longitude: number | null; location_updated_at: string | null;
  customer_rating: number | null; rating_comment: string | null; rated_at: string | null;
  cancellation_fee:number;cancellation_fee_status:string;cancellation_reason:string|null;cancelled_at:string|null;
  proposed_amount:number|null;price_change_reason:string|null;price_change_status:"NONE"|"PENDING"|"APPROVED"|"REJECTED";
  payment_method: "CASH" | "UPI" | "CARD" | "OTHER" | null; payment_status: "NOT_SELECTED" | "AWAITING_PANDIT" | "CONFIRMED" | "DISPUTED"; payment_confirmed_at: string | null;
  service_id:string;dispatch_status:"NONE"|"SEARCHING"|"ASSIGNED"|"EXHAUSTED";search_radius_km:number;max_search_radius_km:number;travel_surcharge:number;next_expansion_at:string|null;active_offer_count:number;available_now_count:number;
  pandit_phone: string | null;
};
type SpeechRecognitionLike = {
  lang: string; interimResults: boolean; continuous: boolean;
  start(): void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

const statusOrder = ["REQUESTED", "ACCEPTED", "ON_THE_WAY", "ARRIVED", "IN_PROGRESS", "COMPLETED"];
const journeySteps = [
  { value: "REQUESTED", label: "Requested" },
  { value: "ACCEPTED", label: "Confirmed" },
  { value: "ON_THE_WAY", label: "On the way" },
  { value: "ARRIVED", label: "Arrived" },
  { value: "IN_PROGRESS", label: "Puja started" },
  { value: "COMPLETED", label: "Completed" },
];
const bookingStatusCopy: Record<string, { label: string; title: string; detail: string }> = {
  REQUESTED: { label: "Awaiting response", title: "Waiting for Pandit confirmation", detail: "We sent your request. You will be notified as soon as the Pandit responds." },
  ACCEPTED: { label: "Confirmed", title: "Your Pandit has accepted", detail: "Your booking is confirmed. We will notify you when the Pandit starts travelling." },
  ON_THE_WAY: { label: "Travelling", title: "Your Pandit is on the way", detail: "Follow the latest location below and keep your phone nearby for updates." },
  ARRIVED: { label: "At your location", title: "Your Pandit has arrived", detail: "Meet the Pandit first, then share the verification code shown below." },
  IN_PROGRESS: { label: "Puja underway", title: "Your Puja has started", detail: "The arrival was verified successfully. No action is needed right now." },
  COMPLETED: { label: "Completed", title: "Puja completed successfully", detail: "Review the payment choice and share your experience with the Pandit." },
};
const materialsLabels: Record<string, string> = {
  HAVE_MATERIALS: "I have the Puja materials",
  PANDIT_BRINGS: "Pandit should bring materials",
  NEED_GUIDANCE: "Help me understand what is needed",
};
const cancellationPolicyVersion = "2026-08-v1";
const activeBookingStatuses = new Set(["REQUESTED", "ACCEPTED", "ON_THE_WAY", "ARRIVED", "IN_PROGRESS"]);
const cancellationReasons = [
  "My plans changed",
  "There is a family or medical emergency",
  "The Pandit is late or not moving towards me",
  "The Pandit asked me to cancel",
  "The booking details are incorrect",
  "I have a safety concern",
  "Other reason",
];

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const value = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function dateTimeLocalValue(timestamp: number) {
  const date = new Date(timestamp);
  return new Date(timestamp - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function scheduleAt(date: string, window: string) {
  if (!date) return "";
  const time = window === "MORNING" ? "09:00" : window === "AFTERNOON" ? "14:00" : window === "EVENING" ? "18:00" : "10:00";
  return `${date}T${time}`;
}

type CustomerStart = "guided" | "sos" | "online";

export function CustomerPortal({ customerId, customerName, initialStart }: { customerId: string; customerName?: string | null; initialStart?: CustomerStart }) {
  const [appLanguage] = usePortalLanguage();
  const tr = useCallback((text: string) => translatePortalText(text, appLanguage), [appLanguage]);
  const [services, setServices] = useState<Service[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [requestType, setRequestType] = useState<RequestType | null>(initialStart === "guided" ? "NEED_GUIDANCE" : initialStart === "sos" ? "PANDIT_SOS" : null);
  const [serviceId, setServiceId] = useState("");
  const [situation, setSituation] = useState("");
  const [language, setLanguage] = useState("Hindi");
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [materialsOption, setMaterialsOption] = useState("NEED_GUIDANCE");
  const [address, setAddress] = useState("");
  const [savedAddress, setSavedAddress] = useState("");
  const [addressMode, setAddressMode] = useState<"CURRENT" | "SAVED" | "OTHER">("CURRENT");
  const [pinCode, setPinCode] = useState("");
  const [notes, setNotes] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleWindow, setScheduleWindow] = useState("PANDIT_RECOMMENDS");
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [clientRequestId, setClientRequestId] = useState(() => initialStart === "guided" ? crypto.randomUUID() : "");
  const [outstandingBalance, setOutstandingBalance] = useState(0);
  const [coordinates, setCoordinates] = useState<BrowserCoordinates | null>(null);
  const [locationSource, setLocationSource] = useState<"GPS" | null>(null);
  const [recommendation, setRecommendation] = useState<RitualRecommendation | null>(null);
  const [guidanceError, setGuidanceError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationFailed, setLocationFailed] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [listening, setListening] = useState(false);
  const [nearbyPandits, setNearbyPandits] = useState<NearbyPandit[] | null>(null);
  const [nearbyPage, setNearbyPage] = useState(1);
  const [nearbyHasMore, setNearbyHasMore] = useState(false);
  const [rematchingId, setRematchingId] = useState<string | null>(null);
  const [rematchErrors, setRematchErrors] = useState<Record<string, string>>({});
  const [consultationMode, setConsultationMode] = useState(initialStart === "online");
  const [ratingDrafts, setRatingDrafts] = useState<Record<string, number>>({});
  const [ratingComments, setRatingComments] = useState<Record<string, string>>({});
  const [ratingBusy, setRatingBusy] = useState<string | null>(null);
  const [ratingMessages, setRatingMessages] = useState<Record<string, string>>({});
  const [paymentBusy, setPaymentBusy] = useState<string | null>(null);
  const [paymentMessages, setPaymentMessages] = useState<Record<string, string>>({});
  const [bookingView, setBookingView] = useState<"ACTIVE" | "HISTORY">("ACTIVE");
  const [onlinePayments,setOnlinePayments]=useState(false);
  const [preferredPandit, setPreferredPandit] = useState<{ id: string; name: string } | null>(null);
  const [cancellationReview, setCancellationReview] = useState<{ bookingId: string; fee: number; stage: string; free: boolean; notice?: string } | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancellationDetails, setCancellationDetails] = useState("");
  const [cancellationBusy, setCancellationBusy] = useState(false);
  const [cancellationError, setCancellationError] = useState("");
  const [fallbackPlan, setFallbackPlan] = useState<FallbackPlan|null>(null);
  const [fallbackBookingId, setFallbackBookingId] = useState<string|null>(null);
  const [fallbackRadius, setFallbackRadius] = useState(20);
  const [fallbackBusy, setFallbackBusy] = useState(false);
  const [fallbackError, setFallbackError] = useState("");
  const [preparationGuide, setPreparationGuide] = useState<PreparationGuide | null>(null);
  const [preparationBookingId, setPreparationBookingId] = useState<string | null>(null);
  const [preparationBusy, setPreparationBusy] = useState(false);
  const [preparationError, setPreparationError] = useState("");

  const refreshBookings = useCallback(async () => {
    const response = await fetch(`/api/bookings?fresh=${Date.now()}`, {
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Cache-Control": "no-cache" },
    });
    const data = await readJson<{ customerId?: string; bookings?: Booking[]; account?: { outstandingBalance?: number } }>(response);
    if (response.status === 401) {
      setBookings([]);
      window.location.assign("/login?role=customer");
      return;
    }
    if (!response.ok) {
      setMessage("We could not refresh your bookings. Your sign-in is still active; please try again.");
      return;
    }
    if (data.customerId !== customerId) {
      setMessage("We could not safely refresh this page. Please reload it; your sign-in is still active.");
      return;
    }
    setBookings(data.bookings ?? []);
    setOutstandingBalance(data.account?.outstandingBalance ?? 0);
  }, [customerId]);

  useEffect(() => {
    fetch("/api/services").then((response) => readJson<{ services: Service[] }>(response))
      .then((data) => setServices(data.services ?? []));
    void fetch("/api/profile", { cache: "no-store" })
      .then((response) => readJson<{ profile?: { preferred_language?: string; default_address?: string } }>(response))
      .then((data) => {
        if (data.profile?.preferred_language) setLanguage(data.profile.preferred_language);
        if (data.profile?.default_address) {
          setSavedAddress(data.profile.default_address);
          setAddress((current) => current || data.profile!.default_address || "");
        }
      });
    const restorePolicy = window.setTimeout(() => {
      if (window.localStorage.getItem("panditconnect:cancellation-policy") === cancellationPolicyVersion) {
        setPolicyAccepted(true);
      }
    }, 0);
    void fetch("/api/payments/orders",{cache:"no-store"}).then(r=>readJson<{enabled?:boolean}>(r)).then(d=>setOnlinePayments(Boolean(d.enabled)));
    const initialLoad = window.setTimeout(() => void refreshBookings(), 0);
    const refresh=()=>{if(document.visibilityState==="visible")void refreshBookings();};
    const timer = window.setInterval(refresh, 15_000);
    const onVisibility=()=>{if(document.visibilityState==="visible")void refreshBookings();};
    window.addEventListener("focus",refresh);document.addEventListener("visibilitychange",onVisibility);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearTimeout(restorePolicy);
      window.clearInterval(timer);
      window.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",onVisibility);
    };
  }, [refreshBookings]);

  useEffect(() => {
    const applySelection = window.setTimeout(() => {
      const selectedId = new URLSearchParams(window.location.search).get("pandit");
      const selectedName = new URLSearchParams(window.location.search).get("name");
      if (selectedId) {
        setPreferredPandit({ id: selectedId, name: selectedName || "this Pandit" });
        setRequestType("KNOWN_PUJA");
      }
    }, 0);
    return () => window.clearTimeout(applySelection);
  }, []);

  const guidance = useMemo(
    () => recommendation ?? (serviceId ? ritualForService(serviceId) : null),
    [recommendation, serviceId],
  );
  const sortedNearbyPandits = useMemo(
    () => [...(nearbyPandits ?? [])].sort((a, b) => Number(a.distance_km) - Number(b.distance_km)),
    [nearbyPandits],
  );
  const visibleBookings = useMemo(() => bookings.filter((booking) => !(
      booking.status === "DECLINED" &&
      booking.dispatch_status === "EXHAUSTED" &&
      booking.available_now_count > 0
    )), [bookings]);
  const activeBookings = useMemo(() => visibleBookings.filter((booking) => activeBookingStatuses.has(booking.status)), [visibleBookings]);
  const closedBookings = useMemo(() => visibleBookings.filter((booking) => !activeBookingStatuses.has(booking.status)), [visibleBookings]);
  const bookingsForView = bookingView === "ACTIVE" ? activeBookings : closedBookings;

  function choosePath(type: RequestType) {
    setRequestType(type);
    setServiceId("");
    setSituation("");
    setRecommendation(null);
    setGuidanceError("");
    setNearbyPandits(null);
    setNearbyPage(1);
    setNearbyHasMore(false);
    setMessage("");
    setScheduledAt("");
    setScheduleDate("");
    setScheduleWindow("PANDIT_RECOMMENDS");
    setClientRequestId(crypto.randomUUID());
    setFallbackPlan(null);
    setFallbackBookingId(null);
    setFallbackError("");
    setPreparationGuide(null);
    setPreparationError("");
  }

  async function detectLocation() {
    setLocationBusy(true);
    setMessage("");
    setLocationError("");
    try {
      const current = await getCurrentCoordinates();
      setCoordinates(current);
      setLocationSource("GPS");
      setLocationFailed(false);
      void fetch("/api/location/geocode", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ latitude: current.latitude, longitude: current.longitude }),
      }).then((response) => readJson<{ label?: string; postalCode?: string | null }>(response)).then((result) => {
        if (result.label) setAddress((value) => value.trim() ? value : result.label!);
        if (result.postalCode) setPinCode(result.postalCode);
      }).catch(() => undefined);
      return current;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unable to detect your location.";
      setLocationError(errorMessage);
      setLocationFailed(true);
      return null;
    } finally {
      setLocationBusy(false);
    }
  }

  async function selectCurrentLocation() {
    setAddressMode("CURRENT");
    setLocationFailed(false);
    setLocationError("");
    await detectLocation();
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

  function updateSituation(nextSituation: string) {
    setSituation(nextSituation);
    setGuidanceError("");
    setMessage("");
    // A recommendation belongs to the exact description that produced it.
    // Never keep a previously selected Puja after the customer changes their need.
    setRecommendation(null);
    setServiceId("");
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
      setRecommendation(null);
      setServiceId("");
    };
    recognition.onerror = () => setMessage("Voice input could not start. Check microphone permission.");
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
  }

  async function loadFallbackOptions(confirmedLocation = coordinates, bookingId?:string) {
    if(!confirmedLocation&&!bookingId)return null;
    setFallbackBusy(true);setFallbackError("");
    const params=bookingId
      ? new URLSearchParams({bookingId})
      : new URLSearchParams({serviceId,language,lat:String(confirmedLocation!.latitude),lng:String(confirmedLocation!.longitude)});
    const response=await fetch(`/api/bookings/fallback?${params}`,{cache:"no-store"});
    const data=await readJson<FallbackPlan&{error?:string}>(response);
    setFallbackBusy(false);
    if(!response.ok){setFallbackError(data.error??"Unable to prepare fallback options.");return null;}
    const plan={stages:data.stages??[],earliestAvailableAt:data.earliestAvailableAt??null};
    setFallbackPlan(plan);setFallbackBookingId(bookingId??null);
    const usefulStage=plan.stages.find((stage)=>stage.eligibleCount>0&&stage.radiusKm>5)??plan.stages.at(-1);
    if(usefulStage)setFallbackRadius(usefulStage.radiusKm);
    return plan;
  }

  function openOnlineGuidance(){
    setRequestType(null);setNearbyPandits(null);setConsultationMode(true);
    window.setTimeout(()=>document.getElementById("online-guidance")?.scrollIntoView({behavior:"smooth",block:"start"}),0);
  }

  async function startWiderSearch(maxRadiusKm:number,visitAt?:string){
    if(!coordinates||!requestType)return;
    setFallbackBusy(true);setFallbackError("");setMessage("");
    const scheduledVisit=Boolean(visitAt);
    const response=await fetch("/api/bookings",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
      dispatchMode:"BROADCAST",dispatchMaxRadiusKm:maxRadiusKm,serviceId,address,postalCode:pinCode,notes,
      requestType:scheduledVisit?"SCHEDULED_PUJA":requestType,situation,preferredLanguage:language,materialsOption,
      scheduledAt:visitAt,policyAccepted,policyVersion:cancellationPolicyVersion,clientRequestId,
      latitude:coordinates.latitude,longitude:coordinates.longitude,
    })});
    const data=await readJson<{error?:string;dispatch?:{status:string;radiusKm:number;offeredCount:number}}>(response);
    setFallbackBusy(false);
    if(!response.ok){setFallbackError(data.error??"Unable to start the wider search.");return;}
    if(scheduledVisit){setRequestType("SCHEDULED_PUJA");setScheduledAt(dateTimeLocalValue(new Date(visitAt!).getTime()));}
    setNearbyPandits(null);setFallbackPlan(null);setClientRequestId(crypto.randomUUID());
    await refreshBookings();
    setRequestType(null);
    setMessage("We are contacting matching nearby Pandits. You will get an update as soon as one accepts.");
  }

  async function reserveEarliestForBooking(bookingId:string){
    if(!fallbackPlan?.earliestAvailableAt||fallbackBookingId!==bookingId){await loadFallbackOptions(null,bookingId);return;}
    setFallbackBusy(true);setFallbackError("");
    const response=await fetch("/api/bookings/fallback",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({bookingId,action:"RESERVE_EARLIEST"})});
    const data=await readJson<{error?:string;scheduledAt?:string}>(response);setFallbackBusy(false);
    if(!response.ok){setFallbackError(data.error??"Unable to reserve the earliest visit.");return;}
    setFallbackPlan(null);setFallbackBookingId(null);await refreshBookings();
  }

  async function findNearbyPandits(page = 1, append = false) {
    if (!requestType || !serviceId) {
      setMessage("Choose the Puja before continuing.");
      return;
    }
    if ((requestType === "NEED_GUIDANCE" || requestType === "PANDIT_SOS") && situation.trim().length < 5) {
      setMessage("Please add a short description of what happened.");
      return;
    }
    setBusy(true);
    setMessage("");
    const current = locationSource === "GPS" && coordinates ? coordinates : await detectLocation();
    if (!current) { setBusy(false); return; }
    if (!address.trim()) {
      setMessage("We could not identify the service address. Enter it once and continue.");
      setLocationFailed(true);
      setBusy(false);
      return;
    }
    if (!/^[1-9]\d{5}$/.test(pinCode)) {
      setMessage("We could not identify the PIN code from GPS. Enter it once to confirm the service area.");
      setLocationFailed(true);
      setBusy(false);
      return;
    }
    if (requestType === "SCHEDULED_PUJA" && !scheduledAt) {
      setMessage("Choose the date and time for your Puja before comparing Pandits.");
      setBusy(false);
      return;
    }
    const params = new URLSearchParams({ serviceId, language, lat: String(current.latitude), lng: String(current.longitude), page: String(page), limit: "8", ...(preferredPandit ? { panditId: preferredPandit.id } : {}), ...(requestType === "SCHEDULED_PUJA" ? { bookingMode: "SCHEDULED", scheduledAt: new Date(scheduledAt).toISOString() } : {}) });
    const response = await fetch(`/api/pandits/nearby?${params}`, { cache: "no-store" });
    const data = await readJson<{ error?: string; pandits?: NearbyPandit[]; hasMore?: boolean }>(response);
    if (!response.ok) {
      setMessage(data.error ?? "Unable to find nearby Pandits.");
      setBusy(false);
      return;
    }
    const eligible = data.pandits ?? [];
    setNearbyPage(page);
    setNearbyHasMore(Boolean(data.hasMore));
    if (preferredPandit) {
      const selected = eligible.find((pandit) => pandit.id === preferredPandit.id);
      if (!selected) {
        setMessage(`${preferredPandit.name} is not available for this Puja at your location. Choose another nearby Pandit below.`);
        setNearbyPandits(eligible);
        setPreferredPandit(null);
        setBusy(false);
        return;
      }
      await sendRequest(selected.id, current);
      return;
    }
    setNearbyPandits((currentPandits) => append && currentPandits ? [...currentPandits, ...eligible] : eligible);
    if(!append&&eligible.length===0)await loadFallbackOptions(current);
    setBusy(false);
  }

  async function loadPreparationGuide(booking: Booking) {
    setPreparationBookingId(booking.id);
    setPreparationBusy(true);
    setPreparationError("");
    const date = booking.scheduled_at
      ? booking.scheduled_at.slice(0, 10)
      : dateTimeLocalValue(Date.now()).slice(0, 10);
    const params = new URLSearchParams({ serviceId: booking.service_id, date, lat: String(booking.latitude), lng: String(booking.longitude) });
    const response = await fetch(`/api/ritual-preparation?${params}`, { cache: "no-store" });
    const data = await readJson<PreparationGuide & { error?: string }>(response);
    setPreparationBusy(false);
    if (!response.ok) {
      setPreparationError(data.error ?? "Unable to prepare the Puja guide.");
      return;
    }
    setPreparationGuide(data);
    window.setTimeout(() => document.getElementById(`puja-preparation-${booking.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 0);
  }

  async function sendRequest(panditId: string, confirmedLocation = coordinates) {
    if (!confirmedLocation || !requestType) return;
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        panditId, serviceId, address, postalCode: pinCode, notes, requestType, situation, preferredLanguage: language,
        materialsOption, scheduledAt: requestType === "SCHEDULED_PUJA" ? new Date(scheduledAt).toISOString() : undefined,
        policyAccepted, policyVersion: cancellationPolicyVersion,
        clientRequestId,
        latitude: confirmedLocation.latitude, longitude: confirmedLocation.longitude,
      }),
    });
    const data = await readJson<{ error?: string; matchedPandit?: { name: string; distanceKm: string; etaMinutes: number } }>(response);
    if (!response.ok) {
      setMessage(data.error ?? "Unable to send the request.");
      setBusy(false);
      return;
    }
      setNearbyPandits(null);
      setBusy(false);
      await refreshBookings();
      setRequestType(null);
      setMessage(data.matchedPandit ? `Request sent to ${data.matchedPandit.name}. We will notify you when the Pandit responds.` : "Your request was sent.");
  }

  async function findAnotherPandit(bookingId: string) {
    if (rematchingId) return;
    setRematchingId(bookingId);
    setRematchErrors((current) => ({ ...current, [bookingId]: "" }));
    const response = await fetch(`/api/bookings/${bookingId}/rematch`, {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Cache-Control": "no-cache" },
    });
    const data = await readJson<{ error?: string; matchedPandit?: { id: string; name: string; distanceKm: string; etaMinutes: number; status: "REQUESTED" } }>(response);
    if (!response.ok) {
      setRematchErrors((current) => ({ ...current, [bookingId]: data.error ?? "Unable to find another Pandit right now." }));
      setRematchingId(null);
      return;
    }
    if (!data.matchedPandit || data.matchedPandit.status !== "REQUESTED") {
      setRematchErrors((current) => ({ ...current, [bookingId]: "The replacement could not be confirmed. Please refresh and try again." }));
      setRematchingId(null);
      return;
    }
    setBookings((current) => current.map((booking) => booking.id === bookingId ? {
      ...booking,
      status: "REQUESTED",
      pandit_name: data.matchedPandit!.name,
      pandit_latitude: null,
      pandit_longitude: null,
      location_updated_at: null,
    } : booking));
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
    else {
      setPaymentMessages((current) => ({ ...current, [bookingId]: "Payment preference saved. Waiting for the Pandit to confirm cash received." }));
      await refreshBookings();
    }
    setPaymentBusy(null);
  }
  async function startOnlinePayment(bookingId:string,purpose:"SERVICE_PAYMENT"|"CANCELLATION_FEE"="SERVICE_PAYMENT"){
    setPaymentBusy(bookingId);setPaymentMessages(current=>({...current,[bookingId]:""}));
    const idempotencyKey=`${purpose}:${bookingId}:${crypto.randomUUID()}`;
    const response=await fetch("/api/payments/orders",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({bookingId,purpose,idempotencyKey})});const data=await readJson<{error?:string;orderId?:string;amount?:number;keyId?:string}>(response);if(!response.ok||!data.orderId||!data.keyId){setPaymentMessages(current=>({...current,[bookingId]:data.error??"Unable to start secure payment."}));setPaymentBusy(null);return;}
    if(!window.Razorpay){await new Promise<void>((resolve,reject)=>{const script=document.createElement("script");script.src="https://checkout.razorpay.com/v1/checkout.js";script.onload=()=>resolve();script.onerror=()=>reject(new Error("Payment checkout could not load"));document.head.appendChild(script);}).catch(error=>setPaymentMessages(current=>({...current,[bookingId]:error instanceof Error?error.message:"Payment checkout could not load"})));}
    if(!window.Razorpay){setPaymentBusy(null);return;}const checkout=new window.Razorpay({key:data.keyId,amount:(data.amount??0)*100,currency:"INR",name:"PanditConnect",description:purpose==="CANCELLATION_FEE"?"Cancellation balance":"Completed Puja payment",order_id:data.orderId,handler:()=>{setPaymentMessages(current=>({...current,[bookingId]:"Payment submitted securely. Waiting for confirmation…"}));setPaymentBusy(null);window.setTimeout(()=>void refreshBookings(),2500);},modal:{ondismiss:()=>setPaymentBusy(null)},theme:{color:"#c54824"}});checkout.on("payment.failed",()=>{setPaymentMessages(current=>({...current,[bookingId]:"Payment failed or was cancelled. No success was recorded."}));setPaymentBusy(null);});checkout.open();
  }
  async function disputeCashPayment(bookingId:string){if(!window.confirm("Report a cash-payment disagreement? Please also create a support case with the facts."))return;setPaymentBusy(bookingId);const response=await fetch(`/api/bookings/${bookingId}/payment`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"DISPUTE"})});const data=await readJson<{error?:string}>(response);setPaymentMessages(current=>({...current,[bookingId]:response.ok?"Payment marked disputed. Open Help and safety to submit evidence.":data.error??"Unable to report payment issue."}));await refreshBookings();setPaymentBusy(null);}
  async function decidePriceChange(bookingId:string,decision:"APPROVE"|"REJECT"){if(!window.confirm(decision==="APPROVE"?"Approve this revised total? The new amount will replace the original booking amount.":"Reject this change? The previously agreed amount and scope will remain."))return;const response=await fetch(`/api/bookings/${bookingId}/price-change`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({decision})});const data=await readJson<{error?:string}>(response);if(!response.ok)setMessage(data.error??"Unable to update the price request.");await refreshBookings();}

  async function cancelBooking(bookingId: string) {
    setMessage("");
    setCancellationError("");
    const previewResponse=await fetch(`/api/bookings/${bookingId}/cancellation-preview`,{cache:"no-store"});
    const preview=await readJson<{error?:string;fee?:number;stage?:string;free?:boolean;notice?:string}>(previewResponse);
    if(!previewResponse.ok){setMessage(preview.error??"Unable to check cancellation terms.");return;}
    setCancellationReason("");
    setCancellationDetails("");
    setCancellationReview({bookingId,fee:preview.fee??0,stage:preview.stage??"",free:preview.free??(preview.fee??0)===0,notice:preview.notice});
  }

  async function confirmCancellation() {
    if (!cancellationReview) return;
    if (!cancellationReason) {
      setCancellationError("Choose a reason for cancelling.");
      return;
    }
    if (cancellationReason === "Other reason" && cancellationDetails.trim().length < 5) {
      setCancellationError("Please briefly explain the reason.");
      return;
    }
    const reason = cancellationDetails.trim()
      ? `${cancellationReason}: ${cancellationDetails.trim()}`
      : cancellationReason;
    setCancellationBusy(true);
    setCancellationError("");
    const response = await fetch(`/api/bookings/${cancellationReview.bookingId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "CANCELLED", cancellationReason: reason }) });
    const data = await readJson<{ error?:string }>(response);
    if (!response.ok) {
      setCancellationError(data.error ?? "Unable to cancel this request.");
      setCancellationBusy(false);
      return;
    }
    setCancellationReview(null);
    setCancellationReason("");
    setCancellationDetails("");
    await refreshBookings();
    setCancellationBusy(false);
  }

  return (
    <AppShell role="Customer" userName={customerName} title="Puja help for your family" subtitle="Book a verified nearby Pandit in a few simple steps.">
      {message && <div className="alert error">{message}</div>}
      {outstandingBalance>0&&<div className="alert error"><strong>Outstanding cancellation balance: ₹{outstandingBalance.toLocaleString("en-IN")}</strong> New bookings are paused. You can dispute an incorrect charge through Help and safety.{onlinePayments&&bookings.find(item=>item.cancellation_fee_status==="OUTSTANDING")&&<button className="btn btn-primary" disabled={Boolean(paymentBusy)} onClick={()=>void startOnlinePayment(bookings.find(item=>item.cancellation_fee_status==="OUTSTANDING")!.id,"CANCELLATION_FEE")}>Pay balance securely</button>}</div>}

      {!requestType && !consultationMode && (
        <section className="customer-home" id="customer-home">
          <div className="customer-welcome">
            <div className="customer-welcome-copy">
              <span className="customer-devotional-label">ॐ · {tr("Puja help")}</span>
              <h1>{tr("What do you need help with today?")}</h1>
              <p>{tr("Choose one option below. You do not need to know the Puja name—we will guide the rest.")}</p>
              <button className="customer-primary-action" onClick={() => choosePath("NEED_GUIDANCE")}><span className="customer-action-icon"><Sparkles /></span><span><small>{tr("Best place to start")}</small><strong>{tr("Help me choose and book")}</strong><em>{tr("Describe the occasion in simple words")}</em></span><ChevronRight /></button>
              <div className="customer-simple-steps"><span><b>1</b> {tr("Describe")}</span><i /><span><b>2</b> {tr("Choose")}</span><i /><span><b>3</b> {tr("Confirm")}</span></div>
            </div>
            <div className="customer-welcome-image"><Image src="/images/customer-puja-welcome.png" alt="A family receiving Puja guidance from a trusted Pandit at home" width={1750} height={900} priority unoptimized /><span><ShieldCheck /> Verified Pandits · Private booking</span></div>
            </div>

          <div className="customer-choice-grid customer-home-actions" id="request-assistance">
            <button className="customer-choice-card schedule" onClick={() => choosePath("SCHEDULED_PUJA")}><span><CalendarDays /></span><div><small>{tr("Plan ahead")}</small><strong>{tr("Schedule for later")}</strong><p>Choose a date; the Pandit can confirm the right time.</p></div><ChevronRight /></button>
            <button className="customer-choice-card urgent" onClick={() => choosePath("PANDIT_SOS")}><span><AlertTriangle /></span><div><small>{tr("Urgent help")}</small><strong>{tr("My Pandit cancelled")}</strong><p>{tr("Quickly find another approved Pandit nearby.")}</p></div><ChevronRight /></button>
            <button className="customer-choice-card online" onClick={openOnlineGuidance}><span><BadgeHelp /></span><div><small>{tr("Online guidance")}</small><strong>{tr("Ask a Pandit online")}</strong><p>{tr("Ask a religious question privately online.")}</p></div><ChevronRight /></button>
          </div>
          {activeBookingStatuses.size > 0 && bookings.some((booking) => activeBookingStatuses.has(booking.status)) && <button className="customer-active-booking-link" onClick={() => document.getElementById("live-requests")?.scrollIntoView({ behavior: "smooth" })}><Clock3 /> You have an active booking <ChevronRight /></button>}
        </section>
      )}

      {consultationMode && <ConsultationPanel role="CUSTOMER" onBack={() => setConsultationMode(false)} />}

          {requestType && nearbyPandits === null && (
        <>
          <div className="progress"><span className="active">1 Your need</span><i /><span className={serviceId ? "active" : ""}>2 Details</span><i /><span>3 Pandit</span></div>
          <button className="back-review flow-back" onClick={() => setRequestType(null)}><ArrowLeft size={16} /> Back</button>
          <section className="guided-workspace" id="request-assistance">
            <div className="guided-main">
              <div className="flow-heading">
                <span className="eyebrow">{requestType === "NEED_GUIDANCE" ? "Guided booking" : requestType === "SCHEDULED_PUJA" ? "Scheduled booking" : "Direct Puja booking"}</span>
                <h2>{requestType === "NEED_GUIDANCE" ? "What happened or what is the occasion?" : requestType === "SCHEDULED_PUJA" ? "Which Puja would you like to schedule?" : "Select the Puja you want to book"}</h2>
                {requestType === "KNOWN_PUJA" && <p>Choose the Puja. We will show only suitable Pandits after the details are complete.</p>}
              </div>

              {(requestType === "NEED_GUIDANCE" || requestType === "PANDIT_SOS") && (
                <>
                  <label>Describe the situation
                    <textarea rows={5} value={situation} aria-invalid={Boolean(guidanceError)} onChange={(event) => updateSituation(event.target.value)} placeholder={requestType === "PANDIT_SOS" ? "Example: Our Griha Pravesh is today at 11 AM and our Pandit cancelled." : "Example: We are opening a new shop and do not know which Puja is suitable."} />
                    {typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window) && <button type="button" className={`voice-button ${listening ? "active" : ""}`} onClick={startVoiceInput}><Mic size={16} /> {listening ? "Listening…" : "Speak"}</button>}
                  </label>
                  {guidanceError && <div className="field-error" role="alert">{guidanceError}</div>}
                  {!guidanceError && <p className="field-hint">For example: “We are opening a new shop” or “Our Pandit cancelled today.”</p>}
                </>
              )}

              {(requestType !== "NEED_GUIDANCE" || recommendation) && (
                <><div className="service-grid">
                  {services.map((service) => <button key={service.id} className={`select-card ${serviceId === service.id ? "selected" : ""}`} onClick={() => { setServiceId(service.id); setRecommendation(ritualForService(service.id)); setPreparationGuide(null); setPreparationError(""); }}>
                    <span className="service-icon">ॐ</span><div><strong>{service.name}</strong><small>{service.description}</small></div><b>from ₹{service.base_price.toLocaleString("en-IN")}</b>
                  </button>)}
                </div>
                {!services.length && <div className="empty"><strong>Puja services are being prepared</strong><span>Please try again shortly or contact support for urgent assistance.</span></div>}</>
              )}

              {requestType === "NEED_GUIDANCE" && !recommendation && <button className="btn btn-primary" onClick={getGuidance}>Continue <ChevronRight size={17} /></button>}

              {guidance && (
                <article className="guidance-card">
                  <div className="guidance-head"><CheckCircle2 size={23} /><div><span>{requestType === "KNOWN_PUJA" ? "Selected Puja" : "Recommended"}</span><h3>{guidance.title}</h3></div></div>
                  <p>{guidance.reason}</p>
                  <small>The Pandit will confirm the exact ritual, materials and muhurat after accepting.</small>
                </article>
              )}
            </div>

                <aside className="side-card sticky">
                  <h3>Request details</h3>
                  {preferredPandit && <div className="preferred-pandit-note"><BadgeCheck size={18} /><span><small>Your selected Pandit</small><strong>{preferredPandit.name}</strong><em>We will confirm this Pandit serves the selected Puja and your location.</em></span><button onClick={() => setPreferredPandit(null)}>Change</button></div>}
              <div className="request-summary-row"><span><small>Language</small><strong>{language}</strong></span><button type="button" onClick={() => setShowLanguagePicker((value) => !value)}>{showLanguagePicker ? "Done" : "Change"}</button></div>
              {showLanguagePicker && <label>Language for the Puja<IndianLanguageSelect value={language} onChange={setLanguage} /><small className="field-hint">Only Pandits who speak this language will be matched.</small></label>}
              <fieldset className="materials-choice"><legend>Who will arrange Puja materials?</legend>{Object.entries(materialsLabels).map(([value, label]) => <label className={materialsOption === value ? "selected" : ""} key={value}><input type="radio" name="materials" value={value} checked={materialsOption === value} onChange={(event) => setMaterialsOption(event.target.value)} /><span>{label}</span></label>)}</fieldset>
              {requestType === "SCHEDULED_PUJA" && <div className="schedule-choice"><label>Preferred date<input type="date" value={scheduleDate} min={dateTimeLocalValue(Date.now() + 24 * 60 * 60 * 1000).slice(0, 10)} max={dateTimeLocalValue(Date.now() + 180 * 24 * 60 * 60 * 1000).slice(0, 10)} onChange={(event) => { const nextDate = event.target.value; setScheduleDate(nextDate); setScheduledAt(scheduleAt(nextDate, scheduleWindow)); }} /></label><label>Preferred time<select value={scheduleWindow} onChange={(event) => { const nextWindow = event.target.value; setScheduleWindow(nextWindow); setScheduledAt(scheduleAt(scheduleDate, nextWindow)); }}><option value="PANDIT_RECOMMENDS">Let the Pandit recommend</option><option value="MORNING">Morning</option><option value="AFTERNOON">Afternoon</option><option value="EVENING">Evening</option></select></label><small>The Pandit will confirm the final muhurat after accepting.</small></div>}
              <fieldset className="address-choice"><legend>Where is the Puja?</legend><button type="button" className={addressMode === "CURRENT" ? "selected" : ""} aria-pressed={addressMode === "CURRENT" && Boolean(coordinates)} onClick={() => void selectCurrentLocation()} disabled={locationBusy}><MapPin /> {locationBusy && addressMode === "CURRENT" ? "Finding location..." : coordinates && addressMode === "CURRENT" ? "Current location ready" : "Use current location"}</button>{savedAddress&&<button type="button" className={addressMode === "SAVED" ? "selected" : ""} onClick={() => { setAddressMode("SAVED"); setAddress(savedAddress); setLocationFailed(false); setLocationError(""); }}><Home /> Saved address</button>}<button type="button" className={addressMode === "OTHER" ? "selected" : ""} onClick={() => { setAddressMode("OTHER"); setCoordinates(null); setLocationSource(null); setLocationFailed(true); setLocationError(""); setAddress(""); setPinCode(""); }}>Other address</button></fieldset>
              {!coordinates && addressMode !== "OTHER" && <button className="btn btn-primary btn-block" onClick={detectLocation} disabled={locationBusy}>{locationBusy ? "Finding your location…" : <><MapPin size={16} /> Confirm location with GPS</>}</button>}
              {locationError && <div className="alert error location-permission-help" role="alert"><span>{locationError}</span><button type="button" className="text-button" disabled={locationBusy} onClick={() => void selectCurrentLocation()}>Try GPS again</button></div>}
              {coordinates && <div className="location-confirmed"><CheckCircle2 /><span><strong>Location ready</strong><small>{address || "Current GPS location"}</small></span><button type="button" onClick={() => { setCoordinates(null); setLocationSource(null); setLocationError(""); }}>Change</button></div>}
              {locationFailed && <><label>Service address<textarea rows={2} value={address} onChange={(event) => { const nextAddress=event.target.value;setAddress(nextAddress);const detectedPin=nextAddress.match(/(?:^|\D)([1-9]\d{2}[\s-]?\d{3})(?!\d)/)?.[1]?.replace(/\D/g,"");if(detectedPin)setPinCode(detectedPin); }} placeholder="House or building, street and area" /></label><label>PIN code <small>Only needed when GPS cannot confirm the area</small><input inputMode="numeric" autoComplete="postal-code" maxLength={6} value={pinCode} onChange={(event)=>setPinCode(event.target.value.replace(/\D/g,"").slice(0,6))} placeholder="6-digit PIN"/></label>{addressMode === "OTHER" && !coordinates && <button className="btn btn-ghost btn-block" type="button" onClick={detectLocation} disabled={locationBusy}>{locationBusy ? "Checking GPS…" : "Use GPS for this address"}</button>}</>}
              <details className="optional-note"><summary>Add a note <span>Optional</span></summary><label>Anything the Pandit should know<textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} /></label></details>
              {!policyAccepted&&<label className="simple-policy-consent"><input type="checkbox" checked={policyAccepted} onChange={(event)=>{const accepted=event.target.checked;setPolicyAccepted(accepted);if(accepted)window.localStorage.setItem("panditconnect:cancellation-policy",cancellationPolicyVersion);}}/><span>I agree to the <a href="/cancellation-policy" target="_blank">cancellation policy</a>.</span></label>}
                  <button className="btn btn-primary btn-block" disabled={busy || !serviceId || !policyAccepted || (requestType === "SCHEDULED_PUJA" && !scheduledAt)} onClick={() => void findNearbyPandits(1)}>{busy ? "Checking availability…" : preferredPandit ? `Confirm and request ${preferredPandit.name}` : requestType === "SCHEDULED_PUJA" ? "Compare Pandits for this time" : "Compare nearby Pandits"} <ChevronRight size={17} /></button>
              <p className="privacy-note"><ShieldCheck size={15} /> Exact address is released to the matched Pandit only after acceptance.</p>
            </aside>
          </section>
        </>
      )}

      {requestType && nearbyPandits !== null && (
        <section className="nearby-chooser" id="nearby-pandits">
          <div className="section-title">
            <div><span className="eyebrow">Nearby and available</span><h2>Choose your Pandit</h2><p>{nearbyPandits.length} approved Pandit{nearbyPandits.length === 1 ? "" : "s"} can serve this Puja near your location.</p></div>
            <button className="btn btn-ghost" onClick={() => setNearbyPandits(null)}><ArrowLeft size={16} /> Edit request</button>
          </div>
          {nearbyPandits.length ? <><p className="nearby-scope-note"><MapPin size={15} /> Matched for your Puja, language and current location.</p><div className="nearby-pandit-grid">{sortedNearbyPandits.map((pandit) => (
            <article className="nearby-pandit-card" key={pandit.id}>
              <div className="nearby-pandit-head"><PanditAvatar panditId={pandit.id} name={pandit.name} className="pandit-avatar" /><div><h3>{pandit.name}</h3><span className="online-label">Online now</span></div><strong>₹{pandit.charge.toLocaleString("en-IN")}</strong></div>
              <div className="nearby-pandit-stats"><span><MapPin size={16} /><b>{Number(pandit.distance_km) < 1 ? "Within 1 km" : `About ${Math.round(Number(pandit.distance_km))} km`}</b><small>away</small></span><span><Clock3 size={16} /><b>{pandit.eta_minutes} min</b><small>estimated</small></span><span><Star size={16} fill="currentColor" /><b>{pandit.rating_count ? Number(pandit.rating).toFixed(1) : "New"}</b><small>{pandit.rating_count ? `${pandit.rating_count} ratings` : "not rated"}</small></span></div>
              <p><b>{pandit.experience_years} years</b> experience · {pandit.completed_jobs} completed Puja{pandit.completed_jobs === 1 ? "" : "s"}</p>
              <div className="pandit-language-list">{pandit.languages.map((item) => <span key={item}>{item}</span>)}</div>
              <button className="btn btn-primary btn-block" disabled={busy} onClick={() => sendRequest(pandit.id)}>{busy ? "Sending request…" : `Send request to ${pandit.name}`} <ChevronRight size={17} /></button>
            </article>
          ))}</div>{nearbyHasMore && <button className="btn btn-ghost btn-block" disabled={busy} onClick={() => void findNearbyPandits(nearbyPage + 1, true)}>{busy ? "Loading nearby Pandits…" : "Show more nearby Pandits"}</button>}</> : <div className="empty"><MapPin size={26} /><strong>No approved Pandit is online nearby</strong><span>Try again in a few minutes or edit the Puja and location details.</span><button className="btn btn-ghost" onClick={() => setNearbyPandits(null)}>Edit request</button></div>}
          {!nearbyPandits.length&&fallbackPlan&&!fallbackBookingId&&<AvailabilityFallback plan={fallbackPlan} onStartSearch={()=>void startWiderSearch(fallbackRadius)} onOnlineGuidance={openOnlineGuidance} onReserveEarliest={()=>fallbackPlan.earliestAvailableAt&&void startWiderSearch(40,fallbackPlan.earliestAvailableAt)} busy={fallbackBusy} onlineGuidanceAvailable={onlinePayments}/>}
          {fallbackError&&<div className="alert error">{fallbackError}</div>}
        </section>
      )}

      <section className="history tracking-history" id="live-requests">
        <div className="section-title live-request-title"><div><span className="eyebrow">My bookings</span><h2>{bookingView === "ACTIVE" ? "Current bookings" : "Booking history"}</h2><p>{bookingView === "ACTIVE" ? "Only bookings that still need attention appear here." : "Completed and closed bookings are kept here."}</p></div><div className="booking-view-switch"><button className={bookingView === "ACTIVE" ? "active" : ""} onClick={() => setBookingView("ACTIVE")}>Current {activeBookings.length ? `(${activeBookings.length})` : ""}</button><button className={bookingView === "HISTORY" ? "active" : ""} onClick={() => setBookingView("HISTORY")}>History</button></div></div>
        {bookingsForView.length ? <div className="tracking-list">{bookingsForView.map((booking) => {
          const activeIndex = statusOrder.indexOf(booking.status);
          const isDeclined = booking.status === "DECLINED";
          const isCancelled = booking.status === "CANCELLED";
          const hasLiveLocation = booking.pandit_latitude != null && booking.pandit_longitude != null && ["ACCEPTED", "ON_THE_WAY", "ARRIVED"].includes(booking.status);
          const distance = hasLiveLocation ? distanceKm(booking.latitude, booking.longitude, booking.pandit_latitude!, booking.pandit_longitude!) : null;
          const statusCopy = bookingStatusCopy[booking.status];
          return <article className={`tracking-card status-${booking.status.toLowerCase()}`} id={`booking-${booking.id}`} key={booking.id}>
              <div className="tracking-head"><div><span className="status">{booking.request_type === "PANDIT_SOS" ? "Urgent replacement" : booking.request_type === "SCHEDULED_PUJA" ? "Scheduled Puja" : "Puja booking"}</span><h3>{booking.service_name}</h3><p>with <strong>{booking.pandit_name ?? "a nearby Pandit"}</strong></p>{booking.scheduled_at && <p><CalendarDays size={15} /> <strong>{new Date(booking.scheduled_at).toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short" })}</strong></p>}</div><div className="tracking-price"><small>Service amount</small><strong>₹{booking.amount.toLocaleString("en-IN")}</strong></div></div>
              {booking.price_change_status==="PENDING"&&<div className="price-change-review"><div><small>Approval required</small><strong>Revised total: ₹{booking.proposed_amount?.toLocaleString("en-IN")}</strong><p>{booking.price_change_reason}</p></div><button onClick={()=>void decidePriceChange(booking.id,"REJECT")}>Keep original</button><button className="approve" onClick={()=>void decidePriceChange(booking.id,"APPROVE")}>Approve ₹{booking.proposed_amount?.toLocaleString("en-IN")}</button></div>}
            {isDeclined&&booking.dispatch_status==="EXHAUSTED" ? <div className="exhausted-search">
              {fallbackBookingId===booking.id&&fallbackPlan?<AvailabilityFallback compact plan={fallbackPlan} onStartSearch={()=>void reserveEarliestForBooking(booking.id)} onOnlineGuidance={openOnlineGuidance} onReserveEarliest={()=>void reserveEarliestForBooking(booking.id)} busy={fallbackBusy} onlineGuidanceAvailable={onlinePayments}/>:<><AlertTriangle size={24}/><div><strong>No matching Pandit is available right now</strong><p>No suitable Pandit accepted this request. Availability can change at any time.</p>{rematchErrors[booking.id]&&<small className="rematch-error">{rematchErrors[booking.id]}</small>}<div className="fallback-inline-actions"><button className="btn btn-primary" disabled={rematchingId===booking.id} onClick={()=>void findAnotherPandit(booking.id)}>{rematchingId===booking.id?"Checking live availability…":"Check nearby Pandits again"}</button><button className="btn btn-ghost" disabled={fallbackBusy} onClick={()=>void loadFallbackOptions(null,booking.id)}>See earliest available visit</button>{onlinePayments&&<button className="btn btn-ghost" onClick={openOnlineGuidance}>Talk to a Pandit online</button>}</div></div></>}
              {fallbackError&&fallbackBookingId===booking.id&&<div className="alert error">{fallbackError}</div>}
            </div> : isDeclined ? <div className="request-unavailable">
              <AlertTriangle size={22} />
              <div><strong>This Pandit is unavailable</strong><p>{booking.pandit_name ?? "The selected Pandit"} could not accept your request. No booking has been confirmed or charged. Search now for another available nearby Pandit.</p>{rematchErrors[booking.id] && <small className="rematch-error">{rematchErrors[booking.id]}</small>}</div>
              <button className="btn btn-primary" disabled={rematchingId === booking.id} onClick={() => findAnotherPandit(booking.id)}>{rematchingId === booking.id ? "Searching nearby…" : "Find another Pandit"}</button>
            </div> : isCancelled ? <div className="request-cancelled"><strong>Request cancelled</strong><p>{booking.cancellation_reason??"This request is closed and no booking is active."}</p>{booking.cancellation_fee>0&&<p><b>Cancellation charge: ₹{booking.cancellation_fee} · {booking.cancellation_fee_status.replaceAll("_"," ")}</b></p>}</div> :
            <>
              {booking.status==="REQUESTED"&&booking.dispatch_status==="SEARCHING"?<div className="dispatch-searching"><span><Search/></span><div><small>Finding your Pandit</small><h4>We are contacting suitable nearby Pandits</h4><p>The search expands automatically. We will notify you as soon as a Pandit accepts.</p></div></div>:<div className={`booking-current-state state-${booking.status.toLowerCase()}`}><span>{booking.status === "REQUESTED" ? <Clock3 /> : <CheckCircle2 />}</span><div><small>{statusCopy?.label ?? booking.status.replaceAll("_", " ")}</small><h4>{statusCopy?.title}</h4><p>{statusCopy?.detail}</p></div></div>}
              <details className="journey-details"><summary>View journey</summary><div className="status-track">{journeySteps.map((step, index) => <span className={`${index <= activeIndex ? "done" : ""} ${index === Math.min(activeIndex, journeySteps.length - 1) ? "current" : ""}`} key={step.value}><i />{step.label}</span>)}</div></details>
              <div className="tracking-facts">
                <span><PackageCheck size={17} /><small>Materials</small><strong>{materialsLabels[booking.materials_option] ?? "Guidance requested"}</strong></span>
                {distance != null && <span><MapPin size={17} /><small>Live distance</small><strong>{distance < 1 ? "Less than 1 km away" : `About ${Math.round(distance)} km away`}</strong></span>}
                <span><Clock3 size={17} /><small>Requested on</small><strong>{new Date(booking.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</strong></span>
              </div>
              <div className="tracking-actions">
                {hasLiveLocation && <a className="btn btn-primary" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${booking.pandit_latitude},${booking.pandit_longitude}`}><MapPin size={16} /> Track Pandit on map</a>}
                {["REQUESTED","ACCEPTED","ON_THE_WAY","ARRIVED"].includes(booking.status) && <button className="text-button danger" onClick={() => void cancelBooking(booking.id)}>Review cancellation</button>}
              </div>
              {["ACCEPTED", "ON_THE_WAY", "ARRIVED", "IN_PROGRESS"].includes(booking.status) && <BookingChat bookingId={booking.id} participantName={booking.pandit_name ?? "your Pandit"} role="CUSTOMER" phone={booking.pandit_phone} />}
              {booking.status === "ARRIVED" && <div className="arrival-code"><span><strong>Share this code with the Pandit</strong><small>Only share it after meeting the Pandit at your address.</small></span><code>{booking.arrival_otp}</code></div>}
              {["ACCEPTED", "ON_THE_WAY", "ARRIVED"].includes(booking.status) && booking.materials_option === "NEED_GUIDANCE" && <div className="post-acceptance-guide"><button className="btn btn-ghost" disabled={preparationBusy && preparationBookingId === booking.id} onClick={() => void loadPreparationGuide(booking)}><PackageCheck /> {preparationBusy && preparationBookingId === booking.id ? "Preparing guide…" : "See materials and timing guidance"}</button>{preparationError && preparationBookingId === booking.id && <small className="field-error">{preparationError}</small>}{preparationGuide && preparationBookingId === booking.id && <article className="puja-preparation-guide compact" id={`puja-preparation-${booking.id}`}><h4>{preparationGuide.guide.title}</h4><div className="samagri-grid">{preparationGuide.guide.essentials.map((item) => <span key={item}><CheckCircle2 /> {item}</span>)}</div>{preparationGuide.panchang && <div className="panchang-summary"><span><small>Tithi</small><strong>{preparationGuide.panchang.tithi}</strong></span><span><small>Nakshatra</small><strong>{preparationGuide.panchang.nakshatra}</strong></span></div>}<p>Confirm tradition-specific items and final muhurat with {booking.pandit_name ?? "your Pandit"}.</p></article>}</div>}
            </>}
            {booking.status === "COMPLETED" && <div className="post-puja-checkout">
              <div className="checkout-progress" aria-label="Payment and review progress">
                <span className={booking.payment_status === "CONFIRMED" ? "done" : "active"}><i>{booking.payment_status === "CONFIRMED" ? <CheckCircle2 /> : <Banknote />}</i><b>1</b><small>Complete payment</small></span>
                <span className={booking.customer_rating ? "done" : booking.payment_status === "CONFIRMED" ? "active" : "locked"}><i>{booking.customer_rating ? <CheckCircle2 /> : <Star />}</i><b>2</b><small>Rate your Pandit</small></span>
              </div>
              <div className={`booking-payment ${booking.payment_status === "CONFIRMED" ? "is-confirmed" : "needs-selection"}`}>
                <div><span className="eyebrow">Step 1 · Payment</span><h4>{booking.payment_status === "CONFIRMED" ? booking.payment_method==="CASH"?"Cash payment confirmed":booking.payment_method==="UPI"?"UPI payment confirmed":"Online payment confirmed" : booking.payment_status === "AWAITING_PANDIT" ? "Waiting for cash confirmation" : booking.payment_status === "DISPUTED" ? "Payment needs support" : "Pay before leaving a review"}</h4><p>{booking.payment_status === "AWAITING_PANDIT" ? "Your Pandit must confirm after receiving the cash. The rating form will unlock automatically." : booking.payment_status === "DISPUTED" ? "Create a support case and describe what happened." : booking.payment_status === "CONFIRMED" ? "Payment is complete. You can now share your experience." : "Choose cash, UPI or card. Your review unlocks only after the payment is confirmed."}</p></div>
                {booking.payment_status !== "NOT_SELECTED" ? <div className="payment-confirmed">{booking.payment_method==="CASH"?<Banknote size={20}/>:booking.payment_method==="UPI"?<Smartphone size={20}/>:<CreditCard size={20}/>}<span><small>{booking.payment_method==="CASH"?"Cash status":booking.payment_method==="UPI"?"UPI payment":"Online payment"}</small><strong>{booking.payment_status === "CONFIRMED" ? "Confirmed" : booking.payment_status === "DISPUTED" ? "Disputed" : "Awaiting Pandit"}</strong></span>{booking.payment_status === "CONFIRMED" ? <CheckCircle2 size={18} /> : booking.payment_method==="CASH"?<button className="text-button danger" disabled={paymentBusy===booking.id} onClick={()=>void disputeCashPayment(booking.id)}>Report issue</button>:null}</div> : <div className="payment-method-grid">
                  <button disabled={paymentBusy === booking.id} onClick={() => confirmPaymentMethod(booking.id, "CASH")}><Banknote /><span><strong>Cash</strong><small>Confirm after paying the Pandit</small></span></button>
                  <button disabled={!onlinePayments || paymentBusy===booking.id} title={onlinePayments ? "Pay securely with UPI" : "UPI will be available after secure payments are configured"} onClick={()=>void startOnlinePayment(booking.id)}><Smartphone /><span><strong>UPI</strong><small>{onlinePayments ? "Pay using any UPI app" : "Secure setup pending"}</small></span></button>
                  <button disabled={!onlinePayments || paymentBusy===booking.id} title={onlinePayments ? "Pay securely by card" : "Card payment will be available after secure payments are configured"} onClick={()=>void startOnlinePayment(booking.id)}><CreditCard /><span><strong>Card</strong><small>{onlinePayments ? "Debit or credit card" : "Secure setup pending"}</small></span></button>
                </div>}
                {paymentMessages[booking.id] && <small className="payment-error">{paymentMessages[booking.id]}</small>}
              </div>
              {booking.customer_rating ? <div className="rating-submitted"><span><Star size={18} fill="currentColor" /> You rated this Puja <strong>{booking.customer_rating}/5</strong></span>{booking.rating_comment && <p>“{booking.rating_comment}”</p>}</div> : booking.payment_status === "CONFIRMED" ? <div className="rate-puja">
                <div><span className="eyebrow">Step 2 · Review</span><h4>How was your experience with {booking.pandit_name ?? "the Pandit"}?</h4><p>Your verified rating helps other families choose confidently.</p></div>
                <div className="star-picker" aria-label="Choose a rating">{[1,2,3,4,5].map((star) => <button className={star <= (ratingDrafts[booking.id] ?? 0) ? "selected" : ""} aria-label={`${star} star${star === 1 ? "" : "s"}`} onClick={() => setRatingDrafts((current) => ({ ...current, [booking.id]: star }))} key={star}><Star fill="currentColor" /></button>)}</div>
                <textarea rows={2} maxLength={500} value={ratingComments[booking.id] ?? ""} onChange={(event) => setRatingComments((current) => ({ ...current, [booking.id]: event.target.value }))} placeholder="Share a short comment (optional)" />
                {ratingMessages[booking.id] && <small className="rating-error">{ratingMessages[booking.id]}</small>}
                <button className="btn btn-primary" disabled={ratingBusy === booking.id} onClick={() => submitRating(booking.id)}>{ratingBusy === booking.id ? "Saving rating…" : "Submit rating"}</button>
              </div> : <div className="rating-locked"><span><Star /></span><div><small>Step 2 · Review</small><strong>Review unlocks after payment</strong><p>Complete Step 1 above. You cannot submit a rating until the payment is confirmed.</p></div></div>}
            </div>}
          </article>;
        })}</div> : <div className="empty"><Clock3 size={26} /><strong>{bookingView === "ACTIVE" ? "No active bookings" : "No booking history"}</strong><span>{bookingView === "ACTIVE" ? "When you request a Pandit, the live status will appear here." : "Completed and cancelled bookings will appear here."}</span></div>}
      </section>
      {cancellationReview && <div className="cancellation-overlay" role="dialog" aria-modal="true" aria-labelledby="cancellation-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !cancellationBusy) setCancellationReview(null); }}>
        <section className="cancellation-sheet">
          <header><div className="cancellation-heading-icon"><AlertTriangle /></div><div><span className="eyebrow">Review before cancelling</span><h2 id="cancellation-title">Cancel this Pandit booking?</h2></div><button className="icon-button" aria-label="Close cancellation review" disabled={cancellationBusy} onClick={() => setCancellationReview(null)}><X /></button></header>
          <div className={`cancellation-charge ${cancellationReview.fee > 0 ? "has-fee" : "is-free"}`}>
            <strong>{cancellationReview.fee > 0 ? `₹${cancellationReview.fee} cancellation charge` : "No cancellation charge"}</strong>
            <p>{cancellationReview.notice ?? (cancellationReview.fee > 0 ? "The Pandit has reserved time or started travelling. This charge will be added to your account and can be disputed if the Pandit was late, asked you to cancel, or there was a safety issue." : "You can cancel this request without a charge at its current stage.")}</p>
          </div>
          <div className="cancellation-choice-group" role="radiogroup" aria-labelledby="cancellation-reason-label"><strong id="cancellation-reason-label">Why are you cancelling?</strong><div className="cancellation-choice-list">{cancellationReasons.map((reason) => { const selected = cancellationReason === reason; return <button type="button" role="radio" aria-checked={selected} className={`cancellation-choice ${selected ? "selected" : ""}`} onClick={() => { setCancellationReason(reason); setCancellationError(""); }} key={reason}><span className="cancellation-choice-mark">{selected && <CheckCircle2 />}</span><span>{reason}</span></button>; })}</div></div>
          <label className="cancellation-details">Additional details <em>{cancellationReason === "Other reason" ? "Required" : "Optional"}</em><textarea rows={3} maxLength={500} value={cancellationDetails} onChange={(event) => setCancellationDetails(event.target.value)} placeholder="Tell us what happened so we can help if a review is needed." /></label>
          {cancellationError && <div className="alert error" role="alert">{cancellationError}</div>}
          <footer><button className="btn btn-ghost" disabled={cancellationBusy} onClick={() => setCancellationReview(null)}>Keep this booking</button><button className="btn cancellation-confirm" disabled={cancellationBusy || !cancellationReason} onClick={() => void confirmCancellation()}>{cancellationBusy ? "Cancelling…" : cancellationReview.fee > 0 ? `Cancel and accept ₹${cancellationReview.fee} charge` : "Confirm cancellation"}</button></footer>
        </section>
      </div>}
    </AppShell>
  );
}
