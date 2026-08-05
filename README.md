# PanditConnect

PanditConnect helps customers describe an urgent religious need, receive guidance, and connect with an approved nearby Pandit. It includes customer, Pandit, administrator, live-booking, location, rating, and guidance-chat flows.

## Safe setup

1. Copy `.env.example` to a private `.env` file.
2. Install dependencies with `npm install`.
3. Apply `db/migrations` in numeric order to an isolated development database.
4. Run `npm run env:check` and `npm run db:audit`.
5. Start with `npm run dev`.

The application uses the `pim_v2` PostgreSQL schema. The `public` schema is legacy and must not be cleaned without a backup, a fresh audit, and explicit approval.

## Validation

```bash
npm run env:check
npm run typecheck
npm run lint
npm test
npm run db:audit
npm run db:legacy-audit
```

## Production operations

See `docs/production-foundation.md` for environment separation, administrator bootstrap, migrations, credential rotation, backups, rollback, health monitoring, and remaining launch blockers.

The records in `db/seeds/demo_pandits.sql` are blocked by default and must never be loaded into staging or production.
