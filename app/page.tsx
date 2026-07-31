import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BadgeCheck, CalendarX2, CircleHelp, Clock3, House, ShieldCheck, Sparkles } from "lucide-react";
import { LiveAvailabilityCard } from "@/components/live-availability-card";

export default function Home() {
  return (
    <main>
      <nav className="topbar">
        <Link href="/" className="brand"><span className="brand-mark">ॐ</span><span>Pandit in Minutes</span></Link>
        <div className="nav-actions">
          <Link href="/login?role=pandit" className="btn btn-ghost">For Pandits</Link>
          <Link href="/login?role=customer" className="btn btn-primary">Find a Pandit now</Link>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><Sparkles size={15} /> Urgent Puja help, guided end to end</span>
          <h1>Religious help, without the calling around.</h1>
          <p>Tell us your situation in simple words. We guide you to the right Puja, find an approved nearby Pandit and keep you updated until arrival.</p>
          <div className="hero-actions">
            <Link href="/login?role=customer" className="btn btn-primary btn-lg">Get help now <ArrowRight size={18} /></Link>
            <a href="#how-it-works" className="btn btn-ghost btn-lg">See how it works</a>
          </div>
          <div className="trust-row">
            <span><BadgeCheck size={18} /> Admin-approved Pandits</span>
            <span><Clock3 size={18} /> Built for urgent needs</span>
            <span><ShieldCheck size={18} /> Your number stays private</span>
          </div>
        </div>
        <div className="hero-showcase">
          <div className="hero-photo">
            <Image src="/puja-hero.png" alt="A Pandit conducting a home Puja for an Indian couple" fill priority sizes="(max-width: 900px) 100vw, 46vw" />
            <div className="hero-photo-badge"><BadgeCheck size={17} /><span><strong>Approved professionals</strong><small>Identity and experience reviewed</small></span></div>
          </div>
          <LiveAvailabilityCard />
        </div>
      </section>

      <section className="scenario-section">
        <div className="scenario-intro"><span className="eyebrow">Start from your problem</span><h2>You do not need to know the Puja name.</h2><p>Choose the situation that feels closest. The app handles the religious terminology and matching.</p></div>
        <div className="scenario-grid">
          <article><span><CalendarX2 /></span><div><strong>My Pandit cancelled</strong><p>Get an urgent replacement using your existing Puja details.</p></div></article>
          <article><span><CircleHelp /></span><div><strong>I need guidance</strong><p>Explain the occasion and see a suitable ritual with preparation steps.</p></div></article>
          <article><span><House /></span><div><strong>I know the Puja</strong><p>Choose it directly and find the best available nearby Pandit.</p></div></article>
        </div>
      </section>

      <section className="how" id="how-it-works">
        <span className="eyebrow">Simple by design</span>
        <h2>Three clear steps. No confusion.</h2>
        <div className="steps-grid">
          <article><b>01</b><h3>Tell us what happened</h3><p>Type or speak naturally. It takes less than a minute and no religious terminology is required.</p></article>
          <article><b>02</b><h3>Confirm the recommendation</h3><p>Review the suggested Puja, materials guidance, language and transparent price before requesting.</p></article>
          <article><b>03</b><h3>Track your Pandit</h3><p>See acceptance, journey and arrival status. Share the secure OTP only when the Pandit reaches you.</p></article>
        </div>
        <div className="how-cta"><div><strong>Need a Pandit right now?</strong><span>Start with your situation—we will guide the rest.</span></div><Link href="/login?role=customer" className="btn btn-primary">Start now <ArrowRight size={17} /></Link></div>
      </section>

      <footer><span>Pandit in Minutes · Trusted religious help, nearby</span><Link href="/login?role=pandit">Join the Pandit network</Link></footer>
    </main>
  );
}
