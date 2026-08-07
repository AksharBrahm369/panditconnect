"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, ChevronRight, CreditCard, LogOut, Settings, ShieldCheck, UserRound } from "lucide-react";

const items = [
  { href: "/pandit/settings/profile", label: "Edit profile", detail: "Professional and service details", icon: UserRound },
  { href: "/pandit/settings/payments", label: "Manage payout", detail: "UPI or bank account", icon: CreditCard },
  { href: "/pandit/settings/notifications", label: "Notifications", detail: "Choose the alerts you receive", icon: Bell },
  { href: "/pandit/settings/security", label: "Privacy & security", detail: "Verified account and session", icon: ShieldCheck },
] as const;

export function PanditAccountMenu({ onLogout }: { onLogout: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function close(event: MouseEvent) { if (!root.current?.contains(event.target as Node)) setOpen(false); }
    function escape(event: KeyboardEvent) { if (event.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape); };
  }, []);
  return <div className="account-menu" ref={root}>
    <button className={`icon-button account-menu-trigger ${open ? "active" : ""}`} onClick={() => setOpen((value) => !value)} aria-label="Pandit account settings" aria-expanded={open}><Settings size={18} /></button>
    {open && <section className="account-menu-panel">
      <header><span><Settings size={18} /></span><div><strong>Private account settings</strong><small>Only you can view these pages</small></div></header>
      <nav>{items.map(({ href, label, detail, icon: Icon }) => <Link href={href} key={href} onClick={() => setOpen(false)}><Icon size={18} /><span><strong>{label}</strong><small>{detail}</small></span><ChevronRight size={16} /></Link>)}</nav>
      <button className="account-menu-logout" onClick={() => void onLogout()}><LogOut size={17} /> Sign out</button>
    </section>}
  </div>;
}
