"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity, BadgeCheck, BookOpenCheck, LayoutDashboard,
  Headphones, LogOut, MapPinned, MessageCircle, ShieldCheck, Sparkles, UsersRound,
} from "lucide-react";
import { NotificationCenter } from "./notification-center";
import { PanditAccountMenu } from "./pandit-account-menu";
import { CustomerAccountMenu } from "./customer-account-menu";
import "./customer-navbar.css";

const roleNavigation = {
  Customer: [
    { label: "Home", href: "/customer#customer-home", icon: LayoutDashboard },
    { label: "Book Pandit", href: "/customer#request-assistance", icon: Sparkles },
    { label: "Ask online", href: "/customer#online-guidance", icon: MessageCircle },
    { label: "My bookings", href: "/customer#live-requests", icon: Activity },
  ],
  Pandit: [
    { label: "Today", href: "/pandit#portal-overview", icon: LayoutDashboard },
    { label: "Requests", href: "/pandit#pandit-requests", icon: MapPinned },
    { label: "Chat", href: "/pandit#online-guidance", icon: MessageCircle },
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
  const [activeHref, setActiveHref] = useState(navigation[0].href as string);
  const [accountName, setAccountName] = useState(userName?.trim() || "");

  useEffect(() => {
    const syncActiveNavigation = () => {
      const currentLocation = `${window.location.pathname}${window.location.hash}`;
      const matchingItem = roleNavigation[role].find((item) => item.href === currentLocation);
      setActiveHref(matchingItem?.href ?? roleNavigation[role][0].href);
    };

    syncActiveNavigation();
    window.addEventListener("hashchange", syncActiveNavigation);
    return () => window.removeEventListener("hashchange", syncActiveNavigation);
  }, [role]);

  useEffect(() => {
    if (role !== "Customer") return;

    const controller = new AbortController();
    fetch("/api/profile", { cache: "no-store", signal: controller.signal })
      .then(async (response) => response.ok ? response.json() as Promise<{ profile?: { name?: string | null } }> : null)
      .then((payload) => {
        const registeredName = payload?.profile?.name?.trim();
        if (registeredName) setAccountName(registeredName);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) return;
      });

    return () => controller.abort();
  }, [role, userName]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/");
  }
  return (
    <div className={`portal portal-${role.toLowerCase()}`}>
      <header className="portal-header">
        <Link href={`/${role.toLowerCase()}`} className="brand portal-brand" aria-label={`Pandit in Minutes ${role} home`}><span className="brand-mark">ॐ</span><span><strong>Pandit</strong> in Minutes</span></Link>
        <nav className="portal-tabs" aria-label={`${role} navigation`}>
          {navigation.map(({ label, href, icon: Icon }) => <a className={activeHref === href ? "active" : ""} href={href} key={href} aria-current={activeHref === href ? "page" : undefined}><Icon size={17} /><span>{label}</span></a>)}
        </nav>
        <div className="portal-account"><span className="portal-role-mark">{role === "Admin" ? <ShieldCheck /> : role === "Pandit" ? <BadgeCheck /> : (accountName.charAt(0) || "C").toUpperCase()}</span><div className="account-identity"><small>{role === "Customer" ? "Namaste" : "Signed in as"}</small><strong>{role === "Pandit" ? userName || "Pandit" : accountName || role}</strong></div><NotificationCenter />{role === "Pandit" ? <PanditAccountMenu onLogout={logout} /> : role === "Customer" ? <CustomerAccountMenu onLogout={logout} /> : <button className="icon-button" onClick={logout} aria-label="Log out"><LogOut size={17} /></button>}</div>
      </header>

      <main className="portal-main">
        <div className="page-heading" id="portal-overview"><div><span className="eyebrow">{role} home</span><h1>{title}</h1><p>{subtitle}</p></div><span className="heading-mark" aria-hidden="true">{role === "Admin" ? <ShieldCheck /> : role === "Pandit" ? <BadgeCheck /> : <Sparkles />}</span></div>
        {children}
      </main>

      <nav className={`portal-mobile-nav mobile-nav-${navigation.length}`} aria-label={`${role} mobile navigation`}>
        {navigation.map(({ label, href, icon: Icon }) => <a className={activeHref === href ? "active" : ""} href={href} key={href} aria-current={activeHref === href ? "page" : undefined}><Icon size={19} /><span>{label}</span></a>)}
      </nav>
    </div>
  );
}
