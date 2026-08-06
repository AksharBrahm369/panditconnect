import { LegalPage } from "@/components/legal-page";

export default function TermsPage() {
  return <LegalPage title="Platform terms" summary="Pandit in Minutes is a marketplace that helps customers discover and coordinate with independently verified Pandits.">
    <section><h2>Accounts and eligibility</h2><p>Users must provide accurate information and protect access to their registered device. Pandits may offer services only after completing the verification process and receiving approval. Approval may be suspended for safety, fraud, inaccurate information or rule violations.</p></section>
    <section><h2>Requests and services</h2><p>A request is not confirmed merely because it was sent. Confirmation occurs only after a Pandit accepts. Ritual guidance and services are provided by the Pandit, who remains responsible for professional conduct, agreed materials, timing and lawful service delivery.</p></section>
    <section><h2>Safety and acceptable use</h2><p>Do not misuse another person’s identity, share arrival codes before the Pandit reaches the location, harass participants, bypass platform safeguards or upload unlawful content. Emergencies should be directed to appropriate emergency services; this platform is not an emergency service.</p></section>
    <section><h2>Beta features and payments</h2><p>Online guidance currently operates in free beta mode. No payment is collected for a session labelled “Free beta”. Prices shown for home visits must be confirmed before booking. Commercial payment terms, taxes and invoicing must be finalised before live payment collection begins.</p></section>
    <section><h2>Changes and disputes</h2><p>Material changes will be communicated through the platform. A verified legal business name, address, support contact, grievance officer and jurisdiction clause must be inserted following Indian legal review before commercial launch.</p></section>
  </LegalPage>;
}
