"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, BadgeCheck, CalendarCheck, Check, Languages, MapPin, RefreshCw, ShieldCheck, Star, UserRound, Users, X } from "lucide-react";
import { AppShell } from "./app-shell";
import { readJson } from "@/lib/http";

type Overview = { stats: { users: number; pendingPandits: number; approvedPandits: number; bookings: number }; recent: Array<{ id: string; service_name: string; pandit_name: string; customer_phone: string; status: string; amount: number; created_at: string }>; approved: ReviewPandit[] };
type ReviewPandit = {
  id: string; name: string | null; phone: string; city: string | null; experience_years: number;
  languages: string[]; specialities: string[]; bio: string | null; base_charge: number;
  verification_status: string; review_note: string | null; created_at: string; is_online?: boolean;
  rating?: string; rating_count?: number; completed_jobs?: number; services?: string[];
};

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
    const response = await fetch(`/api/admin/overview?fresh=${Date.now()}`, { cache: "no-store" });
    const result = await readJson<Overview>(response);
    setData(result);
    setApproved(result.approved ?? []);
  }
  useEffect(() => {
    void load();
  }, []);

  async function openQueue() {
    setNotice("");
    setQueueOpen(true);
    await loadQueue();
  }

  async function review(action: "APPROVE" | "REQUEST_CHANGES") {
    if (!selected) return;
    setBusy(true); setNotice("");
    const response = await fetch("/api/admin/pandits", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ panditId: selected.id, action, note }),
    });
    const result = await readJson<{ error?: string }>(response);
    if (!response.ok) { setNotice(result.error ?? "Unable to save review"); setBusy(false); return; }
    setNotice(action === "APPROVE" ? `${selected.name ?? "Pandit"} approved successfully.` : "Changes requested successfully.");
    setSelected(null); setNote(""); setBusy(false); load();
  }

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
        {data?.recent.length ? <div className="table-wrap"><table><thead><tr><th>Puja</th><th>Pandit</th><th>Customer</th><th>Status</th><th>Amount</th></tr></thead><tbody>{data.recent.map((row) => <tr key={row.id}><td>{row.service_name}</td><td>{row.pandit_name}</td><td>••••{row.customer_phone.slice(-4)}</td><td><span className="status">{row.status}</span></td><td>₹{row.amount.toLocaleString("en-IN")}</td></tr>)}</tbody></table></div> : <div className="empty">No bookings yet.</div>}
      </div>
      <aside className="side-card"><h3>Review queue</h3><div className="queue-item"><span className="avatar">P</span><div><strong>{data?.stats.pendingPandits ?? 0} Pandit {(data?.stats.pendingPandits ?? 0) === 1 ? "profile" : "profiles"}</strong><small>Identity and experience review</small></div></div><button className="btn btn-primary btn-block" onClick={openQueue} disabled={queueLoading}>{queueLoading ? "Refreshing queue…" : "Open verification queue"}</button><p className="privacy-note">Review experience, languages and specialities before approval.</p></aside>
    </section>
    {notice && <div className="alert success admin-notice">{notice}</div>}
    <section className="history approved-directory" id="admin-pandits">
      <div className="section-title"><div><h2>Approved Pandits</h2><p>All active approved profiles remain visible here after leaving the review queue.</p></div><button className="btn btn-ghost" onClick={load}><RefreshCw size={16} /> Refresh</button></div>
      {approved.length ? <div className="approved-grid">{approved.map((pandit) => <article className="approved-card" key={pandit.id}>
        <div className="approved-head"><span className="avatar">{(pandit.name ?? "P").split(" ").map((part) => part[0]).slice(0,2).join("")}</span><div><strong>{pandit.name ?? "Pandit"}</strong><span><MapPin size={13} /> {pandit.city ?? "City not provided"}</span></div><span className={`availability-dot ${pandit.is_online ? "online" : ""}`}>{pandit.is_online ? "Online" : "Offline"}</span></div>
        <div className="approved-metrics"><span><b>{pandit.experience_years}</b> years</span><span><b>{pandit.rating_count ? <>{pandit.rating} <Star size={12} fill="currentColor" /></> : "New"}</b>{pandit.rating_count ? `${pandit.rating_count} ratings` : "not rated"}</span><span><b>{pandit.completed_jobs ?? 0}</b> visits</span></div>
        <div className="tag-row">{(pandit.services?.length ? pandit.services : pandit.specialities).slice(0,4).map((item) => <b key={item}>{item}</b>)}</div>
        <div className="approved-foot"><span>+91 ••••••{pandit.phone.slice(-4)}</span><strong>APPROVED</strong></div>
      </article>)}</div> : <div className="empty">No approved Pandits yet.</div>}
    </section>

    {queueOpen && <div className="review-overlay" role="dialog" aria-modal="true" aria-label="Pandit verification queue">
      <section className="review-drawer">
        <header><div><span className="eyebrow">Admin review</span><h2>{selected ? "Review Pandit profile" : "Pandit verification queue"}</h2></div><div className="drawer-actions">{!selected && <button className="icon-button" onClick={loadQueue} disabled={queueLoading} aria-label="Refresh queue"><RefreshCw size={18} className={queueLoading ? "spin" : ""} /></button>}<button className="icon-button" onClick={() => { setQueueOpen(false); setSelected(null); }} aria-label="Close queue"><X size={19} /></button></div></header>
        {!selected ? <>
          <p className="drawer-intro">{queueLoading ? "Refreshing the latest registrations…" : queue.length ? `${queue.length} profile${queue.length === 1 ? "" : "s"} waiting for a decision.` : "No Pandit profiles are waiting for review."}</p>
          <div className="review-list">{queue.map((pandit) => <button key={pandit.id} className="review-list-item" onClick={() => { setSelected(pandit); setNote(pandit.review_note ?? ""); }}>
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
          <label>Correction note <small>Required only when requesting changes</small><textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Clearly explain what information needs to be updated." /></label>
          {notice && <div className="alert error">{notice}</div>}
          <div className="review-actions"><button className="btn btn-ghost danger" disabled={busy} onClick={() => review("REQUEST_CHANGES")}>Request changes</button><button className="btn btn-primary" disabled={busy || selected.verification_status === "INCOMPLETE"} onClick={() => review("APPROVE")}><Check size={17} /> Approve Pandit</button></div>
          {selected.verification_status === "INCOMPLETE" && <p className="privacy-note">This profile cannot be approved until the Pandit completes the required information.</p>}
        </>}
      </section>
    </div>}
  </AppShell>;
}
