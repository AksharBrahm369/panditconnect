"use client";

import { Headphones, LockKeyhole, ShieldAlert } from "lucide-react";
import { AppShell } from "./app-shell";
import { SupportCenter } from "./support-center";

export function PanditAccessStatus({
  userName,
  status,
  reason,
}: {
  userName?: string | null;
  status: "BLOCKED" | "RESTRICTED";
  reason?: string | null;
}) {
  const blocked = status === "BLOCKED";
  return (
    <AppShell
      role="Pandit"
      userName={userName}
      title={blocked ? "Account blocked" : "Account restricted"}
      subtitle="Your account status is controlled by the PujaOne operations team."
    >
      <main className={`pandit-access-page ${blocked ? "is-blocked" : "is-restricted"}`}>
        <section className="pandit-access-card" aria-live="assertive">
          <span className="pandit-access-icon">{blocked ? <LockKeyhole /> : <ShieldAlert />}</span>
          <span className="eyebrow">Pandit account notice</span>
          <h2>{blocked ? "You have been blocked by the Admin" : "You are restricted from PujaOne"}</h2>
          <p>{blocked
            ? "Your Pandit account and marketplace access are currently blocked. You cannot receive Puja or online guidance requests."
            : "You cannot receive Puja or online guidance requests while this restriction is active."}</p>
          {reason && <div className="pandit-access-reason"><strong>Reason provided by Admin</strong><span>{reason}</span></div>}
          <div className="pandit-access-help"><Headphones /><div><strong>Need help with this decision?</strong><span>Contact support below. Include the facts and any documents that can help the team review your account.</span></div></div>
        </section>
        <SupportCenter />
      </main>
    </AppShell>
  );
}
