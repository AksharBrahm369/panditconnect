"use client";

import Link from "next/link";
import { MapPin, Navigation, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { readJson } from "@/lib/http";
import { getCurrentCoordinates } from "@/lib/browser-location";

type NearbyPandit = {
  id: string;
  name: string;
  experience_years: number;
  languages: string[];
  rating: string;
  charge: number;
  distance_km: string;
  eta_minutes: number;
};

export function LiveAvailabilityCard() {
  const [pandits, setPandits] = useState<NearbyPandit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  function checkAvailability() {
    setStarted(true);
    setError(null);
    setPandits(null);
    getCurrentCoordinates()
      .then((coordinates) => {
        const params = new URLSearchParams({
          serviceId: "ganesh-puja",
          language: "Hindi",
          lat: String(coordinates.latitude),
          lng: String(coordinates.longitude),
        });
        return fetch(`/api/pandits/nearby?${params}`, { cache: "no-store" });
      })
      .then(async (response) => {
        const data = await readJson<{ pandits?: NearbyPandit[]; error?: string }>(response);
        if (!response.ok) throw new Error(data.error || "Nearby availability could not be checked.");
        return data;
      })
      .then((data) => setPandits(data.pandits ?? []))
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "We could not use your location. Please try again.");
        setPandits([]);
      });
  }

  const loading = started && pandits === null;
  const availableCount = pandits?.length ?? 0;
  const available = availableCount > 0;

  return (
    <div className="hero-panel">
      {!started ? <div className="availability-start">
        <span className="availability-pin"><MapPin /></span>
        <div><span className="eyebrow">Live nearby matching</span><h3>See who is available near you</h3><p>We ask for location only after you choose to check.</p></div>
        <button className="btn btn-primary btn-block" onClick={checkAvailability}><Navigation size={16} /> Check Pandits near me</button>
        <p className="privacy-note"><ShieldCheck size={15} /> Your exact location is never displayed publicly.</p>
      </div> : <>
      <div className={`live-pill ${!loading && !available ? "empty" : ""}`}>
        <i />
        {loading
          ? "Checking live availability…"
          : available
            ? `${availableCount} ${availableCount === 1 ? "Pandit" : "Pandits"} available near you`
            : error
              ? "Location needs your attention"
              : "No Pandits online near you"}
      </div>

      {pandits && pandits.length > 0 ? (
        <div className="live-pandit-list" aria-label={`${availableCount} nearby Pandits`}>
          {pandits.map((nearbyPandit) => <article className="live-pandit-card" key={nearbyPandit.id}>
            <div className="mini-card">
              <div className="avatar">
                {nearbyPandit.name.split(" ").slice(-2).map((part) => part[0]).join("")}
              </div>
              <div>
                <strong>{nearbyPandit.name}</strong>
                <small>{nearbyPandit.experience_years} years · {nearbyPandit.languages.join(", ")}</small>
              </div>
              <b>{nearbyPandit.rating} ★</b>
            </div>
            <div className="route-line"><span>{nearbyPandit.distance_km} km away</span><strong>{nearbyPandit.eta_minutes} min</strong></div>
            <div className="puja-summary"><span>Ganesh Puja</span><b>₹{nearbyPandit.charge.toLocaleString("en-IN")}</b></div>
            <Link href="/login?role=customer" className="btn btn-primary btn-block">Request {nearbyPandit.name}</Link>
          </article>)}
        </div>
      ) : (
        <div className="availability-empty">
          <strong>{loading ? "Finding nearby Pandits…" : error ? "We could not use your location" : "No Pandits are online nearby"}</strong>
          <p>{loading
            ? "This will take just a moment."
            : error
              ? error
              : "Your location worked. Approved Pandits will appear here when someone nearby switches availability online."}</p>
          {error?.toLowerCase().includes("permission") && <p className="location-help">On your phone, tap the lock or site-settings icon beside the website address, choose Location, select Allow, then retry.</p>}
          {!loading && <button className="btn btn-primary btn-block" onClick={checkAvailability}>{error ? "Retry location" : "Check again"}</button>}
        </div>
      )}

      <p className="privacy-note"><ShieldCheck size={15} /> Exact address is shared only after acceptance.</p>
      </>}
    </div>
  );
}
