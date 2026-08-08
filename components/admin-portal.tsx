"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, BadgeCheck, CalendarCheck, Check, ExternalLink, Headphones, Languages, MapPin, RefreshCw, ShieldAlert, ShieldCheck, Star, UserRound, Users, X } from "lucide-react";
import { AppShell } from "./app-shell";
import { readJson } from "@/lib/http";

type Overview = { stats: { users: number; pendingPandits: number; approvedPandits: number; bookings: number }; recent: Array<{ id: string; service_name: string; pandit_name: string; customer_phone: string; status: string; amount: number; created_at: string; request_type: string; scheduled_at: string | null }>; approved: ReviewPandit[] };
type ReviewPandit = {
  id: string; name: string | null; phone: string; city: string | null; experience_years: number;
  languages: string[]; specialities: string[]; bio: string | null; base_charge: number;
  verification_status: string; review_note: string | null; created_at: string; is_online?: boolean;
  rating?: string; rating_count?: number; completed_jobs?: number; services?: string[]; account_status?: "ACTIVE" | "SUSPENDED";
  email?: string; date_of_birth?: string; current_address?: string; service_radius_km?: number; payout_method?: string; bank_account_name?: string; bank_ifsc?: string; upi_id?: string; submitted_at?: string;
  references?: Array<{ id: string; name: string; relationship: string; organisation: string | null; phone: string; status: string; note: string | null }>;
  documents?: Array<{ id: string; type: string; name: string; mimeType: string; size: number; status: string; note: string | null }>;
  pricing?: Array<{ serviceId: string; serviceName: string; price: number; enabled: boolean }>;
  review?: ReviewChecklist;
};
type SupportCase = { id:string; category:string; subject:string; description:string; priority:string; status:string; resolution:string|null; booking_id:string|null; created_at:string; reporter_name:string|null; reporter_role:string; reporter_phone:string };
type CheckStatus = "PENDING" | "VERIFIED" | "FAILED";
type ReviewChecklist = { identityStatus: CheckStatus; documentStatus: CheckStatus; referenceStatus: CheckStatus; knowledgeCheckStatus: CheckStatus; bankStatus: CheckStatus; knowledgeScore?: number | null; adminNote?: string | null };
const emptyChecklist: ReviewChecklist = { identityStatus: "PENDING", documentStatus: "PENDING", referenceStatus: "PENDING", knowledgeCheckStatus: "PENDING", bankStatus: "PENDING", knowledgeScore: null, adminNote: "" };

export function AdminPortal() {
  const [data, setData] = useState<Overview | null>(null);
  const [queue, setQueue] = useState<ReviewPandit[]>([]);
  const [approved, setApproved] = useState<ReviewPandit[]>([]);
  const [queueOpen, setQueueOpen] = useState(false);
  const [selected, setSelected] = useState<ReviewPandit | null>(null);
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [queueLoading, setQueueLoading] = useState(false);
  const [checklist, setChecklist] = useState<ReviewChecklist>(emptyChecklist);
  const [supportCases,setSupportCases]=useState<SupportCase[]>([]);

  async function loadQueue() {
    setQueueLoading(true);
    try {
      const response = await fetch(`/api/admin/pandits?fresh=${Date.now()}`, { cache: "no-store" });
      const result = await readJson<{ pandits?: ReviewPandit[]; error?: string }>(response);
      if (!response.ok) throw new Error(result.error ?? "Unable to refresh queue");
      setQueue(result.pandits ?? []);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to refresh queue");
    } finally {
      setQueueLoading(false);
    }
  }

  async function load() {
    const [response,supportResponse] = await Promise.all([fetch(`/api/admin/overview?fresh=${Date.now()}`, { cache: "no-store" }),fetch(`/api/admin/support-cases?fresh=${Date.now()}`,{cache:"no-store"})]);
    const result = await readJson<Overview & { error?: string }>(response); const support=await readJson<{cases?:SupportCase[]}>(supportResponse);
    if (response.status === 401 || response.status === 403) { window.location.assign("/admin/login?reason=session"); return; }
    if (!response.ok) { setNotice(result.error ?? "Unable to load the admin workspace"); return; }
    setData(result);
    setApproved(result.approved ?? []);
    if(supportResponse.ok)setSupportCases(support.cases??[]);
  }
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function openQueue() {
    setNotice("");
    setQueueOpen(true);
    await loadQueue();
  }

  async function review(action: "APPROVE" | "REJECT" | "REQUEST_CHANGES" | "START_REVIEW" | "UPDATE_CHECKLIST") {
    if (!selected) return;
    setBusy(true); setNotice("");
    const response = await fetch("/api/admin/pandits", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ panditId: selected.id, action, note, ...(action === "UPDATE_CHECKLIST" ? checklist : {}) }),
    });
    const result = await readJson<{ error?: string }>(response);
    if (!response.ok) { setNotice(result.error ?? "Unable to save review"); setBusy(false); return; }
    setNotice(action === "APPROVE" ? `${selected.name ?? "Pandit"} approved successfully.` : action === "UPDATE_CHECKLIST" ? "Verification checklist saved." : "Review decision saved.");
    if (action !== "UPDATE_CHECKLIST") { setSelected(null); setNote(""); }
    setBusy(false); await load(); await loadQueue();
  }

  async function openDocument(documentId: string) {
    const response = await fetch(`/api/admin/pandits/documents/${documentId}`, { cache: "no-store" });
    const result = await readJson<{ url?: string; error?: string }>(response);
    if (!response.ok || !result.url) { setNotice(result.error ?? "Unable to open document"); return; }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  async function reviewDocument(documentId: string, status: "VERIFIED" | "REJECTED") {
    if (!selected) return;
    const rejectionNote = status === "REJECTED" ? window.prompt("Explain what the Pandit must correct:")?.trim() : "";
    if (status === "REJECTED" && !rejectionNote) return;
    setBusy(true); setNotice("");
    const response = await fetch(`/api/admin/pandits/documents/${documentId}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, note: rejectionNote }),
    });
    const result = await readJson<{ error?: string; documentStatus?: CheckStatus }>(response);
    if (!response.ok) setNotice(result.error ?? "Unable to review document");
    else {
      setSelected({ ...selected, documents: selected.documents?.map((document) => document.id === documentId ? { ...document, status, note: rejectionNote || null } : document) });
      setChecklist({ ...checklist, documentStatus: result.documentStatus ?? checklist.documentStatus });
      setNotice(status === "VERIFIED" ? "Document verified successfully." : "Document rejected and correction requested.");
    }
    setBusy(false); await loadQueue();
  }

  function selectPandit(pandit: ReviewPandit) { setSelected(pandit); setNote(pandit.review_note ?? pandit.review?.adminNote ?? ""); setChecklist({ ...emptyChecklist, ...(pandit.review ?? {}) }); }
  async function updateCase(caseId:string,status:"IN_REVIEW"|"RESOLVED") { const resolution=status==="IN_REVIEW"?"":window.prompt("Resolution or outcome:")?.trim(); if(status==="RESOLVED"&&!resolution)return; setBusy(true);const response=await fetch("/api/admin/support-cases",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({caseId,status,resolution})});const result=await readJson<{error?:string}>(response);setNotice(response.ok?"Support case updated.":result.error??"Unable to update case");setBusy(false);await load(); }
  async function changePanditAccess(panditId:string,action:"SUSPEND"|"RESTORE") { if(action==="SUSPEND"&&!window.confirm("Suspend this Pandit and end active sessions?"))return;setBusy(true);const response=await fetch("/api/admin/support-cases",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({panditId,accountAction:action})});const result=await readJson<{error?:string}>(response);setNotice(response.ok?`Pandit ${action==="SUSPEND"?"suspended":"restored"}.`:result.error??"Unable to update access");setBusy(false);await load();}

  return <AppShell role="Admin" title="Operations overview" subtitle="A compact control room for verification, urgent bookings and platform health.">
    <div className="demo-banner"><ShieldCheck size={17} /><div><strong>Protected operations workspace</strong><span>Customer phone numbers remain masked while you review bookings and Pandit quality.</span></div></div>
    <section className="stat-grid admin-stats">
      <article><Users size={21} /><span>Registered users</span><strong>{data?.stats.users ?? "—"}</strong></article>
      <article><ShieldCheck size={21} /><span>Pandits to review</span><strong>{data?.stats.pendingPandits ?? "—"}</strong></article>
      <article><CalendarCheck size={21} /><span>Total bookings</span><strong>{data?.stats.bookings ?? "—"}</strong></article>
      <article><BadgeCheck size={21} /><span>Approved Pandits</span><strong>{data?.stats.approvedPandits ?? approved.length}</strong></article>
    </section>
    <section className="workspace admin-workspace" id="admin-bookings">
      <div className="workspace-main"><div className="section-title"><div><h2>Recent bookings</h2><p>Monitor status without exposing customer contact details.</p></div></div>
        {data?.recent.length ? <div className="table-wrap admin-bookings-table"><table><thead><tr><th>Puja</th><th>When</th><th>Pandit</th><th>Customer</th><th>Status</th><th>Amount</th></tr></thead><tbody>{data.recent.map((row) => <tr key={row.id}><td data-label="Puja">{row.service_name}</td><td data-label="When">{row.scheduled_at ? new Date(row.scheduled_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Urgent / now"}</td><td data-label="Pandit">{row.pandit_name}</td><td data-label="Customer">••••{row.customer_phone.slice(-4)}</td><td data-label="Status"><span className="status">{row.status}</span></td><td data-label="Amount">₹{row.amount.toLocaleString("en-IN")}</td></tr>)}</tbody></table></div> : <div className="empty">No bookings yet.</div>}
      </div>
      <aside className="side-card"><h3>Review queue</h3><div className="queue-item"><span className="avatar">P</span><div><strong>{data?.stats.pendingPandits ?? 0} Pandit {(data?.stats.pendingPandits ?? 0) === 1 ? "profile" : "profiles"}</strong><small>Identity and experience review</small></div></div><button className="btn btn-primary btn-block" onClick={openQueue} disabled={queueLoading}>{queueLoading ? "Refreshing queue…" : "Open verification queue"}</button><p className="privacy-note">Review experience, languages and specialities before approval.</p></aside>
    </section>
    {notice && <div className="alert success admin-notice">{notice}</div>}
    <section className="history admin-support" id="admin-support"><div className="section-title"><div><h2>Support and safety cases</h2><p>Urgent reports appear first and every decision is audited.</p></div><span className="live-pill"><i /> {supportCases.filter(item=>["OPEN","IN_REVIEW"].includes(item.status)).length} open</span></div>{supportCases.length?<div className="admin-support-list">{supportCases.map(item=><article key={item.id} className={item.priority==="URGENT"?"urgent":""}><span>{item.priority==="URGENT"?<ShieldAlert/>:<Headphones/>}</span><div><strong>{item.subject}</strong><small>{item.reporter_role} · ••••{item.reporter_phone} · {item.category.replaceAll("_"," ")}</small><p>{item.description}</p>{item.resolution&&<em>Resolution: {item.resolution}</em>}</div><span className="status">{item.status.replaceAll("_"," ")}</span><div className="button-row">{item.status==="OPEN"&&<button className="btn btn-ghost" disabled={busy} onClick={()=>void updateCase(item.id,"IN_REVIEW")}>Start review</button>}{!["RESOLVED","CLOSED"].includes(item.status)&&<button className="btn btn-primary" disabled={busy} onClick={()=>void updateCase(item.id,"RESOLVED")}>Resolve</button>}</div></article>)}</div>:<div className="empty">No support cases yet.</div>}</section>
    <section className="history approved-directory" id="admin-pandits">
      <div className="section-title"><div><h2>Approved Pandits</h2><p>All active approved profiles remain visible here after leaving the review queue.</p></div><button className="btn btn-ghost" onClick={load}><RefreshCw size={16} /> Refresh</button></div>
      {approved.length ? <div className="approved-grid">{approved.map((pandit) => <article className="approved-card" key={pandit.id}>
        <div className="approved-head"><span className="avatar">{(pandit.name ?? "P").split(" ").map((part) => part[0]).slice(0,2).join("")}</span><div><strong>{pandit.name ?? "Pandit"}</strong><span><MapPin size={13} /> {pandit.city ?? "City not provided"}</span></div><span className={`availability-dot ${pandit.is_online ? "online" : ""}`}>{pandit.is_online ? "Online" : "Offline"}</span></div>
        <div className="approved-metrics"><span><b>{pandit.experience_years}</b> years</span><span><b>{pandit.rating_count ? <>{pandit.rating} <Star size={12} fill="currentColor" /></> : "New"}</b>{pandit.rating_count ? `${pandit.rating_count} ratings` : "not rated"}</span><span><b>{pandit.completed_jobs ?? 0}</b> visits</span></div>
        <div className="tag-row">{(pandit.services?.length ? pandit.services : pandit.specialities).slice(0,4).map((item) => <b key={item}>{item}</b>)}</div>
        <div className="approved-foot"><span>+91 ••••••{pandit.phone.slice(-4)}</span><strong>{pandit.account_status??"ACTIVE"}</strong></div>
        <button className={`btn btn-block ${pandit.account_status==="SUSPENDED"?"btn-ghost":"btn-ghost danger"}`} disabled={busy} onClick={()=>void changePanditAccess(pandit.id,pandit.account_status==="SUSPENDED"?"RESTORE":"SUSPEND")}>{pandit.account_status==="SUSPENDED"?"Restore access":"Suspend Pandit"}</button>
      </article>)}</div> : <div className="empty">No approved Pandits yet.</div>}
    </section>

    {queueOpen && <div className="review-overlay" role="dialog" aria-modal="true" aria-label="Pandit verification queue">
      <section className="review-drawer">
        <header><div><span className="eyebrow">Admin review</span><h2>{selected ? "Review Pandit profile" : "Pandit verification queue"}</h2></div><div className="drawer-actions">{!selected && <button className="icon-button" onClick={loadQueue} disabled={queueLoading} aria-label="Refresh queue"><RefreshCw size={18} className={queueLoading ? "spin" : ""} /></button>}<button className="icon-button" onClick={() => { setQueueOpen(false); setSelected(null); }} aria-label="Close queue"><X size={19} /></button></div></header>
        {!selected ? <>
          <p className="drawer-intro">{queueLoading ? "Refreshing the latest registrations…" : queue.length ? `${queue.length} profile${queue.length === 1 ? "" : "s"} waiting for a decision.` : "No Pandit profiles are waiting for review."}</p>
          <div className="review-list">{queue.map((pandit) => <button key={pandit.id} className="review-list-item" onClick={() => selectPandit(pandit)}>
            <span className="avatar">{(pandit.name ?? "P").split(" ").map((part) => part[0]).slice(0,2).join("")}</span>
            <div><strong>{pandit.name ?? "Profile not completed"}</strong><span><MapPin size={13} /> {pandit.city ?? "City missing"} · {pandit.experience_years} years</span><small>{pandit.specialities.length ? pandit.specialities.join(", ") : "Specialities not added"}</small></div>
            <span className="status">{pandit.verification_status.replaceAll("_", " ")}</span>
          </button>)}</div>
        </> : <>
          <button className="back-review" onClick={() => setSelected(null)}><ArrowLeft size={16} /> Back to queue</button>
          <div className="review-profile-head"><span className="avatar large">{(selected.name ?? "P").split(" ").map((part) => part[0]).slice(0,2).join("")}</span><div><h3>{selected.name ?? "Incomplete profile"}</h3><p>+91 ••••••{selected.phone.slice(-4)} · Applied {new Date(selected.created_at).toLocaleDateString("en-IN")}</p></div><span className="status">{selected.verification_status.replaceAll("_", " ")}</span></div>
          <div className="review-facts">
            <div><UserRound size={18} /><span>Experience</span><strong>{selected.experience_years} years</strong></div>
            <div><MapPin size={18} /><span>City</span><strong>{selected.city ?? "Not provided"}</strong></div>
            <div><Languages size={18} /><span>Languages</span><strong>{selected.languages.join(", ") || "Not provided"}</strong></div>
            <div><BadgeCheck size={18} /><span>Starting charge</span><strong>₹{selected.base_charge.toLocaleString("en-IN")}</strong></div>
          </div>
          <div className="review-section"><span>Specialities</span><div className="tag-row">{selected.specialities.length ? selected.specialities.map((item) => <b key={item}>{item}</b>) : <em>Not provided</em>}</div></div>
          <div className="review-section"><span>Professional introduction</span><p>{selected.bio || "No introduction provided."}</p></div>
          <div className="review-section"><span>Identity and contact</span><p>{selected.email || "Email missing"} · DOB {selected.date_of_birth ? new Date(selected.date_of_birth).toLocaleDateString("en-IN") : "missing"}</p><p>{selected.current_address || "Address missing"} · {selected.service_radius_km ?? 0} km service radius</p></div>
          <div className="review-section"><span>Service pricing</span><div className="review-pricing">{selected.pricing?.filter((item) => item.enabled).map((item) => <b key={item.serviceId}>{item.serviceName}: ₹{item.price.toLocaleString("en-IN")}</b>) || <em>No prices submitted</em>}</div></div>
          <div className="review-section"><span>Private documents</span><div className="review-documents">{selected.documents?.map((document) => <div className={`document-review-row ${document.status.toLowerCase()}`} key={document.id}><button className="document-review-button" onClick={() => void openDocument(document.id)}><span><strong>{document.type.replaceAll("_", " ")}</strong><small>{document.name} · {document.status}{document.note ? ` · ${document.note}` : ""}</small></span><ExternalLink size={15} /></button><div><button className="mini-review verify" disabled={busy || document.status === "VERIFIED"} onClick={() => void reviewDocument(document.id, "VERIFIED")}>Verify</button><button className="mini-review reject" disabled={busy || document.status === "REJECTED"} onClick={() => void reviewDocument(document.id, "REJECTED")}>Reject</button></div></div>) || <em>No documents uploaded</em>}</div><small>Open the file first, then verify or reject it. Review links expire after five minutes.</small></div>
          <div className="review-section"><span>References</span>{selected.references?.map((reference) => <div className="admin-reference" key={reference.id}><strong>{reference.name}</strong><span>{reference.relationship} · {reference.organisation || "Independent reference"}</span><small>{reference.phone} · {reference.status}</small></div>) || <em>No references submitted</em>}</div>
          <div className="review-section"><span>Payout verification</span><p>{selected.payout_method === "BANK" ? `${selected.bank_account_name || "Account holder missing"} · IFSC ${selected.bank_ifsc || "missing"}` : `UPI ${selected.upi_id || "missing"}`}</p></div>
          <div className="verification-checklist"><h3>Admin verification checklist</h3>{([
            ["identityStatus","Identity review"], ["documentStatus","Document review"], ["referenceStatus","Reference verification"], ["knowledgeCheckStatus","Puja knowledge check"], ["bankStatus","Bank / UPI verification"],
          ] as Array<[keyof ReviewChecklist,string]>).map(([key,label]) => <label key={key}><span>{label}</span><select value={String(checklist[key] ?? "PENDING")} onChange={(event) => setChecklist({ ...checklist, [key]: event.target.value as CheckStatus })}><option>PENDING</option><option>VERIFIED</option><option>FAILED</option></select></label>)}<label><span>Knowledge score / 100</span><input type="number" min="0" max="100" value={checklist.knowledgeScore ?? ""} onChange={(e) => setChecklist({ ...checklist, knowledgeScore: e.target.value ? Number(e.target.value) : null })} /></label><button className="btn btn-ghost btn-block" disabled={busy} onClick={() => review("UPDATE_CHECKLIST")}>Save verification checklist</button></div>
          <label>Correction note <small>Required only when requesting changes</small><textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Clearly explain what information needs to be updated." /></label>
          {notice && <div className="alert error">{notice}</div>}
          <div className="review-actions multi"><button className="btn btn-ghost" disabled={busy} onClick={() => review("START_REVIEW")}>Start review</button><button className="btn btn-ghost danger" disabled={busy} onClick={() => review("REJECT")}>Reject</button><button className="btn btn-ghost danger" disabled={busy} onClick={() => review("REQUEST_CHANGES")}>Request changes</button><button className="btn btn-primary" disabled={busy || selected.verification_status === "INCOMPLETE"} onClick={() => review("APPROVE")}><Check size={17} /> Approve Pandit</button></div>
          {selected.verification_status === "INCOMPLETE" && <p className="privacy-note">This profile cannot be approved until the Pandit completes the required information.</p>}
        </>}
      </section>
    </div>}
  </AppShell>;
}
