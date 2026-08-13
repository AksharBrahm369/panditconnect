"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, Clock3, LockKeyhole, MapPin } from "lucide-react";

export function LoginForm({ initialRole, nextPath, googleError }: { initialRole: "CUSTOMER" | "PANDIT"; nextPath?: string; googleError?: string }) {
  const [role, setRole] = useState(initialRole);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [error, setError] = useState(googleError ?? "");
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    let checking = false;
    const restoreAuthenticatedPortal = async () => {
      if (checking) return;
      checking = true;
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
          credentials: "same-origin",
          headers: { "Cache-Control": "no-cache" },
        });
        const session = await response.json() as { authenticated?: boolean; role?: "CUSTOMER" | "PANDIT" | "ADMIN" };
        if (session.authenticated && session.role) {
          window.location.replace(session.role === "ADMIN" ? "/admin" : session.role === "PANDIT" ? "/pandit" : nextPath ?? "/customer");
        }
      } catch {
        // A network failure must never clear a valid session.
      } finally {
        checking = false;
      }
    };
    const onPageShow = () => void restoreAuthenticatedPortal();
    window.addEventListener("pageshow", onPageShow);
    void restoreAuthenticatedPortal();
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [nextPath]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  async function requestOtp() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone, role }) });
      const data = await response.json() as { error?: string; devOtp?: string; retryAfter?: number };
      if (!response.ok) { if (data.retryAfter) setResendIn(Math.min(data.retryAfter, 86400)); throw new Error(data.error ?? "Unable to send OTP"); }
      setDevOtp(data.devOtp ?? ""); setOtp(data.devOtp ?? ""); setResendIn(data.retryAfter ?? 60); setStep("otp");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to send OTP"); }
    finally { setBusy(false); }
  }

  async function verify() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone, otp, role }) });
      const data = await response.json() as { error?: string; redirectTo?: string };
      if (!response.ok || !data.redirectTo) throw new Error(data.error ?? "Unable to verify OTP");
      window.location.assign(role === "CUSTOMER" && nextPath ? nextPath : data.redirectTo);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to verify OTP"); setBusy(false); }
  }

  return (
    <div className="auth-shell">
      <section className="auth-side">
        <Link href="/" className="brand brand-light"><span className="brand-mark">ॐ</span><span><strong>PanditConnect</strong><small>Seva with trust</small></span></Link>
        <div><span className="eyebrow eyebrow-light">{role === "CUSTOMER" ? "Puja help for every family" : "A trusted Pandit Seva network"}</span><h1>{role === "CUSTOMER" ? "Puja help, without the confusion." : "Your Seva requests, clearly organised."}</h1><p>{role === "CUSTOMER" ? "Tell us what your family needs. We guide every step and connect you with an approved Pandit." : "Manage your availability, genuine nearby requests and customer updates from one calm workspace."}</p>
          <div className="auth-benefits">
            <span><BadgeCheck /> Approved Pandit profiles</span>
            <span><MapPin /> Nearby GPS-based matching</span>
            <span><Clock3 /> Live request and arrival updates</span>
          </div>
        </div>
        <p><LockKeyhole size={17} /> Your number is never displayed publicly.</p>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-card">
          <Link href="/" className="back-link"><ArrowLeft size={16} /> Back home</Link>
          <span className="auth-step">Step {step === "phone" ? "1 of 2" : "2 of 2"}</span>
          <h2>{step === "phone" ? "Let’s begin" : "Enter verification code"}</h2>
          <p>{step === "phone" ? "Choose your role and enter your mobile number. No password is needed." : `Enter the 6-digit code sent to +91 ${phone.slice(-10)}`}</p>
          <div className="role-tabs">
            <button className={role === "CUSTOMER" ? "active" : ""} onClick={() => { setRole("CUSTOMER"); setStep("phone"); }}>Customer</button>
            <button className={role === "PANDIT" ? "active" : ""} onClick={() => { setRole("PANDIT"); setStep("phone"); }}>Pandit</button>
          </div>
          {error && <div className="alert error">{error}</div>}
          {step === "phone" ? <>
            <a className="google-signin-button" href={`/api/auth/google/start?role=${role}${nextPath ? `&next=${encodeURIComponent(nextPath)}` : ""}`}>
              <span className="google-signin-mark" aria-hidden="true">G</span>
              <span>Continue with Google</span>
            </a>
            <div className="auth-divider"><span>or use mobile OTP</span></div>
            <label>Indian mobile number</label>
            <div className="phone-field"><span>+91</span><input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" placeholder="10-digit number" /></div>
            <button className="btn btn-primary btn-block btn-lg" disabled={busy || phone.length !== 10} onClick={requestOtp}>{busy ? "Sending…" : "Continue with OTP"}</button>
            <p className="form-reassurance"><LockKeyhole size={14} /> Used only for secure account access. Never displayed publicly.</p>
          </> : <>
            {devOtp && <div className="alert success"><strong>Testing OTP:</strong> {devOtp}<br /><small>Testing mode only—this code was not sent by SMS. Do not use test accounts for real customer data.</small></div>}
            <label>6-digit OTP</label>
            <input className="otp-field" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" />
            <button className="btn btn-primary btn-block btn-lg" disabled={busy || otp.length !== 6} onClick={verify}>{busy ? "Verifying…" : "Verify and continue"}</button>
            <button className="text-button" disabled={busy || resendIn > 0} onClick={requestOtp}>{resendIn > 0 ? `Resend OTP in ${resendIn}s` : "Resend OTP"}</button>
            <button className="text-button" onClick={() => { setStep("phone"); setOtp(""); setDevOtp(""); setResendIn(0); }}>Change mobile number</button>
          </>}
        </div>
      </section>
    </div>
  );
}
