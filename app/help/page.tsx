import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, BadgeCheck, Headphones, MapPin,
  MessageSquareText, MousePointerClick, PlayCircle, Route, ShieldCheck,
} from "lucide-react";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "How to use the app",
  description: "Simple step-by-step help for finding and booking a nearby Pandit.",
};

export default async function HelpPage() {
  const user = await currentUser();
  const isCustomer = user?.role === "CUSTOMER";
  const guidedHref = isCustomer
    ? "/customer?start=guided"
    : "/login?role=customer&next=%2Fcustomer%3Fstart%3Dguided";
  const supportHref = isCustomer
    ? "/customer/settings/support"
    : "/login?role=customer&next=%2Fcustomer%2Fsettings%2Fsupport";

  return (
    <main className="help-page">
      <header className="help-header">
        <Link href={isCustomer ? "/customer" : "/"} className="help-back"><ArrowLeft /> Back</Link>
        <Link href="/" className="help-brand"><span>ॐ</span><strong>Pandit in Minutes</strong></Link>
      </header>

      <section className="help-intro">
        <span className="help-kicker">Simple app assistance</span>
        <h1>How can we help you?</h1>
        <p>Choose one option. You will not lose your booking or account information.</p>
      </section>

      <section className="help-options" aria-label="App help choices">
        <Link href={guidedHref} className="help-option help-option-primary">
          <span className="help-option-icon"><Route /></span>
          <span><small>Recommended</small><strong>Guide me step by step</strong><em>Answer one simple question at a time</em></span>
          <ArrowRight />
        </Link>
        <a href="#walkthrough" className="help-option">
          <span className="help-option-icon"><PlayCircle /></span>
          <span><strong>Show me how it works</strong><em>A quick visual guide with no video download</em></span>
          <ArrowRight />
        </a>
        <Link href={supportHref} className="help-option">
          <span className="help-option-icon"><Headphones /></span>
          <span><strong>Talk to app support</strong><em>Help with booking, account or safety</em></span>
          <ArrowRight />
        </Link>
      </section>

      <section className="help-separation-note">
        <MessageSquareText />
        <div><strong>Need religious advice?</strong><p>Use “Ask a Pandit online” in the customer portal. App support is only for help using the website.</p></div>
      </section>

      <section className="help-walkthrough" id="walkthrough" aria-labelledby="walkthrough-title">
        <div className="help-walkthrough-heading">
          <span>Quick visual guide</span>
          <h2 id="walkthrough-title">Book a Pandit in three steps</h2>
          <p>Nothing is sent until you review and confirm it.</p>
        </div>
        <ol>
          <li><b>1</b><span className="help-step-icon"><MousePointerClick /></span><div><strong>Tell us what you need</strong><p>Type or speak what happened. You do not need to know the Puja name.</p></div></li>
          <li><b>2</b><span className="help-step-icon"><MapPin /></span><div><strong>Allow location</strong><p>We show only approved Pandits who are available near you.</p></div></li>
          <li><b>3</b><span className="help-step-icon"><BadgeCheck /></span><div><strong>Review and send</strong><p>Check the Pandit, price, language and distance before sending your request.</p></div></li>
        </ol>
        <Link href={guidedHref} className="help-start">Start with step-by-step help <ArrowRight /></Link>
        <p className="help-privacy"><ShieldCheck /> Your phone number and exact address are never displayed publicly.</p>
      </section>
    </main>
  );
}
