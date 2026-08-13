"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Info, Save, ShieldCheck, UserRound } from "lucide-react";
import { readJson } from "@/lib/http";
import { IndianLanguageMultiSelect, IndianLanguageSelect } from "./indian-language-fields";

type Role = "CUSTOMER" | "PANDIT";
type Profile = {
  name?: string;
  phone?: string;
  account_email?: string;
  auth_provider?: "PHONE" | "GOOGLE";
  city?: string;
  email?: string;
  default_address?: string;
  preferred_language?: string;
  current_address?: string;
  experience_years?: number;
  languages?: string[];
  specialities?: string[];
  bio?: string;
  service_radius_km?: number;
  base_charge?: number;
};
type ServicePrice = { service_id: string; name: string; description?: string; price: number; enabled: boolean };

const empty = {
  name: "", phone: "", city: "", email: "", defaultAddress: "",
  preferredLanguage: "Hindi", currentAddress: "", experienceYears: 0,
  languages: "Hindi", specialities: "", bio: "", serviceRadiusKm: 10,
  baseCharge: 0,
};

export function ProfileEditor({ role, onSaved }: { role: Role; onSaved?: () => void }) {
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pricing, setPricing] = useState<ServicePrice[]>([]);

  useEffect(() => {
    void fetch("/api/profile", { cache: "no-store" })
      .then(async (response) => {
        const data = await readJson<{ profile?: Profile; pricing?: ServicePrice[]; error?: string }>(response);
        if (!response.ok || !data.profile) {
          setError(data.error ?? "Unable to load profile");
          return;
        }
        const profile = data.profile;
        setPricing((data.pricing ?? []).map((service) => ({ ...service, price: Number(service.price) })));
        setForm({
          name: profile.name ?? "",
          phone: profile.phone ?? "",
          city: profile.city ?? "",
          email: profile.email ?? "",
          defaultAddress: profile.default_address ?? "",
          preferredLanguage: profile.preferred_language ?? "Hindi",
          currentAddress: profile.current_address ?? "",
          experienceYears: profile.experience_years ?? 0,
          languages: profile.languages?.join(", ") ?? "Hindi",
          specialities: profile.specialities?.join(", ") ?? "",
          bio: profile.bio ?? "",
          serviceRadiusKm: profile.service_radius_km ?? 10,
          baseCharge: profile.base_charge ?? 0,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  function field(key: keyof typeof form, value: string | number) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setMessage("");
    setError("");
    if (!form.name.trim() || (role === "PANDIT" && !form.city.trim())) {
      setError(role === "PANDIT" ? "Please enter your full name and city before saving." : "Please enter your full name before saving.");
      return;
    }
    setSaving(true);
    const payload = role === "CUSTOMER"
      ? { name: form.name, city: form.city, email: form.email, defaultAddress: form.defaultAddress, preferredLanguage: form.preferredLanguage }
      : {
          name: form.name, city: form.city, email: form.email,
          currentAddress: form.currentAddress, experienceYears: Number(form.experienceYears),
          languages: form.languages.split(",").map((value) => value.trim()).filter(Boolean),
          specialities: form.specialities.split(",").map((value) => value.trim()).filter(Boolean),
          bio: form.bio, serviceRadiusKm: Number(form.serviceRadiusKm),
          pricing: pricing.map((service) => ({ serviceId: service.service_id, price: Number(service.price), enabled: service.enabled })),
        };
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readJson<{ error?: string }>(response);
      if (!response.ok) {
        setError(data.error ?? "Unable to save profile");
        return;
      }
      setMessage("Profile updated successfully.");
      onSaved?.();
    } catch {
      setError("Unable to save profile. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="profile-editor" id={role === "CUSTOMER" ? "customer-profile" : "pandit-profile"}>
      <div className="section-title">
        <div><span className="eyebrow">Account profile</span><h2>Edit your profile</h2><p>Keep your important information accurate and up to date.</p></div>
        <span className="profile-editor-icon"><UserRound /></span>
      </div>
      {loading ? <div className="loading-card">Loading profile...</div> : <>
        {role === "CUSTOMER" && !form.name && !form.city && !form.email && !form.defaultAddress && <div className="profile-empty-note"><Info size={19} /><span><strong>Complete your profile</strong><small>Your account is new, so these fields are empty. Add your details once and they will be available for future Puja requests.</small></span></div>}
        <div className="profile-form-grid">
          <label>Full name <b aria-hidden="true">*</b><input value={form.name} placeholder="For example, Darshan Zala" onChange={(event) => field("name", event.target.value)} maxLength={120} required /></label>
          <label>{form.phone ? "Verified mobile number" : "Google verified email"}<input value={form.phone || form.email} readOnly disabled /><small>Contact support if this verified sign-in identity must change.</small></label>
          <label>Email address <small>Optional</small><input type="email" value={form.email} placeholder="name@example.com" onChange={(event) => field("email", event.target.value)} maxLength={180} /></label>
          {role === "CUSTOMER" ? <>
            <label className="span-2">Default service address <small>Optional</small><textarea rows={3} value={form.defaultAddress} placeholder="House or building, street, area and PIN code" onChange={(event) => field("defaultAddress", event.target.value)} maxLength={500} /></label>
            <label>Preferred Puja language<IndianLanguageSelect value={form.preferredLanguage} onChange={(value) => field("preferredLanguage", value)} /><small>Used by default when finding a matching Pandit.</small></label>
          </> : <>
            <label>City <b aria-hidden="true">*</b><input value={form.city} placeholder="For example, Mumbai" onChange={(event) => field("city", event.target.value)} maxLength={100} required /></label>
            <label className="span-2">Current address<textarea rows={3} value={form.currentAddress} onChange={(event) => field("currentAddress", event.target.value)} maxLength={500} /></label>
            <label>Years of experience<input type="number" min={0} max={80} value={form.experienceYears} onChange={(event) => field("experienceYears", Number(event.target.value))} /></label>
            <label>Service radius (km)<input type="number" min={1} max={25} value={form.serviceRadiusKm} onChange={(event) => field("serviceRadiusKm", Number(event.target.value))} /></label>
            <div className="span-2"><IndianLanguageMultiSelect value={form.languages.split(",").map((item) => item.trim()).filter(Boolean)} onChange={(languages) => field("languages", languages.join(", "))} /></div>
            <label className="span-2">Puja specialities<small>Separate multiple specialities with commas.</small><input value={form.specialities} onChange={(event) => field("specialities", event.target.value)} /></label>
            <label className="span-2">Professional introduction<textarea rows={5} value={form.bio} onChange={(event) => field("bio", event.target.value)} maxLength={1500} /></label>
            <div className="service-price-editor span-2"><div><strong>Services and charges</strong><small>Enable the Pujas you offer and set the customer-visible charge for each service.</small></div><div className="service-price-list">{pricing.map((service, index) => <article className={service.enabled ? "enabled" : ""} key={service.service_id}><label className="service-enable"><input type="checkbox" checked={service.enabled} onChange={(event) => setPricing((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, enabled: event.target.checked } : item))} /><span><strong>{service.name}</strong><small>{service.description}</small></span></label><label className="service-charge"><span>Charge (INR)</span><input type="number" min={0} max={1000000} disabled={!service.enabled} value={service.price} onChange={(event) => setPricing((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, price: Number(event.target.value) } : item))} /></label></article>)}</div></div>
          </>}
        </div>
        {role === "PANDIT" && <div className="profile-protection-note"><ShieldCheck /><span><strong>Protected verification details</strong><small>Government ID, date of birth, bank/UPI proof and verified documents cannot be changed here. Contact support or follow an Admin change request.</small></span></div>}
        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success"><BadgeCheck />{message}</div>}
        <div className="profile-editor-actions"><button type="button" className="btn btn-primary" disabled={saving} onClick={save}><Save size={17} />{saving ? "Saving..." : "Save profile changes"}</button></div>
      </>}
    </section>
  );
}
