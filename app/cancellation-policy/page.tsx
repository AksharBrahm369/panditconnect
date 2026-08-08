import { LegalPage } from "@/components/legal-page";

export default function CancellationPolicyPage() {
  return <LegalPage title="Cancellation policy" summary="Policy version 2026-08-v1. The exact charge is shown before a customer confirms cancellation.">
    <section><h2>Fees by booking stage</h2><p>Before acceptance: free. Within five minutes after acceptance: free. After that grace period: ₹49. Once the Pandit is travelling: 20% of the Puja amount, capped at ₹99. After verified arrival: 30%, capped at ₹199. Once the arrival code starts the Puja, online cancellation is unavailable and support must review any exceptional situation.</p></section>
    <section><h2>Payment after Puja</h2><p>The full Puja amount remains payable after service. A late-cancellation charge is recorded separately as an outstanding account balance. Until online collection is enabled, customers can dispute or request a waiver through support. New bookings may be paused while a valid balance remains outstanding.</p></section>
    <section><h2>Customer protections</h2><p>No charge should apply when the Pandit cancelled, asked the customer to cancel, materially failed to travel, arrived at the wrong location, or a genuine safety issue occurred. Select the relevant cancellation reason and create a support case. Admin can review GPS and the booking timeline and waive an incorrect charge.</p></section>
    <section><h2>Pandit protection</h2><p>Late charges compensate reserved time and verified travel. False travel or arrival updates, repeated cancellations and non-arrival are reviewable and may lead to restrictions. Compensation remains pending until the related charge is collected and any dispute is resolved.</p></section>
    <section><h2>Consent and records</h2><p>The customer must accept this policy before every booking. The platform records the policy version, acceptance time, booking status changes and limited security hashes. It does not publicly expose this information.</p></section>
  </LegalPage>;
}
