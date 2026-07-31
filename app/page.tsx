import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarX2, CircleHelp, Clock3, Flame, Flower2, House, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { LiveAvailabilityCard } from "@/components/live-availability-card";
import { FeaturedPandits } from "@/components/featured-pandits";

export default function Home() {
  return (
    <main>
      <nav className="topbar">
        <Link href="/" className="brand"><span className="brand-mark">ॐ</span><span>Pandit in Minutes</span></Link>
        <div className="public-nav"><a href="#common-pujas">Popular Pujas</a><a href="#pandit-network">Pandit network</a><a href="#how-it-works">How it works</a></div>
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
            {/* Vinext serves public assets directly; bypass its unstable local image optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/puja-hero.png" alt="A Pandit conducting a home Puja for an Indian couple" width="1024" height="1024" fetchPriority="high" />
            <div className="hero-photo-badge"><BadgeCheck size={17} /><span><strong>Approved professionals</strong><small>Identity and experience reviewed</small></span></div>
          </div>
          <LiveAvailabilityCard />
        </div>
      </section>

      <div className="feature-ticker" aria-label="Platform benefits"><div><span><BadgeCheck /> Approved Pandit profiles</span><i>◆</i><span><Clock3 /> Urgent nearby matching</span><i>◆</i><span><ShieldCheck /> Private phone and address</span><i>◆</i><span><MapPin /> Live journey updates</span></div></div>

      <section className="common-pujas" id="common-pujas">
        <div className="common-heading"><div><span className="eyebrow">Popular requests</span><h2>Choose a Puja—or simply ask for guidance</h2><p>Know what you need? Start faster. Unsure? Describe the occasion and we will recommend the right ritual.</p></div><Link href="/login?role=customer" className="btn btn-ghost">I need guidance <ArrowRight size={16} /></Link></div>
        <div className="common-grid">
          <Link href="/login?role=customer"><span><Flower2 /></span><div><strong>Ganesh Puja</strong><small>New beginnings and prosperity</small></div><ArrowRight /></Link>
          <Link href="/login?role=customer"><span><House /></span><div><strong>Griha Pravesh</strong><small>Blessing for a new home</small></div><ArrowRight /></Link>
          <Link href="/login?role=customer"><span><Sparkles /></span><div><strong>Satyanarayan Puja</strong><small>Family wellbeing and gratitude</small></div><ArrowRight /></Link>
          <Link href="/login?role=customer"><span><Flame /></span><div><strong>Havan / Homam</strong><small>Purification and sacred ceremony</small></div><ArrowRight /></Link>
        </div>
      </section>

      <FeaturedPandits />

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
