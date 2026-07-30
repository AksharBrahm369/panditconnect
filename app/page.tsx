import Link from "next/link";
import { ArrowRight, BadgeCheck, Clock3, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { LiveAvailabilityCard } from "@/components/live-availability-card";

export default function Home() {
  return (
    <main>
      <nav className="topbar">
        <Link href="/" className="brand"><span className="brand-mark">ॐ</span><span>Pandit in Minutes</span></Link>
        <div className="nav-actions">
          <Link href="/login?role=pandit" className="btn btn-ghost">Join as Pandit</Link>
          <Link href="/login?role=customer" className="btn btn-primary">Get urgent help</Link>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><Sparkles size={15} /> Religious help for real-life situations</span>
          <h1>Tell us what happened. We help with what comes next.</h1>
          <p>Whether your Pandit cancelled or you do not know which ritual is suitable, get practical guidance and the best available nearby Pandit in one clear flow.</p>
          <div className="hero-actions">
            <Link href="/login?role=customer" className="btn btn-primary btn-lg">Tell us what you need <ArrowRight size={18} /></Link>
            <span className="quiet"><Clock3 size={17} /> Urgent matching, not scheduled listings</span>
          </div>
          <div className="trust-row">
            <span><BadgeCheck size={18} /> Situation-based guidance</span>
            <span><ShieldCheck size={18} /> Private contact details</span>
            <span><MapPin size={18} /> Live GPS matching</span>
          </div>
        </div>
        <LiveAvailabilityCard />
      </section>

      <section className="how">
        <span className="eyebrow">Simple by design</span>
        <h2>Help without confusion</h2>
        <div className="steps-grid">
          <article><b>01</b><h3>Describe the situation</h3><p>Type it or speak in your preferred language. You do not need to know the Puja name.</p></article>
          <article><b>02</b><h3>Get clear guidance</h3><p>See a suitable ritual, preparation checklist and transparent starting price.</p></article>
          <article><b>03</b><h3>Match and track</h3><p>The best available qualified Pandit receives the request, with live status and GPS updates.</p></article>
        </div>
      </section>

      <footer><span>Pandit in Minutes · V2</span><Link href="/admin">Open local admin demo</Link></footer>
    </main>
  );
}
