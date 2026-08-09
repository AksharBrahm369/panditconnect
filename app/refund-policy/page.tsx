import { LegalContact } from "@/components/legal-contact";
import { LegalPage } from "@/components/legal-page";

export default function RefundPolicyPage(){return <LegalPage title="Payments, refunds and grievances" summary="How payment failures, refunds, disputed charges and escalation are handled when online payments are activated.">
  <section><h2>Payment status</h2><p>A payment is successful only after the payment provider confirms it on the server. A pending or failed attempt does not confirm a booking. Never pay a Pandit through an unverified link or share an OTP, PIN or card credential.</p></section>
  <section><h2>Refund handling</h2><p>Eligible online refunds are initiated to the original payment method after support review. Provider and bank processing times may vary; the platform records a refund reference and status. Cash disputes cannot be automatically reversed and require evidence-based support review.</p></section>
  <section><h2>Failed, duplicate or unauthorised payments</h2><p>Open a Payment support case with the booking reference and provider reference. Duplicate confirmed payments are reviewed for refund. Suspected unauthorised activity should also be reported immediately to the bank or payment provider.</p></section>
  <section><h2>Escalation</h2><p>Normal cases receive a first response target within one business day and a resolution target within seven days. Urgent safety or active-service cases are prioritised. If unresolved, escalate the case to the published grievance officer with the support-case ID.</p></section>
  <LegalContact/>
 </LegalPage>;}
