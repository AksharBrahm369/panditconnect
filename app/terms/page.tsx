import { LegalPage } from "@/components/legal-page";
import { LegalContact } from "@/components/legal-contact";

export default function TermsPage() {
  return <LegalPage title="Platform terms" summary="PujaOne is a marketplace that helps customers discover and coordinate with independently verified Pandits.">
    <section><h2>Accounts and eligibility</h2><p>Users must provide accurate information and protect access to their registered device. Pandits may offer services only after completing the verification process and receiving approval. Approval may be suspended for safety, fraud, inaccurate information or rule violations.</p></section>
    <section><h2>Requests and services</h2><p>A request is not confirmed merely because it was sent. Confirmation occurs only after a Pandit accepts. Ritual guidance and services are provided by the Pandit, who remains responsible for professional conduct, agreed materials, timing and lawful service delivery.</p></section>
    <section><h2>Safety and acceptable use</h2><p>Do not misuse another person’s identity, share arrival codes before the Pandit reaches the location, harass participants, bypass platform safeguards or upload unlawful content. Emergencies should be directed to appropriate emergency services; this platform is not an emergency service.</p></section>
    <section><h2>Payments</h2><p>A payment is collected only when an enabled payment option is shown and confirmed. Prices shown for home visits must be reviewed before booking. Applicable taxes, refunds and invoice details are shown through the relevant payment flow.</p></section>
    <section><h2>Changes and disputes</h2><p>Material changes will be communicated through the platform. Payment and service complaints should first be raised through an in-app support case; unresolved matters may be escalated to the published grievance officer.</p></section>
    <LegalContact />
  </LegalPage>;
}
