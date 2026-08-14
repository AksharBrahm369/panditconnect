"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BellRing, CalendarDays, CalendarPlus, ChevronRight, CircleAlert, MessageCircleMore } from "lucide-react";
import { readJson } from "@/lib/http";
import { BookingChat } from "./booking-chat";

type ScheduledBooking = {
  id: string;
  service_name: string;
  customer_name: string | null;
  status: string;
  scheduled_at: string | null;
  preferred_language?: string | null;
  materials_option?: string;
};

const activeChatStatuses = new Set(["ACCEPTED", "ON_THE_WAY", "ARRIVED", "IN_PROGRESS"]);

function scheduleLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

export function PanditSchedule() {
  const [items, setItems] = useState<ScheduledBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [calendarPromptId, setCalendarPromptId] = useState<string | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const response = await fetch("/api/bookings", { cache: "no-store" });
      const data = await readJson<{ bookings?: ScheduledBooking[]; error?: string }>(response);
      if (response.ok) {
        const upcoming = (data.bookings ?? [])
          .filter((item) => item.scheduled_at && !["COMPLETED", "CANCELLED", "DECLINED"].includes(item.status))
          .sort((a,b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime());
        setItems(upcoming);
        const calendarCandidate = upcoming.find((item) => activeChatStatuses.has(item.status) && localStorage.getItem(`panditconnect:calendar:${item.id}`) !== "handled");
        setCalendarPromptId(calendarCandidate?.id ?? null);
      } else setMessage(data.error ?? "Unable to load your schedule.");
      setLoading(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function closeCalendarPrompt(bookingId: string) {
    localStorage.setItem(`panditconnect:calendar:${bookingId}`, "handled");
    setCalendarPromptId(null);
  }
  if (loading) return <div className="loading-card">Loading your schedule…</div>;
  return <section className="pandit-schedule-summary">
    <header><div><span className="eyebrow">Upcoming</span><h2>{items.length ? "Your scheduled Pujas" : "No scheduled Puja"}</h2><p>Check the customer&apos;s requested date, confirm the muhurat and share samagri guidance after accepting.</p></div></header>
    {message&&<div className="alert error">{message}</div>}
    {items.length?<div className="pandit-schedule-list">{items.map((booking)=>{
      const canChat = activeChatStatuses.has(booking.status);
      return <article className="pandit-schedule-card" id={`scheduled-booking-${booking.id}`} key={booking.id}>
        <Link className="pandit-schedule-link" href={`/pandit#pandit-job-${booking.id}`}>
          <CalendarDays/>
          <span><strong>{booking.service_name}</strong><small>{scheduleLabel(booking.scheduled_at!)}</small><em>{booking.status === "REQUESTED" ? "Needs your decision" : booking.status === "ACCEPTED" ? "Confirmed" : "In progress"}</em></span>
          <ChevronRight/>
        </Link>
        <div className={`scheduled-guidance-note ${canChat ? "ready" : "waiting"}`}>
          {canChat ? <MessageCircleMore/> : <CircleAlert/>}
          <span><strong>{canChat ? "Confirm muhurat and samagri" : "Review before accepting"}</strong><small>{canChat ? `Use the private chat to guide ${booking.customer_name ?? "the customer"} about the final time, samagri and preparation.` : "Check whether this date has a suitable muhurat. Accept only if you can support the Puja."}</small></span>
        </div>
        {calendarPromptId === booking.id && <div className="schedule-calendar-consent" role="status">
          <span><BellRing/><strong>Do not miss this Puja</strong></span>
          <p>Would you like to add it to your phone or laptop calendar? Your calendar app will ask you to confirm this one event.</p>
          <div><a className="btn btn-primary" href={`/api/bookings/${booking.id}/calendar`} target="_blank" rel="noreferrer" onClick={() => closeCalendarPrompt(booking.id)}><CalendarPlus/> Add to calendar</a><button className="btn btn-ghost" type="button" onClick={() => closeCalendarPrompt(booking.id)}>Not now</button></div>
          <small>The calendar event includes private reminders one day and two hours before the Puja.</small>
        </div>}
        {canChat && <BookingChat bookingId={booking.id} participantName={booking.customer_name ?? "the customer"} role="PANDIT" scheduledFor={booking.scheduled_at} guidanceMode />}
      </article>;
    })}</div>:<div className="empty">Future scheduled requests will appear here.</div>}
  </section>;
}
