# Backup and recovery runbook

Production backups contain identity, booking, address, payout, and support data. They must always be encrypted and access-controlled.

The encrypted logical dump covers the `pim_v2` PostgreSQL schema. Supabase Storage objects are separate from PostgreSQL backups. Enable storage versioning/backup controls or operate an approved encrypted export of the private document bucket; never assume the database dump contains uploaded identity files.

1. Add GitHub Actions secrets `BACKUP_DATABASE_URL` (Supabase direct connection) and `BACKUP_ENCRYPTION_KEY` (32 random bytes encoded as base64).
2. Run the **Encrypted database backup** workflow manually once.
3. Download the encrypted artifact and run `npm run backup:verify -- <file>` with the encryption key.
4. Once per quarter, restore a decrypted dump into a disposable isolated Supabase project and run `npm run db:audit` against it.
5. Record the date, operator, backup identifier, audit result, and deletion of the disposable project.

Never restore over production. Recovery uses a new database followed by a controlled connection-string switch and application smoke test.

The Vercel Hobby cron is intentionally only a daily fallback. Add the same `CRON_SECRET` to GitHub Actions so the scheduled-operations workflow can invoke reminders, rematching and retries every ten minutes. GitHub schedules can be delayed, so upgrade to a dedicated scheduler before a high-volume launch.
