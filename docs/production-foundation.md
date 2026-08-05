# Production foundation guide

## Environments

Use three isolated environments:

- **Development:** local app, development secrets, development OTP, and an isolated database.
- **Staging:** a separate Supabase project and Vercel Preview environment with test SMS/payment credentials.
- **Production:** the live Supabase project and Vercel Production environment. Never use demo data or return a development OTP.

Set `APP_ENV` to `development`, `staging`, or `production`. Automated tests must use development or staging only.

## Local setup

1. Copy `.env.example` to `.env` and fill local values.
2. Run `npm install`.
3. Apply every SQL file in `db/migrations` in filename order to the local database.
4. Run `npm run env:check`, `npm run db:audit`, then `npm run dev`.

## Supabase and migrations

The authoritative schema is `pim_v2`. Never edit an applied migration. Add the next numbered file, test it in staging, take a backup, then apply the same reviewed file to production. The `0009_production_foundation.sql` migration restores only permanent service reference data and creates the admin audit table and indexes.

Rollback normally means promoting the previous verified application deployment. Database rollbacks require a reviewed compensating migration; never delete production data to imitate a rollback.

## Administrator bootstrap

1. Normalize the administrator number as `+91XXXXXXXXXX`.
2. Add it to the private `ADMIN_PHONE_ALLOWLIST` environment variable. Multiple values are comma-separated.
3. Configure real SMS delivery in production.
4. Visit `/admin/login`. A successful OTP verification creates or promotes only an allowlisted number to `ADMIN`.

Never put the allowlist or an administrator phone number in source control.

## Service reference data

Migration `0009` inserts six permanent services with `ON CONFLICT DO NOTHING`. It is safe to rerun and does not overwrite edited services. It creates no users, Pandits, bookings, ratings, or chats. The demo seed is blocked unless a deliberate development-only session flag is set.

## Vercel configuration

Configure separate Preview and Production values. Production needs HTTPS `APP_URL`, `APP_ENV=production`, strong secrets of at least 32 random characters, Supabase URLs, an admin allowlist, and a real OTP provider. Run `npm run env:check` before promotion.

## Credential rotation checklist

The application cannot rotate third-party credentials itself. Manually rotate, then update local, staging, and Vercel values:

- Supabase database password, `DATABASE_URL`, and `DIRECT_URL`
- `OTP_HASH_PEPPER`, `SESSION_SECRET`, and `ARRIVAL_OTP_SECRET`
- MSG91 key, template, and sender configuration
- Payment keys and webhook secret when configured

Invalidate old sessions after rotating session-related secrets. Never report a credential as rotated until the provider confirms it.

## Backups and recovery

Before migrations or cleanup, verify a recent Supabase backup. Free-tier projects should create regular logical exports. Record the last successful restore test. Never run files in `db/optional` without explicit approval and a verified backup.

## Monitoring

- `GET /api/health` returns only connection status, environment, and timestamp.
- `npm run db:audit` performs a read-only schema and integrity audit.
- `npm run db:legacy-audit` classifies legacy `public` tables without modifying them.

## Known remaining production blockers

This foundation does not complete payments, payout reconciliation, document storage/KYC, legal review, support operations, load testing, or the controlled marketplace pilot. Real production OTP delivery must be configured externally before customer launch.
