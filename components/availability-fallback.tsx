"use client";

import { CalendarClock, ChevronRight, MessageCircle, Search, Users } from "lucide-react";

export type FallbackPlan = {
  stages: Array<{ radiusKm:number; eligibleCount:number; travelSurcharge:number; etaMinutes:number }>;
  earliestAvailableAt:string|null;
};

export function AvailabilityFallback({
  plan,onStartSearch,onOnlineGuidance,onReserveEarliest,busy,compact=false,onlineGuidanceAvailable=false,
}:{
  plan:FallbackPlan;onStartSearch:()=>void;
  onOnlineGuidance:()=>void;onReserveEarliest:()=>void;busy:boolean;compact?:boolean;onlineGuidanceAvailable?:boolean;
}){
  return <section className={`availability-fallback ${compact?"is-compact":""}`} aria-labelledby="availability-fallback-title">
    <header><span><Search /></span><div><small>No one nearby has accepted yet</small><h3 id="availability-fallback-title">We can keep looking for you</h3><p>Only approved Pandits matching your Puja and language will be contacted.</p></div></header>
    {!compact&&<button className="btn btn-primary btn-block fallback-search-button" disabled={busy} onClick={onStartSearch}><Users />{busy?"Continuing the search…":"Keep searching automatically"}<ChevronRight /></button>}
    <div className="fallback-alternatives">
      {onlineGuidanceAvailable&&<button type="button" onClick={onOnlineGuidance}><MessageCircle/><span><strong>Talk to a Pandit online now</strong><small>Start paid private guidance while you wait</small></span><ChevronRight/></button>}
      <button type="button" disabled={!plan.earliestAvailableAt||busy} onClick={onReserveEarliest}><CalendarClock/><span><strong>Reserve the earliest visit</strong><small>{plan.earliestAvailableAt?new Date(plan.earliestAvailableAt).toLocaleString("en-IN",{dateStyle:"full",timeStyle:"short"}):"No future opening found in the next 3 days"}</small></span><ChevronRight/></button>
    </div>
  </section>;
}
