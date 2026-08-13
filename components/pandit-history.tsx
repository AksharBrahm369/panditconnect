"use client";

import { useEffect, useState } from "react";
import { readJson } from "@/lib/http";

type HistoryBooking = { id: string; service_name: string; status: string; amount: number; payment_status?: string; completed_at?: string | null; created_at: string };

export function PanditHistory() {
  const [items, setItems] = useState<HistoryBooking[]>([]);
  const [message, setMessage] = useState("");
  useEffect(() => { const timer = window.setTimeout(async () => { const response = await fetch("/api/bookings", { cache: "no-store" }); const data = await readJson<{ bookings?: HistoryBooking[]; error?: string }>(response); if (response.ok) setItems((data.bookings ?? []).filter((item) => ["COMPLETED", "CANCELLED", "DECLINED"].includes(item.status))); else setMessage(data.error ?? "Unable to load history."); }, 0); return () => window.clearTimeout(timer); }, []);
  const completed = items.filter((item) => item.status === "COMPLETED");
  const earnings = completed.reduce((total, item) => total + item.amount, 0);
  return <section className="settings-card pandit-history-page"><div className="history-summary"><span><small>Completed Pujas</small><strong>{completed.length}</strong></span><span><small>Recorded service value</small><strong>₹{earnings.toLocaleString("en-IN")}</strong></span></div>{message && <div className="alert error">{message}</div>}{items.length ? <div className="settings-history-list">{items.map((item) => <article key={item.id}><div><strong>{item.service_name}</strong><small>{new Date(item.completed_at ?? item.created_at).toLocaleDateString("en-IN")}</small></div><span>{item.status === "COMPLETED" ? `₹${item.amount.toLocaleString("en-IN")}` : item.status === "CANCELLED" ? "Cancelled" : "Declined"}</span></article>)}</div> : <div className="empty">No completed or closed bookings yet.</div>}</section>;
}
