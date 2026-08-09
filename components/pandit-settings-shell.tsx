import Link from "next/link";
import { ArrowLeft, Bell, CreditCard, ShieldCheck, UserRound, Database } from "lucide-react";
import { AppShell } from "./app-shell";

const links = [
  { key: "profile", href: "/pandit/settings/profile", label: "Profile", icon: UserRound },
  { key: "payments", href: "/pandit/settings/payments", label: "Payout", icon: CreditCard },
  { key: "notifications", href: "/pandit/settings/notifications", label: "Notifications", icon: Bell },
  { key: "security", href: "/pandit/settings/security", label: "Security", icon: ShieldCheck },
  { key: "privacy", href: "/pandit/settings/privacy", label: "My data", icon: Database },
] as const;

export function PanditSettingsShell({ userName, active, title, subtitle, children }: { userName?: string | null; active: typeof links[number]["key"]; title: string; subtitle: string; children: React.ReactNode }) {
  return <AppShell role="Pandit" userName={userName} title={title} subtitle={subtitle}>
    <Link className="settings-back" href="/pandit"><ArrowLeft size={16} /> Back to Pandit dashboard</Link>
    <div className="settings-workspace">
      <aside><strong>Account settings</strong><small>Private to your signed-in account</small><nav>{links.map(({ key, href, label, icon: Icon }) => <Link className={active === key ? "active" : ""} href={href} key={href}><Icon size={17} />{label}</Link>)}</nav></aside>
      <div className="settings-content">{children}</div>
    </div>
  </AppShell>;
}
