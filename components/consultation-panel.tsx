"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BadgeCheck, Banknote, Clock3, CreditCard, MessageCircle, Send, Smartphone, Star, Wifi } from "lucide-react";
import { readJson } from "@/lib/http";
import { PanditAvatar } from "./pandit-avatar";

type ConsultationPandit = {
  id: string; name: string; city: string | null; experience_years: number; languages: string[];
  specialities: string[]; rating: string; rating_count: number; completed_jobs: number; consultation_rate_5min: number;
};
type Consultation = {
  id: string; topic: string; status: string; rate_5min: number; blocks: number; amount: number;
  payment_status: string; payment_method?: "CASH" | "UPI" | "CARD" | null; started_at: string; ends_at: string; participant_name?: string;
};
type ChatMessage = {
  id: string; body: string; created_at: string; sender_id: string; sender_name: string | null; sender_role: string;
};

export function ConsultationPanel({ role, onBack }: { role: "CUSTOMER" | "PANDIT"; onBack?: () => void }) {
  const [pandits, setPandits] = useState<ConsultationPandit[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [selected, setSelected] = useState<Consultation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userId, setUserId] = useState("");
  const [topic, setTopic] = useState("");
  const [draft, setDraft] = useState("");
  const [blocks, setBlocks] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(0);
  const [otherTyping, setOtherTyping] = useState<{ typing: boolean; name?: string | null; role?: string }>({ typing: false });
  const [checkoutPandit, setCheckoutPandit] = useState<ConsultationPandit | null>(null);
  const lastTypingSentAt = useRef(0);
  const selectedId = selected?.id;

  const loadConsultations = useCallback(async () => {
    const response = await fetch(`/api/consultations?fresh=${Date.now()}`, { cache: "no-store" });
    const data = await readJson<{ userId?: string; consultations?: Consultation[]; paymentsEnabled?: boolean }>(response);
    if (response.ok) {
      setUserId(data.userId ?? "");
      setConsultations(data.consultations ?? []);
      setSelected((current) => current ? (data.consultations ?? []).find((item) => item.id === current.id) ?? current : current);
    }
  }, []);

  const loadMessages = useCallback(async (consultationId: string) => {
    const response = await fetch(`/api/consultations/${consultationId}/messages?fresh=${Date.now()}`, { cache: "no-store" });
    const data = await readJson<{ userId?: string; messages?: ChatMessage[]; error?: string }>(response);
    if (response.ok) {
      setUserId(data.userId ?? "");
      setMessages(data.messages ?? []);
    }
  }, []);

  const loadTyping = useCallback(async (consultationId: string) => {
    const response = await fetch(`/api/consultations/${consultationId}/typing?fresh=${Date.now()}`, { cache: "no-store" });
    const data = await readJson<{ typing?: boolean; participant?: { name?: string | null; role?: string } | null }>(response);
    if (response.ok) setOtherTyping({ typing: Boolean(data.typing), name: data.participant?.name, role: data.participant?.role });
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => {
      void loadConsultations();
      if (role === "CUSTOMER") {
        void fetch("/api/consultation-pandits", { cache: "no-store" })
          .then((response) => readJson<{ pandits?: ConsultationPandit[] }>(response))
          .then((data) => setPandits(data.pandits ?? []));
      }
    }, 0);
    const refresh = window.setInterval(() => {
      void loadConsultations();
      if (selectedId) void loadMessages(selectedId);
    }, 3_000);
    const clock = window.setInterval(() => setNow(Date.now()), 1_000);
    const typingRefresh = window.setInterval(() => {
      if (selectedId) void loadTyping(selectedId);
    }, 1_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(refresh);
      window.clearInterval(clock);
      window.clearInterval(typingRefresh);
    };
  }, [loadConsultations, loadMessages, loadTyping, role, selectedId]);

  async function openChat(consultation: Consultation) {
    setSelected(consultation);
    await loadMessages(consultation.id);
  }

  async function startChat(pandit: ConsultationPandit, paymentMethod: "CASH") {
    setBusy(true); setError("");
    const response = await fetch("/api/consultations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        panditId: pandit.id,
        topic: topic.trim() || "General Puja and religious guidance",
        blocks,
        paymentMethod,
      }),
    });
    const data = await readJson<{ consultation?: Consultation; error?: string }>(response);
    if (!response.ok || !data.consultation) setError(data.error ?? "Unable to start the consultation.");
    else {
      const opened = { ...data.consultation, participant_name: pandit.name };
      setSelected(opened);
      setTopic("");
      setCheckoutPandit(null);
      await loadMessages(opened.id);
      await loadConsultations();
    }
    setBusy(false);
  }

  async function sendMessage() {
    if (!selected || !draft.trim()) return;
    setBusy(true); setError("");
    const response = await fetch(`/api/consultations/${selected.id}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: draft }),
    });
    const data = await readJson<{ error?: string }>(response);
    if (!response.ok) setError(data.error ?? "Unable to send message.");
    else {
      setDraft("");
      void updateTyping(false);
      await loadMessages(selected.id);
    }
    setBusy(false);
  }

  function updateTyping(typing: boolean) {
    if (!selectedId) return;
    if (typing) {
      const current = Date.now();
      if (current - lastTypingSentAt.current < 1_200) return;
      lastTypingSentAt.current = current;
    } else {
      lastTypingSentAt.current = 0;
    }
    void fetch(`/api/consultations/${selectedId}/typing`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ typing }),
    });
  }

  function changeDraft(value: string) {
    setDraft(value);
    updateTyping(Boolean(value.trim()));
  }

  const remaining = selected ? Math.max(0, new Date(selected.ends_at).getTime() - now) : 0;
  const timer = useMemo(() => {
    const seconds = Math.ceil(remaining / 1000);
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }, [remaining]);

  if (selected) return <section className="consultation-chat" id="online-guidance">
    <header>
      <button className="icon-button" onClick={() => setSelected(null)} aria-label="Back to consultations"><ArrowLeft size={18} /></button>
      <span className="consultation-avatar">{(selected.participant_name ?? "P").split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
      <div><strong>{selected.participant_name ?? "Live consultation"}</strong><small><Wifi size={12} /> Private live chat</small></div>
      <span className={`chat-timer ${remaining === 0 ? "ended" : ""}`}><Clock3 size={14} /> {remaining ? timer : "Ended"}</span>
    </header>
    <div className="consultation-topic"><strong>Your question</strong><span>{selected.topic}</span><b>₹{selected.amount} · {selected.payment_method ?? "Payment"} · {selected.blocks * 5} minutes</b></div>
    <div className="chat-messages">
      {messages.length ? messages.map((message) => <div className={`chat-bubble ${message.sender_id === userId ? "mine" : ""}`} key={message.id}>
        <small>{message.sender_id === userId ? "You" : message.sender_name ?? message.sender_role}</small>
        <p>{message.body}</p><time>{new Date(message.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</time>
      </div>) : !otherTyping.typing && <div className="empty chat-empty"><MessageCircle /><strong>Chat is ready</strong><span>Send the first message about the occasion or question.</span></div>}
      {otherTyping.typing && <div className="typing-presence" aria-live="polite">
        <span className="typing-dots" aria-hidden="true"><i /><i /><i /></span>
        <small>{otherTyping.name ?? selected.participant_name ?? (otherTyping.role === "CUSTOMER" ? "Customer" : "Pandit")} is typing…</small>
      </div>}
    </div>
    {error && <div className="alert error">{error}</div>}
    <div className="chat-composer">
      <textarea rows={2} value={draft} disabled={!remaining} onChange={(event) => changeDraft(event.target.value)} onBlur={() => updateTyping(false)} placeholder={remaining ? "Write a message…" : "This consultation has ended"} />
      <button className="btn btn-primary" disabled={busy || !draft.trim() || !remaining} onClick={sendMessage}><Send size={17} /> Send</button>
    </div>
  </section>;

  return <section className="consultation-center" id="online-guidance">
    <div className="consultation-intro">
      {onBack && <button className="back-review" onClick={onBack}><ArrowLeft size={16} /> Back to options</button>}
      <span className="eyebrow">Online Pandit guidance</span>
      <h2>{role === "CUSTOMER" ? "Chat privately with an available Pandit" : "Your online consultations"}</h2>
      <p>{role === "CUSTOMER" ? "Ideal for quick ritual questions and guidance when a home visit is not required." : "Help customers remotely through private, timed chat sessions."}</p>
    </div>

    {role === "CUSTOMER" && <>
      <div className="consultation-setup">
        <label>What guidance do you need? <small>Optional—you can explain after the chat starts</small><textarea rows={3} value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Example: We are opening a shop tomorrow. Which Puja and materials do we need?" /></label>
        <label>Chat duration<select value={blocks} onChange={(event) => setBlocks(Number(event.target.value))}><option value={1}>5 minutes</option><option value={2}>10 minutes</option><option value={3}>15 minutes</option></select></label>
        <p><BadgeCheck size={15} /> Choose a payment method before the timed chat begins.</p>
      </div>
      {error && <div className="alert error consultation-error">{error}</div>}
      {checkoutPandit && <div className="consultation-payment" role="dialog" aria-label="Choose chat payment method">
        <div><button className="icon-button" onClick={() => setCheckoutPandit(null)} aria-label="Back to Pandit list"><ArrowLeft size={17} /></button><span><small>Payment before chat</small><strong>{checkoutPandit.name} · {blocks * 5} minutes</strong></span><b>₹{checkoutPandit.consultation_rate_5min * blocks}</b></div>
        <p>Select how you want to pay before starting the timed consultation.</p>
        <div className="payment-method-grid">
          <button disabled={busy} onClick={() => startChat(checkoutPandit, "CASH")}><Banknote /><span><strong>Cash</strong><small>Confirm cash payment</small></span></button>
          <button disabled title="Available after secure payment setup"><Smartphone /><span><strong>UPI</strong><small>Coming soon</small></span></button>
          <button disabled title="Available after secure payment setup"><CreditCard /><span><strong>Card</strong><small>Coming soon</small></span></button>
        </div>
        <small>The chat starts only after you confirm a currently available payment method.</small>
      </div>}
      <div className="consultation-list">
        {pandits.length ? pandits.map((pandit) => <article className="consultation-pandit" key={pandit.id}>
          <div className="consultation-pandit-head"><PanditAvatar panditId={pandit.id} name={pandit.name} className="consultation-avatar" /><div><strong>{pandit.name}</strong><span><i /> Available for chat</span></div><b>{pandit.rating_count ? <><Star size={13} fill="currentColor" /> {pandit.rating}</> : "New"}</b></div>
          <p>{pandit.experience_years} years experience · {pandit.languages.slice(0,3).join(", ")}</p>
          <div className="tag-row">{pandit.specialities.slice(0,3).map((item) => <span key={item}>{item}</span>)}</div>
          <button className="btn btn-primary btn-block" disabled={busy} onClick={() => { setError(""); setCheckoutPandit(pandit); }}>Continue · ₹{pandit.consultation_rate_5min * blocks}</button>
        </article>) : <div className="empty"><MessageCircle /><strong>No Pandit is available for chat right now</strong><span>Please check again in a few minutes.</span></div>}
      </div>
    </>}

    <div className="consultation-history">
      <h3>{role === "CUSTOMER" ? "Your consultations" : "Customer chats"}</h3>
      {consultations.length ? consultations.map((item) => <button key={item.id} onClick={() => void openChat(item)}>
        <span className="consultation-avatar small">{(item.participant_name ?? "P").split(" ").map((part) => part[0]).slice(0,2).join("")}</span>
        <span><strong>{item.participant_name ?? "Consultation"}</strong><small>{item.topic}</small></span>
        <b className={new Date(item.ends_at).getTime() > now ? "active" : ""}>{new Date(item.ends_at).getTime() > now ? "Open chat" : "View"}</b>
      </button>) : <div className="empty compact">No consultations yet.</div>}
    </div>
  </section>;
}
