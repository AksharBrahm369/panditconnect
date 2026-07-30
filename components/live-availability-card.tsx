"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
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

  useEffect(() => {
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
  }, []);

  const pandit = pandits?.[0];
  const loading = pandits === null;
  const available = Boolean(pandit);

  return (
    <div className="hero-panel">
      <div className={`live-pill ${!loading && !available ? "empty" : ""}`}>
        <i />
        {loading
          ? "Checking live availability…"
          : available
            ? `${pandits.length} ${pandits.length === 1 ? "Pandit" : "Pandits"} available near you`
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
          {!loading && <Link href="/login?role=pandit" className="btn btn-ghost btn-block">Join as a Pandit</Link>}
        </div>
      )}

      <p className="privacy-note"><ShieldCheck size={15} /> Exact address is shared only after acceptance.</p>
    </div>
  );
}
