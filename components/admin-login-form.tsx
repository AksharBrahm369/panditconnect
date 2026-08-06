"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LockKeyhole, ShieldCheck } from "lucide-react";
import { readJson } from "@/lib/http";

export function AdminLoginForm() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  async function requestOtp() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/admin/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone }) });
      const data = await readJson<{ error?: string; devOtp?: string; retryAfter?: number }>(response);
      if (!response.ok) { if (data.retryAfter) setResendIn(Math.min(data.retryAfter, 86400)); throw new Error(data.error ?? "Administrator access could not be verified."); }
      setDevOtp(data.devOtp ?? ""); setOtp(data.devOtp ?? ""); setResendIn(data.retryAfter ?? 60); setStep("otp");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Administrator access could not be verified."); }
    finally { setBusy(false); }
  }

  async function verifyOtp() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/admin/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone, otp }) });
      const data = await readJson<{ error?: string; redirectTo?: string }>(response);
      if (!response.ok || !data.redirectTo) throw new Error(data.error ?? "Administrator access could not be verified.");
      window.location.assign(data.redirectTo);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Administrator access could not be verified."); setBusy(false); }
  }

  return <div className="auth-shell admin-auth-shell">
    <section className="auth-side">
      <Link href="/" className="brand brand-light"><span className="brand-mark">ॐ</span><span>Pandit in Minutes</span></Link>
      <div><span className="eyebrow eyebrow-light">Authorized operations only</span><h1>Secure administrator access.</h1><p>Review Pandit applications and platform activity from a protected workspace.</p><div className="auth-benefits"><span><ShieldCheck /> Server-verified administrator role</span><span><LockKeyhole /> Time-limited secure session</span></div></div>
      <p><LockKeyhole size={17} /> Access attempts are rate-limited and audited.</p>
    </section>
    <section className="auth-form-wrap"><div className="auth-card">
      <Link href="/" className="back-link"><ArrowLeft size={16} /> Back home</Link>
      <span className="auth-step">Admin · Step {step === "phone" ? "1 of 2" : "2 of 2"}</span>
      <h2>{step === "phone" ? "Administrator sign in" : "Enter verification code"}</h2>
      <p>{step === "phone" ? "Use an authorized administrator mobile number." : `Enter the 6-digit code sent to +91 ${phone.slice(-10)}`}</p>
      {error && <div className="alert error" role="alert">{error}</div>}
      {step === "phone" ? <>
        <label htmlFor="admin-phone">Indian mobile number</label>
        <div className="phone-field"><span>+91</span><input id="admin-phone" aria-label="Administrator mobile number" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0,10))} inputMode="numeric" autoComplete="tel" placeholder="10-digit number" /></div>
        <button className="btn btn-primary btn-block btn-lg" disabled={busy || phone.length !== 10} onClick={requestOtp}>{busy ? "Sending…" : "Continue securely"}</button>
      </> : <>
        {devOtp && <div className="alert success"><strong>Testing OTP:</strong> {devOtp}<br /><small>Shown only for an approved test administrator number.</small></div>}
        <label htmlFor="admin-otp">6-digit OTP</label>
        <input id="admin-otp" aria-label="Administrator OTP" className="otp-field" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0,6))} inputMode="numeric" autoComplete="one-time-code" />
        <button className="btn btn-primary btn-block btn-lg" disabled={busy || otp.length !== 6} onClick={verifyOtp}>{busy ? "Verifying…" : "Verify administrator"}</button>
        <button className="text-button" disabled={busy || resendIn > 0} onClick={requestOtp}>{resendIn > 0 ? `Resend OTP in ${resendIn}s` : "Resend OTP"}</button>
        <button className="text-button" onClick={() => { setStep("phone"); setOtp(""); setDevOtp(""); setResendIn(0); }}>Change mobile number</button>
      </>}
    </div></section>
  </div>;
}
