"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle, ArrowLeft, BadgeCheck, BadgeHelp, CheckCircle2, ChevronRight, Clock3,
  Banknote, CalendarDays, Compass, CreditCard, HelpCircle, MapPin, Mic, PackageCheck, RefreshCw, Search, ShieldCheck, Smartphone, Sparkles, Star, X,
} from "lucide-react";
import { AppShell } from "./app-shell";
import { ConsultationPanel } from "./consultation-panel";
import { PanditAvatar } from "./pandit-avatar";
import { AvailabilityFallback, type FallbackPlan } from "./availability-fallback";
import { readJson } from "@/lib/http";
import { getCurrentCoordinates, type BrowserCoordinates } from "@/lib/browser-location";
import { recommendRitual, ritualForService, type RequestType, type RitualRecommendation } from "@/lib/ritual-guide";

type Service = { id: string; name: string; description: string; base_price: number; duration_minutes: number };
declare global { interface Window { Razorpay?:new(options:Record<string,unknown>)=>{open:()=>void;on:(event:string,handler:(response:unknown)=>void)=>void}; } }
type NearbyPandit = {
  id: string; name: string; experience_years: number; languages: string[]; rating: string;
  rating_count: number; completed_jobs: number; charge: number; distance_km: string; eta_minutes: number;
};
type DiscoveryPandit = {
  id: string; name: string; city: string | null; experience_years: number; languages: string[];
  specialities: string[]; rating: string; rating_count: number; completed_jobs: number;
  starting_charge: number; distance_km: string; eta_minutes: number; services: string[];
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
  service_id:string;dispatch_status:"NONE"|"SEARCHING"|"ASSIGNED"|"EXHAUSTED";search_radius_km:number;max_search_radius_km:number;travel_surcharge:number;next_expansion_at:string|null;active_offer_count:number;
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

export function CustomerPortal({ customerId, customerName, initialStart }: { customerId: string; customerName?: string | null; initialStart?: "guided" }) {
  const [services, setServices] = useState<Service[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [requestType, setRequestType] = useState<RequestType | null>(initialStart === "guided" ? "NEED_GUIDANCE" : null);
  const [serviceId, setServiceId] = useState("");
  const [situation, setSituation] = useState("");
  const [language, setLanguage] = useState("Hindi");
  const [materialsOption, setMaterialsOption] = useState("NEED_GUIDANCE");
  const [address, setAddress] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [notes, setNotes] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
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
  const [listening, setListening] = useState(false);
  const [match, setMatch] = useState<{ name: string; distanceKm: string; etaMinutes: number; broadcast?:boolean } | null>(null);
  const [nearbyPandits, setNearbyPandits] = useState<NearbyPandit[] | null>(null);
  const [nearbyPage, setNearbyPage] = useState(1);
  const [nearbyHasMore, setNearbyHasMore] = useState(false);
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
  const [onlinePayments,setOnlinePayments]=useState(false);
  const [discoveryPandits, setDiscoveryPandits] = useState<DiscoveryPandit[]>([]);
  const [discoveryBusy, setDiscoveryBusy] = useState(false);
  const [discoveryPage, setDiscoveryPage] = useState(1);
  const [discoveryHasMore, setDiscoveryHasMore] = useState(false);
  const [discoveryMessage, setDiscoveryMessage] = useState("");
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
  const discoveryRail = useRef<HTMLDivElement>(null);

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
    void fetch("/api/payments/orders",{cache:"no-store"}).then(r=>readJson<{enabled?:boolean}>(r)).then(d=>setOnlinePayments(Boolean(d.enabled)));
    const initialLoad = window.setTimeout(() => void refreshBookings(), 0);
    const refresh=()=>{if(document.visibilityState==="visible")void refreshBookings();};
    const timer = window.setInterval(refresh, 15_000);
    const onVisibility=()=>{if(document.visibilityState==="visible")void refreshBookings();};
    window.addEventListener("focus",refresh);document.addEventListener("visibilitychange",onVisibility);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
      window.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",onVisibility);
    };
  }, [refreshBookings]);

  const loadNearbyDiscovery = useCallback(async (page = 1, append = false) => {
    setDiscoveryBusy(true);
    setDiscoveryMessage("");
    try {
      const current = await getCurrentCoordinates();
      setCoordinates(current);
      setLocationSource("GPS");
      const params = new URLSearchParams({ lat: String(current.latitude), lng: String(current.longitude), page: String(page), limit: "6" });
      const response = await fetch(`/api/pandits/discover?${params}`, { cache: "no-store" });
      const data = await readJson<{ pandits?: DiscoveryPandit[]; hasMore?: boolean; error?: string }>(response);
      if (!response.ok) throw new Error(data.error ?? "Unable to load nearby Pandits.");
      setDiscoveryPandits((currentPandits) => append ? [...currentPandits, ...(data.pandits ?? [])] : (data.pandits ?? []));
      setDiscoveryPage(page);
      setDiscoveryHasMore(Boolean(data.hasMore));
      if (!data.pandits?.length) setDiscoveryMessage("No approved Pandit is online near you right now. Please check again shortly.");
    } catch (error) {
      setDiscoveryMessage(error instanceof Error ? error.message : "Allow location access to see nearby Pandits.");
    } finally {
      setDiscoveryBusy(false);
    }
  }, []);

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
    setNearbyPage(1);
    setNearbyHasMore(false);
    setMessage("");
    setScheduledAt("");
    setPolicyAccepted(false);
    setClientRequestId(crypto.randomUUID());
    setFallbackPlan(null);
    setFallbackBookingId(null);
    setFallbackError("");
  }

  function requestDiscoveryPandit(pandit: DiscoveryPandit) {
    choosePath("KNOWN_PUJA");
    setPreferredPandit({ id: pandit.id, name: pandit.name });
    window.setTimeout(() => document.getElementById("request-assistance")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function moveDiscovery(direction: -1 | 1) {
    discoveryRail.current?.scrollBy({ left: direction * Math.min(360, discoveryRail.current.clientWidth * .86), behavior: "smooth" });
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
    setRequestType(null);setMatch(null);setNearbyPandits(null);setConsultationMode(true);
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
    setMatch({name:"nearby approved Pandits",distanceKm:`up to ${maxRadiusKm}`,etaMinutes:0,broadcast:true});
    setNearbyPandits(null);setFallbackPlan(null);setClientRequestId(crypto.randomUUID());
    await refreshBookings();
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
    if (!requestType || !serviceId || !address.trim()) {
      setMessage("Complete the guidance, Puja and address details before continuing.");
      return;
    }
    if ((requestType === "NEED_GUIDANCE" || requestType === "PANDIT_SOS") && situation.trim().length < 5) {
      setMessage("Please add a short description of what happened.");
      return;
    }
    if (!/^[1-9]\d{5}$/.test(pinCode)) {
      setMessage("Enter your 6-digit service-area PIN code before continuing.");
      return;
    }
    setBusy(true);
    setMessage("");
    const current = locationSource === "GPS" && coordinates ? coordinates : await detectLocation();
    if (!current) { setBusy(false); return; }
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
    setMatch(data.matchedPandit ?? null);
    setNearbyPandits(null);
    setBusy(false);
    void refreshBookings();
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
    setMatch({ name: data.matchedPandit.name, distanceKm: data.matchedPandit.distanceKm, etaMinutes: data.matchedPandit.etaMinutes });
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
    if(!window.Razorpay){setPaymentBusy(null);return;}const checkout=new window.Razorpay({key:data.keyId,amount:(data.amount??0)*100,currency:"INR",name:"Pandit in Minutes",description:purpose==="CANCELLATION_FEE"?"Cancellation balance":"Completed Puja payment",order_id:data.orderId,handler:()=>{setPaymentMessages(current=>({...current,[bookingId]:"Payment submitted securely. Waiting for provider confirmation…"}));setPaymentBusy(null);window.setTimeout(()=>void refreshBookings(),2500);},modal:{ondismiss:()=>setPaymentBusy(null)},theme:{color:"#c54824"}});checkout.on("payment.failed",()=>{setPaymentMessages(current=>({...current,[bookingId]:"Payment failed or was cancelled. No success was recorded."}));setPaymentBusy(null);});checkout.open();
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

      {!requestType && !match && !consultationMode && (
        <section className="customer-home" id="customer-home">
          <div className="customer-welcome">
            <div className="customer-welcome-copy">
              <span className="customer-devotional-label">ॐ · Puja help</span>
              <h1>What do you need help with today?</h1>
              <p>Choose one option below. You do not need to know the Puja name—we will guide the rest.</p>
              <button className="customer-primary-action" onClick={() => choosePath("NEED_GUIDANCE")}><span className="customer-action-icon"><Sparkles /></span><span><small>Best place to start</small><strong>Help me choose and book</strong><em>Describe the occasion in simple words</em></span><ChevronRight /></button>
              <div className="customer-simple-steps"><span><b>1</b> Describe</span><i /><span><b>2</b> Choose</span><i /><span><b>3</b> Confirm</span></div>
            </div>
            <div className="customer-welcome-image"><Image src="/images/customer-puja-welcome.png" alt="A family receiving Puja guidance from a trusted Pandit at home" width={1750} height={900} priority unoptimized /><span><ShieldCheck /> Verified Pandits · Private booking</span></div>
            </div>

            <section className="customer-pandit-discovery" aria-labelledby="nearby-pandit-heading">
              <div className="customer-discovery-heading">
                <div><span>Nearby verified Pandits</span><h2 id="nearby-pandit-heading">Choose someone your family can trust</h2><p>Only approved, online Pandits inside their service area are shown.</p></div>
                <div className="customer-discovery-controls">
                  <button className="btn btn-ghost" onClick={() => void loadNearbyDiscovery(1)} disabled={discoveryBusy}><MapPin size={16} /> {discoveryBusy ? "Checking location…" : discoveryPandits.length ? "Refresh nearby" : "Show Pandits near me"}</button>
                  {discoveryPandits.length > 1 && <><button className="icon-button" aria-label="Previous Pandits" onClick={() => moveDiscovery(-1)}><ArrowLeft size={18} /></button><button className="icon-button" aria-label="Next Pandits" onClick={() => moveDiscovery(1)}><ChevronRight size={18} /></button></>}
                </div>
              </div>
              {discoveryMessage && <div className="customer-discovery-message"><MapPin size={18} /><span>{discoveryMessage}</span></div>}
              {discoveryPandits.length > 0 && <div className="customer-pandit-rail" ref={discoveryRail}>{discoveryPandits.map((pandit) => {
                const labels = pandit.services.length ? pandit.services : pandit.specialities;
                const extraCount = Math.max(0, labels.length - 3);
                return <article className="customer-pandit-card" key={pandit.id}>
                  <div className="customer-pandit-top"><PanditAvatar panditId={pandit.id} name={pandit.name} className="pandit-avatar" /><div><h3>{pandit.name}</h3><span className="online-label">Available nearby</span></div><b>{pandit.distance_km} km</b></div>
                  <div className="customer-pandit-tags">{labels.slice(0,3).map((item) => <span key={item}>{item}</span>)}{extraCount > 0 && <span>+{extraCount} more</span>}</div>
                  <div className="customer-pandit-facts"><span><Star size={15} fill="currentColor" /><strong>{pandit.rating_count ? Number(pandit.rating).toFixed(1) : "New"}</strong><small>{pandit.rating_count ? `${pandit.rating_count} ratings` : "No ratings yet"}</small></span><span><Clock3 size={15} /><strong>{pandit.experience_years} years</strong><small>Experience</small></span><span><BadgeCheck size={15} /><strong>{pandit.completed_jobs}</strong><small>Pujas completed</small></span></div>
                  <p className="customer-pandit-language">Speaks {pandit.languages.slice(0,3).join(", ")}</p>
                  <div className="customer-pandit-price"><span>Starts from <strong>₹{pandit.starting_charge.toLocaleString("en-IN")}</strong></span><small>About {pandit.eta_minutes} min away</small></div>
                  <button className="btn btn-primary btn-block" onClick={() => requestDiscoveryPandit(pandit)}>Request this Pandit</button>
                  <Link className="customer-pandit-more" href={`/customer/pandits/${pandit.id}`}>Know more about {pandit.name} <ChevronRight size={15} /></Link>
                </article>;
              })}</div>}
              {discoveryHasMore && <button className="btn btn-ghost btn-block" disabled={discoveryBusy} onClick={() => void loadNearbyDiscovery(discoveryPage + 1, true)}>{discoveryBusy ? "Loading more…" : "Show more nearby Pandits"}</button>}
            </section>

            <div className="customer-choice-heading" id="request-assistance"><div><span>Quick help</span><h2>Choose what you need now</h2></div><p>Nothing is submitted until you confirm.</p></div>
          <div className="customer-choice-grid">
            <button className="customer-choice-card schedule" onClick={() => choosePath("SCHEDULED_PUJA")}><span><CalendarDays /></span><div><small>Plan ahead</small><strong>Schedule a Puja</strong><p>Choose a future date, time and nearby Pandit.</p></div><ChevronRight /></button>
            <button className="customer-choice-card urgent" onClick={() => choosePath("PANDIT_SOS")}><span><AlertTriangle /></span><div><small>Urgent help</small><strong>My Pandit cancelled</strong><p>Quickly find another approved Pandit nearby.</p></div><ChevronRight /></button>
            <button className="customer-choice-card online" id="online-guidance" onClick={() => setConsultationMode(true)}><span><BadgeHelp /></span><div><small>Online guidance</small><strong>Chat with a Pandit</strong><p>Ask a religious question privately online.</p></div><ChevronRight /></button>
          </div>

          <div className="customer-trust-row"><span><ShieldCheck /><b>Verified profiles</b><small>Reviewed by Admin</small></span><span><MapPin /><b>Nearby matching</b><small>Based on your area</small></span><span><BadgeCheck /><b>Simple updates</b><small>Track every status</small></span></div>
        </section>
      )}

      {consultationMode && <ConsultationPanel role="CUSTOMER" onBack={() => setConsultationMode(false)} />}

          {requestType && !match && nearbyPandits === null && (
        <>
          <div className="flow-assurance"><ShieldCheck /><div><strong>You stay in control</strong><span>Nothing is sent until you review the Puja, language, materials and address.</span></div></div>
          <div className="progress"><span className="active">1 {requestType === "KNOWN_PUJA" || requestType === "SCHEDULED_PUJA" ? "Select Puja" : "Describe need"}</span><i /><span className={serviceId ? "active" : ""}>2 Booking details</span><i /><span>3 Choose Pandit</span></div>
          <button className="back-review flow-back" onClick={() => setRequestType(null)}><ArrowLeft size={16} /> Choose another path</button>
          <section className="guided-workspace" id="request-assistance">
            <div className="guided-main">
              <div className="flow-heading">
                <span className="eyebrow">{requestType === "NEED_GUIDANCE" ? "Guided booking" : requestType === "SCHEDULED_PUJA" ? "Scheduled booking" : "Direct Puja booking"}</span>
                <h2>{requestType === "NEED_GUIDANCE" ? "What happened or what is the occasion?" : requestType === "SCHEDULED_PUJA" ? "Which Puja would you like to schedule?" : "Select the Puja you want to book"}</h2>
                {requestType === "KNOWN_PUJA" && <p>Prices shown are starting prices. You will choose from Pandits who perform this Puja, speak your preferred language and serve your location.</p>}
              </div>

              {(requestType === "NEED_GUIDANCE" || requestType === "PANDIT_SOS") && (
                <>
                  <label>Describe the situation
                    <textarea rows={5} value={situation} aria-invalid={Boolean(guidanceError)} onChange={(event) => updateSituation(event.target.value)} placeholder={requestType === "PANDIT_SOS" ? "Example: Our Griha Pravesh is today at 11 AM and our Pandit cancelled." : "Example: We are opening a new shop and do not know which Puja is suitable."} />
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
                  <div className="guidance-head"><CheckCircle2 size={23} /><div><span>{requestType === "KNOWN_PUJA" ? "Selected Puja" : "Recommended"}</span><h3>{guidance.title}</h3></div></div>
                  <p>{guidance.reason}</p>
                  <div className="checklist"><strong>Preparation checklist</strong>{guidance.checklist.map((item) => <span key={item}><CheckCircle2 size={15} /> {item}</span>)}</div>
                  <small>This is practical guidance, not a substitute for advice from a qualified Pandit. The matched Pandit will confirm the ritual.</small>
                </article>
              )}
            </div>

                <aside className="side-card sticky">
                  <h3>Request details</h3>
                  {preferredPandit && <div className="preferred-pandit-note"><BadgeCheck size={18} /><span><small>Your selected Pandit</small><strong>{preferredPandit.name}</strong><em>We will confirm this Pandit serves the selected Puja and your location.</em></span><button onClick={() => setPreferredPandit(null)}>Change</button></div>}
              <label>Preferred language<select value={language} onChange={(event) => setLanguage(event.target.value)}><option>Hindi</option><option>Marathi</option><option>Gujarati</option><option>English</option><option>Sanskrit</option></select></label>
              <label>Puja materials<select value={materialsOption} onChange={(event) => setMaterialsOption(event.target.value)}>{Object.entries(materialsLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
              {requestType === "SCHEDULED_PUJA" && <label>Puja date and time<input type="datetime-local" value={scheduledAt} min={dateTimeLocalValue(Date.now() + 2 * 60 * 60 * 1000)} max={dateTimeLocalValue(Date.now() + 180 * 24 * 60 * 60 * 1000)} onChange={(event) => setScheduledAt(event.target.value)} /><small className="field-hint">Schedule at least 2 hours ahead.</small></label>}
              <label>Full service address<textarea rows={3} value={address} onChange={(event) => { const nextAddress=event.target.value;setAddress(nextAddress);const detectedPin=nextAddress.match(/(?:^|\D)([1-9]\d{2}[\s-]?\d{3})(?!\d)/)?.[1]?.replace(/\D/g,"");if(detectedPin)setPinCode(detectedPin); }} placeholder="House or building, street and area" /></label>
              <label>6-digit PIN code<input inputMode="numeric" autoComplete="postal-code" maxLength={6} pattern="[1-9][0-9]{5}" value={pinCode} onChange={(event)=>setPinCode(event.target.value.replace(/\D/g,"").slice(0,6))} placeholder="Example: 400075"/><small className="field-hint">Enter the PIN code for the Puja address.</small></label>
              <button className="btn btn-ghost btn-block" onClick={detectLocation} disabled={locationBusy}>{locationBusy ? "Detecting GPS…" : <><MapPin size={16} /> Use my current GPS location</>}</button>
              <p className={`location-state ${coordinates ? "ready" : ""}`}>{coordinates ? `GPS detected within about ${Math.round(coordinates.accuracy)} metres` : "GPS permission is required. Pandits are fetched only after your location is detected."}</p>
              <label>Additional note <em>Optional</em><textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
              <div className="booking-policy-consent"><strong>Cancellation policy</strong><p>Cancellation is free before acceptance and for 5 minutes after acceptance. Later cancellation may cost ₹49, up to ₹99 while travelling, or up to ₹199 after arrival.</p><label><input type="checkbox" checked={policyAccepted} onChange={(event)=>setPolicyAccepted(event.target.checked)}/><span>I understand and agree to cancellation policy version {cancellationPolicyVersion}.</span></label><Link href="/cancellation-policy" target="_blank">Read full cancellation policy</Link></div>
                  <button className="btn btn-primary btn-block" disabled={busy || !serviceId || !policyAccepted || (requestType === "SCHEDULED_PUJA" && !scheduledAt)} onClick={() => void findNearbyPandits(1)}>{busy ? "Checking availability…" : preferredPandit ? `Confirm and request ${preferredPandit.name}` : requestType === "SCHEDULED_PUJA" ? "Compare Pandits for this time" : "Compare nearby Pandits"} <ChevronRight size={17} /></button>
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
              <div className="nearby-pandit-head"><PanditAvatar panditId={pandit.id} name={pandit.name} className="pandit-avatar" /><div><h3>{pandit.name}</h3><span className="online-label">Online now</span></div><strong>₹{pandit.charge.toLocaleString("en-IN")}</strong></div>
              <div className="nearby-pandit-stats"><span><MapPin size={16} /><b>{pandit.distance_km} km</b><small>away</small></span><span><Clock3 size={16} /><b>{pandit.eta_minutes} min</b><small>estimated</small></span><span><Star size={16} fill="currentColor" /><b>{pandit.rating_count ? Number(pandit.rating).toFixed(1) : "New"}</b><small>{pandit.rating_count ? `${pandit.rating_count} ratings` : "not rated"}</small></span></div>
              <p><b>{pandit.experience_years} years</b> experience · {pandit.completed_jobs} completed Puja{pandit.completed_jobs === 1 ? "" : "s"}</p>
              <div className="pandit-language-list">{pandit.languages.map((item) => <span key={item}>{item}</span>)}</div>
              <button className="btn btn-primary btn-block" disabled={busy} onClick={() => sendRequest(pandit.id)}>{busy ? "Sending request…" : `Send request to ${pandit.name}`} <ChevronRight size={17} /></button>
            </article>
          ))}</div>{nearbyHasMore && <button className="btn btn-ghost btn-block" disabled={busy} onClick={() => void findNearbyPandits(nearbyPage + 1, true)}>{busy ? "Loading nearby Pandits…" : "Show more nearby Pandits"}</button>}</> : <div className="empty"><MapPin size={26} /><strong>No approved Pandit is online nearby</strong><span>Try again in a few minutes or edit the Puja and location details.</span><button className="btn btn-ghost" onClick={() => setNearbyPandits(null)}>Edit request</button></div>}
          {!nearbyPandits.length&&fallbackPlan&&!fallbackBookingId&&<AvailabilityFallback plan={fallbackPlan} selectedRadius={fallbackRadius} onRadiusChange={setFallbackRadius} onStartSearch={()=>void startWiderSearch(fallbackRadius)} onOnlineGuidance={openOnlineGuidance} onReserveEarliest={()=>fallbackPlan.earliestAvailableAt&&void startWiderSearch(40,fallbackPlan.earliestAvailableAt)} busy={fallbackBusy}/>}
          {fallbackError&&<div className="alert error">{fallbackError}</div>}
        </section>
      )}

      {match && (
        <section className="success-panel match-success"><CheckCircle2 size={48}/><span className="eyebrow">{requestType==="SCHEDULED_PUJA"?"Schedule request sent":match.broadcast?"Automatic search started":"Request sent"}</span><h2>{match.broadcast?"We are contacting matching nearby Pandits":`Waiting for ${match.name} to accept`}</h2><p>{match.broadcast?`The search starts at 5 km and expands automatically up to ${match.distanceKm} km every 3 minutes. The first eligible Pandit to accept will be confirmed.`:requestType==="SCHEDULED_PUJA"&&scheduledAt?`Your Puja request for ${new Date(scheduledAt).toLocaleString("en-IN",{dateStyle:"full",timeStyle:"short"})} was sent to a nearby Pandit.`:`Your request was sent to a Pandit ${match.distanceKm} km away.`} The confirmed status will appear below.</p>{match.broadcast&&<button className="btn btn-ghost" onClick={openOnlineGuidance}>Talk to a Pandit online while we search</button>}<button className="btn btn-primary" onClick={()=>{setMatch(null);setRequestType(null);}}>View live status</button></section>
      )}

      <section className="history tracking-history" id="live-requests">
        <div className="section-title live-request-title"><div><span className="eyebrow">My bookings</span><h2>Your Puja requests</h2><p>See the latest update and what you need to do next.</p></div><button className="icon-button" onClick={refreshBookings} aria-label="Refresh requests"><RefreshCw size={17} /></button></div>
        {bookings.length ? <div className="tracking-list">{bookings.map((booking) => {
          const activeIndex = statusOrder.indexOf(booking.status);
          const isDeclined = booking.status === "DECLINED";
          const isCancelled = booking.status === "CANCELLED";
          const hasLiveLocation = booking.pandit_latitude != null && booking.pandit_longitude != null && ["ACCEPTED", "ON_THE_WAY", "ARRIVED"].includes(booking.status);
          const distance = hasLiveLocation ? distanceKm(booking.latitude, booking.longitude, booking.pandit_latitude!, booking.pandit_longitude!) : null;
          const statusCopy = bookingStatusCopy[booking.status];
          return <article className={`tracking-card status-${booking.status.toLowerCase()}`} key={booking.id}>
              <div className="tracking-head"><div><span className="status">{booking.request_type === "PANDIT_SOS" ? "Urgent replacement" : booking.request_type === "SCHEDULED_PUJA" ? "Scheduled Puja" : "Puja booking"}</span><h3>{booking.service_name}</h3><p>with <strong>{booking.pandit_name ?? "a nearby Pandit"}</strong></p>{booking.scheduled_at && <p><CalendarDays size={15} /> <strong>{new Date(booking.scheduled_at).toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short" })}</strong></p>}</div><div className="tracking-price"><small>Service amount</small><strong>₹{booking.amount.toLocaleString("en-IN")}</strong></div></div>
              {booking.price_change_status==="PENDING"&&<div className="price-change-review"><div><small>Approval required</small><strong>Revised total: ₹{booking.proposed_amount?.toLocaleString("en-IN")}</strong><p>{booking.price_change_reason}</p></div><button onClick={()=>void decidePriceChange(booking.id,"REJECT")}>Keep original</button><button className="approve" onClick={()=>void decidePriceChange(booking.id,"APPROVE")}>Approve ₹{booking.proposed_amount?.toLocaleString("en-IN")}</button></div>}
            {isDeclined&&booking.dispatch_status==="EXHAUSTED" ? <div className="exhausted-search">
              {fallbackBookingId===booking.id&&fallbackPlan?<AvailabilityFallback compact plan={fallbackPlan} selectedRadius={40} onRadiusChange={()=>undefined} onStartSearch={()=>void reserveEarliestForBooking(booking.id)} onOnlineGuidance={openOnlineGuidance} onReserveEarliest={()=>void reserveEarliestForBooking(booking.id)} busy={fallbackBusy}/>:<><AlertTriangle size={24}/><div><strong>Nearby Pandits are currently busy</strong><p>We completed the approved search up to {booking.max_search_radius_km} km. No booking was confirmed or charged.</p><div className="fallback-inline-actions"><button className="btn btn-primary" disabled={fallbackBusy} onClick={()=>void loadFallbackOptions(null,booking.id)}>See earliest available visit</button><button className="btn btn-ghost" onClick={openOnlineGuidance}>Talk to a Pandit online</button></div></div></>}
              {fallbackError&&fallbackBookingId===booking.id&&<div className="alert error">{fallbackError}</div>}
            </div> : isDeclined ? <div className="request-unavailable">
              <AlertTriangle size={22} />
              <div><strong>This Pandit is unavailable</strong><p>{booking.pandit_name ?? "The selected Pandit"} could not accept your request. No booking has been confirmed or charged. Search now for another available nearby Pandit.</p>{rematchErrors[booking.id] && <small className="rematch-error">{rematchErrors[booking.id]}</small>}</div>
              <button className="btn btn-primary" disabled={rematchingId === booking.id} onClick={() => findAnotherPandit(booking.id)}>{rematchingId === booking.id ? "Searching nearby…" : "Find another Pandit"}</button>
            </div> : isCancelled ? <div className="request-cancelled"><strong>Request cancelled</strong><p>{booking.cancellation_reason??"This request is closed and no booking is active."}</p>{booking.cancellation_fee>0&&<p><b>Cancellation charge: ₹{booking.cancellation_fee} · {booking.cancellation_fee_status.replaceAll("_"," ")}</b></p>}</div> :
            <>
              {booking.status==="REQUESTED"&&booking.dispatch_status==="SEARCHING"?<div className="dispatch-searching"><span><Search/></span><div><small>Automatic nearby search</small><h4>We are contacting matching Pandits</h4><p>Searching within {booking.search_radius_km} km now. {booking.active_offer_count?`${booking.active_offer_count} approved Pandit${booking.active_offer_count===1?" has":"s have"} 3 minutes to respond.`:"The next approved distance band will be checked automatically."}</p><div className="dispatch-radius-progress">{[5,10,20,40].filter((radius)=>radius<=booking.max_search_radius_km).map((radius)=><i className={radius<=booking.search_radius_km?"done":""} key={radius}>{radius} km</i>)}</div><button className="btn btn-ghost" onClick={openOnlineGuidance}>Talk to a Pandit online while we search</button></div></div>:<div className={`booking-current-state state-${booking.status.toLowerCase()}`}><span>{booking.status === "REQUESTED" ? <Clock3 /> : <CheckCircle2 />}</span><div><small>{statusCopy?.label ?? booking.status.replaceAll("_", " ")}</small><h4>{statusCopy?.title}</h4><p>{statusCopy?.detail}</p></div></div>}
              <div className="status-track">{journeySteps.map((step, index) => <span className={`${index <= activeIndex ? "done" : ""} ${index === Math.min(activeIndex, journeySteps.length - 1) ? "current" : ""}`} key={step.value}><i />{step.label}</span>)}</div>
              <div className="tracking-facts">
                <span><PackageCheck size={17} /><small>Materials</small><strong>{materialsLabels[booking.materials_option] ?? "Guidance requested"}</strong></span>
                {distance != null && <span><MapPin size={17} /><small>Live distance</small><strong>About {distance.toFixed(1)} km away</strong></span>}
                <span><Clock3 size={17} /><small>Requested on</small><strong>{new Date(booking.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</strong></span>
              </div>
              <div className="tracking-actions">
                {hasLiveLocation && <a className="btn btn-primary" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${booking.pandit_latitude},${booking.pandit_longitude}`}><MapPin size={16} /> Track Pandit on map</a>}
                {["REQUESTED","ACCEPTED","ON_THE_WAY","ARRIVED"].includes(booking.status) && <button className="text-button danger" onClick={() => void cancelBooking(booking.id)}>Review cancellation</button>}
              </div>
              {["ACCEPTED", "ON_THE_WAY"].includes(booking.status) && <div className="arrival-code arrival-code-locked"><ShieldCheck size={18} /><span><strong>Arrival code is protected</strong><small>It will appear after the Pandit marks “Arrived”.</small></span></div>}
              {booking.status === "ARRIVED" && <div className="arrival-code"><span><strong>Share this code with the Pandit</strong><small>Only share it after meeting the Pandit at your address.</small></span><code>{booking.arrival_otp}</code></div>}
            </>}
            {booking.status === "COMPLETED" && <div className={`booking-payment ${booking.payment_status === "CONFIRMED" ? "is-confirmed" : "needs-selection"}`}>
              <div><span className="eyebrow">{booking.payment_status === "CONFIRMED" ? "Payment settled" : booking.payment_status === "AWAITING_PANDIT" ? "Waiting for Pandit confirmation" : booking.payment_status === "DISPUTED" ? "Payment disputed" : "Choose payment method"}</span><h4>{booking.payment_status === "CONFIRMED" ? booking.payment_method==="CASH"?"Cash confirmed by both sides":"Online payment confirmed" : booking.payment_status === "AWAITING_PANDIT" ? "You selected cash payment" : booking.payment_status === "DISPUTED" ? "Support review needed" : "How would you like to pay?"}</h4><p>{booking.payment_status === "AWAITING_PANDIT" ? "The Pandit must confirm only after receiving the cash." : booking.payment_status === "DISPUTED" ? "Create a support case and describe what happened." : onlinePayments?"Online payments are confirmed only by the secure provider.":"Online payment is not active yet; cash remains available."}</p></div>
              {booking.payment_status !== "NOT_SELECTED" ? <div className="payment-confirmed">{booking.payment_method==="CASH"?<Banknote size={20}/>:<CreditCard size={20}/>}<span><small>{booking.payment_method==="CASH"?"Cash status":"Online payment"}</small><strong>{booking.payment_status === "CONFIRMED" ? "Confirmed" : booking.payment_status === "DISPUTED" ? "Disputed" : "Awaiting Pandit"}</strong></span>{booking.payment_status === "CONFIRMED" ? <CheckCircle2 size={18} /> : booking.payment_method==="CASH"?<button className="text-button danger" disabled={paymentBusy===booking.id} onClick={()=>void disputeCashPayment(booking.id)}>Report issue</button>:null}</div> : <div className="payment-method-grid">
                <button disabled={paymentBusy === booking.id} onClick={() => confirmPaymentMethod(booking.id, "CASH")}><Banknote /><span><strong>Cash</strong><small>Pay with cash after Puja</small></span></button>
                <button disabled={!onlinePayments||paymentBusy===booking.id} title={onlinePayments?"Pay securely using the configured provider":"Available after secure payment setup"} onClick={()=>void startOnlinePayment(booking.id)}><Smartphone /><span><strong>UPI</strong><small>{onlinePayments?"Secure online payment":"Coming soon"}</small></span></button>
                <button disabled={!onlinePayments||paymentBusy===booking.id} title={onlinePayments?"Pay securely using the configured provider":"Available after secure payment setup"} onClick={()=>void startOnlinePayment(booking.id)}><CreditCard /><span><strong>Card</strong><small>{onlinePayments?"Secure online payment":"Coming soon"}</small></span></button>
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
        })}</div> : <div className="empty"><Clock3 size={26} /><strong>No Puja requests yet</strong><span>Choose “Help me choose and book” whenever your family needs a Pandit.</span></div>}
      </section>
      <Link href="/help" className="customer-help-fab" aria-label="Get help using the app"><HelpCircle /><span>Need help?</span></Link>
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
