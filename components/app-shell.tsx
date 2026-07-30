"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";

export function AppShell({ role, title, subtitle, children }: { role: "Customer" | "Pandit" | "Admin"; title: string; subtitle: string; children: React.ReactNode }) {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/");
  }
  return (
    <div className="portal">
      <header className="portal-header">
        <Link href="/" className="brand"><span className="brand-mark">ॐ</span><span>Pandit in Minutes</span></Link>
        <div className="portal-role"><span>{role} portal</span>{role !== "Admin" && <button className="icon-button" onClick={logout} aria-label="Log out"><LogOut size={18} /></button>}</div>
      </header>
      <main className="portal-main">
        <div className="page-heading"><div><span className="eyebrow">{role}</span><h1>{title}</h1><p>{subtitle}</p></div></div>
        {children}
      </main>
    </div>
  );
}

