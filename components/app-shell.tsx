"use client";

import Link from "next/link";
import {
  Activity, BadgeCheck, BookOpenCheck, LayoutDashboard,
  Headphones, LogOut, MapPinned, MessageCircle, Radio, ShieldCheck, Sparkles, UsersRound,
} from "lucide-react";
import { NotificationCenter } from "./notification-center";
import { PanditAccountMenu } from "./pandit-account-menu";

const roleNavigation = {
  Customer: [
    { label: "Home", href: "/customer#portal-overview", icon: LayoutDashboard },
    { label: "Get help", href: "/customer#request-assistance", icon: Sparkles },
    { label: "Ask online", href: "/customer#online-guidance", icon: MessageCircle },
    { label: "My requests", href: "/customer#live-requests", icon: Activity },
  ],
  Pandit: [
    { label: "Home", href: "/pandit#portal-overview", icon: LayoutDashboard },
    { label: "Availability", href: "/pandit#pandit-status", icon: Radio },
    { label: "Live chats", href: "/pandit#online-guidance", icon: MessageCircle },
    { label: "Urgent requests", href: "/pandit#pandit-requests", icon: MapPinned },
  ],
  Admin: [
    { label: "Overview", href: "/admin#portal-overview", icon: LayoutDashboard },
    { label: "Bookings", href: "/admin#admin-bookings", icon: BookOpenCheck },
    { label: "Pandit network", href: "/admin#admin-pandits", icon: UsersRound },
    { label: "Support", href: "/admin#admin-support", icon: Headphones },
  ],
} as const;

export function AppShell({ role, userName, title, subtitle, children }: { role: "Customer" | "Pandit" | "Admin"; userName?: string | null; title: string; subtitle: string; children: React.ReactNode }) {
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
        <div className="portal-account"><span>{role === "Admin" ? <ShieldCheck /> : role === "Pandit" ? <BadgeCheck /> : <Sparkles />}</span><div className="account-identity"><small>Signed in as</small><strong>{role === "Pandit" ? userName || "Pandit" : role}</strong></div><NotificationCenter />{role === "Pandit" ? <PanditAccountMenu onLogout={logout} /> : <button className="icon-button" onClick={logout} aria-label="Log out"><LogOut size={17} /></button>}</div>
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
