import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck2,
  CalendarDays,
  CalendarX2,
  CheckCircle2,
  Clock3,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const entryPoints = [
  {
    icon: CalendarDays,
    number: "01",
    label: "At home",
    title: "Book a Pandit",
    detail: "Tell us the occasion. We’ll guide the Puja, timing and next steps.",
    action: "Start a booking",
    href: "/login?role=customer&next=%2Fcustomer%3Fstart%3Dguided",
    tone: "saffron",
  },
  {
    icon: CalendarX2,
    number: "02",
    label: "Urgent help",
    title: "Find a replacement",
    detail: "Your Pandit cancelled? Search nearby without repeating everything.",
    action: "Search nearby",
    href: "/login?role=customer&next=%2Fcustomer%3Fstart%3Dsos",
    tone: "rose",
  },
  {
    icon: MessageCircle,
    number: "03",
    label: "Online guidance",
    title: "Ask a Pandit",
    detail: "Chat privately about samagri, timing or religious guidance.",
    action: "See online Pandits",
    href: "/login?role=customer&next=%2Fcustomer%3Fstart%3Donline",
    tone: "green",
  },
] as const;

export default function Home() {
  return (
    <main className="public-home public-home-v3">
      <div className="home-notice"><span>ॐ</span> Puja assistance for today or a future date <Link href="/login?role=customer">Get help <ArrowRight /></Link></div>

      <header className="home-header">
        <div className="home-header-inner">
          <Link href="/" className="home-brand" aria-label="PujaOne home">
            <span className="home-brand-mark" aria-hidden="true">ॐ</span>
            <span className="home-brand-copy"><strong>PujaOne</strong><small>Puja help, thoughtfully arranged</small></span>
          </Link>
          <nav className="home-nav" aria-label="Homepage navigation">
            <a href="#services">Services</a>
            <a href="#how-it-works">How it works</a>
            <a href="#trust">Trust & safety</a>
            <Link href="/login?role=pandit">For Pandits</Link>
          </nav>
          <Link href="/login?role=customer" className="home-header-cta">Sign in <ArrowRight /></Link>
        </div>
      </header>

      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-copy">
          <span className="home-eyebrow"><Sparkles /> Simple help for every family</span>
          <h1 id="home-title">A simpler way to arrange your Puja.</h1>
          <p className="home-hero-lead">Share the occasion in your own words. PujaOne helps you understand what you need and find a verified Pandit nearby.</p>
          <div className="home-hero-actions">
            <Link href="/login?role=customer&next=%2Fcustomer%3Fstart%3Dguided" className="home-primary-button">Tell us what you need <ArrowRight /></Link>
            <a href="#how-it-works" className="home-secondary-link">How PujaOne works</a>
          </div>
          <div className="home-hero-assurance">
            <BadgeCheck /><span><strong>Reviewed Pandit profiles</strong><small>See language, experience, distance and price before requesting.</small></span>
          </div>
        </div>

        <figure className="home-hero-art">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pujaone-ritual-art-v2.webp" alt="A hand-painted Puja thali, diya, flowers and kalash prepared in an Indian home" width="1400" height="933" />
          <figcaption><span><i /> Nearby matching</span><small>Location is used only after you allow it</small></figcaption>
        </figure>
      </section>

      <section className="home-service-section" id="services" aria-labelledby="service-title">
        <div className="home-section-heading">
          <span>Start with one choice</span>
          <h2 id="service-title">What can we help you with?</h2>
          <p>No long form at the beginning. Choose what feels closest to your situation.</p>
        </div>
        <div className="home-service-grid">
          {entryPoints.map(({ icon: Icon, number, label, title, detail, action, href, tone }) => (
            <Link href={href} className={`home-service-card home-service-${tone}`} key={href}>
              <span className="home-service-number">{number}</span>
              <span className="home-service-icon"><Icon /></span>
              <div><small>{label}</small><strong>{title}</strong><p>{detail}</p></div>
              <span className="home-card-action">{action} <ArrowRight /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-proof" aria-label="PujaOne assurances">
        <div><BadgeCheck /><span><strong>Verified profiles</strong><small>Identity and experience reviewed</small></span></div>
        <div><MapPin /><span><strong>Real nearby matching</strong><small>Only eligible Pandits are shown</small></span></div>
        <div><ShieldCheck /><span><strong>Private by default</strong><small>Contact details stay protected</small></span></div>
      </section>

      <section className="home-process" id="how-it-works" aria-labelledby="process-title">
        <div className="home-process-intro">
          <span>From need to confirmed visit</span>
          <h2 id="process-title">One clear next step, every time.</h2>
          <p>The screen changes with your request. You only see the action that matters now.</p>
          <Link href="/login?role=customer" className="home-process-link">Arrange a Puja <ArrowRight /></Link>
        </div>

        <div className="home-event-demo" aria-label="Example booking journey">
          <div className="home-event-top"><span>Ganesh Puja</span><b>Today</b></div>
          <div className="home-event-status"><CheckCircle2 /><span><small>Booking confirmed</small><strong>Your Pandit has accepted</strong></span></div>
          <ol>
            <li className="done"><i>1</i><span><strong>Tell us the occasion</strong><small>Simple words are enough</small></span></li>
            <li className="done"><i>2</i><span><strong>Choose a nearby Pandit</strong><small>Compare what matters</small></span></li>
            <li className="active"><i>3</i><span><strong>Follow live updates</strong><small>Know what happens next</small></span></li>
          </ol>
          <div className="home-event-next"><Clock3 /><span><small>Next update</small><strong>We’ll notify you when the Pandit starts travelling.</strong></span></div>
        </div>
      </section>

      <section className="home-trust" id="trust" aria-labelledby="trust-title">
        <div className="home-trust-copy">
          <span>Made for real families</span>
          <h2 id="trust-title">Religious help without the usual uncertainty.</h2>
          <p>Clear choices, respectful language and no unnecessary information on screen.</p>
        </div>
        <div className="home-trust-points">
          <article><CalendarCheck2 /><span><strong>Today or later</strong><small>Book urgently or choose a future date.</small></span></article>
          <article><MessageCircle /><span><strong>Guidance stays connected</strong><small>Ask the accepted Pandit about timing and preparation.</small></span></article>
          <article><ShieldCheck /><span><strong>You remain in control</strong><small>Review everything before a request is sent.</small></span></article>
        </div>
      </section>

      <section className="home-final-cta">
        <span aria-hidden="true">ॐ</span>
        <div><small>Not sure which Puja you need?</small><h2>Start with the occasion. We’ll guide the rest.</h2></div>
        <Link href="/login?role=customer&next=%2Fcustomer%3Fstart%3Dguided">Get Puja help <ArrowRight /></Link>
      </section>

      <footer className="home-footer">
        <div className="home-footer-inner">
          <div className="home-footer-brand"><span>ॐ</span><div><strong>PujaOne</strong><small>Simple, respectful Puja assistance.</small></div></div>
          <nav aria-label="Legal and partner links"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/cancellation-policy">Cancellation policy</Link><Link href="/login?role=pandit">Join as a Pandit</Link></nav>
          <p>Made for families across India.</p>
        </div>
      </footer>
    </main>
  );
}
