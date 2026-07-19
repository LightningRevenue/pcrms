# Stack reference

## Docker / DB
- `docker compose up -d` → Postgres 16 on **localhost:5433** (not 5432), db/user/pass all `crm`.
- Data persists in the `pgdata` volume.

## Prisma (v7 — config shape changed from v6)
- Datasource URL lives in `prisma.config.ts`, NOT in `schema.prisma` (`datasource` block only has `provider`).
- Runtime client needs a driver adapter, not a bare `new PrismaClient()`. See `src/lib/db.ts`:
  `new PrismaClient({ adapter: new PrismaPg({ connectionString: ... }) })`.
- Models: `User`, `Account`, `Session`, `VerificationToken` (Auth.js — don't touch), `Company`, `Person`, `Opportunity` (CRM data, still schema-only, no UI wired yet).
- Migrate: `npx prisma migrate dev --name <change>`. Regenerate client: `npx prisma generate`.

## Auth
- Auth.js v5 (`next-auth@beta`), Google-only provider, database session strategy.
- Config: `src/lib/auth.ts`. Route: `src/app/api/auth/[...nextauth]/route.ts`.
- Route protection: `src/proxy.ts` (Next 16 renamed `middleware.ts` → `proxy.ts`).
- `(app)` route group = authenticated pages + Sidebar; `/login` sits outside it, chrome-free.
- Env vars: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `DATABASE_URL` — see `.env.example`.
- Session expiry: Auth.js default `maxAge` = 30 days (not overridden).
