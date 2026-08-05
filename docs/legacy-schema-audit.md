# Legacy public-schema audit

The running application uses only the `pim_v2` schema. Source inspection found no active application query that reads or writes the legacy Prisma-style tables in `public`.

## Classification

- `_prisma_migrations`: **requires review**. Keep it while any legacy Prisma migration workflow may still be needed.
- Other legacy application tables in `public`: **safe to archive after manual approval**, provided a fresh `npm run db:legacy-audit` still reports no source references and a verified backup exists.
- Supabase-managed schemas such as `auth`, `storage`, and system schemas: **out of scope** and must not be modified by the optional cleanup.

No legacy table is dropped automatically. The guarded file in `db/optional` requires a deliberate session flag and uses `RESTRICT` to prevent cascading deletion.
