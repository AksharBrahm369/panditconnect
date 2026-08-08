import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarX2, Clock3, ShieldCheck, Sparkles } from "lucide-react";
import { LiveAvailabilityCard } from "@/components/live-availability-card";
import { FeaturedPandits } from "@/components/featured-pandits";

export default function Home() {
  return (
    <main>
      <nav className="topbar">
        <Link href="/" className="brand"><span className="brand-mark">ॐ</span><span>Pandit in Minutes</span></Link>
        <div className="public-nav"><a href="#how-it-works">How it works</a><a href="#pandit-network">Our Pandits</a></div>
        <div className="nav-actions">
          <Link href="/login?role=pandit" className="btn btn-ghost">Join as Pandit</Link>
          <Link href="/login?role=customer" className="btn btn-primary">Get Puja help</Link>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><Sparkles size={15} /> Simple, trusted Puja assistance</span>
          <h1>Tell us what you need. We’ll find the right Pandit.</h1>
          <p>You don’t need to know the Puja name. Share your situation and get clear guidance, a verified nearby Pandit, and live updates.</p>
          <div className="hero-actions">
            <Link href="/login?role=customer" className="btn btn-primary btn-lg">Find my Pandit <ArrowRight size={18} /></Link>
            <a href="#how-it-works" className="text-button">How it works</a>
          </div>
          <div className="hero-choices">
            <Link href="/login?role=customer"><CalendarX2 /><span><strong>My Pandit cancelled</strong><small>Find a replacement quickly</small></span><ArrowRight /></Link>
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

      <section className="simple-trust" aria-label="Why customers trust the service">
        <div><BadgeCheck /><span><strong>Verified Pandits</strong><small>Profiles reviewed before approval</small></span></div>
        <div><Clock3 /><span><strong>Quick nearby matching</strong><small>Designed for urgent requirements</small></span></div>
        <div><ShieldCheck /><span><strong>Private by default</strong><small>Your contact details stay protected</small></span></div>
      </section>

      <FeaturedPandits />

      <section className="how" id="how-it-works">
        <span className="eyebrow">How it works</span>
        <h2>Puja help in three easy steps</h2>
        <div className="steps-grid">
          <article><b>01</b><h3>Tell us what happened</h3><p>Type or speak naturally. It takes less than a minute and no religious terminology is required.</p></article>
          <article><b>02</b><h3>Confirm the recommendation</h3><p>Review the suggested Puja, materials guidance, language and transparent price before requesting.</p></article>
          <article><b>03</b><h3>Track your Pandit</h3><p>See acceptance, journey and arrival status. Share the secure OTP only when the Pandit reaches you.</p></article>
        </div>
        <div className="how-cta"><div><strong>Need a Pandit right now?</strong><span>Start with your situation—we will guide the rest.</span></div><Link href="/login?role=customer" className="btn btn-primary">Start now <ArrowRight size={17} /></Link></div>
      </section>

      <footer><span>Pandit in Minutes · Trusted religious help, nearby</span><div className="footer-links"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/cancellation-policy">Cancellation</Link><Link href="/login?role=pandit">Join as Pandit</Link></div></footer>
    </main>
  );
}
