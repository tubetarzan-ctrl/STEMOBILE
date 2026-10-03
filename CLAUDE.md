# CLAUDE.md — StarTech Electronics OS

The full product brief lives in [docs/BRIEF.md](docs/BRIEF.md). Read it before
non-trivial work. Build in the phase order in §13 of the brief.

## Non-negotiable rules
1. Money is integer paisa (`bigint`). Format only in UI via `lib/money.ts`.
2. Stock and money change only through Postgres RPCs (supabase/migrations)
   inside one transaction. RLS denies direct writes to ledger/stock tables.
3. Journals must balance (DB-enforced by deferred constraint trigger), are
   immutable once posted, and are corrected by reversal (`reverse_journal`).
4. Business-day logic in Asia/Karachi (`lib/time.ts`, `public.business_date()`).
5. Every third party (payments, courier, WhatsApp, AI, email) sits behind an
   interface in `lib/*` with a mock implementation for local dev.
6. When a decision isn't covered by the brief, choose the simplest option that
   keeps the ledger correct and leave a `// DECISION:` (or `-- DECISION:`) comment.

## Layout
- `app/(store)` public storefront · `app/(panel)` staff panel · `app/(admin)` super admin
  · `app/(trade)` trade portal · `app/verify/[code]` · `app/track/[ref]` · `app/api/*`
- `lib/` domain modules · `components/` UI · `supabase/` migrations, seed, SQL tests
- `tests/` Vitest unit tests

## Commands
- `npm run dev` — dev server (works without Supabase using mock data)
- `npm test` — Vitest
- `npx supabase start && npx supabase db reset` — local DB with migrations + seed
- `npm run db:test` — SQL integrity tests (trial balance, stock = Σ movements)
