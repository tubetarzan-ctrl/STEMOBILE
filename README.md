# StarTech Electronics OS

Storefront, offline-first POS, repairs, trade khata and a self-running double-entry
back office for StarTech Electronics (Sarena Mobile Mall, Karachi).
Product brief: [docs/BRIEF.md](docs/BRIEF.md). Engineering rules: [CLAUDE.md](CLAUDE.md).

## Quick start (no database needed)

```bash
npm install
npm run dev            # http://localhost:3000 — storefront runs on a built-in demo catalogue
```

## Full setup

```bash
cp .env.example .env.local                 # fill the Supabase keys at minimum
npx supabase start && npx supabase db reset   # local Postgres + migrations + seed
#   or, for a hosted project:  npx supabase link && npx supabase db push
npm run owner:create -- owner@startech.pk 'strong-password' "Owner Name"
npm run dev                                # sign in at /login → Staff
```

Every integration (payments, courier, WhatsApp, email, AI, Google reviews,
UploadThing) has a mock fallback, so you can fill keys one at a time.

## Checks

| Command | What it proves |
|---|---|
| `npm run db:test` | Applies every migration + seed in an in-process Postgres (PGlite) and runs the ledger integrity tests: trial balance balances, stock = Σ movements, inventory GL ≈ stock value, balance sheet balances, cash flow reconciles, journals immutable, unbalanced journals rejected, closed days locked, idempotent POS, anon blocked, offline oversell flagged, year-end close/reopen, Genuine Proof codes. |
| `npm test` | Unit tests (money in paisa, PKT business day, phone normalisation, email gate, review filter, answer bank, courier CSV). |
| `npm run typecheck` · `npm run lint` · `npm run build` | Types, lint, production build. |

## Map

| Area | Where |
|---|---|
| Ledger, stock, sales, orders, repairs, closing, reports, RLS | `supabase/migrations/` (all stock & money changes are SECURITY DEFINER RPCs) |
| Storefront | `app/(store)` — home (CMS sections, §4.6), shop, product, cart/checkout, repair, verify, track, warranty, reviews, trade |
| 3D hero | `components/hero` — WebGL (R3F) → CSS-3D → poster tiers; scroll-linked explode |
| Staff panel | `app/(panel)/panel` — cockpit, POS (offline), orders, repairs, inventory/GRN, closing, accounts, reports, trade, inbox, copilot |
| Super Admin | `app/(admin)/admin` — website content manager, appearance, reviews, FAQ, staff permissions, audit log |
| Integrations | `lib/payments`, `lib/courier`, `lib/whatsapp`, `lib/email`, `lib/ai`, `lib/reviews` |
| Webhooks & cron | `app/api/webhooks/*`, `app/api/cron/*` (scheduled in `vercel.json`; pg_cron also runs closing/expiry) |

## Before go-live (open items from brief §14)

Exact address/domain/logo · payment gateway choice (PayFast vs Safepay) and merchant
docs for the adapter · first courier account (PostEx adapter stubbed) · approved
WhatsApp templates (names in `lib/whatsapp`) · opening balances (stock count, cash,
bank, payables, khata) · warranty/return policy per grade · trade tiers · Google
Business Profile access · a real Draco GLB for the hero (procedural model in place).
