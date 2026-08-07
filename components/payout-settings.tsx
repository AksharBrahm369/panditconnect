"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Building2, Save, ShieldCheck, Smartphone } from "lucide-react";
import { readJson } from "@/lib/http";

type Payout = { payout_method?: "UPI" | "BANK"; upi_id?: string | null; bank_account_name?: string | null; bank_ifsc?: string | null; has_bank_account?: boolean; bank_status?: string };

export function PayoutSettings() {
  const [form, setForm] = useState({ method: "UPI" as "UPI" | "BANK", upiId: "", accountName: "", accountNumber: "", ifsc: "" });
  const [status, setStatus] = useState("PENDING");
  const [hasBank, setHasBank] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { void fetch("/api/pandit/payout", { cache: "no-store" }).then(async (response) => { const data = await readJson<{ payout?: Payout; error?: string }>(response); if (!response.ok || !data.payout) { setError(data.error ?? "Unable to load payout settings"); return; } const payout = data.payout; setForm({ method: payout.payout_method ?? "UPI", upiId: payout.upi_id ?? "", accountName: payout.bank_account_name ?? "", accountNumber: "", ifsc: payout.bank_ifsc ?? "" }); setStatus(payout.bank_status ?? "PENDING"); setHasBank(Boolean(payout.has_bank_account)); }).finally(() => setLoading(false)); }, []);
  async function save() { setSaving(true); setError(""); setMessage(""); try { const response = await fetch("/api/pandit/payout", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ payoutMethod: form.method, upiId: form.upiId, bankAccountName: form.accountName, bankAccountNumber: form.accountNumber, bankIfsc: form.ifsc }) }); const data = await readJson<{ error?: string }>(response); if (!response.ok) setError(data.error ?? "Unable to update payout settings"); else { setMessage("Payout details saved and sent for Admin verification."); setStatus("PENDING"); setHasBank(form.method === "BANK"); setForm((current) => ({ ...current, accountNumber: "" })); } } catch { setError("Unable to save. Check your connection and try again."); } finally { setSaving(false); } }
  if (loading) return <div className="loading-card">Loading payout settings...</div>;
  return <section className="private-settings-card"><div className="private-card-heading"><span><Building2 /></span><div><h2>Manage payout details</h2><p>Choose where future platform payouts should be sent.</p></div><b>{status.replaceAll("_", " ")}</b></div>
    <div className="payout-choice"><button className={form.method === "UPI" ? "active" : ""} onClick={() => setForm({ ...form, method: "UPI" })}><Smartphone /><span><strong>UPI</strong><small>Use a verified UPI ID</small></span></button><button className={form.method === "BANK" ? "active" : ""} onClick={() => setForm({ ...form, method: "BANK" })}><Building2 /><span><strong>Bank account</strong><small>Use account number and IFSC</small></span></button></div>
    <div className="settings-form">{form.method === "UPI" ? <label>UPI ID<input value={form.upiId} onChange={(event) => setForm({ ...form, upiId: event.target.value })} placeholder="name@bank" /></label> : <><label>Account holder name<input value={form.accountName} onChange={(event) => setForm({ ...form, accountName: event.target.value })} /></label><label>Account number<input type="password" inputMode="numeric" value={form.accountNumber} onChange={(event) => setForm({ ...form, accountNumber: event.target.value.replace(/\D/g, "") })} placeholder={hasBank ? "Leave blank to keep saved account" : "Enter account number"} /><small>{hasBank ? "A protected bank account is already saved." : "Encrypted before it is stored."}</small></label><label>IFSC code<input value={form.ifsc} onChange={(event) => setForm({ ...form, ifsc: event.target.value.toUpperCase() })} maxLength={20} /></label></>}</div>
    <div className="secure-setting-note"><ShieldCheck /><span><strong>Verification protection</strong><small>Changing payout details resets payout verification to Pending. An Admin must verify them before payouts are enabled.</small></span></div>
    {error && <div className="alert error">{error}</div>}{message && <div className="alert success"><BadgeCheck />{message}</div>}
    <button className="btn btn-primary settings-save" disabled={saving} onClick={save}><Save size={17} />{saving ? "Saving..." : "Save payout details"}</button>
  </section>;
}
