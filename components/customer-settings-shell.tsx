import Link from "next/link";
import { ArrowLeft, Bell, Headphones, ShieldCheck, UserRound } from "lucide-react";
import { AppShell } from "./app-shell";

const links = [
  { key: "profile", href: "/customer/settings/profile", label: "Profile", icon: UserRound },
  { key: "notifications", href: "/customer/settings/notifications", label: "Notifications", icon: Bell },
  { key: "security", href: "/customer/settings/security", label: "Security", icon: ShieldCheck },
  { key: "support", href: "/customer/settings/support", label: "Help & support", icon: Headphones },
] as const;

export function CustomerSettingsShell({ active, title, subtitle, children }: { active: typeof links[number]["key"]; title: string; subtitle: string; children: React.ReactNode }) {
  return <AppShell role="Customer" title={title} subtitle={subtitle}>
    <Link className="settings-back" href="/customer"><ArrowLeft size={16} /> Back to customer dashboard</Link>
    <div className="settings-workspace">
      <aside><strong>My account</strong><small>Private to your signed-in account</small><nav>{links.map(({ key, href, label, icon: Icon }) => <Link className={active === key ? "active" : ""} href={href} key={href}><Icon size={17} />{label}</Link>)}</nav></aside>
      <div className="settings-content">{children}</div>
    </div>
  </AppShell>;
}
