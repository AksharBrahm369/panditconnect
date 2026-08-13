import Link from "next/link";
import {
  ArrowRight, BadgeCheck, CalendarDays, CalendarX2, Check,
  ChevronRight, Clock3, MapPin, MessageCircle, ShieldCheck, Sparkles,
} from "lucide-react";

export default function Home() {
  return (
    <main className="public-home">
      <header className="home-header">
        <div className="home-header-inner">
          <Link href="/" className="home-brand" aria-label="Pandit in Minutes home">
            <span className="home-brand-mark">ॐ</span>
            <span className="home-brand-copy"><strong>PanditConnect</strong><small>Ghar ki Puja, bharose ke saath</small></span>
          </Link>
          <nav className="home-nav" aria-label="Homepage navigation">
            <a href="#services">Services</a>
            <a href="#how-it-works">How it works</a>
            <a href="#trust">Safety</a>
            <Link href="/login?role=pandit">For Pandits</Link>
          </nav>
          <Link href="/login?role=customer" className="home-header-cta">Get Puja help <ArrowRight /></Link>
        </div>
      </header>

      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-copy">
          <div className="home-eyebrow"><Sparkles /> Simple Puja help for every family</div>
          <h1 id="home-title">Aapki Puja.<br /><em>Humari zimmedari.</em></h1>
          <p className="home-hero-lead">Tell us what your family needs. We guide you gently and connect you with an approved Pandit near you.</p>
          <div className="home-hero-actions">
            <Link href="/login?role=customer" className="home-primary-button">Start with Puja help <ArrowRight /></Link>
            <a href="#how-it-works" className="home-text-link">Understand the 3 steps <ChevronRight /></a>
          </div>
          <ul className="home-assurances" aria-label="Booking assurances">
            <li><Check /> Admin-reviewed Pandits</li>
            <li><Check /> Private family details</li>
            <li><Check /> Clear booking updates</li>
          </ul>
        </div>

        <div className="home-hero-media">
          {/* Public assets bypass the local image optimiser used by Vinext. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/puja-hero.png" alt="A family speaking with a Pandit during a home Puja" width="1024" height="1024" />
          <div className="home-photo-status"><span><i /> Seva available near you</span><small>Your location is used only after permission</small></div>
          <div className="home-photo-trust"><ShieldCheck /><span><strong>Respectful and private</strong><small>Personal details stay protected</small></span></div>
        </div>
      </section>

      <section className="home-service-section" id="services" aria-labelledby="service-title">
        <div className="home-section-heading">
          <span>Choose one simple path</span>
          <h2 id="service-title">How may we help your family?</h2>
          <p>No complicated forms. Begin with the option closest to your situation.</p>
        </div>
        <div className="home-service-grid">
          <Link href="/login?role=customer" className="home-service-card">
            <span className="home-service-icon"><CalendarDays /></span>
            <div><small>Plan with confidence</small><strong>Book a Puja at home</strong><p>Choose today or a future date and review everything before sending.</p></div>
            <span className="home-card-action">Begin gently <ArrowRight /></span>
          </Link>
          <Link href="/login?role=customer" className="home-service-card">
            <span className="home-service-icon"><CalendarX2 /></span>
            <div><small>Urgent replacement</small><strong>My Pandit cancelled</strong><p>Quickly search approved Pandits who can reach your area.</p></div>
            <span className="home-card-action">Search nearby <ArrowRight /></span>
          </Link>
          <Link href="/login?role=customer" className="home-service-card">
            <span className="home-service-icon"><MessageCircle /></span>
            <div><small>Private guidance</small><strong>Ask a Pandit online</strong><p>Speak privately when you need guidance without a home visit.</p></div>
            <span className="home-card-action">Open guidance <ArrowRight /></span>
          </Link>
        </div>
      </section>

      <section className="home-process" id="how-it-works" aria-labelledby="process-title">
        <div className="home-process-intro">
          <span>Three calm steps</span>
          <h2 id="process-title">From need to Seva, without confusion.</h2>
          <p>Every important detail stays visible. Nothing is sent until you review it.</p>
          <Link href="/login?role=customer" className="home-process-link">Start now <ArrowRight /></Link>
        </div>
        <ol className="home-process-list">
          <li><b>१</b><span><strong>Tell us your situation</strong><small>Write or speak naturally—you do not need to know the ritual name.</small></span></li>
          <li><b>२</b><span><strong>Choose with confidence</strong><small>Review nearby Pandits, language, experience and Puja specialities.</small></span></li>
          <li><b>३</b><span><strong>Follow every update</strong><small>See acceptance, travel and arrival in one clear journey.</small></span></li>
        </ol>
      </section>

      <section className="home-trust" id="trust" aria-labelledby="trust-title">
        <div className="home-trust-copy">
          <span>Maryada, privacy and trust</span>
          <h2 id="trust-title">Technology that respects the Puja.</h2>
        </div>
        <div className="home-trust-points">
          <article><BadgeCheck /><span><strong>Profiles reviewed</strong><small>Identity and experience are checked before approval.</small></span></article>
          <article><MapPin /><span><strong>Nearby matching</strong><small>Location is used only to find Pandits serving your area.</small></span></article>
          <article><Clock3 /><span><strong>Live booking status</strong><small>Know whether your request is pending, accepted or on the way.</small></span></article>
        </div>
      </section>

      <footer className="home-footer">
        <div className="home-footer-inner">
          <div className="home-footer-brand"><span>ॐ</span><div><strong>PanditConnect</strong><small>Ghar ki Puja, bharose ke saath.</small></div></div>
          <nav aria-label="Legal and partner links"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/cancellation-policy">Cancellation policy</Link><Link href="/login?role=pandit">Join as a Pandit</Link></nav>
          <p>Designed for simple, private and respectful Puja assistance.</p>
        </div>
      </footer>
    </main>
  );
}
