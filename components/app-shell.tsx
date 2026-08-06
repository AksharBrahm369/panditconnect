"use client";

import Link from "next/link";
import {
  Activity, BadgeCheck, BookOpenCheck, LayoutDashboard,
  LogOut, MapPinned, MessageCircle, Radio, ShieldCheck, Sparkles, UsersRound,
} from "lucide-react";
import { NotificationCenter } from "./notification-center";

const roleNavigation = {
  Customer: [
    { label: "Overview", href: "#portal-overview", icon: LayoutDashboard },
    { label: "Request help", href: "#request-assistance", icon: Sparkles },
    { label: "Live guidance", href: "#online-guidance", icon: MessageCircle },
    { label: "Live requests", href: "#live-requests", icon: Activity },
  ],
  Pandit: [
    { label: "Overview", href: "#portal-overview", icon: LayoutDashboard },
    { label: "Availability", href: "#pandit-status", icon: Radio },
    { label: "Live chats", href: "#online-guidance", icon: MessageCircle },
    { label: "Urgent requests", href: "#pandit-requests", icon: MapPinned },
  ],
  Admin: [
    { label: "Overview", href: "#portal-overview", icon: LayoutDashboard },
    { label: "Bookings", href: "#admin-bookings", icon: BookOpenCheck },
    { label: "Pandit network", href: "#admin-pandits", icon: UsersRound },
  ],
} as const;

export function AppShell({ role, title, subtitle, children }: { role: "Customer" | "Pandit" | "Admin"; title: string; subtitle: string; children: React.ReactNode }) {
  const navigation = roleNavigation[role];
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/");
  }
  return (
    <div className={`portal portal-${role.toLowerCase()}`}>
      <header className="portal-header">
        <Link href="/" className="brand portal-brand"><span className="brand-mark">ॐ</span><span>Pandit in Minutes</span></Link>
        <nav className="portal-tabs" aria-label={`${role} navigation`}>
          {navigation.map(({ label, href, icon: Icon }, index) => <a className={index === 0 ? "active" : ""} href={href} key={href}><Icon size={17} /><span>{label}</span></a>)}
        </nav>
        <div className="portal-account"><span>{role === "Admin" ? <ShieldCheck /> : role === "Pandit" ? <BadgeCheck /> : <Sparkles />}</span><div><small>Signed in as</small><strong>{role}</strong></div><NotificationCenter /><button className="icon-button" onClick={logout} aria-label="Log out"><LogOut size={17} /></button></div>
      </header>

      <main className="portal-main">
        <div className="page-heading" id="portal-overview"><div><span className="eyebrow">{role} home</span><h1>{title}</h1><p>{subtitle}</p></div><span className="heading-mark" aria-hidden="true">{role === "Admin" ? <ShieldCheck /> : role === "Pandit" ? <BadgeCheck /> : <Sparkles />}</span></div>
        {children}
      </main>

      <nav className={`portal-mobile-nav mobile-nav-${navigation.length}`} aria-label={`${role} mobile navigation`}>
        {navigation.map(({ label, href, icon: Icon }) => <a href={href} key={href}><Icon size={19} /><span>{label}</span></a>)}
      </nav>
    </div>
  );
}
