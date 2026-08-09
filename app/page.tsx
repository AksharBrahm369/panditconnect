import Link from "next/link";
import {
  ArrowRight, BadgeCheck, CalendarClock, CalendarX2, HelpCircle,
  MapPin, MessageCircle, ShieldCheck,
} from "lucide-react";

export default function Home() {
  return (
    <main className="easy-home">
      <header className="easy-header">
        <Link href="/" className="easy-brand" aria-label="Pandit in Minutes home">
          <span>ॐ</span>
          <strong>Pandit in Minutes</strong>
        </Link>
        <Link href="/login?role=customer" className="easy-header-action">Get Puja help</Link>
      </header>

      <section className="easy-hero" aria-labelledby="easy-home-title">
        <div className="easy-hero-copy">
          <span className="easy-kicker"><HelpCircle /> Simple help for every family</span>
          <h1 id="easy-home-title">What do you need help with?</h1>
          <p>Choose one option. We will guide you step by step—you do not need to know the Puja name.</p>

          <div className="easy-actions" aria-label="Choose the help you need">
            <Link href="/login?role=customer" className="easy-action-primary">
              <span className="easy-action-icon"><MapPin /></span>
              <span><small>Most common choice</small><strong>Find a Pandit near me</strong><em>For a Puja at home, today or later</em></span>
              <ArrowRight />
            </Link>

            <div className="easy-secondary-actions">
              <Link href="/login?role=customer" className="easy-action-secondary">
                <span><CalendarX2 /></span>
                <strong>My Pandit cancelled</strong>
                <small>Find a nearby replacement</small>
                <ArrowRight />
              </Link>
              <Link href="/login?role=customer" className="easy-action-secondary">
                <span><MessageCircle /></span>
                <strong>Ask a Pandit online</strong>
                <small>Get private religious guidance</small>
                <ArrowRight />
              </Link>
            </div>
          </div>

          <p className="easy-reassurance"><ShieldCheck /> Your phone number and exact address are never shown publicly.</p>
        </div>

        <div className="easy-hero-visual">
          {/* Public assets bypass the local image optimiser used by Vinext. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/puja-hero.png" alt="A family welcoming a Pandit for a Puja at home" width="1024" height="1024" />
          <div className="easy-visual-note"><BadgeCheck /><span><strong>Verified Pandits</strong><small>Identity and experience reviewed</small></span></div>
        </div>
      </section>

      <section className="easy-steps" id="how-it-works" aria-labelledby="easy-steps-title">
        <div className="easy-section-heading">
          <span>What happens next?</span>
          <h2 id="easy-steps-title">Three simple steps</h2>
          <p>There are no hidden steps. Nothing is booked until you confirm.</p>
        </div>
        <ol>
          <li><b>1</b><span><strong>Tell us what happened</strong><small>Type or speak in simple words.</small></span></li>
          <li><b>2</b><span><strong>Allow your location</strong><small>We show only suitable nearby Pandits.</small></span></li>
          <li><b>3</b><span><strong>Choose and send request</strong><small>Compare the Pandit, price and distance first.</small></span></li>
        </ol>
        <Link href="/login?role=customer" className="easy-start-button">Start finding a Pandit <ArrowRight /></Link>
      </section>

      <section className="easy-trust" aria-label="Booking protections">
        <article><BadgeCheck /><span><strong>Admin verified</strong><small>Every visible Pandit is reviewed</small></span></article>
        <article><MapPin /><span><strong>Nearby Pandits only</strong><small>See suitable Pandits close to you</small></span></article>
        <article><CalendarClock /><span><strong>Live status updates</strong><small>Follow acceptance and arrival</small></span></article>
      </section>

      <footer className="easy-footer">
        <div><span>ॐ</span><strong>Pandit in Minutes</strong><small>Trusted religious help, nearby.</small></div>
        <nav aria-label="Legal and partner links"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/cancellation-policy">Cancellation</Link><Link href="/login?role=pandit">Join as Pandit</Link></nav>
      </footer>
    </main>
  );
}
