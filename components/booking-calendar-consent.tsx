"use client";

import { useEffect, useState } from "react";
import { BellRing, CalendarPlus } from "lucide-react";

type CalendarAudience = "CUSTOMER" | "PANDIT";

export function BookingCalendarConsent({ bookingId, scheduledFor, audience }: {
  bookingId: string;
  scheduledFor: string;
  audience: CalendarAudience;
}) {
  const [visible, setVisible] = useState(false);
  const storageKey = `panditconnect:calendar:${audience.toLowerCase()}:${bookingId}:${scheduledFor}`;

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(window.localStorage.getItem(storageKey) !== "handled"), 0);
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  function close() {
    window.localStorage.setItem(storageKey, "handled");
    setVisible(false);
  }

  if (!visible) return null;
  const isCustomer = audience === "CUSTOMER";
  return <div className="schedule-calendar-consent" role="status">
    <span><BellRing /><strong>{isCustomer ? "Remember your Puja date" : "Do not miss this Puja"}</strong></span>
    <p>{isCustomer
      ? "Would you like to add the confirmed date to your phone or laptop calendar? Your calendar app will ask you before saving it."
      : "Would you like to add it to your phone or laptop calendar? Your calendar app will ask you to confirm this one event."}</p>
    <div>
      <a className="btn btn-primary" href={`/api/bookings/${bookingId}/calendar`} target="_blank" rel="noreferrer" onClick={close}><CalendarPlus /> Add to calendar</a>
      <button className="btn btn-ghost" type="button" onClick={close}>Not now</button>
    </div>
    <small>The private calendar event includes reminders one day and two hours before the Puja.</small>
  </div>;
}
