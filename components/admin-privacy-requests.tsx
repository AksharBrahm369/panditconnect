"use client";

import { useEffect, useState } from "react";
import { Download, ShieldCheck } from "lucide-react";
import { readJson } from "@/lib/http";

type PrivacyRequest={id:string;request_type:string;status:string;details:string|null;resolution:string|null;requested_at:string;role:string;name:string|null;phone:string|null;email:string|null};

export function AdminPrivacyRequests(){
  const [items,setItems]=useState<PrivacyRequest[]>([]);const [busy,setBusy]=useState("");const [notice,setNotice]=useState("");
  async function load(){const response=await fetch(`/api/admin/privacy-requests?fresh=${Date.now()}`,{cache:"no-store"});const data=await readJson<{requests?:PrivacyRequest[];error?:string}>(response);if(response.ok)setItems(data.requests??[]);else setNotice(data.error??"Unable to load privacy requests");}
  useEffect(()=>{const timer=window.setTimeout(()=>void load(),0);return()=>window.clearTimeout(timer);},[]);
  async function act(item:PrivacyRequest,action:"START_REVIEW"|"COMPLETE"|"REJECT"){
    const resolution=action==="START_REVIEW"?"":window.prompt(action==="COMPLETE"?"Describe what was deleted or completed:":"Explain why this request cannot be completed:")?.trim();if(action!=="START_REVIEW"&&!resolution)return;
    if(action==="COMPLETE"&&item.request_type==="ACCOUNT_DELETION"&&!window.confirm("This permanently anonymises the account and deletes private profile documents. Continue?"))return;
    setBusy(item.id);const response=await fetch("/api/admin/privacy-requests",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({requestId:item.id,action,resolution})});const data=await readJson<{error?:string}>(response);setNotice(response.ok?"Privacy request updated.":data.error??"Unable to update privacy request");setBusy("");await load();
  }
  return <section className="history admin-privacy" id="admin-privacy"><div className="section-title"><div><h2>Privacy rights requests</h2><p>Exports are self-service. Deletion and consent requests are reviewed and audited here.</p></div><ShieldCheck size={22}/></div>{notice&&<div className="alert success">{notice}</div>}{items.length?<div className="admin-privacy-list">{items.map(item=><article key={item.id}><div><strong>{item.request_type.replaceAll("_"," ")}</strong><span>{item.role} · {item.name??"Unnamed"} · {item.phone ? `••••${item.phone.slice(-4)}` : item.email ?? "Google account"}</span><small>Requested {new Date(item.requested_at).toLocaleString("en-IN")}</small>{item.details&&<p>{item.details}</p>}{item.resolution&&<em>{item.resolution}</em>}</div><span className="status">{item.status.replaceAll("_"," ")}</span><div className="button-row">{item.status==="OPEN"&&<button className="btn btn-ghost" disabled={busy===item.id} onClick={()=>void act(item,"START_REVIEW")}>Start review</button>}{["OPEN","IN_REVIEW"].includes(item.status)&&<><button className="btn btn-ghost danger" disabled={busy===item.id} onClick={()=>void act(item,"REJECT")}>Reject</button><button className="btn btn-primary" disabled={busy===item.id} onClick={()=>void act(item,"COMPLETE")}><Download size={15}/> Complete</button></>}</div></article>)}</div>:<div className="empty">No privacy requests yet.</div>}</section>;
}
