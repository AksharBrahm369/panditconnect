"use client";

import { BadgeCheck, BellRing, LockKeyhole } from "lucide-react";

const essentialAlerts = [
  ["Booking updates", "Requests, acceptance, cancellations and journey changes"],
  ["Live guidance", "New chat requests and messages"],
  ["Account updates", "Verification, access and payment status changes"],
] as const;

export function NotificationSettings() {
  return <section className="private-settings-card">
    <div className="private-card-heading"><span><BellRing /></span><div><h2>Notifications</h2><p>Important updates for this account.</p></div></div>
    <div className="essential-alert-note"><LockKeyhole /><div><strong>Essential alerts stay on</strong><p>These alerts protect bookings and help both sides respond on time. Your phone or browser still controls whether they appear as push notifications or play sound.</p></div></div>
    <div className="settings-toggle-list essential-alert-list">
      {essentialAlerts.map(([title, detail]) => <div className="essential-alert-row" key={title}><span><strong>{title}</strong><small>{detail}</small></span><b><BadgeCheck /> On</b></div>)}
    </div>
  </section>;
}
