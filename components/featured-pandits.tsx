"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BadgeCheck, Languages, Star } from "lucide-react";
import { readJson } from "@/lib/http";

type FeaturedPandit = {
  id: string;
  name: string;
  experience_years: number;
  languages: string[];
  rating: string;
  rating_count: number;
  completed_jobs: number;
  is_online: boolean;
  starting_charge: number;
  services: string[];
};

export function FeaturedPandits() {
  const [pandits, setPandits] = useState<FeaturedPandit[]>([]);
  const [stats, setStats] = useState({ approved: 0, online: 0 });

  useEffect(() => {
    fetch("/api/pandits/featured", { cache: "no-store" })
      .then((response) => readJson<{ pandits?: FeaturedPandit[]; stats?: { approved: number; online: number } }>(response))
      .then((data) => {
        setPandits(data.pandits ?? []);
        setStats(data.stats ?? { approved: 0, online: 0 });
      });
  }, []);

  if (!pandits.length) return null;

  return <section className="featured-pandits" id="pandit-network">
    <div className="directory-heading">
      <div><span className="live-pill"><i /> {stats.online} online now</span><h2>Meet approved Pandits in the network</h2><p>Every profile is reviewed for experience, languages and Puja specialities before customers can match.</p></div>
      <Link href="/login?role=customer" className="text-button">Find the right Pandit <ArrowRight size={16} /></Link>
    </div>
    <div className="featured-grid">
      {pandits.slice(0, 4).map((pandit) => <article className="expert-card" key={pandit.id}>
        <div className="expert-top">
          <span className="expert-avatar">{pandit.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
          <div><h3>{pandit.name}</h3><span><BadgeCheck size={14} /> Admin approved</span></div>
          <b className={pandit.is_online ? "online" : ""}>{pandit.is_online ? "Online" : "Offline"}</b>
        </div>
        <div className="expert-tags">{pandit.services.slice(0, 3).map((service) => <span key={service}>{service}</span>)}</div>
        <div className="expert-details">
          <span><strong>{pandit.experience_years} yrs</strong> experience</span>
          <span><strong>{pandit.rating_count ? <><Star size={13} fill="currentColor" /> {pandit.rating}</> : "New"}</strong>{pandit.rating_count ? `${pandit.rating_count} rating${pandit.rating_count === 1 ? "" : "s"}` : "not rated yet"}</span>
          <span><strong>{pandit.completed_jobs}</strong> Pujas done</span>
        </div>
        <p><Languages size={15} /> {pandit.languages.slice(0, 3).join(" · ")}</p>
        <div className="expert-footer"><span>Starts from <strong>₹{pandit.starting_charge.toLocaleString("en-IN")}</strong></span><Link href="/login?role=customer" className="btn btn-primary">Request</Link></div>
      </article>)}
    </div>
  </section>;
}
