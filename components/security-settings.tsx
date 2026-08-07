"use client";

import Link from "next/link";
import { LogOut, Phone, ShieldCheck } from "lucide-react";

export function SecuritySettings({ phone }: { phone: string }) {
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); window.location.assign("/"); }
  const masked = `${phone.slice(0, 3)} ${"•".repeat(Math.max(0, phone.length - 7))}${phone.slice(-4)}`;
  return <section className="private-settings-card"><div className="private-card-heading"><span><ShieldCheck /></span><div><h2>Privacy and account security</h2><p>Your verified identity and signed-in session.</p></div></div><div className="security-setting-row"><Phone /><span><strong>Verified mobile number</strong><small>{masked}</small></span><b>Verified</b></div><div className="secure-setting-note"><ShieldCheck /><span><strong>Your private information stays protected</strong><small>Phone, government ID, bank information and documents are never shown publicly. Contact support before changing a verified identity field.</small></span></div><div className="security-links"><Link href="/privacy">Privacy notice</Link><Link href="/terms">Platform terms</Link></div><button className="btn btn-ghost danger-button" onClick={() => void logout()}><LogOut size={17} /> Sign out from this device</button></section>;
}
