"use client";

import { CalendarClock, Check, ChevronRight, MapPin, MessageCircle, Search, Users } from "lucide-react";

export type FallbackPlan = {
  stages: Array<{ radiusKm:number; eligibleCount:number; travelSurcharge:number; etaMinutes:number }>;
  earliestAvailableAt:string|null;
};

export function AvailabilityFallback({
  plan,selectedRadius,onRadiusChange,onStartSearch,onOnlineGuidance,onReserveEarliest,busy,compact=false,
}:{
  plan:FallbackPlan;selectedRadius:number;onRadiusChange:(radius:number)=>void;onStartSearch:()=>void;
  onOnlineGuidance:()=>void;onReserveEarliest:()=>void;busy:boolean;compact?:boolean;
}){
  const selected=plan.stages.find((stage)=>stage.radiusKm===selectedRadius)??plan.stages.at(-1)!;
  return <section className={`availability-fallback ${compact?"is-compact":""}`} aria-labelledby="availability-fallback-title">
    <header><span><Search /></span><div><small>We are still here to help</small><h3 id="availability-fallback-title">Nearby Pandits are currently busy</h3><p>Choose how far we may search. We contact only approved Pandits matching your Puja, language and service area.</p></div></header>
    {!compact&&<><div className="fallback-radius-list" role="radiogroup" aria-label="Maximum search distance">
      {plan.stages.map((stage)=><button type="button" role="radio" aria-checked={selectedRadius===stage.radiusKm} className={selectedRadius===stage.radiusKm?"selected":""} onClick={()=>onRadiusChange(stage.radiusKm)} key={stage.radiusKm}>
        <span className="fallback-radio">{selectedRadius===stage.radiusKm&&<Check />}</span>
        <span><strong>Up to {stage.radiusKm} km</strong><small>{stage.eligibleCount?`${stage.eligibleCount} currently eligible`:"Search automatically when someone is available"}</small></span>
        <span><b>{stage.travelSurcharge?`Up to â‚¹${stage.travelSurcharge}`:"No travel fee"}</b><small>Approx. {stage.etaMinutes} min</small></span>
      </button>)}
    </div>
    <div className="fallback-consent"><MapPin/><p><strong>Your approval:</strong> the search starts at 5 km and expands every 3 minutes only up to {selected.radiusKm} km. Any travel surcharge is shown above and added only if that distance band accepts.</p></div>
    <button className="btn btn-primary btn-block fallback-search-button" disabled={busy} onClick={onStartSearch}><Users />{busy?"Starting secure searchâ€¦":`Search up to ${selected.radiusKm} km`}<ChevronRight /></button></>}
    <div className="fallback-alternatives">
      <button type="button" onClick={onOnlineGuidance}><MessageCircle/><span><strong>Talk to a Pandit online now</strong><small>Start paid private guidance while you wait</small></span><ChevronRight/></button>
      <button type="button" disabled={!plan.earliestAvailableAt||busy} onClick={onReserveEarliest}><CalendarClock/><span><strong>Reserve the earliest visit</strong><small>{plan.earliestAvailableAt?new Date(plan.earliestAvailableAt).toLocaleString("en-IN",{dateStyle:"full",timeStyle:"short"}):"No future opening found in the next 3 days"}</small></span><ChevronRight/></button>
    </div>
  </section>;
}
