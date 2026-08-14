"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Phone, Send, X } from "lucide-react";
import { readJson } from "@/lib/http";

type BookingMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender_name: string | null;
  sender_role: string;
};

export function BookingChat({ bookingId, participantName, role, phone }: {
  bookingId: string;
  participantName: string;
  role: "CUSTOMER" | "PANDIT";
  phone?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<BookingMessage[]>([]);
  const [userId, setUserId] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const newestMessageId = messages.at(-1)?.id;

  const loadMessages = useCallback(async () => {
    const response = await fetch(`/api/bookings/${bookingId}/messages?fresh=${Date.now()}`, { cache: "no-store" });
    const data = await readJson<{ userId?: string; messages?: BookingMessage[]; error?: string }>(response);
    if (response.ok) {
      setUserId(data.userId ?? "");
      setMessages(data.messages ?? []);
      setError("");
    } else setError(data.error ?? "Unable to open this chat.");
  }, [bookingId]);

  useEffect(() => {
    if (!open) return;
    void loadMessages();
    const refresh = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadMessages();
    }, 3_000);
    return () => window.clearInterval(refresh);
  }, [loadMessages, open]);

  useEffect(() => {
    if (!open || !messageListRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      messageListRef.current?.scrollTo({ top: messageListRef.current.scrollHeight, behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [newestMessageId, open]);

  async function sendMessage() {
    const message = draft.trim();
    if (!message || busy) return;
    setBusy(true);
    setError("");
    const response = await fetch(`/api/bookings/${bookingId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = await readJson<{ error?: string }>(response);
    if (response.ok) {
      setDraft("");
      await loadMessages();
    } else setError(data.error ?? "Unable to send your message.");
    setBusy(false);
  }

  const cleanPhone = phone?.replace(/[^+\d]/g, "") ?? "";
  return <section className="booking-contact-card">
    <div className="booking-contact-copy"><MessageCircle /><span><strong>{role === "CUSTOMER" ? `Ask ${participantName}` : `Chat with ${participantName}`}</strong><small>{role === "CUSTOMER" ? "Ask about samagri, muhurat or Puja preparation." : "Answer preparation questions for this booking."}</small></span></div>
    <div className="booking-contact-actions">
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}><MessageCircle size={17} /> Open private chat</button>
      {role === "CUSTOMER" && cleanPhone && <a className="btn btn-ghost booking-call-button" href={`tel:${cleanPhone}`}><Phone size={17} /><span><small>Call your Pandit</small><strong>{phone}</strong></span></a>}
    </div>
    {role === "CUSTOMER" && cleanPhone && <p className="booking-contact-note">Contact details are available only while this confirmed booking is active. Keep Puja updates inside this chat for your safety.</p>}
    {open && <div className="booking-chat-overlay" role="dialog" aria-modal="true" aria-label={`Chat with ${participantName}`} onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div className="booking-chat-sheet">
        <header><div><span className="eyebrow">Private booking chat</span><h3>{participantName}</h3><p>{role === "CUSTOMER" ? "Ask about materials, timing and preparation." : "Help the customer prepare for this Puja."}</p></div><button className="icon-button" type="button" aria-label="Close chat" onClick={() => setOpen(false)}><X /></button></header>
        <div className="booking-chat-messages" ref={messageListRef} aria-live="polite">
          {messages.length ? messages.map((message) => <div className={`booking-chat-bubble ${message.sender_id === userId ? "mine" : ""}`} key={message.id}><small>{message.sender_id === userId ? "You" : message.sender_name ?? message.sender_role}</small><p>{message.body}</p><time>{new Date(message.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</time></div>) : <div className="booking-chat-empty"><MessageCircle /><strong>No messages yet</strong><span>{role === "CUSTOMER" ? "Ask what samagri to arrange or confirm the Puja timing." : "The customer has not asked a question yet."}</span></div>}
        </div>
        {error && <div className="alert error" role="alert">{error}</div>}
        <div className="booking-chat-composer"><textarea rows={2} maxLength={1000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={role === "CUSTOMER" ? "Ask about samagri, timing or preparation…" : "Write your reply…"} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} /><button className="btn btn-primary" type="button" disabled={busy || !draft.trim()} onClick={() => void sendMessage()}><Send size={17} /> {busy ? "Sending…" : "Send"}</button></div>
      </div>
    </div>}
  </section>;
}

