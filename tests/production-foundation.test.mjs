import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

async function render(path) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("foundation-test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test("anonymous visitors are redirected away from the admin portal", async () => {
  const response = await render("/admin");
  assert.ok([302, 303, 307, 308].includes(response.status));
  assert.match(response.headers.get("location") ?? "", /\/admin\/login/);
});

test("admin login page is available", async () => {
  const response = await render("/admin/login");
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Administrator sign in/);
});

test("admin API requires authentication", async () => {
  const response = await render("/api/admin/overview");
  assert.equal(response.status, 401);
});

test("Pandit onboarding APIs return authorization errors instead of server errors", async () => {
  const response = await render("/api/pandit/onboarding");
  assert.equal(response.status, 401);
});

test("manual location fallback is authenticated and sends only a PIN code", async () => {
  const route = await readFile(new URL("../app/api/location/geocode/route.ts", import.meta.url), "utf8");
  assert.match(route, /requireCustomer\(\)/);
  assert.match(route, /postalCode/);
  assert.doesNotMatch(route, /currentAddress|serviceAddress/);
});

test("service migration is idempotent and contains all permanent services", async () => {
  const migration = await readFile(new URL("../db/migrations/0009_production_foundation.sql", import.meta.url), "utf8");
  for (const id of ["ganesh-puja", "lakshmi-puja", "satyanarayan", "havan", "griha-pravesh"]) assert.match(migration, new RegExp(`'${id}'`));
  assert.match(migration, /ON CONFLICT\(id\) DO NOTHING/i);
});

test("active application database queries use the pim_v2 schema", async () => {
  const files = ["../lib/auth.ts", "../app/api/services/route.ts", "../app/api/admin/overview/route.ts", "../app/api/admin/pandits/route.ts"];
  for (const relative of files) {
    const source = await readFile(new URL(relative, import.meta.url), "utf8");
    assert.doesNotMatch(source, /\b(public\.User|public\.PanditProfile|public\.Booking|public\.PujaService)\b/i);
  }
});

test("secret files are ignored while the placeholder file is committed", async () => {
  const ignore = await readFile(new URL("../.gitignore", import.meta.url), "utf8");
  const example = await readFile(new URL("../.env.example", import.meta.url), "utf8");
  assert.match(ignore, /^\.env\*/m);
  assert.match(ignore, /^!\.env\.example$/m);
  assert.doesNotMatch(example, /postgres(?:ql)?:\/\/[^"\s]+:[^"\s]+@/i);
});

test("only successfully delivered OTP challenges can be verified", async () => {
  for (const relative of ["../app/api/auth/verify/route.ts", "../app/api/auth/admin/verify/route.ts"]) {
    const source = await readFile(new URL(relative, import.meta.url), "utf8");
    assert.match(source, /delivery_status IN \('DEVELOPMENT','SENT'\)/);
  }
});

test("visible testing OTP requires an explicit testing-mode switch, localhost or an allowlist", async () => {
  const security = await readFile(new URL("../lib/otp-security.ts", import.meta.url), "utf8");
  const requestRoute = await readFile(new URL("../app/api/auth/request/route.ts", import.meta.url), "utf8");
  assert.match(security, /OTP_TEST_PHONE_ALLOWLIST/);
  assert.match(security, /OTP_ALLOW_ALL_TEST_PHONES/);
  assert.match(security, /allTestPhonesEnabled/);
  assert.match(security, /testPhoneAllowlist\(\)\.has\(phone\)/);
  assert.match(security, /hostname === "localhost"/);
  assert.doesNotMatch(requestRoute, /devOtp:\s*otp/);
});

test("OTP security enforces cooldown, daily limits, retirement and cleanup", async () => {
  const security = await readFile(new URL("../lib/otp-security.ts", import.meta.url), "utf8");
  assert.match(security, /RESEND_COOLDOWN_SECONDS = 60/);
  assert.match(security, /PHONE_DAILY_LIMIT = 20/);
  assert.match(security, /IP_HOURLY_LIMIT = 20/);
  assert.match(security, /IP_DAILY_LIMIT = 50/);
  assert.match(security, /created_at<now\(\)-interval '2 days'/);
  assert.match(security, /SET expires_at=LEAST\(expires_at,now\(\)\)/);
});

test("OTP migration tracks delivery without storing plaintext codes", async () => {
  const migration = await readFile(new URL("../db/migrations/0010_otp_security_foundation.sql", import.meta.url), "utf8");
  assert.match(migration, /delivery_status/);
  assert.doesNotMatch(migration, /plaintext|otp_value|otp_code/i);
  assert.doesNotMatch(migration, /DROP\s+(TABLE|SCHEMA)/i);
});

test("trusted Pandit onboarding uses private Supabase storage and auditable reviews", async () => {
  const migration = await readFile(new URL("../db/migrations/0011_trusted_pandit_onboarding.sql", import.meta.url), "utf8");
  const storage = await readFile(new URL("../lib/supabase-storage.ts", import.meta.url), "utf8");
  const adminRoute = await readFile(new URL("../app/api/admin/pandits/route.ts", import.meta.url), "utf8");
  for (const table of ["pandit_documents", "pandit_references", "pandit_service_pricing", "pandit_verification_reviews", "pandit_verification_events"]) assert.match(migration, new RegExp(table));
  assert.match(migration, /'pandit-private-documents'[\s\S]*false/);
  assert.match(storage, /createPrivateSignedUrl/);
  assert.doesNotMatch(storage, /getPublicUrl|\/object\/public\//);
  assert.match(adminRoute, /Complete and verify every review check before approval/);
  assert.match(adminRoute, /body\.action === "APPROVE"[\s\S]*\? "APPROVED"/);
  assert.match(adminRoute, /body\.action === "REJECT"[\s\S]*\? "REJECTED"/);
  assert.match(adminRoute, /: "CHANGES_REQUESTED"/);
});

test("sessions persist independently from mutable account roles", async () => {
  const migration = await readFile(new URL("../db/migrations/0015_persistent_role_sessions.sql", import.meta.url), "utf8");
  const auth = await readFile(new URL("../lib/auth.ts", import.meta.url), "utf8");
  const adminVerify = await readFile(new URL("../app/api/auth/admin/verify/route.ts", import.meta.url), "utf8");
  assert.match(migration, /session_role/);
  assert.match(auth, /s\.session_role AS role/);
  assert.match(adminVerify, /session_role,expires_at/);
  assert.doesNotMatch(adminVerify, /DO UPDATE SET role='ADMIN'/);
  assert.match(adminVerify, /interval '30 days'/);
});

test("online consultations require a payment choice before chat creation", async () => {
  const payments = await readFile(new URL("../lib/payments.ts", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/consultations/route.ts", import.meta.url), "utf8");
  const panel = await readFile(new URL("../components/consultation-panel.tsx", import.meta.url), "utf8");
  const migration = await readFile(new URL("../db/migrations/0018_consultation_payment_method.sql", import.meta.url), "utf8");
  assert.match(payments, /provider !== "development"/);
  assert.match(payments, /PAYMENT_PROVIDER_KEY_ID/);
  assert.match(payments, /PAYMENT_PROVIDER_KEY_SECRET/);
  assert.match(route, /paymentMethod !== "CASH"/);
  assert.match(route, /const paymentStatus = "CASH_SELECTED"/);
  assert.match(route, /available\.consultation_rate_5min \* blocks/);
  assert.match(panel, /Payment before chat/);
  assert.match(panel, />Cash</);
  assert.match(panel, />UPI</);
  assert.match(panel, />Card</);
  assert.match(migration, /payment_method/);
});

test("security hardening protects arrival codes, uploads and state-changing requests", async () => {
  const arrival = await readFile(new URL("../lib/arrival-otp.ts", import.meta.url), "utf8");
  const files = await readFile(new URL("../lib/file-validation.ts", import.meta.url), "utf8");
  const proxy = await readFile(new URL("../proxy.ts", import.meta.url), "utf8");
  const config = await readFile(new URL("../next.config.ts", import.meta.url), "utf8");
  assert.match(arrival, /AES-GCM/);
  assert.match(arrival, /constantTimeEqual/);
  assert.match(files, /file\.slice\(0, 32\)/);
  assert.match(files, /application\/pdf/);
  assert.match(proxy, /sec-fetch-site/);
  assert.match(proxy, /Untrusted request origin/);
  assert.match(config, /Content-Security-Policy/);
  assert.match(config, /Strict-Transport-Security/);
});

test("mobile navigation and core workspaces use responsive phone layouts", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const shell = await readFile(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
  const admin = await readFile(new URL("../components/admin-portal.tsx", import.meta.url), "utf8");
  assert.match(shell, /mobile-nav-\$\{navigation\.length\}/);
  assert.match(styles, /\.portal-mobile-nav\.mobile-nav-4[\s\S]*repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
  assert.match(styles, /input, textarea, select \{ min-height: 46px; font-size: 16px; \}/);
  assert.match(styles, /@media \(max-width: 390px\)/);
  assert.match(admin, /admin-bookings-table/);
  assert.match(admin, /data-label="Status"/);
});

test("completed Puja payment choice is persisted without pretending to process online payments", async () => {
  const migration = await readFile(new URL("../db/migrations/0017_booking_payment_method.sql", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/bookings/[id]/payment/route.ts", import.meta.url), "utf8");
  const customer = await readFile(new URL("../components/customer-portal.tsx", import.meta.url), "utf8");
  assert.match(migration, /payment_method/);
  assert.match(migration, /payment_status/);
  assert.match(migration, /'CASH','UPI','CARD','OTHER'/);
  assert.match(route, /user\.role !== "CUSTOMER"/);
  assert.match(route, /status='COMPLETED'/);
  assert.match(route, /payment will be available after the secure payment gateway is configured/);
  assert.match(customer, />Cash</);
  assert.match(customer, />UPI</);
  assert.match(customer, />Card</);
  assert.match(customer, /Coming soon/);
  assert.doesNotMatch(customer, /confirmPaymentMethod\(booking\.id, "OTHER"\)/);
});

test("operations foundation provides support, moderation, cancellations and notification preferences", async () => {
  const migration = await readFile(new URL("../db/migrations/0019_operations_support.sql", import.meta.url), "utf8");
  const support = await readFile(new URL("../app/api/support-cases/route.ts", import.meta.url), "utf8");
  const admin = await readFile(new URL("../app/api/admin/support-cases/route.ts", import.meta.url), "utf8");
  const booking = await readFile(new URL("../app/api/bookings/[id]/route.ts", import.meta.url), "utf8");
  const auth = await readFile(new URL("../lib/auth.ts", import.meta.url), "utf8");
  for (const name of ["support_cases","notification_preferences","account_status","cancellation_reason"]) assert.match(migration,new RegExp(name));
  assert.match(support,/reporter_id=\$1/);
  assert.match(admin,/recordAdminAction/);
  assert.match(admin,/PANDIT_\$\{body\.accountAction\}/);
  assert.match(booking,/cancellationReason/);
  assert.match(auth,/u\.account_status='ACTIVE'/);
});

test("Pandit and admin onboarding no longer require or display interviews", async () => {
  const pandit = await readFile(new URL("../components/pandit-onboarding.tsx", import.meta.url), "utf8");
  const admin = await readFile(new URL("../components/admin-portal.tsx", import.meta.url), "utf8");
  const onboarding = await readFile(new URL("../app/api/pandit/onboarding/route.ts", import.meta.url), "utf8");
  const review = await readFile(new URL("../app/api/admin/pandits/route.ts", import.meta.url), "utf8");
  for (const source of [pandit,admin,onboarding]) assert.doesNotMatch(source,/interview/i);
  assert.doesNotMatch(review,/videoInterviewStatus|video_interview_status/);
  assert.match(review,/document_type<>'VIDEO_INTERVIEW'/);
});

test("online consultation is excluded from the Puja service selector", async () => {
  const migration = await readFile(new URL("../db/migrations/0020_remove_consultation_from_puja_services.sql", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/services/route.ts", import.meta.url), "utf8");
  assert.match(migration,/id='religious-guidance'/);
  assert.match(migration,/active=false/);
  assert.match(route,/id<>'religious-guidance'/);
});

test("submitted Pandits see a pending screen and receive admin decision notifications", async () => {
  const portal = await readFile(new URL("../components/pandit-portal.tsx", import.meta.url), "utf8");
  const admin = await readFile(new URL("../app/api/admin/pandits/route.ts", import.meta.url), "utf8");
  assert.match(portal,/Your request is pending with Admin/);
  assert.match(portal,/checks for updates automatically/);
  assert.match(portal,/Enable notifications from the bell icon/);
  assert.match(admin,/Application approved/);
  assert.match(admin,/Application not approved/);
  assert.match(admin,/notifyUser\(panditId/);
});

test("customers can review every eligible nearby Pandit before sending a request", async () => {
  const nearby = await readFile(new URL("../app/api/pandits/nearby/route.ts", import.meta.url), "utf8");
  const booking = await readFile(new URL("../app/api/bookings/route.ts", import.meta.url), "utf8");
  const customer = await readFile(new URL("../components/customer-portal.tsx", import.meta.url), "utf8");
  assert.match(nearby, /WHERE distance <= service_radius_km/);
  assert.match(nearby, /least\(COALESCE\(p\.service_radius_km,25\),25\)/);
  assert.match(nearby, /LIMIT 50/);
  assert.match(booking, /body\.panditId/);
  assert.match(booking, /u\.id=\$4/);
  assert.doesNotMatch(booking, /ORDER BY language_rank,distance,rating DESC LIMIT 1/);
  assert.match(customer, /Choose your Pandit/);
  assert.match(customer, /sortedNearbyPandits\.map/);
  assert.match(customer, /Send request to/);
  assert.match(customer, /Highest rated/);
  assert.match(customer, /Most experienced/);
});

test("push notifications provide sound, delivery diagnostics and admin event coverage", async () => {
  const center = await readFile(new URL("../components/notification-center.tsx", import.meta.url), "utf8");
  const worker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  const push = await readFile(new URL("../lib/push-notifications.ts", import.meta.url), "utf8");
  const onboarding = await readFile(new URL("../app/api/pandit/onboarding/route.ts", import.meta.url), "utf8");
  const support = await readFile(new URL("../app/api/support-cases/route.ts", import.meta.url), "utf8");
  const booking = await readFile(new URL("../app/api/bookings/route.ts", import.meta.url), "utf8");
  assert.match(worker, /self\.skipWaiting/);
  assert.match(worker, /self\.clients\.claim/);
  assert.match(worker, /PANDITCONNECT_PUSH/);
  assert.match(worker, /silent: false/);
  assert.match(center, /navigator\.vibrate/);
  assert.match(center, /playAlertSound/);
  assert.match(center, /registration\.update/);
  assert.match(center, /push delivery failed/i);
  assert.match(push, /export async function notifyAdmins/);
  assert.match(onboarding, /notifyAdmins/);
  assert.match(support, /notifyAdmins/);
  assert.match(booking, /notifyAdmins/);
});

test("Pandits receive the customer address and GPS directions only after accepting", async () => {
  const route = await readFile(new URL("../app/api/bookings/route.ts", import.meta.url), "utf8");
  const portal = await readFile(new URL("../components/pandit-portal.tsx", import.meta.url), "utf8");
  assert.match(route, /CASE WHEN b\.status='REQUESTED' THEN 'Exact address shared after acceptance'/);
  assert.match(route, /CASE WHEN b\.status='REQUESTED' THEN NULL ELSE b\.latitude/);
  assert.match(route, /CASE WHEN b\.status='REQUESTED' THEN NULL ELSE b\.longitude/);
  assert.match(portal, /Customer service address/);
  assert.match(portal, /Open directions/);
  assert.match(portal, /google\.com\/maps\/dir/);
});

test("rematching and consultation selection stay nearby, notify Pandits and prevent self-selection", async () => {
  const rematch = await readFile(new URL("../app/api/bookings/[id]/rematch/route.ts", import.meta.url), "utf8");
  const booking = await readFile(new URL("../app/api/bookings/route.ts", import.meta.url), "utf8");
  const consultation = await readFile(new URL("../app/api/consultations/route.ts", import.meta.url), "utf8");
  assert.match(rematch, /service_radius_km/);
  assert.match(rematch, /<= least\(COALESCE\(p\.service_radius_km,25\),25\)/);
  assert.match(rematch, /notifyUser\(match\.id/);
  assert.match(booking, /u\.id<>\$5/);
  assert.match(consultation, /user_id<>\$2/);
  assert.match(consultation, /CONSULTATION_STARTED/);
});

test("customer and Pandit profile editing is role scoped and protects verified fields", async () => {
  const migration = await readFile(new URL("../db/migrations/0021_role_profiles.sql", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/profile/route.ts", import.meta.url), "utf8");
  const editor = await readFile(new URL("../components/profile-editor.tsx", import.meta.url), "utf8");
  const shell = await readFile(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS pim_v2\.customer_profiles/);
  assert.match(migration, /REFERENCES pim_v2\.users\(id\) ON DELETE CASCADE/);
  assert.match(route, /requireUser\(\)/);
  assert.match(route, /WHERE u\.id=\$1/);
  assert.match(route, /UPDATE pim_v2\.users SET name=\$2,city=\$3 WHERE id=\$1/);
  assert.match(route, /WITH updated_user AS/);
  assert.match(route, /notifyAdmins/);
  assert.match(editor, /Verified mobile number/);
  assert.match(editor, /readOnly disabled/);
  assert.match(editor, /Protected verification details/);
  assert.match(editor, /Save profile changes/);
  assert.match(shell, /#customer-profile/);
  assert.match(shell, /#pandit-profile/);
});
