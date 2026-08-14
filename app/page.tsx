import Link from "next/link";
import { DM_Sans, Lora } from "next/font/google";
import {
  ArrowRight, BadgeCheck, CalendarDays, CalendarX2, Check,
  ChevronRight, Clock3, MapPin, MessageCircle, ShieldCheck,
} from "lucide-react";

const homeSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-home-sans",
  weight: ["400", "500", "600", "700"],
});

const homeSerif = Lora({
  subsets: ["latin"],
  variable: "--font-home-serif",
  weight: ["500", "600", "700"],
});

export default function Home() {
  return (
    <main className={`${homeSans.variable} ${homeSerif.variable} public-home`}>
      <header className="home-header">
        <div className="home-header-inner">
          <Link href="/" className="home-brand" aria-label="PanditConnect home">
            <span className="home-brand-mark">ॐ</span>
            <span className="home-brand-copy"><strong>PanditConnect</strong><small>Trusted Puja assistance</small></span>
          </Link>
          <nav className="home-nav" aria-label="Homepage navigation">
            <a href="#services">Services</a>
            <a href="#how-it-works">How it works</a>
            <a href="#trust">Safety</a>
            <Link href="/login?role=pandit">For Pandits</Link>
          </nav>
          <Link href="/login?role=customer" className="home-header-cta">Find a Pandit <ArrowRight /></Link>
        </div>
      </header>

      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-copy">
          <div className="home-eyebrow"><BadgeCheck /> Verified nearby Pandits for home Puja</div>
          <h1 id="home-title">A trusted Pandit, when your family needs one.</h1>
          <p className="home-hero-lead">Tell us what happened in your own words. We help you choose the right Puja and connect you with a suitable nearby Pandit.</p>
          <div className="home-hero-actions">
            <Link href="/login?role=customer" className="home-primary-button">Find a nearby Pandit <ArrowRight /></Link>
            <a href="#how-it-works" className="home-text-link">See how booking works <ChevronRight /></a>
          </div>
          <ul className="home-assurances" aria-label="Booking assurances">
            <li><Check /> Admin-verified profiles</li>
            <li><Check /> Exact address stays private</li>
            <li><Check /> Track every booking update</li>
          </ul>
        </div>

        <div className="home-hero-media">
          {/* Public assets bypass the local image optimiser used by Vinext. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/puja-hero.png" alt="A family speaking with a Pandit during a home Puja" width="1024" height="1024" />
          <div className="home-photo-status"><span><i /> Pandits available nearby</span><small>Location is checked only after you allow it</small></div>
          <div className="home-photo-trust"><ShieldCheck /><span><strong>Private by design</strong><small>Your contact details are never public</small></span></div>
        </div>
      </section>

      <section className="home-service-section" id="services" aria-labelledby="service-title">
        <div className="home-section-heading">
          <span>Start here</span>
          <h2 id="service-title">What would you like help with?</h2>
          <p>You do not need to know religious terminology. Choose the situation that feels closest.</p>
        </div>
        <div className="home-service-grid">
          <Link href="/login?role=customer&next=%2Fcustomer%3Fstart%3Dguided" className="home-service-card">
            <span className="home-service-icon"><CalendarDays /></span>
            <div><small>Most requested</small><strong>Book a Puja at home</strong><p>For today or a future date. We will help you choose the appropriate Puja.</p></div>
            <span className="home-card-action">Start booking <ArrowRight /></span>
          </Link>
          <Link href="/login?role=customer&next=%2Fcustomer%3Fstart%3Dsos" className="home-service-card">
            <span className="home-service-icon"><CalendarX2 /></span>
            <div><small>Urgent help</small><strong>My Pandit cancelled</strong><p>Find another approved Pandit near your location without starting over.</p></div>
            <span className="home-card-action">Find a replacement <ArrowRight /></span>
          </Link>
          <Link href="/login?role=customer&next=%2Fcustomer%3Fstart%3Donline" className="home-service-card">
            <span className="home-service-icon"><MessageCircle /></span>
            <div><small>Private guidance</small><strong>Ask a Pandit online</strong><p>Chat privately when you need religious guidance rather than a home visit.</p></div>
            <span className="home-card-action">Ask online <ArrowRight /></span>
          </Link>
        </div>
      </section>

      <section className="home-process" id="how-it-works" aria-labelledby="process-title">
        <div className="home-process-intro">
          <span>Simple from the first step</span>
          <h2 id="process-title">Book with clarity, not guesswork.</h2>
          <p>You review the Puja, language, price, distance and Pandit profile before sending any request.</p>
          <Link href="/login?role=customer" className="home-process-link">Get Puja help <ArrowRight /></Link>
        </div>
        <ol className="home-process-list">
          <li><b>01</b><span><strong>Describe what you need</strong><small>Type or speak naturally. The app suggests the most suitable ritual.</small></span></li>
          <li><b>02</b><span><strong>Compare nearby Pandits</strong><small>See experience, language, ratings, price and travel time.</small></span></li>
          <li><b>03</b><span><strong>Send and track the request</strong><small>Follow acceptance, travel and arrival from one clear screen.</small></span></li>
        </ol>
      </section>

      <section className="home-trust" id="trust" aria-labelledby="trust-title">
        <div className="home-trust-copy">
          <span>Built around family trust</span>
          <h2 id="trust-title">You stay in control from request to arrival.</h2>
        </div>
        <div className="home-trust-points">
          <article><BadgeCheck /><span><strong>Profiles reviewed</strong><small>Identity and experience are checked before approval.</small></span></article>
          <article><MapPin /><span><strong>Nearby matching</strong><small>Location is used only to find Pandits serving your area.</small></span></article>
          <article><Clock3 /><span><strong>Live booking status</strong><small>Know whether your request is pending, accepted or on the way.</small></span></article>
        </div>
      </section>

      <footer className="home-footer">
        <div className="home-footer-inner">
          <div className="home-footer-brand"><span>ॐ</span><div><strong>PanditConnect</strong><small>Trusted religious help, nearby.</small></div></div>
          <nav aria-label="Legal and partner links"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/cancellation-policy">Cancellation policy</Link><Link href="/login?role=pandit">Join as a Pandit</Link></nav>
          <p>Designed for simple, private and respectful Puja assistance.</p>
        </div>
      </footer>
    </main>
  );
}
