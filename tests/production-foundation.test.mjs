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
  for (const id of ["ganesh-puja", "lakshmi-puja", "satyanarayan", "havan", "griha-pravesh", "religious-guidance"]) assert.match(migration, new RegExp(`'${id}'`));
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

test("visible testing OTP is restricted to localhost or an explicit phone allowlist", async () => {
  const security = await readFile(new URL("../lib/otp-security.ts", import.meta.url), "utf8");
  const requestRoute = await readFile(new URL("../app/api/auth/request/route.ts", import.meta.url), "utf8");
  assert.match(security, /OTP_TEST_PHONE_ALLOWLIST/);
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

test("unconfigured payments create explicitly free beta consultations", async () => {
  const payments = await readFile(new URL("../lib/payments.ts", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/consultations/route.ts", import.meta.url), "utf8");
  const panel = await readFile(new URL("../components/consultation-panel.tsx", import.meta.url), "utf8");
  assert.match(payments, /provider !== "development"/);
  assert.match(payments, /PAYMENT_PROVIDER_KEY_ID/);
  assert.match(payments, /PAYMENT_PROVIDER_KEY_SECRET/);
  assert.match(route, /billingEnabled \? available\.consultation_rate_5min \* blocks : 0/);
  assert.match(route, /"FREE_BETA"/);
  assert.match(panel, /Free beta mode: no payment or charge is collected/);
});
