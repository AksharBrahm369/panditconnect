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
  const [error, setError] = useState(false);
  const [started, setStarted] = useState(false);

  function checkAvailability() {
    setStarted(true);
    setError(false);
    setPandits(null);
    getCurrentCoordinates()
      .then((coordinates) => {
        const params = new URLSearchParams({
          serviceId: "ganesh-puja",
          lat: String(coordinates.latitude),
          lng: String(coordinates.longitude),
        });
        return fetch(`/api/pandits/nearby?${params}`, { cache: "no-store" });
      })
      .then((response) => {
        if (!response.ok) throw new Error("Availability request failed");
        return readJson<{ pandits?: NearbyPandit[] }>(response);
      })
      .then((data) => setPandits(data.pandits ?? []))
      .catch(() => {
        setError(true);
        setPandits([]);
      });
  }

  const pandit = pandits?.[0];
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
              ? "Allow location to see nearby Pandits"
              : "No Pandits online near you"}
      </div>

      {pandit ? (
        <>
          <div className="mini-card">
            <div className="avatar">
              {pandit.name.split(" ").slice(-2).map((part) => part[0]).join("")}
            </div>
            <div>
              <strong>{pandit.name}</strong>
              <small>{pandit.experience_years} years · {pandit.languages.join(", ")}</small>
            </div>
            <b>{pandit.rating} ★</b>
          </div>
          <div className="route-line"><span>{pandit.distance_km} km away</span><strong>{pandit.eta_minutes} min</strong></div>
          <div className="puja-summary"><span>Ganesh Puja</span><b>₹{pandit.charge.toLocaleString("en-IN")}</b></div>
          <Link href="/login?role=customer" className="btn btn-primary btn-block">Send urgent request</Link>
        </>
      ) : (
        <div className="availability-empty">
          <strong>{loading ? "Finding nearby Pandits…" : "No live profiles available"}</strong>
          <p>{loading ? "This will take just a moment." : "Approved Pandits will appear here when they switch their availability online."}</p>
          {!loading && <button className="btn btn-ghost btn-block" onClick={checkAvailability}>Try location again</button>}
        </div>
      )}

      <p className="privacy-note"><ShieldCheck size={15} /> Exact address is shared only after acceptance.</p>
      </>}
    </div>
  );
}
