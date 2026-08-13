"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, BadgeCheck, CalendarCheck, Check, ExternalLink, Headphones, Languages, MapPin, RefreshCw, ShieldAlert, ShieldCheck, Star, UserRound, Users, X } from "lucide-react";
import { AppShell } from "./app-shell";
import { readJson } from "@/lib/http";
import { AdminPrivacyRequests } from "./admin-privacy-requests";
import { AdminFinanceOperations } from "./admin-finance-operations";

type Overview = { stats: { users: number; pendingPandits: number; approvedPandits: number; bookings: number }; risk:{outstanding_balance:number;restricted_customers:number;open_disputes:number}; funnel:{requests:number;accepted:number;completed:number;cancelled:number;acceptance_rate:number;completion_rate:number;avg_match_minutes:number;push_success_rate:number}; recent: Array<{ id: string; service_name: string; pandit_name: string; customer_phone: string; status: string; amount: number; created_at: string; request_type: string; scheduled_at: string | null }> };
type ReviewPandit = {
  id: string; name: string | null; phone: string | null; city: string | null; experience_years: number;
  languages: string[]; specialities: string[]; bio: string | null; base_charge: number;
  verification_status: string; review_note: string | null; created_at: string; is_online?: boolean;
  rating?: string; rating_count?: number; completed_jobs?: number; services?: string[]; account_status?: "ACTIVE" | "RESTRICTED" | "BLOCKED" | "DELETION_REQUESTED" | "DELETED";
  account_status_reason?: string | null; account_status_changed_at?: string | null;
  deletion_request_id?: string | null; deletion_request_status?: "OPEN" | "IN_REVIEW" | null; deletion_requested_at?: string | null;
  email?: string; date_of_birth?: string; current_address?: string; service_radius_km?: number; payout_method?: string; bank_account_name?: string; bank_ifsc?: string; upi_id?: string; submitted_at?: string;
  references?: Array<{ id: string; name: string; relationship: string; organisation: string | null; phone: string; status: string; note: string | null }>;
  documents?: Array<{ id: string; type: string; name: string; mimeType: string; size: number; status: string; note: string | null }>;
  pricing?: Array<{ serviceId: string; serviceName: string; price: number; enabled: boolean }>;
  review?: ReviewChecklist;
};
type SupportCase = { id:string; category:string; subject:string; description:string; priority:string; status:string; resolution:string|null; booking_id:string|null; created_at:string; reporter_name:string|null; reporter_role:string; reporter_phone:string;cancellation_fee?:number;cancellation_fee_status?:string };
type CheckStatus = "PENDING" | "VERIFIED" | "FAILED";
type ReviewChecklist = { identityStatus: CheckStatus; documentStatus: CheckStatus; referenceStatus: CheckStatus; knowledgeCheckStatus: CheckStatus; bankStatus: CheckStatus; knowledgeScore?: number | null; adminNote?: string | null; identityMethod?:string|null;identityReference?:string|null;bankMethod?:string|null;bankReference?:string|null;referenceCheckedAt?:string|null };
const emptyChecklist: ReviewChecklist = { identityStatus: "PENDING", documentStatus: "PENDING", referenceStatus: "PENDING", knowledgeCheckStatus: "PENDING", bankStatus: "PENDING", knowledgeScore: null, adminNote: "",identityMethod:"",identityReference:"",bankMethod:"",bankReference:"" };

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
  const [queuePage, setQueuePage] = useState(1);
  const [queueHasMore, setQueueHasMore] = useState(false);
  const [queueTotal, setQueueTotal] = useState<number | null>(null);
  const [approvedLoading, setApprovedLoading] = useState(false);
  const [approvedPage, setApprovedPage] = useState(1);
  const [approvedHasMore, setApprovedHasMore] = useState(false);
  const [checklist, setChecklist] = useState<ReviewChecklist>(emptyChecklist);
  const [supportCases,setSupportCases]=useState<SupportCase[]>([]);
  const [deletionFocus,setDeletionFocus]=useState<string|null>(null);

  async function loadQueue(page = 1, append = false) {
    setQueueLoading(true);
    try {
      const response = await fetch(`/api/admin/pandits?page=${page}&limit=12&fresh=${Date.now()}`, { cache: "no-store" });
      const result = await readJson<{ pandits?: ReviewPandit[]; total?: number; hasMore?: boolean; error?: string }>(response);
      if (!response.ok) throw new Error(result.error ?? "Unable to refresh queue");
      setQueue((current) => append ? [...current, ...(result.pandits ?? [])] : (result.pandits ?? []));
      setQueueTotal(Number(result.total ?? result.pandits?.length ?? 0));
      setQueuePage(page);
      setQueueHasMore(Boolean(result.hasMore));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to refresh queue");
    } finally {
      setQueueLoading(false);
    }
  }

  const loadApproved = useCallback(async (page = 1, append = false) => {
    setApprovedLoading(true);
    try {
      const response = await fetch(`/api/admin/pandits?scope=approved&page=${page}&limit=12&fresh=${Date.now()}`, { cache: "no-store" });
      const result = await readJson<{ pandits?: ReviewPandit[]; hasMore?: boolean; error?: string }>(response);
      if (!response.ok) throw new Error(result.error ?? "Unable to load approved Pandits");
      setApproved((current) => append ? [...current, ...(result.pandits ?? [])] : (result.pandits ?? []));
      setApprovedPage(page);
      setApprovedHasMore(Boolean(result.hasMore));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load approved Pandits");
    } finally {
      setApprovedLoading(false);
    }
  }, []);

  const refreshQueueTotal = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/pandits?page=1&limit=4&fresh=${Date.now()}`, { cache: "no-store" });
      const result = await readJson<{ pandits?: ReviewPandit[]; total?: number }>(response);
      if (response.ok) setQueueTotal(Number(result.total ?? result.pandits?.length ?? 0));
    } catch {
      // Keep the last confirmed queue total during a temporary network failure.
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const [response, supportResponse] = await Promise.all([
        fetch(`/api/admin/overview?fresh=${Date.now()}`, { cache: "no-store" }),
        fetch(`/api/admin/support-cases?fresh=${Date.now()}`, { cache: "no-store" }),
      ]);
      const result = await readJson<Partial<Overview> & { error?: string }>(response);
      const support = await readJson<{ cases?: SupportCase[]; error?: string }>(supportResponse);
      if (response.status === 401 || response.status === 403) {
        window.location.assign("/admin/login?reason=session");
        return;
      }
      if (!response.ok || !result.stats || !result.risk || !result.funnel || !Array.isArray(result.recent)) {
        setNotice(result.error ?? "Unable to load the admin workspace. Please refresh and try again.");
        return;
      }
      setData(result as Overview);
      if (supportResponse.ok) setSupportCases(support.cases ?? []);
      await loadApproved(1);
    } catch {
      setNotice("The admin workspace could not connect to the server. Please refresh and try again.");
    }
  }, [loadApproved]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
      void refreshQueueTotal();
    }, 0);
    const interval = window.setInterval(() => void refreshQueueTotal(), 30_000);
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") void refreshQueueTotal(); };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [load, refreshQueueTotal]);

  async function openQueue() {
    setNotice("");
    setQueueOpen(true);
    await loadQueue(1);
  }

  async function review(action: "APPROVE" | "REJECT" | "REQUEST_CHANGES" | "START_REVIEW" | "UPDATE_CHECKLIST") {
    if (!selected) return;
    setBusy(true); setNotice("");
    if (action === "APPROVE") {
      const requiredChecks: Array<[keyof ReviewChecklist, string]> = [
        ["identityStatus", "Identity review"],
        ["documentStatus", "Document review"],
        ["referenceStatus", "Reference verification"],
        ["knowledgeCheckStatus", "Puja knowledge check"],
        ["bankStatus", "Bank / UPI verification"],
      ];
      const missing = requiredChecks.filter(([key]) => checklist[key] !== "VERIFIED").map(([, label]) => label);
      if (missing.length) {
        setNotice(`Complete these checks before approval: ${missing.join(", ")}.`);
        setBusy(false);
        return;
      }
      if (!checklist.identityMethod?.trim() || !checklist.identityReference?.trim()) {
        setNotice("Choose how the identity was verified and add a safe masked reference before approval.");
        setBusy(false);
        return;
      }
      if (!checklist.bankMethod?.trim() || !checklist.bankReference?.trim()) {
        setNotice("Choose how the bank or UPI account was verified and add a safe masked reference before approval.");
        setBusy(false);
        return;
      }
      const checklistResponse = await fetch("/api/admin/pandits", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ panditId: selected.id, action: "UPDATE_CHECKLIST", note, ...checklist }),
      });
      const checklistResult = await readJson<{ error?: string }>(checklistResponse);
      if (!checklistResponse.ok) {
        setNotice(checklistResult.error ?? "Unable to save the verification checklist");
        setBusy(false);
        return;
      }
    }
    const response = await fetch("/api/admin/pandits", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ panditId: selected.id, action, note, ...(action === "UPDATE_CHECKLIST" ? checklist : {}) }),
    });
    const result = await readJson<{ error?: string }>(response);
    if (!response.ok) { setNotice(result.error ?? "Unable to save review"); setBusy(false); return; }
    setNotice(action === "APPROVE" ? `${selected.name ?? "Pandit"} approved successfully.` : action === "UPDATE_CHECKLIST" ? "Verification checklist saved." : "Review decision saved.");
    if (action !== "UPDATE_CHECKLIST") { setSelected(null); setNote(""); }
    setBusy(false); await load(); await loadQueue(1);
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
    setBusy(false); await loadQueue(1);
  }

  function selectPandit(pandit: ReviewPandit) { setSelected(pandit); setNote(pandit.review_note ?? pandit.review?.adminNote ?? ""); setChecklist({ ...emptyChecklist, ...(pandit.review ?? {}) }); }
  async function updateCase(caseId:string,status:"IN_REVIEW"|"RESOLVED") { const supportCase=supportCases.find(item=>item.id===caseId);const resolution=status==="IN_REVIEW"?"":window.prompt("Resolution or outcome:")?.trim(); if(status==="RESOLVED"&&!resolution)return;const hasReviewableFee=Boolean(status==="RESOLVED"&&supportCase?.cancellation_fee&&["OUTSTANDING","DISPUTED"].includes(supportCase.cancellation_fee_status??""));const waiveCancellationFee=Boolean(hasReviewableFee&&window.confirm(`Should the ₹${supportCase?.cancellation_fee} cancellation charge be waived? Choose OK to waive it, or Cancel to uphold it.`));const upholdCancellationFee=Boolean(hasReviewableFee&&!waiveCancellationFee&&supportCase?.cancellation_fee_status==="DISPUTED"); setBusy(true);const response=await fetch("/api/admin/support-cases",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({caseId,status,resolution,waiveCancellationFee,upholdCancellationFee})});const result=await readJson<{error?:string}>(response);setNotice(response.ok?waiveCancellationFee?"Support case resolved and cancellation charge waived.":upholdCancellationFee?"Support case resolved and charge upheld.":"Support case updated.":result.error??"Unable to update case");setBusy(false);await load(); }
  async function changePanditAccess(panditId:string,action:"BLOCK"|"RESTRICT"|"UNBLOCK") {
    const reason = action === "UNBLOCK" ? undefined : window.prompt(action === "BLOCK" ? "Why are you blocking this Pandit? This reason will be shown to them." : "Why are you restricting this Pandit? This reason will be shown to them.")?.trim();
    if (action !== "UNBLOCK" && (!reason || reason.length < 5)) return;
    const message = action === "BLOCK"
      ? "Block this Pandit? They will be taken offline, removed from customer searches and unable to use marketplace features until Admin unblocks them."
      : action === "RESTRICT"
        ? "Restrict this Pandit? They will be taken offline and unable to receive Puja or chat requests until Admin restores access."
        : "Restore this Pandit's access? They will remain offline until they choose to go online.";
    if (!window.confirm(message)) return;
    setBusy(true);
    const response = await fetch("/api/admin/support-cases", { method:"PATCH", headers:{"content-type":"application/json"}, body:JSON.stringify({panditId,accountAction:action,accountReason:reason}) });
    const result = await readJson<{error?:string}>(response);
    const success = action === "BLOCK" ? "Pandit blocked and removed from the marketplace." : action === "RESTRICT" ? "Pandit restricted and removed from new requests." : "Pandit unblocked. They can use the portal again and will remain offline until ready.";
    setNotice(response.ok ? success : result.error ?? "Unable to update Pandit access");
    setBusy(false);
    await load();
  }

  function reviewDeletionRequest(requestId:string){
    setDeletionFocus(requestId);
    window.setTimeout(()=>document.getElementById("admin-privacy")?.scrollIntoView({behavior:"smooth",block:"start"}),0);
  }

  const pendingPanditCount = queueTotal ?? data?.stats.pendingPandits ?? 0;

  return <AppShell role="Admin" title="Operations overview" subtitle="A compact control room for verification, urgent bookings and platform health.">
    <div className="demo-banner"><ShieldCheck size={17} /><div><strong>Protected operations workspace</strong><span>Customer phone numbers remain masked while you review bookings and Pandit quality.</span></div></div>
    <section className="stat-grid admin-stats">
      <article><Users size={21} /><span>Registered users</span><strong>{data?.stats.users ?? "—"}</strong></article>
      <article><ShieldCheck size={21} /><span>Pandits to review</span><strong>{queueTotal ?? data?.stats.pendingPandits ?? "—"}</strong></article>
      <article><CalendarCheck size={21} /><span>Total bookings</span><strong>{data?.stats.bookings ?? "—"}</strong></article>
      <article><BadgeCheck size={21} /><span>Approved Pandits</span><strong>{data?.stats.approvedPandits ?? approved.length}</strong></article>
    </section>
    <section className="admin-risk-strip"><span><small>Outstanding charges</small><strong>₹{(data?.risk.outstanding_balance??0).toLocaleString("en-IN")}</strong></span><span><small>Restricted customers</small><strong>{data?.risk.restricted_customers??0}</strong></span><span><small>Open booking disputes</small><strong>{data?.risk.open_disputes??0}</strong></span></section>
    <section className="admin-funnel"><header><div><span className="eyebrow">Last 30 days</span><h2>Marketplace health</h2></div><small>Operational totals only; no advertising trackers.</small></header><div><span><small>Requests</small><strong>{data?.funnel.requests??0}</strong></span><span><small>Accepted</small><strong>{data?.funnel.acceptance_rate??0}%</strong></span><span><small>Completed</small><strong>{data?.funnel.completion_rate??0}%</strong></span><span><small>Avg. match</small><strong>{data?.funnel.avg_match_minutes??0} min</strong></span><span><small>Push delivered</small><strong>{data?.funnel.push_success_rate??0}%</strong></span><span><small>Cancelled / declined</small><strong>{data?.funnel.cancelled??0}</strong></span></div></section>
    <section className="workspace admin-workspace" id="admin-bookings">
      <div className="workspace-main"><div className="section-title"><div><h2>Recent bookings</h2><p>Monitor status without exposing customer contact details.</p></div></div>
        {data?.recent.length ? <div className="table-wrap admin-bookings-table"><table><thead><tr><th>Puja</th><th>When</th><th>Pandit</th><th>Customer</th><th>Status</th><th>Amount</th></tr></thead><tbody>{data.recent.map((row) => <tr key={row.id}><td data-label="Puja">{row.service_name}</td><td data-label="When">{row.scheduled_at ? new Date(row.scheduled_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Urgent / now"}</td><td data-label="Pandit">{row.pandit_name}</td><td data-label="Customer">••••{row.customer_phone.slice(-4)}</td><td data-label="Status"><span className="status">{row.status}</span></td><td data-label="Amount">₹{row.amount.toLocaleString("en-IN")}</td></tr>)}</tbody></table></div> : <div className="empty">No bookings yet.</div>}
      </div>
      <aside className="side-card"><h3>Review queue</h3><div className="queue-item"><span className="avatar">P</span><div><strong>{pendingPanditCount} Pandit {pendingPanditCount === 1 ? "profile" : "profiles"}</strong><small>Identity and experience review</small></div></div><button className="btn btn-primary btn-block" onClick={openQueue} disabled={queueLoading}>{queueLoading ? "Refreshing queue…" : "Open verification queue"}</button><p className="privacy-note">Review experience, languages and specialities before approval.</p></aside>
    </section>
    {notice && <div className="alert success admin-notice">{notice}</div>}
    <section className="history admin-support" id="admin-support"><div className="section-title"><div><h2>Support and safety cases</h2><p>Urgent reports appear first and every decision is audited.</p></div><span className="live-pill"><i /> {supportCases.filter(item=>["OPEN","IN_REVIEW"].includes(item.status)).length} open</span></div>{supportCases.length?<div className="admin-support-list">{supportCases.map(item=><article key={item.id} className={item.priority==="URGENT"?"urgent":""}><span>{item.priority==="URGENT"?<ShieldAlert/>:<Headphones/>}</span><div><strong>{item.subject}</strong><small>{item.reporter_role} · ••••{item.reporter_phone} · {item.category.replaceAll("_"," ")}</small><p>{item.description}</p>{Boolean(item.cancellation_fee)&&<em>Cancellation charge: ₹{item.cancellation_fee} · {item.cancellation_fee_status}</em>}{item.resolution&&<em>Resolution: {item.resolution}</em>}</div><span className="status">{item.status.replaceAll("_"," ")}</span><div className="button-row">{item.status==="OPEN"&&<button className="btn btn-ghost" disabled={busy} onClick={()=>void updateCase(item.id,"IN_REVIEW")}>Start review</button>}{!["RESOLVED","CLOSED"].includes(item.status)&&<button className="btn btn-primary" disabled={busy} onClick={()=>void updateCase(item.id,"RESOLVED")}>Resolve</button>}</div></article>)}</div>:<div className="empty">No support cases yet.</div>}</section>
    <section className="history approved-directory" id="admin-pandits">
      <div className="section-title"><div><h2>All verified Pandits</h2><p>Review active, restricted and blocked profiles. Profiles load in small batches to keep this workspace fast.</p></div><button className="btn btn-ghost" onClick={() => void loadApproved(1)} disabled={approvedLoading}><RefreshCw size={16} className={approvedLoading ? "spin" : ""} /> Refresh</button></div>
      {approved.length ? <div className="approved-grid">{approved.map((pandit) => <article className="approved-card" key={pandit.id}>
        <div className="approved-head"><span className="avatar">{(pandit.name ?? "P").split(" ").map((part) => part[0]).slice(0,2).join("")}</span><div><strong>{pandit.name ?? "Pandit"}</strong><span><MapPin size={13} /> {pandit.city ?? "City not provided"}</span></div><span className={`availability-dot ${pandit.is_online ? "online" : ""}`}>{pandit.is_online ? "Online" : "Offline"}</span></div>
        <div className="approved-metrics"><span><b>{pandit.experience_years}</b> years</span><span><b>{pandit.rating_count ? <>{pandit.rating} <Star size={12} fill="currentColor" /></> : "New"}</b>{pandit.rating_count ? `${pandit.rating_count} ratings` : "not rated"}</span><span><b>{pandit.completed_jobs ?? 0}</b> visits</span></div>
        <div className="tag-row">{(pandit.services?.length ? pandit.services : pandit.specialities).slice(0,4).map((item) => <b key={item}>{item}</b>)}</div>
        <div className="approved-foot"><span>{pandit.phone ? `+91 ••••••${pandit.phone.slice(-4)}` : pandit.email ?? "Google account"}</span><strong className={`admin-access-status ${(pandit.account_status ?? "ACTIVE").toLowerCase()}`}>{pandit.account_status ?? "ACTIVE"}</strong></div>
        {pandit.account_status !== "ACTIVE" && pandit.account_status_reason && <p className="admin-access-reason"><strong>Admin reason:</strong> {pandit.account_status_reason}</p>}
        {pandit.account_status === "DELETION_REQUESTED" && <div className="admin-deletion-pending"><strong>Account deletion needs your decision</strong><span>The profile remains stored for review but is hidden from customer searches. Approve only after checking active services and balances.</span>{pandit.deletion_requested_at&&<small>Requested {new Date(pandit.deletion_requested_at).toLocaleString("en-IN")}</small>}</div>}
        <div className="button-row admin-access-actions">
          {(pandit.account_status ?? "ACTIVE") === "ACTIVE" && <><button className="btn btn-ghost" disabled={busy} onClick={()=>void changePanditAccess(pandit.id,"RESTRICT")}>Restrict</button><button className="btn btn-ghost danger" disabled={busy} onClick={()=>void changePanditAccess(pandit.id,"BLOCK")}>Block</button></>}
          {pandit.account_status === "RESTRICTED" && <><button className="btn btn-ghost" disabled={busy} onClick={()=>void changePanditAccess(pandit.id,"UNBLOCK")}>Restore access</button><button className="btn btn-ghost danger" disabled={busy} onClick={()=>void changePanditAccess(pandit.id,"BLOCK")}>Block</button></>}
          {pandit.account_status === "BLOCKED" && <button className="btn btn-primary btn-block" disabled={busy} onClick={()=>void changePanditAccess(pandit.id,"UNBLOCK")}>Unblock Pandit</button>}
          {pandit.account_status === "DELETION_REQUESTED" && pandit.deletion_request_id && <button className="btn btn-primary btn-block" disabled={busy} onClick={()=>reviewDeletionRequest(pandit.deletion_request_id!)}>Review deletion request</button>}
        </div>
      </article>)}</div> : <div className="empty"><strong>No approved Pandits yet.</strong><span>Submitted applications remain in the Review queue until Admin completes verification and approves them.</span></div>}
      {approvedHasMore && <button className="btn btn-ghost btn-block" disabled={approvedLoading} onClick={() => void loadApproved(approvedPage + 1, true)}>{approvedLoading ? "Loading more…" : "Load more approved Pandits"}</button>}
    </section>
    <AdminPrivacyRequests focusRequestId={deletionFocus} onChanged={()=>{setDeletionFocus(null);void load();}} />
    <AdminFinanceOperations />

    {queueOpen && <div className="review-overlay" role="dialog" aria-modal="true" aria-label="Pandit verification queue">
      <section className="review-drawer">
        <header><div><span className="eyebrow">Admin review</span><h2>{selected ? "Review Pandit profile" : "Pandit verification queue"}</h2></div><div className="drawer-actions">{!selected && <button className="icon-button" onClick={() => void loadQueue(1)} disabled={queueLoading} aria-label="Refresh queue"><RefreshCw size={18} className={queueLoading ? "spin" : ""} /></button>}<button className="icon-button" onClick={() => { setQueueOpen(false); setSelected(null); }} aria-label="Close queue"><X size={19} /></button></div></header>
        {!selected ? <>
          <p className="drawer-intro">{queueLoading ? "Refreshing the latest registrations…" : pendingPanditCount ? `${pendingPanditCount} profile${pendingPanditCount === 1 ? "" : "s"} waiting for a decision.` : "No Pandit profiles are waiting for review."}</p>
          <div className="review-list">{queue.map((pandit) => <button key={pandit.id} className="review-list-item" onClick={() => selectPandit(pandit)}>
            <span className="avatar">{(pandit.name ?? "P").split(" ").map((part) => part[0]).slice(0,2).join("")}</span>
            <div><strong>{pandit.name ?? "Profile not completed"}</strong><span><MapPin size={13} /> {pandit.city ?? "City missing"} · {pandit.experience_years} years</span><small>{pandit.specialities.length ? pandit.specialities.join(", ") : "Specialities not added"}</small></div>
            <span className="status">{pandit.verification_status.replaceAll("_", " ")}</span>
          </button>)}</div>
          {queueHasMore && <button className="btn btn-ghost btn-block" disabled={queueLoading} onClick={() => void loadQueue(queuePage + 1, true)}>{queueLoading ? "Loading more…" : "Load more applications"}</button>}
        </> : <>
          <button className="back-review" onClick={() => setSelected(null)}><ArrowLeft size={16} /> Back to queue</button>
          <div className="review-profile-head"><span className="avatar large">{(selected.name ?? "P").split(" ").map((part) => part[0]).slice(0,2).join("")}</span><div><h3>{selected.name ?? "Incomplete profile"}</h3><p>{selected.phone ? `+91 ••••••${selected.phone.slice(-4)}` : selected.email ?? "Google account"} · Applied {new Date(selected.created_at).toLocaleDateString("en-IN")}</p></div><span className="status">{selected.verification_status.replaceAll("_", " ")}</span></div>
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
           <div className="verification-checklist"><h3>Admin verification checklist</h3><p className="verification-help">Review each item and mark it verified only after checking the supporting information. The approval button will save this checklist automatically.</p>{([
             ["identityStatus","Identity review"], ["documentStatus","Document review"], ["referenceStatus","Reference verification"], ["knowledgeCheckStatus","Puja knowledge check"], ["bankStatus","Bank / UPI verification"],
           ] as Array<[keyof ReviewChecklist,string]>).map(([key,label]) => <label key={key}><span>{label}</span><select value={String(checklist[key] ?? "PENDING")} onChange={(event) => setChecklist({ ...checklist, [key]: event.target.value as CheckStatus })}><option value="PENDING">Pending</option><option value="VERIFIED">Verified</option><option value="FAILED">Failed</option></select></label>)}
           {checklist.identityStatus === "VERIFIED" && <div className="verification-evidence"><h4>Identity evidence</h4><p>Record how you checked the ID. Never enter the complete Aadhaar, PAN or document number.</p><label><span>How was it checked?</span><select value={checklist.identityMethod??""} onChange={(e)=>setChecklist({...checklist,identityMethod:e.target.value})}><option value="">Choose method</option><option>Original ID checked</option><option>Video KYC completed</option><option>Verification provider result</option></select></label><label><span>Safe reference</span><input value={checklist.identityReference??""} onChange={(e)=>setChecklist({...checklist,identityReference:e.target.value})} placeholder="Example: Aadhaar ending 1234"/><small>Use only the last four digits or a provider result ID.</small></label></div>}
           {checklist.bankStatus === "VERIFIED" && <div className="verification-evidence"><h4>Bank / UPI evidence</h4><p>Record how the payout owner was matched without storing full account details.</p><label><span>How was it checked?</span><select value={checklist.bankMethod??""} onChange={(e)=>setChecklist({...checklist,bankMethod:e.target.value})}><option value="">Choose method</option><option>UPI name matched</option><option>Cancelled cheque checked</option><option>Bank penny-drop verified</option></select></label><label><span>Safe reference</span><input value={checklist.bankReference??""} onChange={(e)=>setChecklist({...checklist,bankReference:e.target.value})} placeholder="Example: account ending 6789"/><small>Use only masked details or a verification result ID.</small></label></div>}
           {checklist.knowledgeCheckStatus === "VERIFIED" && <label><span>Knowledge score / 100</span><input type="number" min="0" max="100" value={checklist.knowledgeScore ?? ""} onChange={(e) => setChecklist({ ...checklist, knowledgeScore: e.target.value ? Number(e.target.value) : null })} /></label>}<button className="btn btn-ghost btn-block" disabled={busy} onClick={() => review("UPDATE_CHECKLIST")}>Save verification checklist</button></div>
          <label>Correction note <small>Required only when requesting changes</small><textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Clearly explain what information needs to be updated." /></label>
          {notice && <div className="alert error">{notice}</div>}
          <div className="review-actions multi"><button className="btn btn-ghost" disabled={busy} onClick={() => review("START_REVIEW")}>Start review</button><button className="btn btn-ghost danger" disabled={busy} onClick={() => review("REJECT")}>Reject</button><button className="btn btn-ghost danger" disabled={busy} onClick={() => review("REQUEST_CHANGES")}>Request changes</button><button className="btn btn-primary" disabled={busy || selected.verification_status === "INCOMPLETE"} onClick={() => review("APPROVE")}><Check size={17} /> Approve Pandit</button></div>
          {selected.verification_status === "INCOMPLETE" && <p className="privacy-note">This profile cannot be approved until the Pandit completes the required information.</p>}
        </>}
      </section>
    </div>}
  </AppShell>;
}
