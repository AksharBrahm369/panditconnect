import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("every booking records policy consent and an idempotency key", async () => {
  const booking = await source("../app/api/bookings/route.ts");
  const migration = await source("../db/migrations/0023_marketplace_risk_controls.sql");
  const customer = await source("../components/customer-portal.tsx");
  assert.match(booking, /policyAccepted !== true/);
  assert.match(booking, /policy_ip_hash/);
  assert.match(booking, /client_request_id/);
  assert.match(booking, /ON CONFLICT\(customer_id,client_request_id\)/);
  assert.match(migration, /booking_customer_request_key_idx/);
  assert.match(customer, /I understand and agree to cancellation policy/);
});

test("duplicate and overlapping requests are blocked at API and database levels", async () => {
  const booking = await source("../app/api/bookings/route.ts");
  const migration = await source("../db/migrations/0023_marketplace_risk_controls.sql");
  assert.match(booking, /OVERLAPPING_BOOKING/);
  assert.match(booking, /scheduled_at BETWEEN \$2::timestamptz - interval '3 hours'/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /prevent_customer_booking_overlap_trigger/);
});

test("late cancellation uses an exact preview, ledger and staged limits", async () => {
  const risk = await source("../lib/booking-risk.ts");
  const preview = await source("../app/api/bookings/[id]/cancellation-preview/route.ts");
  const transition = await source("../app/api/bookings/[id]/route.ts");
  const customer = await source("../components/customer-portal.tsx");
  assert.match(risk, /acceptedGraceMinutes: 5/);
  assert.match(risk, /Math\.min\(99/);
  assert.match(risk, /Math\.min\(199/);
  assert.match(preview, /cancellationFee/);
  assert.match(preview, /NO_POLICY_EVIDENCE/);
  assert.match(transition, /'CANCELLATION_FEE'/);
  assert.match(transition, /'PANDIT_COMPENSATION'/);
  assert.match(transition, /policyEvidencePresent/);
  assert.doesNotMatch(transition, /Cancellation policy evidence is missing\. Contact support/);
  assert.match(customer, /cancellationReview\.fee > 0/);
  assert.match(customer, /Cancel and accept ₹\$\{cancellationReview\.fee\} charge/);
  assert.match(customer, /Why are you cancelling\?/);
  assert.doesNotMatch(customer, /window\.prompt\("Tell us why you are cancelling/);
});

test("travel and no-show claims require recent GPS, proximity and waiting time", async () => {
  const transition = await source("../app/api/bookings/[id]/route.ts");
  const noShow = await source("../app/api/bookings/[id]/no-show/route.ts");
  assert.match(transition, /updated_at>now\(\)-interval '2 minutes'/);
  assert.match(transition, /distanceMetres!>1000/);
  assert.match(noShow, /arrived_at<=now\(\)-interval '15 minutes'/);
  assert.match(noShow, /status='DISPUTED'/);
  assert.doesNotMatch(noShow, /customer_risk_profiles/);
  assert.match(noShow, /pending Admin review/i);
});

test("cash settlement requires both sides and disputes do not auto-penalize customers", async () => {
  const payment = await source("../app/api/bookings/[id]/payment/route.ts");
  const migration = await source("../db/migrations/0023_marketplace_risk_controls.sql");
  assert.match(payment, /customer_cash_confirmed_at/);
  assert.match(payment, /pandit_cash_confirmed_at/);
  assert.match(payment, /CONFIRM_RECEIVED/);
  assert.match(payment, /PAYMENT_DISPUTED/);
  assert.doesNotMatch(payment, /customer_risk_profiles/);
  assert.match(migration, /'AWAITING_PANDIT','CONFIRMED','DISPUTED'/);
});

test("scope and price changes need a reason and explicit customer approval", async () => {
  const route = await source("../app/api/bookings/[id]/price-change/route.ts");
  const customer = await source("../components/customer-portal.tsx");
  const pandit = await source("../components/pandit-portal.tsx");
  assert.match(route, /reason\.length<10/);
  assert.match(route, /price_change_status='PENDING'/);
  assert.match(route, /decision\?:"APPROVE"\|"REJECT"/);
  assert.match(customer, /Approve ₹/);
  assert.match(pandit, /proposePriceChange/);
});

test("support abuse is limited while Admin retains fair waiver and uphold controls", async () => {
  const support = await source("../app/api/support-cases/route.ts");
  const admin = await source("../app/api/admin/support-cases/route.ts");
  assert.match(support, /open_count/);
  assert.match(support, /daily_count/);
  assert.match(support, /An open case for this booking and issue type already exists/);
  assert.match(admin, /waiveCancellationFee/);
  assert.match(admin, /upholdCancellationFee/);
  assert.match(admin, /Waived by Admin/);
  assert.match(admin, /Upheld by Admin/);
  assert.match(admin, /recordAdminAction/);
});

test("ratings remain one-per-completed-booking and aggregate without double counting", async () => {
  const rating = await source("../app/api/bookings/[id]/rating/route.ts");
  assert.match(rating, /status='COMPLETED' AND customer_rating IS NULL/);
  assert.match(rating, /round\(avg\(b\.customer_rating\)::numeric,1\)/);
  assert.match(rating, /CUSTOMER_RATING_SUBMITTED/);
  assert.doesNotMatch(rating, /count\(b\.customer_rating\)\+1/);
});

test("booking events preserve an owned privacy-safe audit timeline", async () => {
  const migration = await source("../db/migrations/0023_marketplace_risk_controls.sql");
  const events = await source("../app/api/bookings/[id]/events/route.ts");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS pim_v2\.booking_events/);
  assert.match(events, /customer_id=\$2 OR pandit_id=\$2/);
  assert.match(events, /Cache-Control":"private, no-store/);
});
