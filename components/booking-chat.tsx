"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LockKeyhole, MessageCircle, Phone, Send, Sparkles, X } from "lucide-react";
import { readJson } from "@/lib/http";
import styles from "./booking-chat.module.css";

type BookingMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender_name: string | null;
  sender_role: string;
};

export function BookingChat({ bookingId, participantName, role, phone, phoneAvailableAt, scheduledFor, guidanceMode = false }: {
  bookingId: string;
  participantName: string;
  role: "CUSTOMER" | "PANDIT";
  phone?: string | null;
  phoneAvailableAt?: string | null;
  scheduledFor?: string | null;
  guidanceMode?: boolean;
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
    const initialLoad = window.setTimeout(() => void loadMessages(), 0);
    const refresh = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadMessages();
    }, 3_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(refresh);
    };
  }, [loadMessages, open]);

  useEffect(() => {
    if (!open || !messageListRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      messageListRef.current?.scrollTo({ top: messageListRef.current.scrollHeight, behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [newestMessageId, open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

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
  const phoneUnlockLabel = phoneAvailableAt ? new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(phoneAvailableAt)) : null;
  const scheduledLabel = scheduledFor ? new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(scheduledFor)) : null;

  return <section className={styles.contactCard}>
    <div className={styles.contactCopy}>
      <span className={styles.contactIcon}><Sparkles aria-hidden="true" /></span>
      <span className={styles.contactText}>
        <small>{guidanceMode ? "Scheduled Puja planning" : role === "CUSTOMER" ? "Booking support" : "Customer question"}</small>
        <strong>{role === "CUSTOMER" ? `Plan with ${participantName}` : `Guide ${participantName}`}</strong>
        <span>{guidanceMode ? role === "CUSTOMER" ? "Ask your confirmed Pandit about the final muhurat, samagri and preparation." : `Review the requested date${scheduledLabel ? ` (${scheduledLabel})` : ""}, then confirm the muhurat and samagri here.` : role === "CUSTOMER" ? "Confirm samagri, muhurat or Puja preparation directly." : "Answer preparation questions for this booking."}</span>
      </span>
    </div>

    <div className={styles.contactActions}>
      <button type="button" className={styles.chatButton} onClick={() => setOpen(true)}><MessageCircle aria-hidden="true" /> <span>Open private chat</span></button>
      {role === "CUSTOMER" && cleanPhone && <a className={styles.callButton} href={`tel:${cleanPhone}`} aria-label={`Call ${participantName} at ${phone}`}><Phone aria-hidden="true" /><span><small>Call your Pandit</small><strong>{phone}</strong></span></a>}
    </div>

    {role === "CUSTOMER" && cleanPhone && <p className={styles.contactNote}><LockKeyhole aria-hidden="true" /> {phoneAvailableAt ? "The phone number is available now because the Puja is within two days." : "Contact details are available for this confirmed booking."} It stays visible only while this booking is active.</p>}
    {role === "CUSTOMER" && !cleanPhone && phoneUnlockLabel && <div className={styles.phoneLocked}><LockKeyhole aria-hidden="true" /><span><strong>Phone number unlocks on {phoneUnlockLabel}</strong><small>This is exactly two days before the scheduled Puja. Until then, use the private chat above.</small></span></div>}

    {open && <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={`Chat with ${participantName}`} onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div className={styles.chatSheet}>
        <header className={styles.chatHeader}>
          <span className={styles.chatAvatar}><MessageCircle aria-hidden="true" /></span>
          <div><small>Private booking chat</small><h3>{participantName}</h3><p>{role === "CUSTOMER" ? "Ask about materials, timing and preparation." : "Help the customer prepare for this Puja."}</p></div>
          <button className={styles.closeButton} type="button" aria-label="Close chat" onClick={() => setOpen(false)}><X aria-hidden="true" /></button>
        </header>

        <div className={styles.messages} ref={messageListRef} aria-live="polite">
          {messages.length ? messages.map((message) => <div className={`${styles.bubble} ${message.sender_id === userId ? styles.mine : ""}`} key={message.id}><small>{message.sender_id === userId ? "You" : message.sender_name ?? message.sender_role}</small><p>{message.body}</p><time>{new Date(message.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</time></div>) : <div className={styles.empty}><span><MessageCircle aria-hidden="true" /></span><strong>No messages yet</strong><p>{role === "CUSTOMER" ? "Start by asking what samagri to arrange or confirming the Puja timing." : "The customer has not asked a question yet."}</p></div>}
        </div>

        {error && <div className={styles.error} role="alert">{error}</div>}

        <div className={styles.composer}>
          <textarea rows={2} maxLength={1000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={role === "CUSTOMER" ? "Ask about samagri, timing or preparation…" : "Write your reply…"} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} />
          <button className={styles.sendButton} type="button" disabled={busy || !draft.trim()} onClick={() => void sendMessage()}><Send aria-hidden="true" /> <span>{busy ? "Sending…" : "Send"}</span></button>
        </div>
      </div>
    </div>}
  </section>;
}
