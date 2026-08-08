"use client";

import { useEffect, useRef, useState } from "react";
import { BellRing, Check, Volume2, VolumeX } from "lucide-react";

const ALARM_KEY = "panditconnect-pandit-loud-alarm";
let alarmContext: AudioContext | null = null;

async function ringAlarm() {
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return false;
  alarmContext ??= new AudioContextClass();
  if (alarmContext.state === "suspended") await alarmContext.resume();
  const start = alarmContext.currentTime;
  [[0,880],[.18,1180],[.36,880],[.62,1320],[.82,1040],[1.02,1320]].forEach(([delay, frequency]) => {
    const oscillator = alarmContext!.createOscillator();
    const gain = alarmContext!.createGain();
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(frequency, start + delay);
    gain.gain.setValueAtTime(.0001, start + delay);
    gain.gain.exponentialRampToValueAtTime(.42, start + delay + .025);
    gain.gain.exponentialRampToValueAtTime(.0001, start + delay + .15);
    oscillator.connect(gain).connect(alarmContext!.destination);
    oscillator.start(start + delay);
    oscillator.stop(start + delay + .17);
  });
  if ("vibrate" in navigator) navigator.vibrate([350,120,350,120,500]);
  return true;
}

export function PanditUrgentAlarm({ pujaRequests, chatRequests }: { pujaRequests: number; chatRequests: number }) {
  const urgentCount = pujaRequests + chatRequests;
  const [enabled, setEnabled] = useState(false);
  const [muted, setMuted] = useState(false);
  const previousCount = useRef(0);

  useEffect(() => setEnabled(localStorage.getItem(ALARM_KEY) === "on"), []);
  useEffect(() => {
    if (urgentCount > previousCount.current) setMuted(false);
    previousCount.current = urgentCount;
  }, [urgentCount]);
  useEffect(() => {
    if (!enabled || muted || urgentCount < 1) return;
    void ringAlarm().catch(() => setEnabled(false));
    const timer = window.setInterval(() => void ringAlarm().catch(() => setEnabled(false)), 8_000);
    return () => window.clearInterval(timer);
  }, [enabled, muted, urgentCount]);

  async function enableAlarm() {
    try {
      if (!await ringAlarm()) return;
    } catch {
      return;
    }
    localStorage.setItem(ALARM_KEY, "on");
    setEnabled(true);
    setMuted(false);
  }

  return <section className={`pandit-urgent-alarm ${urgentCount ? "has-urgent" : ""}`} aria-live="polite">
    <span className="pandit-alarm-icon">{enabled ? <Volume2 /> : <VolumeX />}</span>
    <div><small>Loud request alarm</small><strong>{urgentCount ? `${urgentCount} request${urgentCount === 1 ? "" : "s"} need attention` : enabled ? "Loud alerts are ready" : "Turn on loud alerts on this device"}</strong><p>{urgentCount ? `${pujaRequests ? `${pujaRequests} Puja` : ""}${pujaRequests && chatRequests ? " · " : ""}${chatRequests ? `${chatRequests} live chat` : ""}` : "Your phone or laptop will ring repeatedly for new Puja and chat requests."}</p></div>
    {!enabled ? <button onClick={() => void enableAlarm()}><BellRing /> Enable loud alerts</button> : urgentCount && !muted ? <button onClick={() => setMuted(true)}><VolumeX /> Silence this alarm</button> : urgentCount && muted ? <button onClick={() => setMuted(false)}><Volume2 /> Ring again</button> : <span className="pandit-alarm-ready"><Check /> Ready</span>}
  </section>;
}
