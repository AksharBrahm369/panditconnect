"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Activity, BadgeCheck, BookOpenCheck, CalendarDays, LayoutDashboard,
  Headphones, LogOut, MapPinned, Settings, ShieldCheck, Sparkles, UsersRound,
} from "lucide-react";
import { NotificationCenter } from "./notification-center";
import { PortalLanguageSwitcher, usePortalLanguage } from "./portal-language-switcher";
import { portalCopy, translatePortalText } from "@/lib/portal-i18n";
import { usePanditPageLocalizer } from "./pandit-page-localizer";
import "./customer-navbar.css";

const roleNavigation = {
  Customer: [
    { label: "Home", href: "/customer#customer-home", icon: LayoutDashboard },
    { label: "Book Pandit", href: "/customer#request-assistance", icon: Sparkles },
    { label: "My bookings", href: "/customer#live-requests", icon: Activity },
    { label: "Account", href: "/customer/settings", icon: Settings },
  ],
  Pandit: [
    { label: "Home", href: "/pandit#pandit-home", icon: LayoutDashboard },
    { label: "Requests", href: "/pandit#pandit-requests", icon: MapPinned },
    { label: "Schedule", href: "/pandit/schedule", icon: CalendarDays },
    { label: "Account", href: "/pandit/settings", icon: Settings },
  ],
  Admin: [
    { label: "Overview", href: "/admin#portal-overview", icon: LayoutDashboard },
    { label: "Bookings", href: "/admin#admin-bookings", icon: BookOpenCheck },
    { label: "Pandit network", href: "/admin#admin-pandits", icon: UsersRound },
    { label: "Support", href: "/admin#admin-support", icon: Headphones },
  ],
} as const;

export function AppShell({ role, userName, title, subtitle, children, showHeading = role === "Admin" }: { role: "Customer" | "Pandit" | "Admin"; userName?: string | null; title: string; subtitle: string; children: React.ReactNode; showHeading?: boolean }) {
  const navigation = roleNavigation[role];
  const [activeHref, setActiveHref] = useState(navigation[0].href as string);
  const [accountName, setAccountName] = useState(userName?.trim() || "");
  const [appLanguage, setAppLanguage] = usePortalLanguage();
  const portalMainRef = useRef<HTMLElement>(null);
  const copy = portalCopy(appLanguage);
  usePanditPageLocalizer(portalMainRef, appLanguage, role === "Pandit");

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

  return (
    <div className={`portal portal-${role.toLowerCase()}`}>
      <header className="portal-header">
        <Link href={`/${role.toLowerCase()}`} className="brand portal-brand" aria-label={`PanditConnect ${role} home`}><span className="brand-mark">ॐ</span><span><strong>Pandit</strong>Connect</span></Link>
        <nav className="portal-tabs" aria-label={`${role} navigation`}>
          {navigation.map(({ label, href, icon: Icon }) => { const translated = label === "Home" ? copy.home : label === "Book Pandit" ? copy.bookPandit : label === "My bookings" ? copy.myBookings : label === "Requests" ? copy.requests : label; return <a className={activeHref === href ? "active" : ""} href={href} key={href} aria-current={activeHref === href ? "page" : undefined}><Icon size={17} /><span>{translated}</span></a>; })}
        </nav>
        <div className="portal-account"><PortalLanguageSwitcher value={appLanguage} onChange={setAppLanguage} label={copy.language} /><span className="portal-role-mark">{role === "Admin" ? <ShieldCheck /> : role === "Pandit" ? <BadgeCheck /> : (accountName.charAt(0) || "C").toUpperCase()}</span><div className="account-identity"><strong>{role === "Pandit" ? userName || "Pandit" : accountName || role}</strong></div><NotificationCenter role={role} />{role === "Admin" && <button className="icon-button" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.assign("/"); }} aria-label="Log out"><LogOut size={17} /></button>}</div>
      </header>

      <main className="portal-main" ref={portalMainRef} lang={appLanguage === "English" ? "en" : undefined} dir={appLanguage === "Urdu" ? "rtl" : "ltr"}>
        {showHeading && <div className="page-heading" id="portal-overview"><div><span className="eyebrow">{role} home</span><h1>{translatePortalText(title, appLanguage)}</h1><p>{translatePortalText(subtitle, appLanguage)}</p></div><span className="heading-mark" aria-hidden="true">{role === "Admin" ? <ShieldCheck /> : role === "Pandit" ? <BadgeCheck /> : <Sparkles />}</span></div>}
        {children}
      </main>

      <nav className={`portal-mobile-nav mobile-nav-${navigation.length}`} aria-label={`${role} mobile navigation`}>
        {navigation.map(({ label, href, icon: Icon }) => { const translated = label === "Home" ? copy.home : label === "Book Pandit" ? copy.bookPandit : label === "My bookings" ? copy.myBookings : label === "Requests" ? copy.requests : label; return <a className={activeHref === href ? "active" : ""} href={href} key={href} aria-current={activeHref === href ? "page" : undefined}><Icon size={19} /><span>{translated}</span></a>; })}
      </nav>
    </div>
  );
}
