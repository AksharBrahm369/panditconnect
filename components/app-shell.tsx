"use client";

import Link from "next/link";
import {
  Activity, BadgeCheck, BookOpenCheck, CircleHelp, LayoutDashboard,
  LogOut, MapPinned, Radio, ShieldCheck, Sparkles, UsersRound,
} from "lucide-react";

const roleNavigation = {
  Customer: [
    { label: "Overview", href: "#portal-overview", icon: LayoutDashboard },
    { label: "Request help", href: "#request-assistance", icon: Sparkles },
    { label: "Live requests", href: "#live-requests", icon: Activity },
  ],
  Pandit: [
    { label: "Overview", href: "#portal-overview", icon: LayoutDashboard },
    { label: "Availability", href: "#pandit-status", icon: Radio },
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
      <aside className="portal-sidebar">
        <Link href="/" className="brand portal-brand"><span className="brand-mark">ॐ</span><span><strong>Pandit</strong><small>in Minutes</small></span></Link>
        <div className="sidebar-role"><span className="sidebar-role-icon">{role === "Admin" ? <ShieldCheck /> : role === "Pandit" ? <BadgeCheck /> : <CircleHelp />}</span><div><small>Signed in to</small><strong>{role} workspace</strong></div></div>
        <nav className="sidebar-nav" aria-label={`${role} navigation`}>
          <span className="nav-label">Workspace</span>
          {navigation.map(({ label, href, icon: Icon }, index) => <a className={index === 0 ? "active" : ""} href={href} key={href}><Icon size={18} /><span>{label}</span></a>)}
        </nav>
        <div className="sidebar-trust"><ShieldCheck size={19} /><div><strong>Private & verified</strong><span>Contact details stay protected throughout every request.</span></div></div>
        {role !== "Admin" && <button className="sidebar-logout" onClick={logout}><LogOut size={17} /> Sign out</button>}
      </aside>

      <div className="portal-content">
        <header className="portal-header">
          <Link href="/" className="brand mobile-brand"><span className="brand-mark">ॐ</span><span>Pandit in Minutes</span></Link>
          <div className="portal-breadcrumb"><span>Workspace</span><b>/</b><strong>{role}</strong></div>
          <div className="portal-role"><i /><span>{role === "Admin" ? "System operational" : "Live services active"}</span>{role !== "Admin" && <button className="icon-button" onClick={logout} aria-label="Log out"><LogOut size={18} /></button>}</div>
        </header>
        <main className="portal-main">
          <div className="page-heading" id="portal-overview"><div><span className="eyebrow">{role} workspace</span><h1>{title}</h1><p>{subtitle}</p></div><span className="heading-mark" aria-hidden="true">{role === "Admin" ? <ShieldCheck /> : role === "Pandit" ? <BadgeCheck /> : <Sparkles />}</span></div>
          {children}
        </main>
      </div>

      <nav className="portal-mobile-nav" aria-label={`${role} mobile navigation`}>
        {navigation.map(({ label, href, icon: Icon }) => <a href={href} key={href}><Icon size={19} /><span>{label}</span></a>)}
      </nav>
    </div>
  );
}
