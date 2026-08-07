"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, FileCheck2, Save, Send, ShieldCheck, Upload } from "lucide-react";
import { readJson } from "@/lib/http";

type Service = { id: string; name: string; description: string; base_price: number };
type Doc = { id: string; document_type: string; original_name: string; review_status: string };
type Reference = { name: string; relationship: string; organisation: string; phone: string };
type Price = { serviceId: string; price: number; enabled: boolean };
type ApiProfile = { name?: string; phone?: string; email?: string; date_of_birth?: string; city?: string; current_address?: string; experience_years?: number; languages?: string[]; specialities?: string[]; bio?: string; service_radius_km?: number; availability_preference?: "AVAILABLE_AFTER_APPROVAL" | "OFFLINE"; payout_method?: "BANK" | "UPI"; bank_account_name?: string; bank_ifsc?: string; upi_id?: string; platform_rules_accepted_at?: string };
type OnboardingResponse = { error?: string; profile?: ApiProfile; services?: Service[]; documents?: Doc[]; references?: Array<{ reference_name: string; relationship: string; temple_or_organisation?: string; phone: string }>; pricing?: Array<{ service_id: string; price: number; enabled: boolean }> };

const newReference = (): Reference => ({ name: "", relationship: "", organisation: "", phone: "" });
const uploadTypes = [
  ["PROFILE_PHOTO", "Profile photograph", true], ["GOVERNMENT_ID", "Government identification", true],
  ["BANK_PROOF", "Bank or UPI proof", true], ["ADDRESS_PROOF", "Address proof", false],
  ["REFERENCE_LETTER", "Reference letter", false],
] as const;

export function PanditOnboarding({ status, reviewNote, onSaved }: { status: string; reviewNote?: string | null; onSaved: () => void }) {
  const [services, setServices] = useState<Service[]>([]);
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [references, setReferences] = useState<Reference[]>([newReference()]);
  const [pricing, setPricing] = useState<Price[]>([]);
  const [form, setForm] = useState({ legalName: "", phone: "", email: "", dateOfBirth: "", city: "", currentAddress: "", experienceYears: 0, languages: "Hindi", specialities: "", bio: "", serviceRadiusKm: 10, availabilityPreference: "OFFLINE" as "AVAILABLE_AFTER_APPROVAL" | "OFFLINE", payoutMethod: "UPI" as "BANK" | "UPI", bankAccountName: "", bankAccountNumber: "", bankIfsc: "", upiId: "", acceptPlatformRules: false });
  const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false); const [uploading, setUploading] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const dirtyRef = useRef(false);

  async function load() {
    const response = await fetch(`/api/pandit/onboarding?fresh=${Date.now()}`, { cache: "no-store" });
    const data = await readJson<OnboardingResponse>(response);
    if (!response.ok || !data.profile) { setNotice(data.error ?? "Unable to load onboarding"); return; }
    const p = data.profile; const serviceRows: Service[] = data.services ?? [];
    setServices(serviceRows); setDocuments(data.documents ?? []);
    if (!dirtyRef.current) {
      setReferences(data.references?.length ? data.references.map((r) => ({ name: r.reference_name, relationship: r.relationship, organisation: r.temple_or_organisation ?? "", phone: r.phone })) : [newReference()]);
      setPricing(serviceRows.map((service) => { const saved = data.pricing?.find((item) => item.service_id === service.id); return { serviceId: service.id, price: saved?.price ?? service.base_price, enabled: saved?.enabled ?? true }; }));
      setForm((old) => ({ ...old, legalName: p.name ?? "", phone: p.phone ?? "", email: p.email ?? "", dateOfBirth: p.date_of_birth?.slice(0, 10) ?? "", city: p.city ?? "", currentAddress: p.current_address ?? "", experienceYears: p.experience_years ?? 0, languages: p.languages?.join(", ") || "Hindi", specialities: p.specialities?.join(", ") || "", bio: p.bio ?? "", serviceRadiusKm: p.service_radius_km ?? 10, availabilityPreference: p.availability_preference ?? "OFFLINE", payoutMethod: p.payout_method ?? "UPI", bankAccountName: p.bank_account_name ?? "", bankIfsc: p.bank_ifsc ?? "", upiId: p.upi_id ?? "", acceptPlatformRules: Boolean(p.platform_rules_accepted_at) }));
    }
    setHydrated(true);
  }
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, []);

  const missingRequirements = useMemo(() => {
    const uploaded = new Set(documents.map((doc) => doc.document_type));
    const firstReference = references[0];
    const requirements: Array<[boolean, string]> = [
      [form.legalName.trim().length >= 3, "Enter your full legal name"],
      [/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()), "Enter a valid email address"],
      [Boolean(form.dateOfBirth), "Select your date of birth"],
      [form.city.trim().length >= 2, "Enter your city"],
      [form.currentAddress.trim().length >= 10, "Enter your complete current address"],
      [form.languages.split(",").some((item) => item.trim()), "Add at least one language"],
      [form.specialities.split(",").some((item) => item.trim()), "Add at least one Puja speciality"],
      [form.bio.trim().length >= 30, `Write a professional introduction (${Math.max(0, 30 - form.bio.trim().length)} more characters)`],
      [pricing.length > 0 && pricing.some((item) => item.enabled && item.price >= 0), "Enable and price at least one service"],
      [Boolean(firstReference?.name.trim() && firstReference.relationship.trim() && /^\+?[0-9]{10,13}$/.test(firstReference.phone.trim())), "Complete one reference with name, relationship and mobile number"],
      [form.payoutMethod === "UPI" ? /^[\w.-]+@[\w.-]+$/.test(form.upiId.trim()) : Boolean(form.bankAccountName.trim() && form.bankAccountNumber.trim() && form.bankIfsc.trim()), form.payoutMethod === "UPI" ? "Enter a valid UPI ID" : "Complete account holder, account number and IFSC"],
      [uploaded.has("PROFILE_PHOTO"), "Upload a profile photograph"],
      [uploaded.has("GOVERNMENT_ID"), "Upload government identification"],
      [uploaded.has("BANK_PROOF"), "Upload bank or UPI proof"],
      [form.acceptPlatformRules, "Accept the platform rules and verification consent"],
    ];
    return requirements.filter(([complete]) => !complete).map(([, label]) => label);
  }, [documents, form, pricing, references]);
  const progress = Math.round(((15 - missingRequirements.length) / 15) * 100);

  async function save(submit: boolean) {
    if (submit && missingRequirements.length) {
      setNotice(`Complete the ${missingRequirements.length} item${missingRequirements.length === 1 ? "" : "s"} shown in “Still needed” before submitting.`);
      document.getElementById("onboarding-missing")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setBusy(true); setNotice("");
    const response = await fetch("/api/pandit/onboarding", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, languages: form.languages.split(",").map((x) => x.trim()).filter(Boolean), specialities: form.specialities.split(",").map((x) => x.trim()).filter(Boolean), references, pricing, submit }) });
    const data = await readJson<{ error?: string }>(response);
    setNotice(response.ok ? submit ? "Application submitted for verification." : "Draft saved securely." : data.error ?? "Unable to save");
    setBusy(false); if (response.ok && submit) onSaved();
  }
  async function upload(type: string, file?: File) {
    if (!file) return; setUploading(type); setNotice("");
    const data = new FormData(); data.set("documentType", type); data.set("file", file);
    const response = await fetch("/api/pandit/onboarding/documents", { method: "POST", body: data });
    const result = await readJson<{ error?: string; document?: Doc }>(response);
    if (response.ok && result.document) {
      setDocuments((current) => [result.document!, ...current.filter((document) => document.id !== result.document!.id)]);
      setNotice("Document stored privately in Supabase.");
    } else setNotice(result.error ?? "Upload failed");
    setUploading(""); if (response.ok) await load();
  }
  function updateReference(index: number, key: keyof Reference, value: string) { setReferences(references.map((row, i) => i === index ? { ...row, [key]: value } : row)); }

  if (!hydrated) return <section className="onboarding-loading" aria-live="polite"><span className="onboarding-loader" /><div><strong>Loading your saved application…</strong><small>Please wait before entering information.</small></div></section>;

  return <section className="trusted-onboarding" onChangeCapture={() => { dirtyRef.current = true; }}>
    <header className="onboarding-header"><div><span className="eyebrow">Trusted Pandit onboarding</span><h2>Complete your verified professional profile</h2><p>Save a draft at any time. Required documents are private and never receive public URLs.</p></div><div className="progress-ring"><strong>{progress}%</strong><span>complete</span></div></header>
    {["SUBMITTED", "UNDER_REVIEW"].includes(status) && <div className="review-in-progress-banner"><BadgeCheck size={22} /><span><strong>Your application is {status.replaceAll("_", " ").toLowerCase()}.</strong> You can still correct information using Save draft.</span></div>}
    {reviewNote && <div className="alert error"><strong>Admin note:</strong> {reviewNote}</div>}{notice && <div className={notice.includes("Unable") || notice.includes("failed") ? "alert error" : "alert success"}>{notice}</div>}
    {missingRequirements.length > 0 && <div className="requirements-card" id="onboarding-missing"><div><strong>Still needed before submission</strong><span>{missingRequirements.length} item{missingRequirements.length === 1 ? "" : "s"} remaining</span></div><ul>{missingRequirements.map((item) => <li key={item}>{item}</li>)}</ul></div>}
    {missingRequirements.length === 0 && <div className="requirements-ready"><BadgeCheck size={20} /><span><strong>Your application is complete.</strong> You can now submit it for admin verification.</span></div>}
    <div className="onboarding-section"><h3>1. Legal identity and contact</h3><div className="form-grid">
      <label>Full legal name *<input value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} /></label><label>Verified mobile<input value={form.phone} disabled /></label>
      <label>Email *<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label><label>Date of birth *<input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} /></label>
      <label>City *<input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label><label>Service radius (km) *<input type="number" min="1" max="100" value={form.serviceRadiusKm} onChange={(e) => setForm({ ...form, serviceRadiusKm: Number(e.target.value) })} /></label>
      <label className="span-2">Availability after approval<select value={form.availabilityPreference} onChange={(e) => setForm({ ...form, availabilityPreference: e.target.value as "AVAILABLE_AFTER_APPROVAL" | "OFFLINE" })}><option value="OFFLINE">Stay offline until I switch on availability</option><option value="AVAILABLE_AFTER_APPROVAL">Ready to receive requests after approval</option></select></label>
      <label className="span-2">Current address *<textarea rows={3} value={form.currentAddress} onChange={(e) => setForm({ ...form, currentAddress: e.target.value })} /></label>
    </div></div>
    <div className="onboarding-section"><h3>2. Experience and services</h3><div className="form-grid"><label>Years of experience *<input type="number" min="0" max="80" value={form.experienceYears} onChange={(e) => setForm({ ...form, experienceYears: Number(e.target.value) })} /></label><label>Languages *<input value={form.languages} onChange={(e) => setForm({ ...form, languages: e.target.value })} placeholder="Hindi, Marathi, Sanskrit" /></label><label className="span-2">Puja specialities *<input value={form.specialities} onChange={(e) => setForm({ ...form, specialities: e.target.value })} /></label><label className="span-2">Professional introduction *<textarea rows={4} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="At least 30 characters" /></label></div>
      <div className="pricing-list">{services.map((service) => { const price = pricing.find((row) => row.serviceId === service.id); return price && <label className="pricing-row" key={service.id}><input type="checkbox" checked={price.enabled} onChange={(e) => setPricing(pricing.map((row) => row.serviceId === service.id ? { ...row, enabled: e.target.checked } : row))} /><span><strong>{service.name}</strong><small>{service.description}</small></span><span className="price-input">₹ <input type="number" min="0" value={price.price} onChange={(e) => setPricing(pricing.map((row) => row.serviceId === service.id ? { ...row, price: Number(e.target.value) } : row))} /></span></label>; })}</div>
    </div>
    <div className="onboarding-section"><h3>3. Private documents</h3><p className="section-help"><ShieldCheck size={16} /> Only authorised admins can open five-minute signed review links.</p><div className="document-grid">{uploadTypes.map(([type, title, required]) => { const existing = documents.find((doc) => doc.document_type === type); const state = existing?.review_status === "VERIFIED" ? "Verified by admin" : existing?.review_status === "REJECTED" ? "Changes required — upload a corrected document" : existing ? "Uploaded successfully — awaiting admin review" : "JPG, PNG, WebP or PDF up to 10 MB"; return <label className={`document-upload ${existing?.review_status?.toLowerCase() ?? "empty"}`} key={type}><Upload /><span><strong>{title}{required ? " *" : ""}</strong><small>{existing ? `${existing.original_name} · ${state}` : state}</small></span><b className="document-state">{existing?.review_status === "VERIFIED" ? "VERIFIED" : existing?.review_status === "REJECTED" ? "REUPLOAD" : existing ? "UPLOADED" : "CHOOSE FILE"}</b><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={uploading === type} onChange={(e) => void upload(type, e.target.files?.[0])} /></label>; })}</div></div>
    <div className="onboarding-section"><h3>4. References and payout</h3>{references.map((reference, index) => <div className="reference-row" key={index}><input placeholder="Reference name" value={reference.name} onChange={(e) => updateReference(index, "name", e.target.value)} /><input placeholder="Relationship" value={reference.relationship} onChange={(e) => updateReference(index, "relationship", e.target.value)} /><input placeholder="Temple / organisation" value={reference.organisation} onChange={(e) => updateReference(index, "organisation", e.target.value)} /><input placeholder="Mobile" value={reference.phone} onChange={(e) => updateReference(index, "phone", e.target.value)} /></div>)}<button type="button" className="btn btn-ghost" onClick={() => setReferences([...references, newReference()])}>Add another reference</button>
      <div className="payout-box"><label>Payout method<select value={form.payoutMethod} onChange={(e) => setForm({ ...form, payoutMethod: e.target.value as "BANK" | "UPI" })}><option value="UPI">UPI</option><option value="BANK">Bank account</option></select></label>{form.payoutMethod === "UPI" ? <label>UPI ID *<input value={form.upiId} onChange={(e) => setForm({ ...form, upiId: e.target.value })} /></label> : <><label>Account holder *<input value={form.bankAccountName} onChange={(e) => setForm({ ...form, bankAccountName: e.target.value })} /></label><label>Account number *<input value={form.bankAccountNumber} onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })} /></label><label>IFSC *<input value={form.bankIfsc} onChange={(e) => setForm({ ...form, bankIfsc: e.target.value.toUpperCase() })} /></label></>}</div>
    </div>
    <label className="rules-consent"><input type="checkbox" checked={form.acceptPlatformRules} onChange={(e) => setForm({ ...form, acceptPlatformRules: e.target.checked })} /><span><strong>I agree to the platform rules and verification process.</strong><small>I confirm that all information is accurate and permit identity, reference, knowledge and payout verification.</small></span></label>
    <div className="onboarding-actions"><button className="btn btn-ghost" disabled={busy} onClick={() => void save(false)}><Save size={17} /> Save draft</button><button className="btn btn-primary" disabled={busy} onClick={() => void save(true)}><Send size={17} /> {missingRequirements.length ? `Review ${missingRequirements.length} missing item${missingRequirements.length === 1 ? "" : "s"}` : "Submit for verification"}</button></div>
    <div className="private-storage-note"><FileCheck2 /><span>All application records and file metadata are stored in your Supabase project.</span></div>
  </section>;
}
