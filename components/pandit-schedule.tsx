"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";
import { readJson } from "@/lib/http";

type ScheduledBooking = { id: string; service_name: string; status: string; scheduled_at: string | null; preferred_language?: string | null; materials_option?: string };

export function PanditSchedule() {
  const [items, setItems] = useState<ScheduledBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  useEffect(() => { const timer = window.setTimeout(async () => { const response = await fetch("/api/bookings", { cache: "no-store" }); const data = await readJson<{ bookings?: ScheduledBooking[]; error?: string }>(response); if (response.ok) setItems((data.bookings ?? []).filter((item) => item.scheduled_at && !["COMPLETED", "CANCELLED", "DECLINED"].includes(item.status)).sort((a,b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())); else setMessage(data.error ?? "Unable to load your schedule."); setLoading(false); }, 0); return () => window.clearTimeout(timer); }, []);
  if (loading) return <div className="loading-card">Loading your schedule…</div>;
  return <section className="pandit-schedule-summary"><header><div><span className="eyebrow">Upcoming</span><h2>{items.length ? "Your scheduled Pujas" : "No scheduled Puja"}</h2><p>Scheduled requests are kept here so your home screen stays focused on immediate work.</p></div></header>{message&&<div className="alert error">{message}</div>}{items.length?<div className="pandit-schedule-list">{items.map((booking)=><Link href={`/pandit#pandit-job-${booking.id}`} key={booking.id}><CalendarDays/><span><strong>{booking.service_name}</strong><small>{new Date(booking.scheduled_at!).toLocaleString("en-IN",{dateStyle:"full",timeStyle:"short"})}</small><em>{booking.status === "REQUESTED" ? "Needs your decision" : booking.status === "ACCEPTED" ? "Confirmed" : "In progress"}</em></span><ChevronRight/></Link>)}</div>:<div className="empty">Future scheduled requests will appear here.</div>}</section>;
}
