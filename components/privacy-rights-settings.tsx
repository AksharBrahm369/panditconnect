"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, FileX2, LogOut, ShieldCheck, Trash2 } from "lucide-react";
import { readJson } from "@/lib/http";

type RequestItem={id:string;request_type:string;status:string;resolution:string|null;requested_at:string;completed_at:string|null};

export function PrivacyRightsSettings({role}:{role:"CUSTOMER"|"PANDIT"}){
  const [requests,setRequests]=useState<RequestItem[]>([]);const [busy,setBusy]=useState("");const [message,setMessage]=useState("");const [error,setError]=useState("");const [confirmation,setConfirmation]=useState("");const [deletionSubmitted,setDeletionSubmitted]=useState(false);
  async function load(){const response=await fetch("/api/account/privacy",{cache:"no-store"});const data=await readJson<{requests?:RequestItem[]}>(response);if(response.ok)setRequests(data.requests??[]);}
  useEffect(()=>{const timer=window.setTimeout(()=>void load(),0);return()=>window.clearTimeout(timer);},[]);
  async function submit(requestType:string){setBusy(requestType);setMessage("");setError("");const response=await fetch("/api/account/privacy",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({requestType})});const result=await readJson<{error?:string}>(response);if(!response.ok){setError(result.error??"Unable to submit this request.");setBusy("");return;}if(requestType==="ACCOUNT_DELETION"){setDeletionSubmitted(true);setBusy("");window.setTimeout(()=>window.location.assign("/"),5000);return;}setMessage("Your privacy request has been recorded.");setBusy("");await load();}
  async function closeSessions(){setBusy("SESSIONS");const response=await fetch("/api/account/sessions",{method:"DELETE"});if(response.ok)window.location.assign("/");else{setError("Unable to close sessions.");setBusy("");}}
  if(deletionSubmitted)return <section className="private-settings-card privacy-deletion-submitted"><span><ShieldCheck/></span><h2>Deletion request sent to Admin</h2><p>Your profile has not been deleted yet. It is hidden from new customer requests while an authorised Admin checks active services and balances. Deletion happens only after Admin approval; then the private profile is removed and the account anonymised.</p><small>You have been securely signed out. Returning to the home page…</small><Link className="btn btn-primary" href="/">Go to home page</Link></section>;
  return <section className="private-settings-card privacy-rights-card"><div className="private-card-heading"><span><ShieldCheck/></span><div><h2>Your privacy choices</h2><p>Download your information, withdraw optional consent, or request deletion.</p></div></div>
    <div className="privacy-action-list">
      <article><Download/><span><strong>Download my data</strong><small>Receive a private JSON copy of your profile, bookings, chats, alerts, support cases and consent history.</small></span><a className="btn btn-ghost" href="/api/account/data-export" download>Download</a></article>
      <article><ShieldCheck/><span><strong>Withdraw optional marketing consent</strong><small>Service, safety and booking messages remain enabled because they are needed to operate your account.</small></span><button className="btn btn-ghost" disabled={Boolean(busy)} onClick={()=>void submit("CONSENT_WITHDRAWAL")}>Withdraw</button></article>
      <article><LogOut/><span><strong>Sign out every device</strong><small>Immediately closes every active phone and laptop session, including this one.</small></span><button className="btn btn-ghost" disabled={Boolean(busy)} onClick={()=>void closeSessions()}>{busy==="SESSIONS"?"Closing…":"Close sessions"}</button></article>
      {role==="PANDIT"&&<article><FileX2/><span><strong>Request document deletion</strong><small>Admin will review retention obligations before securely removing private verification files.</small></span><button className="btn btn-ghost" disabled={Boolean(busy)} onClick={()=>void submit("DOCUMENT_DELETION")}>{busy==="DOCUMENT_DELETION"?"Submitting…":"Request"}</button></article>}
    </div>
    <div className="privacy-danger-zone"><Trash2/><div><strong>Request account deletion</strong><p>This sends a request to an authorised Admin; it does not instantly delete your profile. Active bookings and outstanding disputes must be resolved first. After approval, private profile data is removed and required transaction or safety records may be retained only in anonymised form.</p><label>Type DELETE to confirm<input value={confirmation} onChange={event=>setConfirmation(event.target.value)} autoComplete="off"/></label><button className="btn danger-button" disabled={confirmation!=="DELETE"||Boolean(busy)} onClick={()=>void submit("ACCOUNT_DELETION")}>{busy==="ACCOUNT_DELETION"?"Sending request…":"Send deletion request to Admin"}</button></div></div>
    {error&&<div className="alert error" role="alert">{error}</div>}{message&&<div className="alert success">{message}</div>}
    {requests.length>0&&<div className="privacy-request-history"><h3>Request history</h3>{requests.map(item=><div key={item.id}><span><strong>{item.request_type.replaceAll("_"," ")}</strong><small>{new Date(item.requested_at).toLocaleString("en-IN")}</small></span><b>{item.status.replaceAll("_"," ")}</b>{item.resolution&&<p>{item.resolution}</p>}</div>)}</div>}
  </section>;
}
