"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";

export function LoginForm({ initialRole }: { initialRole: "CUSTOMER" | "PANDIT" }) {
  const [role, setRole] = useState(initialRole);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function requestOtp() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone, role }) });
      const data = await response.json() as { error?: string; devOtp?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to send OTP");
      setDevOtp(data.devOtp ?? ""); setOtp(data.devOtp ?? ""); setStep("otp");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to send OTP"); }
    finally { setBusy(false); }
  }

  async function verify() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone, otp, role }) });
      const data = await response.json() as { error?: string; redirectTo?: string };
      if (!response.ok || !data.redirectTo) throw new Error(data.error ?? "Unable to verify OTP");
      window.location.assign(data.redirectTo);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to verify OTP"); setBusy(false); }
  }

  return (
    <div className="auth-shell">
      <section className="auth-side">
        <Link href="/" className="brand brand-light"><span className="brand-mark">ॐ</span><span>Pandit in Minutes</span></Link>
        <div><span className="eyebrow eyebrow-light">Secure access</span><h1>{role === "CUSTOMER" ? "Book an urgent Puja with confidence." : "Receive genuine nearby Puja requests."}</h1><p>One phone number, one clear flow, and no public contact details.</p></div>
        <p><LockKeyhole size={17} /> Your number is never displayed publicly.</p>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-card">
          <Link href="/" className="back-link"><ArrowLeft size={16} /> Back home</Link>
          <h2>{step === "phone" ? "Continue with mobile" : "Enter verification code"}</h2>
          <p>{step === "phone" ? "We’ll use a development OTP while V2 is being tested." : `Code sent to +91 ${phone.slice(-10)}`}</p>
          <div className="role-tabs">
            <button className={role === "CUSTOMER" ? "active" : ""} onClick={() => { setRole("CUSTOMER"); setStep("phone"); }}>Customer</button>
            <button className={role === "PANDIT" ? "active" : ""} onClick={() => { setRole("PANDIT"); setStep("phone"); }}>Pandit</button>
          </div>
          {error && <div className="alert error">{error}</div>}
          {step === "phone" ? <>
            <label>Mobile number</label>
            <div className="phone-field"><span>+91</span><input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" placeholder="10-digit number" /></div>
            <button className="btn btn-primary btn-block btn-lg" disabled={busy || phone.length !== 10} onClick={requestOtp}>{busy ? "Sending…" : "Continue with OTP"}</button>
          </> : <>
            {devOtp && <div className="alert success"><strong>Development OTP:</strong> {devOtp}</div>}
            <label>6-digit OTP</label>
            <input className="otp-field" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" />
            <button className="btn btn-primary btn-block btn-lg" disabled={busy || otp.length !== 6} onClick={verify}>{busy ? "Verifying…" : "Verify and continue"}</button>
            <button className="text-button" onClick={() => setStep("phone")}>Change mobile number</button>
          </>}
        </div>
      </section>
    </div>
  );
}

