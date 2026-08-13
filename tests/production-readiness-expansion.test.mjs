import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = (relative) => readFile(new URL(relative, import.meta.url), "utf8");

test("rating counters are database maintained and reconcilable", async () => {
  const migration = await source("../db/migrations/0024_pandit_counter_integrity.sql");
  assert.match(migration, /CREATE OR REPLACE FUNCTION pim_v2\.sync_pandit_booking_counters/i);
  assert.match(migration, /CREATE TRIGGER/i);
  assert.match(migration, /rating_count/i);
  assert.match(migration, /completed_jobs/i);
});

test("scheduled operations cover expiry, reminders, retries and SLA escalation", async () => {
  const operations = await source("../lib/scheduled-operations.ts");
  const cron = await source("../app/api/cron/operations/route.ts");
  const migration = await source("../db/migrations/0025_operational_reliability.sql");
  for (const expected of ["runScheduledOperations", "rematchExpiredRequest", "retryQueuedPushNotifications", "supportEscalations", "DELETE FROM pim_v2.sessions"]) {
    assert.match(operations, new RegExp(expected));
  }
  assert.match(cron, /CRON_SECRET/);
  assert.match(cron, /runScheduledOperations/);
  assert.match(migration, /push_delivery_queue/i);
  assert.match(migration, /operation_runs/i);
});

test("privacy rights support export, consent, sessions and deletion review", async () => {
  const migration = await source("../db/migrations/0026_privacy_rights.sql");
  const customer = await source("../app/api/account/privacy/route.ts");
  const sessions = await source("../app/api/account/sessions/route.ts");
  const admin = await source("../app/api/admin/privacy-requests/route.ts");
  for (const right of ["EXPORT", "ACCOUNT_DELETION", "DOCUMENT_DELETION"]) assert.match(migration, new RegExp(right));
  assert.match(customer, /CONSENT_WITHDRAWAL/);
  assert.match(customer, /OPTIONAL_MARKETING/);
  assert.match(sessions, /DELETE FROM pim_v2\.sessions WHERE user_id=\$1/);
  assert.match(admin, /removePanditDocuments/);
  assert.match(admin, /account_status='DELETED'/);
});

test("distributed abuse controls protect non-OTP endpoints", async () => {
  const limiter = await source("../lib/rate-limit.ts");
  assert.match(limiter, /api_rate_limits/);
  assert.match(limiter, /429/);
  for (const relative of [
    "../app/api/bookings/route.ts",
    "../app/api/consultations/route.ts",
    "../app/api/consultations/[id]/messages/route.ts",
    "../app/api/location/geocode/route.ts",
    "../app/api/support-cases/route.ts",
    "../app/api/ritual-preparation/route.ts",
  ]) assert.match(await source(relative), /enforceRateLimit/);
});

test("online money movement trusts signed provider webhooks", async () => {
  const provider = await source("../lib/payment-provider.ts");
  const webhook = await source("../app/api/payments/webhook/route.ts");
  const orders = await source("../app/api/payments/orders/route.ts");
  const migration = await source("../db/migrations/0028_payments_and_payouts.sql");
  assert.match(provider, /timingSafeEqual/);
  assert.match(provider, /PAYMENT_PROVIDER_WEBHOOK_SECRET/);
  assert.match(webhook, /request\.text\(\)/);
  assert.match(webhook, /verifyProviderWebhook/);
  assert.match(webhook, /payment\.captured/);
  assert.match(orders, /idempotencyKey/);
  for (const table of ["payment_transactions", "payment_webhook_events", "refunds", "payout_batches", "payout_items"]) assert.match(migration, new RegExp(table));
});

test("legal, support and incident operations do not hide missing launch configuration", async () => {
  const legal = await source("../lib/legal-config.ts");
  const env = await source("../scripts/validate-env.mjs");
  const migration = await source("../db/migrations/0027_governance_and_abuse_controls.sql");
  assert.match(legal, /LEGAL_BUSINESS_NAME/);
  assert.match(legal, /GRIEVANCE_OFFICER_NAME/);
  assert.match(env, /COMMERCIAL_LAUNCH/);
  assert.match(env, /SUPPORT_EMAIL/);
  assert.match(migration, /security_incidents/i);
  assert.match(migration, /credential_rotation_log/i);
});

test("CI, backups, staging, uptime and load testing are automated", async () => {
  const ci = await source("../.github/workflows/ci.yml");
  const backup = await source("../.github/workflows/backup.yml");
  const staging = await source("../.github/workflows/staging.yml");
  const uptime = await source("../.github/workflows/uptime.yml");
  const operations = await source("../.github/workflows/operations.yml");
  const load = await source("../scripts/load-test.mjs");
  assert.match(ci, /npm run typecheck/);
  assert.match(ci, /npm audit/);
  assert.match(backup, /backup:create/);
  assert.match(backup, /backup:verify/);
  assert.match(staging, /STAGING_DATABASE_URL/);
  assert.match(uptime, /api\/health\/live/);
  assert.match(operations, /api\/cron\/operations/);
  assert.match(load, /concurrency/i);
});

test("customer retries receive a fresh provider idempotency key", async () => {
  const customer = await source("../components/customer-portal.tsx");
  assert.match(customer, /crypto\.randomUUID\(\)/);
  assert.match(customer, /setPaymentBusy\(null\);window\.setTimeout/);
});
