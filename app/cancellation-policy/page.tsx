import { LegalPage } from "@/components/legal-page";

export default function CancellationPolicyPage() {
  return <LegalPage title="Cancellation and refund policy" summary="Clear status messages help customers understand whether a request was sent, accepted, cancelled or completed.">
    <section><h2>Before acceptance</h2><p>A customer may withdraw a request before a Pandit accepts it. If a Pandit declines or does not accept, no booking is confirmed and the customer can search for another available Pandit.</p></section>
    <section><h2>After acceptance</h2><p>Cancellation after acceptance should be made as early as possible. During beta, the platform does not collect online payment, so no platform payment refund is generated. Any cash or direct payment dispute must be reported through support with the booking reference.</p></section>
    <section><h2>Pandit cancellation or non-arrival</h2><p>If a Pandit cancels or cannot arrive, the customer may request rematching. Repeated cancellation, false status updates or non-arrival may trigger review or suspension.</p></section>
    <section><h2>Future paid services</h2><p>Before online payments launch, this policy must be updated with cancellation windows, fees, refund destination and timing, chargeback handling, taxes and grievance escalation. Paid checkout must not be enabled until those terms are published.</p></section>
  </LegalPage>;
}
