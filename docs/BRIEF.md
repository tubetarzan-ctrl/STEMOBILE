# CLAUDE.md — StarTech Electronics OS (v4 — FINAL)

> Master brief for Claude Code. Read this file fully before writing any code.
> Build in the phase order in §13. When something isn't covered, choose the
> simplest option that keeps the ledger correct and auditable, and leave a
> `// DECISION:` comment explaining it.
>
> **v4 (final):** landing-page section structure for the homepage, all sections
> add/edit/delete/reorder from Super Admin (§4.6, §5.20); live Google reviews + customer
> photo/video reviews on UploadThing (§5.17); themes, repair stories, portfolio,
> promotions, inbox, blog, year-end accounting close (§5.12, §5.23–§5.28).
> **v3.1:** Website Content Manager (§5.20), hero video modes (§5.21), muted-autoplay
> YouTube/Instagram reels (§5.22).
> **v3 changes:** dark "Midnight Lab" UI with 3D exploded-phone hero and
> motion system (§4), UI benchmarks. **v2:** competitor research (§2), 10x
> differentiators (§3), Pakistan payment/courier rails, offline POS, trade/khata
> accounts, landed cost, AI layer, fraud controls.

---

## 0. One-Line Vision

**The most trusted place in Pakistan to buy a genuine phone part, get a phone
repaired, or stock a repair shop — with a back office that runs itself.**

StarTech has 22 years of trust at Sarena Mobile Mall. The platform turns that
trust into something a customer can *verify* (genuine-part proof, digital
warranty, live repair tracking) and turns the shop's operations into something
the owner can *see* without being at the counter.

---

## 1. Business Context

| Item | Detail |
|---|---|
| Business | StarTech Electronics |
| Location | Sarena Mobile Mall, Karachi *(confirm exact shop no., floor, address)* |
| Operating since | 22+ years |
| Lines of business | (1) Mobile repairing (2) Accessories (3) Genuine replacement parts — retail **and** to other technicians (trade) |
| Channels | Counter POS · Website · WhatsApp · Repair desk · Trade (B2B) accounts |
| Currency | PKR. Store as integer paisa (`bigint`), never floats |
| Timezone | Asia/Karachi (UTC+5). All "business day" logic in PKT |
| Languages | English + Urdu (RTL) + Roman Urdu search |
| Owner | Single owner = Super Admin |

### Non-negotiable core rule
**No event may change stock or money without writing a balanced ledger entry
in the same database transaction.** If the journal fails, the sale fails.

---

## 2. Competitor Research & Gap Analysis

### 2.1 Pakistan

| Competitor type | Examples | What they do well | Where they fall short (our opening) |
|---|---|---|---|
| General marketplaces | Daraz, Telemart-style stores | Reach, COD everywhere, trust in brand stores | Generic catalog; no model-compatibility; no repair; parts quality unclear |
| Classifieds | OLX "panel / OLED / battery" listings | Cheap, huge parts supply | Zero quality assurance; "original" claims unverifiable; no warranty; no stock truth |
| Wholesale/reseller apps | Markaz, Saddar-market wholesale apps | Wholesale pricing, COD, reseller earnings | Accessories-focused, not genuine parts; no technician tools |
| Official brand stores | Xiaomi/Nillkin-type brand stores | Authenticity + warranty | Single brand; no parts; no repair |
| Instagram/Facebook shops | Hundreds of mall sellers | Social reach, fast DMs | Manual orders in DMs; no inventory truth; no records |
| Local repair-shop sites | Small static sites ("100% original parts, 6-month warranty") | Claim genuine parts + warranty | Brochure sites: no live stock, no booking, no tracking, no proof |
| Generic Pakistani POS/ERP | Local retail POS vendors | Counter billing, basic stock | Not built for repair tickets, IMEI, part grades, or e-commerce |

**Market realities that shape the design:**
- COD dominates Pakistani online purchases, and fake/unconfirmed COD orders causing return-to-origin losses are a top seller pain → WhatsApp COD confirmation is mandatory, not optional.
- Raast (SBP's instant payment rail) is now accepted through licensed gateways such as PayFast and Safepay, including QR → we can offer instant bank payment without card fees.
- Courier APIs (PostEx, Leopards, Trax, M&P, TCS) are fragmented and unreliable → build an adapter layer with retries and polling.
- Power and internet outages are routine → POS must work offline.

### 2.2 Global benchmarks (what we borrow)

| Benchmark | What they're known for | What we take |
|---|---|---|
| **RepairDesk** (repair-shop POS) | Repair ticketing + POS + inventory in one; serialized inventory; low-stock alerts; supplier integration that auto-creates goods-received notes; customer SMS; unified inbox | Ticket workflow, serialized stock, supplier PO→GRN flow, unified WhatsApp inbox |
| **iFixit** | "My Workbench": save your devices, see compatible parts & guides; compatibility checker with "fits / probably fits" states | **My Devices** + 3-state compatibility ("Fits", "Fits — check version", "Doesn't fit") |
| **MobileSentrix** (parts wholesaler) | Quality standards on parts (pre-installed brackets, adhesives), lifetime warranty, **broken-screen buyback** | Part-grade standards, warranty-first selling, **LCD/OLED buyback program** |
| **Back Market** | Transparent condition grading; trade-in with **AI photo grading** | Grade transparency on parts; AI-assisted trade-in/buyback grading (Phase 4) |
| **Amazon** | Catalog, cart, reviews, delivery promise, "frequently bought together" | Bundles ("Screen + glass + case"), delivery promise per area, verified reviews |

### 2.3 Feature gap verdict
Nobody in the Karachi mobile-market space combines: **verified genuine parts + model-exact compatibility + instant repair quotes + live repair tracking + trade accounts + a self-running ledger**. That combination is StarTech's moat.

---

## 3. The 10x Differentiators

These are what make the platform extraordinary. Each is specified in §5.

1. **Fit Finder** — Customer picks (or we detect) their phone model once; the whole store, search, and repair quotes reshape around it. Saved in **My Devices**.
2. **Genuine Proof™** — Every part carries a standard grade badge (see §5.3) and serialized high-value parts get a **QR authenticity + warranty code**. Anyone can scan to see: grade, sale date, warranty left, shop that sold it.
3. **Instant Repair Quote** — Model + problem → price per part grade, time estimate, warranty, book a slot. No "come to the shop and ask."
4. **Live Repair Tracker** — Delivery-app-style progress bar with photos at check-in and handover, WhatsApp updates at every stage.
5. **Digital Warranty Wallet** — Every purchase and repair warranty lives under the customer's phone number. No paper slips. Claim warranty in two taps.
6. **Trade Accounts (Technician Pro)** — Other repair shops buy at tiered prices with credit limits and a digital **khata** (running account) with WhatsApp payment reminders.
7. **WhatsApp-first commerce** — COD confirmation, order/repair updates, abandoned-cart recovery, and a Roman-Urdu/Urdu AI assistant that answers from live stock ("iPhone 12 ka original panel kitne ka hai?").
8. **Broken Part Buyback** — Customers and technicians sell broken LCD/OLEDs and old devices; credit goes to their wallet or khata.
9. **Offline-first POS** — Keeps selling through load-shedding and internet drops; syncs safely when back.
10. **Owner Copilot** — Ask the business in plain language ("aaj ka profit?", "which cashier gave the most discounts this week?"), plus a 10 PM WhatsApp brief and anomaly alerts for cash, discounts, voids, and shrinkage.

---

## 4. UI / UX System — "Midnight Lab" (v3)

### 4.1 Benchmarks that shaped this UI

| Benchmark | What they do | What we take | What we avoid |
|---|---|---|---|
| **Apple product pages** | Scroll-driven product storytelling: a canvas swaps hundreds of pre-loaded image frames as you scroll, so the device appears to rotate and come apart | Scroll-linked storytelling and the "device comes apart" reveal | 50MB+ image sequences — we use real-time 3D instead (one compressed model, far lighter) |
| **Nothing** | Monochrome, industrial, dot-matrix type, transparent hardware showing the internals | Showing the inside of the phone as the hero; mono/technical type accents | Pure monochrome (we need colour for grades and stock) |
| **Samsung / OnePlus** | Dark cinematic heroes, glowing product renders, colour pickers | Dark stage, spotlight glow, premium product framing | Slow, video-heavy heroes on mobile |
| **dbrand** | Device-first shopping: pick your phone, then everything fits | Device selector as the first action (Fit Finder) | — |
| **Amazon** | Dense, fast utility: search, filters, delivery promise, bundles | Search, filters, "frequently bought together", delivery promise | Its cluttered look |

**Positioning:** StarTech is a *parts and repair* brand, so the hero is not a shiny phone — it is a phone **coming apart into the exact parts we sell** (back glass, battery, logic board, frame, display). Every competitor shows the outside of a phone; we show the inside. That is the brand idea.

### 4.2 Design tokens

Dark-first storefront (light theme available as a toggle). Staff panels use the same dark tokens.

| Token | Value / rule |
|---|---|
| `--bg` | `#07080B` (page) |
| `--surface-1` | `#0E1015` (cards) |
| `--surface-2` | `#151821` (raised, inputs) |
| `--line` | `#232733` (hairlines) |
| `--ink` | `#EEF0F3` · `--ink-2` `#B7BDC7` · `--ink-3` `#8A919C` |
| `--accent` | Electric cyan `#22D3EE` (actions, focus, live) — dark text on it |
| `--trust` | `#34D399` (Genuine Proof, in stock, warranty) |
| `--warn` | `#FBBF24` · `--danger` `#F87171` |
| `--glow` | `0 0 0 1px rgba(34,211,238,.35), 0 0 40px rgba(34,211,238,.18)` |
| Display | Space Grotesk 600/700, tight tracking (−0.03em) |
| Body | IBM Plex Sans 400/500/600 |
| Technical | IBM Plex Mono (SKUs, specs, labels, diagnostic readouts) |
| Urdu | Noto Nastaliq Urdu (headings), Noto Naskh Arabic (UI) |
| Numbers | Tabular figures for money and stock |
| Radius | 16px cards, 12px controls, pill badges |
| Motion | 200–400ms `cubic-bezier(.2,.8,.2,1)`; ambient loops 6–10s |

Rules: glow is a highlight, not a wallpaper — at most one glowing element per viewport. No gradient washes behind text. Contrast ≥ 4.5:1 for body text on every surface.

### 4.3 Signature 3D & motion moments

1. **Exploded-phone hero (the brand moment)**
   - A generic, original StarTech phone model (not a copy of any brand's device design) floats on a dark stage with a soft cyan spotlight and a ground ring.
   - It sways slowly in 3D, then **separates into 5 layers** — back glass → battery → logic board → mid-frame → display — with labels that link to each category ("Battery · shop 120+ fits").
   - Controls: *Auto · Exploded · Assembled*. On desktop, scrolling the hero drives the explode (scroll-linked); dragging rotates it.
   - Build: React Three Fiber + drei, one Draco-compressed GLB (< 1.5 MB) with each layer as a separate mesh; GSAP ScrollTrigger maps scroll progress to layer offsets.
   - The owner can switch the hero to *3D phone + video on its screen*, *full video*, or *image* (§5.21).
   - Fallback: CSS-3D layered version (as in the design artifact) for mid-range phones; a static poster image for low-end devices, Save-Data, or `prefers-reduced-motion`.
2. **Fit Finder command bar** — a floating glass bar under the hero: "What phone do you have?" with model autocomplete; once set, a slim "Shopping for: Galaxy A54 ✕" bar follows on every page.
3. **Brand marquee** — slow horizontal ticker of supported brands (text, not logos).
4. **Bento "Shop by part" grid** — dark tiles with small 3D-tilted part illustrations; tile tilts toward the cursor and its edge lights up on hover.
5. **Grade ladder** — dark comparison rows; the selected grade gets the cyan edge glow.
6. **Repair zone picker** — a phone outline with tappable hotspots (screen, battery, port, camera, back); tapping one updates price per grade and time instantly.
7. **Holographic Genuine Proof card** — a tilted card with a moving light sheen, showing the verified part's grade and warranty; scan page uses the same card.
8. **Live repair tracker** — dark progress timeline with a pulsing "now" dot.
9. **Owner Cockpit** — dark dashboard (approved as designed).

### 4.4 3D performance budget (non-negotiable)
- 3D scene lazy-loads *after* LCP; the hero's first paint is a poster image of the same scene, so LCP stays < 2.5s on 4G.
- GLB < 1.5 MB (Draco geometry, KTX2 textures); device pixel ratio capped at 1.5; render loop pauses when the hero is off-screen or the tab is hidden.
- Detect GPU tier (e.g. `detect-gpu`): high → WebGL; mid → CSS-3D layers; low / Save-Data / reduced motion → static poster.
- Storefront JS < 170 KB initial (3D bundle loaded separately on demand).
- Every animation respects `prefers-reduced-motion`.

### 4.5 UX rules
- **Mobile-first.** On phones the hero becomes a shorter stage with auto-explode on view (no scroll-jacking).
- **Never scroll-jack** beyond the hero; normal scrolling everywhere else.
- **Three-tap checkout** for returning customers (phone number = identity, OTP).
- **Honest stock**: "In stock at shop", "Only 2 left", "Arrives in 2–3 days", "Out of stock — notify me".
- **Roman Urdu tolerant search** ("panel", "pannel", "screen", "LCD", "bettery").
- Empty, loading (skeleton shimmer on dark), and error states designed for every screen.
- Accessibility: WCAG 2.2 AA, visible cyan focus rings, keyboard navigation, `lang="ur" dir="rtl"` for Urdu, all 3D controls have button equivalents.

### 4.6 Homepage structure (landing-page framework)
The homepage follows the proven landing-page order — **Hero → Problem/Solution → Case Studies → Testimonials → Portfolio → Why Us → FAQ → Final CTA** — with StarTech's shopping sections slotted in between. Every section below is a CMS block (§5.20): the Super Admin can **edit, hide, delete, duplicate, reorder, or add** any of them, and add new sections from a section library.

| # | Section | Content | Managed in |
|---|---|---|---|
| 1 | **Hero** | Headline, sub-text, **primary CTA** ("Shop parts that fit") + **portfolio CTA** ("See our repairs" → Portfolio), Fit Finder bar, trust bar (years in business, Google rating, repairs done — real figures only), hero media (3D / video / image / offer carousel) | Content Manager · Hero media (§5.21) |
| 2 | **Problem / Solution** | 3–4 pain points of the mobile market (fake "original" parts, parts that don't fit, no warranty, no price until you visit) each answered by a StarTech solution (Genuine Proof, Fit Finder, Warranty Wallet, Instant Quote) | Content Manager |
| 3 | Shop by part (bento) | Category tiles | Content Manager + Inventory |
| 4 | Picked for your phone | Products that fit the selected device; admin can pin featured picks | Inventory + Content Manager |
| 5 | Instant Repair Quote | Repair zone picker | Repair price list (§5.7) |
| 6 | **Case Studies — Repair Stories** | 3 featured before/after stories: device, problem, what was replaced (grade), time taken, customer quote, photos/video | Repair Stories Manager (§5.24) |
| 7 | **Testimonials** | Live Google rating + reviews, plus on-site customer reviews with photos and videos, "Write a review" button | Reviews Manager (§5.17) |
| 8 | **Portfolio** | Before/after repair gallery, shop & bench photos, reels strip ("Watch the bench") | Portfolio Manager (§5.24) · Video & reels (§5.22) |
| 9 | Genuine Proof | Grade explainer + holographic verify card | Content Manager |
| 10 | **Why Us** | 22 years at Sarena Mobile Mall, differentiators, comparison table: StarTech vs a typical mall stall vs online marketplaces | Content Manager |
| 11 | Technician Pro | Trade-account pitch | Content Manager |
| 12 | **FAQ** | 8–12 questions (warranty, grades, delivery time, COD, repair time, data privacy during repair) with FAQ schema | FAQ Manager (§5.20) |
| 13 | **Final CTA** | Last push: Book a repair · Shop now · WhatsApp · Visit the shop (map, hours, directions) + quick inquiry form | Content Manager |
| — | Persistent | Sticky WhatsApp bubble (pre-filled message), "Shopping for" device bar, cart | Settings |

Category, product, repair and model landing pages (e.g. "iPhone 13 screen replacement in Karachi") reuse the same framework with section sets chosen per page type.

---

## 5. Modules

### 5.1 Storefront (public)
- Home: follows the landing-page structure in §4.6 (Hero → Problem/Solution → shopping sections → Case Studies → Testimonials → Portfolio → Why Us → FAQ → Final CTA); every section editable, reorderable and deletable from Super Admin.
- Catalog: Accessories (chargers, cables, cases, glass, audio, power banks, holders), Genuine Parts (displays, batteries, back glass, charging ports, cameras, speakers, flex), Tools (for technicians).
- Filters: brand, model compatibility, part grade, price, in stock, warranty length.
- Product page: gallery, grade ladder, compatibility verdict for selected device, stock status, warranty, "frequently bought together", verified reviews, Q&A.
- Bundles: "Screen replacement kit" (part + glass + adhesive), "New phone pack" (case + glass + charger).
- Cart, checkout, order tracking, repair booking, repair tracking, warranty wallet, Genuine Proof scan, buyback request, "notify me when back in stock".
- Customer account via phone OTP: orders, repairs, My Devices, warranties, wallet credit, saved addresses.
- SEO: product schema (JSON-LD), model landing pages ("iPhone 13 screen replacement price in Karachi"), sitemap, local business schema.

### 5.2 Fit Finder & compatibility
- `devices` (brand, model, variants/model numbers, release year) and `part_compat` (variant ↔ device, confidence: `exact` | `check_version` | `no`).
- Customer can enter model number from Settings ("SM-A546E") → resolves to device.
- Every search/listing respects the active device; badge shows "Fits", "Fits — check version", or hides non-fitting items (toggle).
- Staff UI to bulk-map compatibility (one part → many models) with CSV import.

### 5.3 Genuine Proof (grading + authenticity)
Standard grades (configurable labels, fixed meaning):

| Code | Label | Meaning shown to customer |
|---|---|---|
| `ORIG_NEW` | Original (New) | Manufacturer part, new |
| `ORIG_PULL` | Original (Pulled) | Manufacturer part removed from another device, tested |
| `OEM` | OEM Grade | Made to manufacturer spec by third party |
| `PREMIUM` | Premium Copy | High-quality aftermarket |
| `STANDARD` | Standard Copy | Budget aftermarket |

- Grade is required on every part. Grade claims are part of the audit log — changing a grade after sale is blocked.
- Serialized items get a unique code + QR printed on a label at stock-in. Sale binds the code to the invoice and customer phone. `/verify/[code]` shows the verdict. Codes are random (not sequential) and rate-limited to prevent guessing.

### 5.4 Inventory
- Products → variants (colour, capacity, grade) with SKU + barcode; label printing (barcode + Genuine Proof QR) on 2" thermal labels.
- Serial/IMEI tracking where applicable.
- `stock_movements` is the single source of truth (types: `opening`, `purchase`, `sale`, `online_reserve`, `online_release`, `return_in`, `return_out`, `repair_consume`, `buyback_in`, `adjustment`, `transfer`).
- **Locations**: shop counter, back store, warehouse/home (transfers between them).
- Costing: **weighted average**, recalculated on each receipt, using **landed cost**.
- **Landed cost**: imports (often from China) carry freight, customs, clearing, and FX. Purchase supports foreign-currency invoices (USD/CNY) with an FX rate, plus extra charges allocated across lines by value or quantity.
- Purchase orders → Goods Received Notes (partial receipts supported) → supplier bill.
- Stock counts (cycle counts by shelf/category), adjustments need reason + approval.
- **Smart reorder**: suggested qty = recent sales velocity × lead time + safety stock; draft POs per supplier for one-click approval.
- **Dead stock report**: items with no sale in 60/90/180 days, valued at cost, with "push as bundle / discount" suggestions.
- Bulk import from CSV/Excel for go-live.

### 5.5 Shortage & operations alerts
- Postgres trigger on stock change → `stock_alerts` when `on_hand <= reorder_level` (one open alert per SKU until restocked).
- Instant email + WhatsApp for items flagged critical; daily digest at 9 PM PKT; in-app bell.
- Super Admin sets recipients per alert type and category.
- Other alerts: cash variance over threshold, discount above limit, void/refund spikes, repair overdue, payment proof awaiting verification > 2h, courier COD remittance overdue.

### 5.6 POS (counter) — offline-first PWA
- Scanner-first sale screen, customer lookup by phone, split payments (cash, card machine, Raast QR, JazzCash/Easypaisa, wallet credit, trade khata).
- Discounts capped by permission and min price; void/refund requires manager PIN.
- **Offline mode**: catalog and prices cached in IndexedDB; sales queued with client-generated UUIDs and idempotency keys; on reconnect, the server RPC posts them in order. Conflicts (sold-out item) flagged for review, never silently dropped. Offline banner always visible.
- Receipts: 80mm thermal print + WhatsApp/PDF.
- Cash drawer sessions with opening float.
- Customer-facing display route showing cart and Raast QR.

### 5.7 Repairs
- Intake: customer, device (from `devices`), IMEI, issue zones, condition checklist (screen, body, buttons, cameras, Face ID/fingerprint, charging, water damage), photos, passcode (encrypted, optional, auto-deleted on handover), estimate, advance, promised time, technician.
- Statuses: `booked → received → diagnosing → awaiting_approval → awaiting_parts → in_repair → quality_check → ready → delivered` (+ `cancelled`, `returned_unrepaired`).
- Customer approves revised estimate via WhatsApp link.
- Parts consumed from inventory with grade shown on the job; labour + parts on final invoice.
- Quality-check checklist before `ready`.
- Technician productivity: jobs, average turnaround, comeback (warranty return) rate, commission (configurable % of labour).
- Repair warranty per job; warranty claim creates a linked job at zero labour.
- Repair price list (model × issue × grade) powers the public Instant Quote.

### 5.8 Online orders & delivery
- Statuses: `pending_payment → payment_submitted → confirmed → packed → dispatched → delivered` (+ `cancelled`, `returned`, `rto`).
- Stock reserved at checkout; unpaid bank-transfer orders expire (default 24h) and release stock.
- **COD confirmation via WhatsApp** (Confirm / Cancel buttons); unconfirmed after X hours → call queue for staff.
- Simple COD risk score: new phone number, past RTO on this number, high value, mismatched city → may require partial advance via Raast.
- Delivery options: shop pickup, own rider (Karachi zones), courier.
- **Courier adapter** (`CourierProvider` interface): book shipment, print label, track (webhook where available, else polling), and import COD remittance reports. Start with one courier, add others behind the same interface.
- **COD reconciliation**: match courier remittances to orders; flag short-paid or missing amounts.

### 5.9 Payments
- `PaymentProvider` interface. Methods:
  - Cash (counter / COD)
  - **Raast via a licensed gateway** (PayFast or Safepay — choose at onboarding) with webhook confirmation → auto-verify, no screenshot needed
  - Card via the same gateway
  - Manual bank transfer / wallet transfer with proof upload (fallback) → staff verification
  - Store wallet credit (from returns, buyback)
  - Trade khata (approved trade accounts only)
- Webhooks verified by signature, idempotent, logged.

### 5.10 Trade accounts (Technician Pro / B2B)
- Apply online with shop name, location, CNIC (optional), phone; owner approves.
- Price tiers (e.g. Retail, Trade, Trade Gold) per product or by category markup.
- Credit limit and payment terms; orders blocked when over limit (owner override).
- **Digital khata**: running statement per account, aging, WhatsApp statement + payment reminders, pay via Raast link.
- Trade portal: quick reorder, bulk add by SKU, order history, statement download.

### 5.11 Buyback & trade-in
- Broken LCD/OLED buyback: customer/technician selects model + condition → indicative price → drop at shop or courier → staff tests → final price → paid in cash, wallet credit, or khata credit.
- Phase 4: AI photo pre-grading of condition to give a better first quote (staff always makes the final call).
- Accounting: buyback stock enters inventory at purchase cost (`buyback_in`).

### 5.12 Accounting engine (double-entry)

**Chart of accounts (seed; owner can extend)**
- Assets: Cash in Hand (per drawer), Bank (each account), Gateway Clearing (PayFast/Safepay), Wallet accounts, Accounts Receivable – Trade (khata), COD Receivable – Courier, Inventory, Inventory in Transit, Fixed Assets, Advances to Suppliers
- Liabilities: Accounts Payable, Customer Deposits (repair advances), Customer Wallet Credit, Accrued Expenses, Technician Commission Payable
- Equity: Owner's Capital, Owner's Drawings, Retained Earnings
- Income: Sales – Accessories, Sales – Parts, Sales – Trade, Repair Labour Income, Delivery Income, Cash Over, FX Gain
- Expenses: COGS, Rent, Salaries, Commissions, Utilities, Courier Charges, Gateway Fees, Bank Charges, Marketing, Cash Short, Inventory Shrinkage, RTO Losses, FX Loss, Misc

**Auto-posting rules (Postgres functions, one transaction each)**

| Event | Debit | Credit |
|---|---|---|
| Counter cash sale | Cash in Hand; COGS | Sales; Inventory |
| Raast/card via gateway | Gateway Clearing | Sales |
| Gateway settlement | Bank; Gateway Fees | Gateway Clearing |
| COD delivered | COD Receivable | Sales (+ COGS/Inventory) |
| Courier remits COD | Bank; Courier Charges | COD Receivable |
| RTO (returned undelivered) | Inventory; RTO Losses (shipping) | COGS; Cash/Payable |
| Trade sale on khata | AR – Trade | Sales – Trade (+ COGS/Inventory) |
| Trade payment | Bank / Cash | AR – Trade |
| Purchase (landed) | Inventory | Accounts Payable; Accrued freight/customs |
| Supplier payment | Accounts Payable | Bank / Cash |
| Repair advance | Cash | Customer Deposits |
| Repair delivered | Customer Deposits; Cash; COGS | Repair Labour Income; Sales – Parts; Inventory |
| Buyback | Inventory | Cash / Customer Wallet Credit / AR – Trade |
| Expense | Expense account | Cash / Bank |
| Stock write-off | Inventory Shrinkage | Inventory |
| Sales return | Sales; Inventory | Cash / Wallet Credit; COGS |

- Journals must balance (DB-enforced). Posted journals are immutable; corrections by reversal only.
- Every journal links to its source document for drill-down.
- Period lock after daily close; owner-approved adjustments only.

**Chart of accounts numbering:** 5-digit blocks so reports are formula-driven with no hard-coded account lists — 10000 Assets · 20000 Liabilities · 30000 Equity · 40000 Revenue · 50000 Cost of sales · 60000 Operating expenses. Each account also has a `subtype` (cash, bank, ar, inventory, fixed_asset, contra_asset, ap, deposit, accrued, capital, drawings, retained_earnings, revenue, other_income, cogs, opex). New accounts slot into the right report automatically.

**Periods & closing:**
- `accounting_periods` (month / year): daily close (§5.13) locks days; **month-end close** locks the month after checks (trial balance balances, no unverified payments, no unapproved adjustments, stock count variance posted).
- **Year-end close (one click, reversible until final lock):** closing entries move all income and expense balances to Retained Earnings; next year's P&L starts at zero. Reopening a closed period needs the owner and is audit-logged.
- **Fixed assets register & depreciation:** shop fit-out, counters, tools, laptops, testing equipment — straight-line monthly depreciation posted automatically.
- **Bank reconciliation:** import or enter the bank statement; system matches lines to bank-account journal lines and flags unmatched items.
- **Comparatives:** every report supports "vs previous period" and "vs same period last year".
- **Notes to the accounts** auto-drafted each period (accounting policies, revenue by channel and category, inventory valuation, receivables/khata aging, payables aging, fixed assets, owner's capital and drawings) with space for the owner's commentary.
- **Annual report pack (one PDF):** cover, P&L, balance sheet, statement of changes in equity, cash flow statement (indirect method), notes, revenue by channel/category appendix, aging appendix — ready for a bank, investor or accountant.

**Reports (live from ledger views)**: Trial Balance · P&L (with period comparison and margin by category/channel/grade) · Balance Sheet · General Ledger · Cash Book · Bank Book · Khata aging · Payables aging · Inventory valuation · Stock aging / dead stock · Sales by product/category/cashier/technician/channel · Repair profitability · COD reconciliation · Gateway reconciliation · Cash Flow Statement · Statement of Changes in Equity · Fixed asset register · Bank reconciliation. Export to PDF and Excel.

### 5.13 Automatic daily cash closing
- Cashier counts drawer (denomination helper: 5000/1000/500/100/50/20/10 notes + coins).
- Expected cash = opening float + cash sales + cash receipts − cash refunds − cash expenses − cash transfers out.
- Variance posts to Cash Over / Cash Short automatically.
- Scheduled job (default 11:59 PM PKT): auto-closes open drawers (flagged "not counted"), locks the day, generates the **Daily Closing Report** (sales by channel and method, repairs delivered, expenses, cash expected vs counted, bank/gateway receipts, khata movements, top items, stock alerts), emails PDF to owner + accountant, and sends a short WhatsApp summary to the owner.
- Accountant marks the day "verified"; owner sees status on the cockpit.

### 5.14 Instagram posts & reels (website feed)
- Employees with `social.post.create` publish posts: media upload, caption, hashtags, optional Instagram URL, **tagged products** (shoppable).
- Workflow: `draft → pending_approval → published`; approval rule set by Super Admin.
- Posts render on the homepage feed and `/feed`; tagged products show price + live stock.
- Phase 4: Instagram Graph API sync / cross-posting (requires a Business account and Meta app review).
- Reels use the video rules in §5.22 (upload the reel file for muted autoplay; Instagram's own embed can't autoplay).
- Content calendar view in the panel.

### 5.15 WhatsApp hub
- Meta WhatsApp Cloud API (official). Approved templates for: order confirmation, COD confirm/cancel, dispatch, delivery, repair status, estimate approval, ready for pickup, warranty reminder, khata reminder, back-in-stock, abandoned cart.
- Unified inbox in the panel: conversations linked to customer, orders, and repair jobs; assign to staff.
- Opt-out respected; message log stored.

### 5.16 AI layer
- **Shop assistant (storefront + WhatsApp)**: answers in English, Urdu, and Roman Urdu using tool calls against live data only (search products, check stock, get repair quote, order status). Never invents prices or stock; hands off to a human when unsure.
- **Answer-bank first:** the assistant checks the FAQ Manager and a keyword answer bank before calling the AI model; only misses go to the model, and frequently missed questions are shown to the owner to add to the FAQ — so AI cost keeps falling.
- **Owner Copilot (admin)**: natural-language questions over read-only reporting views ("is hafte ka gross margin?", "top 10 dead stock items"). Generates SQL against a whitelisted set of views only, with row limits; shows the numbers and the underlying report link.
- **Anomaly watch**: nightly checks for unusual discounts, voids, refunds, cash variances, and shrinkage by employee; flags go to owner only.
- **Content helper**: drafts Instagram captions and product descriptions for staff to edit.
- Use pgvector in Supabase for product/FAQ semantic search. Keep the model provider behind an interface; log token cost per feature.

### 5.17 Reviews — live Google reviews + customer photo/video reviews
**On the website (Testimonials section, product pages, repair pages):**
- **Google block:** live Google rating, total review count and recent reviews with Google attribution and a "See all on Google" link.
  - **Primary source: Google Business Profile API** — StarTech connects its own verified Business Profile (owner OAuth); this returns the full review history and lets the owner **reply to Google reviews from the admin panel** (replies appear on Google too). Reviews are synced every few hours into `google_reviews`.
  - **Fallback until that access is approved: Google Places API**, which returns at most 5 reviews and must not be stored (only the place ID may be kept) — so it is fetched live and shown with Google's required attribution.
  - Google review text is never edited. Admin can switch the Google block on/off and choose sort (newest / highest).
- **On-site reviews:** star rating, text, **multiple photos and a video**, "Verified purchase" / "Verified repair" badge when linked to a real order or repair job, the owner's public reply under the review, and filters (with photos, with video, by rating, by product/repair type).
- **"Write a review" button** at the end of the Testimonials section and on order/repair tracking pages. Post-purchase and post-repair WhatsApp messages carry a link pre-filled with the order or job, so the review is automatically verified.

**Submission flow:**
1. Customer enters name, phone (OTP verify), rating, text, and optionally what they bought/repaired (pre-filled from the link).
2. Photos (up to 6) and one video (≤ 60s, ≤ 100 MB before compression) upload **directly from the browser to UploadThing**; files are compressed client-side (images to WebP, max 1600px) first. Only the returned URLs/keys are saved in `review_media`.
3. Rules-based filter (no AI call): profanity, links, repeated text, too many submissions from one phone. Pass → **auto-published**. Fail → **pending review** for the owner.
4. Owner/staff get an in-app + WhatsApp alert for every new review (especially ratings ≤ 3).
5. **Google follow-up screen** after submitting: "Thank you! Would you also share this on Google?" with the review text ready to copy and a one-tap link to StarTech's Google "write a review" page. Google does not allow posting a review on a customer's behalf, so this is the compliant way to grow Google reviews. The click-through is tracked.

**Reviews Manager (Super Admin / `reviews.moderate`):**
- Queue with filters: pending, published, hidden, rejected; source (on-site / Google / admin-added); rating; has media.
- **Reply publicly**, **edit the owner reply**, **hide** (soft) or **delete** (hard) any on-site review, **approve/reject** pending ones, **re-link** to the right product or repair job, **feature** a review in the homepage Testimonials section, and **pin order**.
- **Add a review manually** (e.g. from a WhatsApp message, with the customer's permission): text, rating, photos and video uploaded to UploadThing.
- Reply to **Google** reviews (via Business Profile API) from the same screen.
- Funnel stats: review requests sent → reviews submitted → Google follow-up clicked; average rating trend.

### 5.17b Loyalty
- Loyalty points per PKR spent, redeemable as wallet credit (posted as a liability).

### 5.18 Staff, roles & permissions
Roles (templates; Super Admin customises per employee): `super_admin`, `manager`, `inventory_clerk`, `cashier`, `accountant`, `repair_tech`, `social_media`, `content_editor`, `order_handler`, `trade_manager`.

- Granular permission keys (e.g. `inventory.adjust`, `pos.discount.above_limit`, `pos.void`, `accounts.journal.create`, `reports.financial.view`, `social.post.publish`, `content.edit`, `content.publish`, `content.delete`, `media.upload`, `reviews.moderate`, `reviews.reply`, `promotions.manage`, `blog.publish`, `appearance.manage`, `accounts.period.close`, `orders.verify_payment`, `trade.credit_limit.edit`, `staff.manage`).
- Role defaults + per-employee grant/revoke overrides; toggle matrix UI.
- Enforced in RLS, server actions (`requirePermission()`), and UI.
- Staff PINs for fast POS switching; deactivate (never delete) employees.
- Basic attendance (clock in/out on POS) and commission statements.
- Full audit log with before/after values, searchable by owner.

### 5.19 Super Admin
- Owner Cockpit (§4.3).
- Staff & permissions, approvals inbox (adjustments, discounts, credit limits, posts).
- Website Content Manager (§5.20) and hero media mode (§5.21).
- Settings: business profile, payment and courier credentials, delivery zones and charges, order expiry, closing time, alert recipients, invoice templates, price tiers, loyalty rules.
- Audit log viewer; data export (full backup to Excel/CSV).

### 5.20 Website Content Manager (edit any text, image or video)
Nothing on the storefront is hard-coded. Every word, image, video and section can be changed by the owner or an employee with permission, without a developer.

- **Who can edit:** Super Admin always; employees with `content.edit` (edit drafts) and `content.publish` (make live). Owner can require approval before publish.
- **What is editable:** hero headline, sub-text, buttons and links · hero media (see §5.21) · announcement bar · every section title and description · banners and promotions · category tiles (name, text, image, order) · featured product picks · "Shop by part" order · repair section text · Genuine Proof copy · Technician Pro block · footer, shop address, hours, phone, WhatsApp, map pin · FAQ · warranty, returns, privacy and delivery policy pages · SEO title/description per page · Urdu version of every field.
- **Add / delete sections:** a section library (hero, text + image, problem/solution, case-study row, testimonial grid, portfolio grid, reel strip, product row, category grid, comparison table, FAQ, CTA band, map + hours, custom HTML-free rich text) lets the owner add new sections to any page or delete existing ones; deleted sections go to a 30-day trash before permanent removal.
- **FAQ Manager:** add/edit/delete/reorder questions per page, English + Urdu; feeds the FAQ section, FAQ schema and the WhatsApp/AI assistant's answer bank.
- **Pages:** create, edit and delete pages (landing pages, policy pages, campaign pages) with their own URL and SEO fields.
- **Edit mode (on the live site):** a logged-in editor sees an "Edit page" toggle. Every editable block gets an outline; click text to edit in place, click an image or video to replace it from a side panel. Sections can be reordered (drag), hidden or duplicated.
- **Draft → preview → publish:** edits are saved as a draft, previewed on a private link (desktop and phone preview), then published. Optional scheduling ("show this Eid banner from 1st to 3rd").
- **Version history:** every publish is a version; one-click rollback. Audit log records who changed what.
- **Bilingual:** each text field has English and Urdu side by side; missing Urdu falls back to English and is flagged.
- **Guardrails:** character limits per field so the layout never breaks; image crop/focus-point tool; automatic WebP/AVIF conversion; video size and length limits (§5.22).
- **Product content** (names, descriptions, photos, specs) stays in Inventory (§5.4) — the same people edit it there, and it flows to the website automatically.
- **Rendering:** published content is cached (Next.js ISR) and refreshed instantly on publish (on-demand revalidation), so editing never slows the site.

### 5.21 Hero media — where the video shows
The owner picks the hero mode in Website Content Manager:

| Mode | What the visitor sees |
|---|---|
| **3D phone** (default) | The exploded-phone hero from §4.3 |
| **3D phone + video screen** | The same 3D phone, with the video **playing on the phone's display layer** — a shop reel or repair clip appears on the phone's own screen as it turns. This is the signature option. |
| **Full video** | A full-width background video behind the headline, with a dark overlay so text stays readable |
| **Image** | A still campaign image (for Eid sales etc.) |

- All hero video **autoplays muted, loops, and plays inline on phones**.
- A clear **sound button** (speaker icon, bottom-right of the video) lets the visitor unmute and set volume; a pause button sits beside it. Volume choice is remembered for that visit.
- A poster image shows instantly, then the video fades in — the page never waits for video to load.
- On Save-Data, very slow connections or reduced-motion settings: poster image plus a play button, no autoplay.

### 5.22 Video & reels (Instagram + YouTube)
Staff add videos in the panel by **pasting a link** or **uploading a file**. They can be placed in the hero (§5.21), in a "Watch the bench" reel strip on the homepage, on product pages ("see this part fitted"), and on repair pages.

**How each source behaves (browser rule: video may autoplay only when muted; sound needs a tap):**

| Source | Autoplay muted on page load? | How we do it |
|---|---|---|
| **YouTube video or Short** (paste link) | **Yes** | Privacy-enhanced embed (`youtube-nocookie.com`) via the YouTube IFrame Player API with `autoplay=1&mute=1&playsinline=1&loop=1&rel=0`; our own sound button calls the player's unmute/volume functions |
| **Uploaded video file** (MP4 the shop owns, e.g. the same reel posted on Instagram) | **Yes** | Self-hosted `<video autoplay muted loop playsinline>` with our custom sound/volume and pause controls |
| **Instagram reel** (paste link) | **No — Instagram's embed does not allow autoplay** | Two options: (1) **Recommended:** staff upload the reel's video file once (it's StarTech's own content) → it autoplays muted on the site with a "View on Instagram" link; (2) the standard Instagram embed, which shows the reel but the visitor must tap play |
| **Instagram auto-sync** (Phase 4) | **Yes** | With StarTech's Instagram Business account connected through the official Instagram API, new reels are pulled in automatically; the video is copied to our storage (Instagram's links expire) and then autoplays muted like an upload |

**Reel strip UX:** vertical 9:16 cards in a swipeable row; the card in view plays muted, others show posters; tap a card to open full-screen with sound. Each reel can tag products (shoppable, shows live price and stock) — same as Instagram posts (§5.14).

**Performance rules (strict):**
- Only **one** video plays at a time; videos play only while on screen (IntersectionObserver) and pause when scrolled away or the tab is hidden.
- Third-party players (YouTube, Instagram) load lazily — a lightweight poster is shown first; the real player loads when the card scrolls into view.
- Upload limits: hero video ≤ 30s and ≤ 6 MB (720p for phones, 1080p for desktop, H.264 MP4 plus WebM); reels ≤ 60s. The panel compresses and makes a poster image automatically on upload.
- Captions/alt text field on every video for accessibility.

**Storage:** all public media (product photos, CMS images, hero videos, reels, review photos/videos, portfolio) is uploaded to **UploadThing** directly from the browser. Private files (payment proofs, repair check-in photos, CNIC images) stay in **private Supabase Storage buckets** served by short-lived signed URLs. If video bandwidth outgrows UploadThing's plan, move video to a low-egress store or a video service (verify pricing at build time).

### 5.23 Appearance & themes
- Every storefront colour comes from CSS variables (§4.2); the owner switches the whole site's look from **Super Admin → Appearance**.
- Theme presets: **Midnight Lab** (default, dark cyan) · Midnight Gold · Graphite Green · Deep Navy · Carbon Red · Daylight (light) · plus a seasonal/Eid preset.
- Swatch grid, live preview of the homepage, "Apply to site" (instant, no flash of the wrong theme — the active theme is read server-side), and an Advanced panel to override single colours, logo, favicon and fonts.
- Visitors can still switch light/dark for themselves.

### 5.24 Repair Stories (case studies) & Portfolio Manager
- **Repair Stories:** add/edit/delete/reorder case-study cards — device, problem, what was replaced and its grade, time taken, before/after photos and optional video (UploadThing), customer quote (optionally linked to their review), which pages they appear on, show/hide. Can be created in one click from a completed repair job (photos and details pre-filled; customer consent checkbox required).
- **Portfolio:** before/after gallery and shop/bench photos, tagged by device, part and repair type; show/hide per item; drag to reorder; each item can link to the matching product or repair quote.

### 5.25 Promotions & offers
- **Hero offer carousel** (optional hero mode): featured deals that auto-rotate every 4–5 seconds with a progress bar, dots and arrows, pause on hover/touch, no auto-rotation with reduced motion; each slide links to the product or offer.
- **Announcement bar** with schedule (e.g. "Eid hours", "Free fitting this week").
- **Discount codes:** percent or fixed, by category/product/channel, min order, usage limits, valid dates; applied at checkout and POS; posted as a sales discount in the ledger.
- **Referral codes** for customers and technicians: reward as wallet credit when a referred customer's first order is delivered.

### 5.26 Inquiries & inbox
- **Inquiries inbox:** website forms (quick inquiry, bulk/trade request, "can't find my part" special-order request), escalated WhatsApp chats and emails in one list; assign to staff, status, notes.
- **Email (Resend inbound) with a safety gate:** inbound mail is classified rules-first; notification and social-media senders (Facebook, Instagram, LinkedIn etc.) and spam are **never** auto-replied; general questions get an auto-reply drafted from the FAQ answer bank; complaints and refund requests are never auto-replied — they go straight to the owner as priority.
- **Live chat fallback** on desktop for visitors without WhatsApp.
- **WhatsApp broadcast** to a chosen segment (e.g. "trade accounts", "customers with Galaxy A54") using approved templates, used sparingly because they cost money.

### 5.27 Blog, SEO & trust pages
- Blog/guides CMS ("Original vs copy panels", "How to check your battery health") with authors, categories and SEO fields.
- Structured data on every page: Product, Offer, Review/AggregateRating (on-site reviews only — Google's own reviews are not marked up as ours), FAQPage, LocalBusiness, BreadcrumbList.
- Auto sitemap.xml and robots.txt from products, devices, pages and posts.
- Legal pages editable in the CMS: privacy, terms, warranty, returns, delivery; cookie consent banner.
- Analytics: GA4 and Meta Pixel with server-side events for purchases (consent-aware).
- Installable PWA (manifest + icons) for the storefront and staff panels.

### 5.28 Super Admin menu (final)
Cockpit · POS · Online orders · Repairs · Inventory · Purchases · Trade accounts · Customers · **Website** (Pages & sections, Hero media, Video & reels, Repair stories, Portfolio, FAQ, Blog, Promotions, Appearance) · **Reviews** · Instagram posts · Inquiries & inbox · WhatsApp · Accounts (journals, periods & closing, fixed assets, bank reconciliation) · Reports · Staff & permissions · Audit log · Settings · Data export.

---

## 6. Tech Stack (free / near-zero first)

| Layer | Choice |
|---|---|
| Framework | Next.js 15 App Router, TypeScript, Server Actions; route groups `(store)`, `(panel)`, `(admin)`, `(trade)` |
| DB/Auth | Supabase (Postgres + RLS + Auth phone OTP + pg_cron + pgvector) |
| Media uploads | **UploadThing** (public media: products, CMS, videos, reels, review photos/videos, portfolio) |
| Private files | Supabase Storage private buckets + signed URLs (payment proofs, repair check-in photos, CNIC) |
| Reviews | Google Business Profile API (primary, owner-authorised) · Google Places API (fallback, live only) |
| Business logic | Postgres functions (RPC) for all stock + money operations |
| UI | Tailwind CSS + shadcn/ui, tokens from §4.2, lucide icons |
| 3D | three.js + React Three Fiber + drei (GLB, Draco/KTX2), `detect-gpu` for tiering |
| Motion | GSAP + ScrollTrigger (hero scroll-link), Motion (formerly Framer Motion) for UI micro-interactions |
| i18n | `next-intl` with en / ur (RTL) |
| Offline POS | PWA (service worker) + IndexedDB (Dexie) sync queue |
| Search | Postgres full-text + `pg_trgm` + synonyms; pgvector for semantic |
| Email | Resend + React Email |
| WhatsApp | Meta WhatsApp Cloud API |
| Payments | PayFast or Safepay (Raast + cards) behind `PaymentProvider` |
| Courier | One courier first behind `CourierProvider` |
| PDFs | `@react-pdf/renderer` (invoices, job cards, statements, closing report) |
| Charts | Recharts |
| Validation | Zod shared schemas |
| Testing | Vitest (unit), Playwright (E2E), pgTAP or SQL tests for RPCs |
| Hosting | Vercel (Pro needed for commercial use) |
| Monitoring | Sentry free tier |

---

## 7. Database Outline

```
-- identity & access
profiles, roles, permissions, role_permissions, employee_permissions,
staff_pins, attendance, audit_log

-- catalog & compatibility
categories, brands, devices(brand_id, name, model_numbers[], year),
products(id, name, slug, category_id, brand_id, description, is_online),
product_variants(id, product_id, sku, barcode, grade, attributes, sale_price,
  min_price, avg_cost, reorder_level, reorder_qty, lead_time_days, is_critical),
part_compat(variant_id, device_id, confidence),
price_tiers, variant_tier_prices, bundles, bundle_items, product_images

-- stock
locations, stock_movements(variant_id, location_id, qty, unit_cost, type,
  ref_type, ref_id, created_by, created_at),
serial_units(id, variant_id, serial_or_imei, proof_code, status, sold_sale_id),
stock_alerts, stock_counts, stock_count_lines, stock_adjustments, transfers

-- purchasing
suppliers, purchase_orders, po_lines, grns, grn_lines,
supplier_bills(currency, fx_rate), landed_cost_charges

-- customers & trade
customers(phone unique, name, email, wallet_balance view),
customer_devices, addresses,
trade_accounts(customer_id, tier_id, credit_limit, terms_days, status),
loyalty_ledger

-- sales & orders
cash_drawers, drawer_sessions, sales(channel['pos','online','repair','trade']),
sale_items(cost_at_sale, grade_at_sale), payments, payment_webhooks,
orders, order_events, cod_confirmations, shipments, courier_remittances,
returns, return_items

-- repairs & buyback
repair_price_list(device_id, issue, grade, labour, part_variant_id),
repair_jobs, repair_checklists, repair_parts, repair_photos,
repair_status_history, warranties(source_type, source_id, starts, ends, status),
buyback_requests

-- accounting
accounts, journal_entries(source_type, source_id, reversal_of),
journal_lines(debit, credit bigint), business_days, expenses

-- engagement
social_posts, social_post_products, reviews,
reviews(source['onsite','google','admin'], rating, text, customer_id, phone,
  sale_id, repair_job_id, product_id, verified, status['published','pending',
  'hidden','rejected'], featured, sort, owner_reply, owner_reply_at,
  flagged_reason, google_prompt_shown, google_prompt_clicked),
review_media(review_id, type['image','video'], uploadthing_key, url, poster),
google_reviews(google_review_id, author, rating, text, time, reply, synced_at),
review_requests(customer_id, source_type, source_id, sent_at, opened_at),
site_themes, theme_overrides, repair_stories, portfolio_items, faqs,
discount_codes, discount_redemptions, referral_codes, announcements,
inquiries, email_threads, blog_posts, blog_categories,
accounting_periods, fixed_assets, depreciation_runs, bank_statements,
bank_statement_lines, bank_matches, financial_notes,
site_pages, page_sections(order, visible), content_blocks(key, en, ur, limits),
content_versions(published_by, published_at, snapshot), content_schedules,
hero_settings(mode, media_id), media_assets(type, source['upload','youtube',
  'instagram'], url, poster, duration, size, captions, product_tags), whatsapp_threads,
whatsapp_messages, notifications, ai_usage_log, settings
```

Views: `v_stock_on_hand`, `v_trial_balance`, `v_profit_loss`, `v_balance_sheet`, `v_general_ledger`, `v_khata_aging`, `v_dead_stock`, `v_daily_summary`, `v_cashier_risk`.

Key RPCs: `post_pos_sale`, `sync_offline_sales`, `place_online_order`, `confirm_cod`, `verify_payment`, `handle_gateway_webhook`, `expire_unpaid_orders`, `book_shipment`, `import_courier_remittance`, `receive_grn`, `allocate_landed_cost`, `approve_adjustment`, `create_repair_job`, `deliver_repair_job`, `post_buyback`, `post_trade_payment`, `close_drawer`, `run_daily_closing`, `post_manual_journal`, `reverse_journal`, `verify_proof_code`.

---

## 8. Engineering Rules
1. Money is integer paisa. Format only in UI (`Rs 1,250`).
2. Stock and money change only through RPCs inside one transaction; RLS denies direct writes to those tables.
3. Journals balance (DB-enforced), are immutable, and are corrected by reversal.
4. Business-day logic in Asia/Karachi.
5. RLS on every table. Storefront never sees cost, margin, supplier, or other customers' data.
6. Idempotency keys on checkout, payments, webhooks, and offline sync.
7. All third parties (payments, courier, WhatsApp, AI) behind interfaces with retries, timeouts, and a mock implementation for local dev.
8. Every sensitive action is audit-logged.
9. Seed script with realistic data: 30 device models, 300 variants, a week of sales, repairs, and trade orders.
10. Integrity tests: after every accounting scenario, trial balance balances and stock equals the sum of movements. CI fails otherwise.
11. Accessibility and performance budgets in §4.4–4.5 are checked in CI (Lighthouse).

---

## 9. Security & Privacy
- Customer phone numbers and passcodes are personal data: passcodes encrypted at rest and purged on handover; CNIC optional and masked.
- Proof codes and order lookups are rate-limited.
- Staff sessions expire; sensitive actions re-prompt for PIN.
- Daily automated backups (Supabase) plus weekly export to owner's storage.

---

## 10. Cost Model (monthly, early stage — verify current pricing at build time)

| Item | Expected |
|---|---|
| Supabase | Free tier at start → Pro when DB/storage grows |
| Vercel | Pro (commercial use) |
| Domain | Annual, small |
| Resend email | Free tier likely enough initially |
| UploadThing | Free tier at start (public media); paid plan as videos grow |
| Google APIs | Business Profile API free with approval; Places API pay-per-use with monthly free credit |
| WhatsApp Cloud API | Pay per conversation/template; service replies inside 24h window are cheaper |
| Payment gateway | Per-transaction fee; Raast usually cheaper than cards |
| Courier | Per-shipment, deducted from COD remittance |
| AI | Pay per token; cap with per-feature budgets in `ai_usage_log` |

---

## 11. KPIs to show on the cockpit
Daily revenue and gross margin by channel · cash variance · COD confirmation rate and RTO rate · repair turnaround and comeback rate · stock-out days on top 50 SKUs · dead-stock value · khata outstanding and overdue · website conversion rate · repeat-customer rate · Google rating and review count · review funnel (requests → reviews → Google clicks).

---

## 12. Folder Structure
```
/app
  /(store)   /(trade)   /(panel)   /(admin)
  /verify/[code]   /track/[ref]
  /api/webhooks/{payments,courier,whatsapp}   /api/cron/*
/components   /components/ui (shadcn)
/lib
  /auth  /accounting  /inventory  /payments  /courier  /whatsapp
  /ai  /i18n  /offline  /email  /cms  /media  /reviews  /uploadthing
/supabase/migrations  /supabase/seed.sql  /supabase/tests
/tests/e2e
```

---

## 13. Build Phases

**Phase 1 — Back office core (go live in shop)**
Auth + roles/permissions + audit · products, variants, grades, devices, compatibility · stock movements, GRN, landed cost, counts, adjustments · offline-first POS + drawers · chart of accounts + auto-posting · daily closing + report email · TB / P&L / BS · shortage alerts · CSV import · month-end close + fixed assets + bank reconciliation · Owner Cockpit v1.

**Phase 2 — Storefront & orders**
3D exploded-phone hero (+ CSS-3D and poster fallbacks) · device selector + Fit Finder · catalog, grade ladder, bundles · checkout with Raast/card gateway, COD, pickup, manual transfer fallback · reservations and expiry · WhatsApp COD confirmation + notifications · one courier integration + COD reconciliation · Homepage landing-page structure (§4.6) · Website Content Manager (edit mode, add/delete sections, drafts, versions, Urdu, FAQ Manager) · Appearance themes · on-site reviews with UploadThing photos/videos + Google reviews (Places fallback) + Reviews Manager · Repair Stories & Portfolio · promotions & discount codes · · hero media modes + muted-autoplay video · YouTube/uploaded reel strip · Instagram posts module · Genuine Proof labels and `/verify` · SEO pages · Urdu.

**Phase 3 — Repairs, trade & trust**
Repair price list + Instant Quote · repair jobs, checklists, photos, live tracker · warranty wallet + claims · trade accounts, tiers, khata, reminders, trade portal · Google Business Profile API sync + reply · loyalty + referral codes · inquiries inbox + Resend email gate · blog & SEO pages · WhatsApp unified inbox · smart reorder + dead stock.

**Phase 4 — Intelligence & scale**
AI shop assistant (WhatsApp + web, answer-bank first) · year-end close + annual report pack · Owner Copilot + anomaly watch · buyback with AI photo pre-grading · Instagram Graph API sync · additional couriers · multi-branch support.

---

## 13b. Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
UPLOADTHING_TOKEN=
RESEND_API_KEY=
RESEND_INBOUND_WEBHOOK_SECRET=
WHATSAPP_CLOUD_API_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
PAYMENT_GATEWAY=payfast|safepay
PAYMENT_GATEWAY_MERCHANT_ID=
PAYMENT_GATEWAY_SECRET=
COURIER_PROVIDER=
COURIER_API_KEY=
GOOGLE_PLACES_API_KEY=
GOOGLE_BUSINESS_CLIENT_ID=
GOOGLE_BUSINESS_CLIENT_SECRET=
GOOGLE_BUSINESS_REFRESH_TOKEN=
NEXT_PUBLIC_GOOGLE_PLACE_ID=
YOUTUBE_API_KEY=
INSTAGRAM_GRAPH_TOKEN=
AI_PROVIDER_API_KEY=
NEXT_PUBLIC_GA4_ID=
NEXT_PUBLIC_META_PIXEL_ID=
SENTRY_DSN=
NEXT_PUBLIC_SITE_URL=
```

---

## 14. Open Questions (confirm with owner)
- Exact address, domain, logo, brand colours (or approve the §4.2 palette)
- Preferred payment gateway (PayFast vs Safepay) and bank accounts
- Delivery: own rider zones, which courier first
- Opening balances at go-live: stock count, cash, bank, payables, khata receivables
- Number of counters and staff; who gets which role
- Warranty and return policy per grade
- Trade pricing tiers and default credit terms
- Online vs counter price policy
- Is buyback of broken parts already done informally today?
- Google Business Profile: who is the verified owner/manager (needed to connect reviews), and the Place ID
- Existing reviews, before/after photos and reels to import at launch
- Year-end date for the accounts and opening fixed assets list
