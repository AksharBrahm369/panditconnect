import { LegalPage } from "@/components/legal-page";
import { LegalContact } from "@/components/legal-contact";

export default function PrivacyPage() {
  return <LegalPage title="Privacy notice" summary="This notice explains what PujaOne collects, why it is needed, and the choices available to customers and Pandits.">
    <section><h2>Information we collect</h2><p>We collect account details, verified mobile number, profile and onboarding information, booking and chat records, approximate or precise location when you choose to share it, device notification subscriptions, and security logs. Pandit identity, address, bank and verification documents are stored privately and are accessible only to authorised reviewers.</p></section>
    <section><h2>How we use it</h2><p>We use data to authenticate accounts, match nearby Pandits, deliver and track requests, review Pandit eligibility, provide support, prevent abuse, send requested notifications, and meet legal obligations. We do not sell personal data.</p></section>
    <section><h2>Sharing and location</h2><p>Only information necessary to fulfil a confirmed request is shared between participants. Exact customer contact details are not displayed publicly. If precise GPS is unavailable, the customer can choose a PIN-code-area lookup; only the PIN code is sent to the geocoding service.</p></section>
    <section><h2>Retention and choices</h2><p>Data is retained only for platform operation, safety, disputes and applicable legal requirements. Signed-in customers and Pandits can export their information, close sessions, withdraw optional marketing consent and request account or document deletion from My data settings.</p></section>
    <section><h2>Security</h2><p>Sessions use secure cookies, sensitive files use private storage with expiring links, and access is role restricted. No online system can promise absolute security. Suspected unauthorised access should be reported immediately through support.</p></section>
    <LegalContact />
  </LegalPage>;
}
