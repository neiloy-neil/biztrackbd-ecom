# Project checkup, 11 October 2026

Run against the **real Supabase project** (its Postgres database, its sign-in, its storage), with the apps connecting as the restricted
roles `biztrack_app` and `biztrack_platform`, so row-level security was in force. Screenshots are in `checkup/screens/`:
`actual/` (80 captures), `reference/` (all 88 design artboards), `compare/` (58 side-by-side images: **actual on the left, design on the right**).
`checkup/state.json` lists every id the run created. `checkup/run1-as-postgres/` is a first run that turned out to bypass row-level security (see 2.1); keep it only as a record.

> **Status update, later on 11 October 2026.** This report is the walk-through as it happened. Since then: the problems in section 2 are fixed (see `checkup/AUDIT-REPORT.md` for the full fix list and current test results); the Supabase test data described in section 4 has been deleted; five storefront themes became selectable, so the template screenshots below ("Coming soon" on four) are out of date; and the favicon 404 in 2.4 is fixed.

Tools: `tools/dev-real.mjs` (start the four apps against Supabase), `tools/checkup-run.mjs <stage>` (the walk-through), `tools/render-canvas.mjs` (turns the design artboards into plain HTML so they can be screenshotted), `tools/checkup-roles.mjs`, `tools/checkup-audit.mjs`, `tools/checkup-migrate.mjs`.

## 1. What was walked, and what the database held afterwards

| Stage | What happened | Stored in Supabase (checked with a direct query) |
|---|---|---|
| Marketing site | Home, templates, pricing, mobile home | none (static) |
| Signup wizard | Five steps, a new Pro store with sample products | `Tenant` (TRIAL, Pro, 14 days), owner `TenantUser`, 3 products, 1 category, 2 delivery zones, store settings |
| Flagged signup | A store named "Apex Tailors" (a protected brand word) | `Tenant.quarantined = true`, reason "Name or address contains apex" |
| Owner first sign-in | Email code, then choose a password, via real Supabase Auth | owner row **bound** to the Supabase account, login time recorded |
| Owner admin tour | 29 screens at 1440, 4 at 390; every one returned 200 | none |
| Owner pays for the plan | bKash proof from the billing screen | `PaymentProof` PENDING, then APPROVED |
| Platform admin | Account + authenticator (TOTP) enrolled; signed in with two steps | `PlatformUser` |
| Platform approves | Flagged store: approved with a review note. Payment: approved | flagged store `quarantined = false`; proof APPROVED, store ACTIVE on Pro, `Subscription` ACTIVE until 11 Nov |
| Customer order | Visitor on the new store's address orders cash on delivery | `Order` BT-10001 (৳1,330 incl. ৳80 delivery), customer, order item |
| Owner fulfils | Sees the order, confirms it | order CONFIRMED |

Isolation, measured on the live data as `biztrack_app`: the store sees 1 category, 3 products, 1 order, 1 customer; the flagged store sees its own 3 products and 0 orders; with no store set, 0 rows.
`pnpm audit:rls` against Supabase with data in two stores: 19 tables hold data, a cross-tenant insert was attempted on 18, all refused: `OK: every table is isolated`.

## 2. Problems found, and what was done

### 2.1 The run was not testing what it claimed (fixed)
All three connection strings in `.env.local` were the same `postgres` login, which bypasses row-level security. A first run therefore "worked" while every store could see every other store's rows (the storefront showed 6 products for a 3-product store and React logged duplicate keys). `tools/checkup-roles.mjs` gave `biztrack_app` and `biztrack_platform` their own passwords, wrote the strings, and checked each logs in as that role (`biztrack_platform` bypasses RLS by design, `biztrack_app` does not). The earlier "RLS audit OK" was meaningless: it passes on empty tables and on a bypassing login.

### 2.2 Supabase turns row-level security on for every new table (fixed in migration 16)
A Supabase event trigger (`ensure_rls`) enables RLS on every table a migration creates. Eight tables ended up with RLS on and no policy: `Announcement`, `Plan`, `PhoneTrustEvent`, `PhoneTrustStat`, `PlatformAuditLog`, `PlatformDailyMetrics`, `PlatformUser`, `_prisma_migrations`. Six are platform-only and are correctly sealed. **`Plan` and `Announcement` are meant to be readable by the store apps**, and were invisible: the signup page crashed ("Cannot read properties of undefined (reading 'tier')") and billing would have shown no prices. Migration `20261014000016_platform_tables_readable_under_rls` adds two read-only policies for `biztrack_app`. Applied to Supabase and to the local database; no effect on plain Postgres.

### 2.3 Supabase exposed every table to its public REST API (fixed by hand, not in a migration)
`anon` and `authenticated` held 476 table privileges and 19 function privileges in `public` (including `staff_memberships`). Revoked, with default privileges changed, and re-checked: no rows remain. Because the `anon` role does not exist on plain Postgres, this cannot be a migration. **Deployment checklist item:** after every migration against Supabase, rerun the check query (in the notes for docs/17).

### 2.4 Smaller findings
- The platform "Approve" for a flagged store needs the note ("What you checked"); without it the store stays flagged and the page shows the reason in an alert box (checked in the code: `tenants/[id]/page.tsx` renders `?err`). My script reloaded the page, which hid it.
- Both stores' first order is `BT-10001`: numbering is per store. Correct, but the platform's cross-store views must not rely on it being unique.
- The platform payment card warned "This sender number has also paid for 1 other store": the duplicate-sender check works (my test used one number twice).
- Every app logged one 404 for a resource on each page: it was the missing favicon. Fixed (an icon on all four apps).
- The development "N / Issues" badge and a compile pill appear in screenshots: development only.
- Storefront opens in Bangla by default (cookie `bt_lang` absent), which is by design.
- The audit log for the flagged store lists only `store.created`; the platform's approval is recorded in the platform's own audit log (not re-checked in this run).

## 3. UI/UX and features against the design canvas

Judged from `checkup/screens/compare/NN-name.png`. Overall: the **structure, wording and data are right on the owner admin, and the colours and type match**; the gaps are mostly chrome and richness, and the **platform admin and marketing site are the thinnest**.

| Area | Match | Differences from the design |
|---|---|---|
| Marketing home (01) | Brand colour, type, wording on hero | Left-aligned hero (design centred); no product preview, no template gallery, no pricing strip, no "built for Bangladesh" panel, no dark closing call to action; header lacks Features, Help, the Bangla switch and Log in; footer is one line, not four columns; FAQ shows questions only, no answers |
| Templates (02) | Five templates listed, Ready / Coming soon | Plain name tiles, not mini previews; no category filter chips or "sorted by"; feature tags missing |
| Pricing (03) | Three plans, prices, Pro highlighted | No Monthly/Yearly toggle, no "Compare plans" table, no "Pay the way that suits you" strip; feature lists differ from the design |
| Signup (05-09) | Fields, trial wording, plan choice | One centred 5-step form instead of the split layout with the dark "What happens next" panel and the **live store preview**; no "Continue with Google"; no password on the form (the owner sets it at first sign-in); template step is a radio list, not preview cards; **no brand step** (logo, main colour, language, currency); sample-products opt-in is present |
| Owner dashboard (10, 11) | Greeting, four numbers, sales chart, setup checklist, recent orders | No top bar (search, View store, EN/বাং, notifications, help, avatar); no plan/trial card in the sidebar; no low-stock panel, no tip card; sidebar is grouped differently |
| Orders (12, 13) | Tabs, search, payment filter, bulk actions | Courier / district / date chips, the selected-rows bar, Courier column, Export |
| Order detail (14) | Items, payment, customer, delivery trust, timeline, courier, packed button | Design is a two-column desk with a delivery-company chooser and "Book courier"; here couriers need keys first (a notice says so) |
| Products (15) | Table, status, stock, category, price | Product thumbnails, a list/grid switch, Import CSV, "sold in 30 days" is present but empty |
| Loyalty (29) | All the settings, now including VIP thresholds, expiry and birthday voucher | Design is a read-only tier table with perks and a "top members" panel; here the tiers are form fields and the table is a count line |
| Mobile dashboard (42) | Greeting, quick actions, numbers, checklist | No dark sales hero, no "Needs your attention" cards |
| Platform overview (46) | Four numbers, "Needs you", new-stores chart | Light sidebar (design: dark navy with a "PLATFORM ADMIN" tag); nav has Overview, Stores, Payments, Domains, Plans, Audit log, **not** Themes and modules, Support tickets, Announcements, Usage and limits; no MRR growth chart, newest signups, or funnel |
| Platform stores (47) | Search, list, flagged marker | Tab counts, filter chips, MRR / orders / GMV / last-active columns, Export CSV |
| Platform store detail (48) | Owner, subscription, usage, payments, suspend, trial extension, plan change, brand review, "what we did" | Tabs (Overview, Subscription, Usage, Domains, Modules, Support, Audit), KPI cards, **Log in as owner**, Open store, domains, modules, internal notes, usage bars |
| Platform payments (49) | Approve / reject with the TrxID, sender, amount; duplicate-sender warning | Master-detail layout with the bKash screenshot panel and the three checks; "Ask for more details"; gateway and failed-payment tabs |
| Storefront (53-58) | Kapor home, product, cart, checkout, order success | Compared at desktop width against **mobile** artboards, so only the content is comparable: no announcement bar and hero artwork on a new store, sample products have no badges or compare-at prices, the sample category renders without images. Checkout has no inline bKash instruction panel until bKash is chosen (not captured) |

Features in the docs and design that this checkup did not find in the running product: Google sign-in; the brand step of signup; live store preview in signup; the platform's Themes and modules, Support tickets, Announcements and Usage and limits screens; "Log in as owner"; per-tenant MRR/GMV columns; a funnel on the platform overview. Some of these are listed as not built in docs/16; the platform items should be checked against it.

## 4. Not covered (as of this report; later results are in `checkup/AUDIT-REPORT.md`)
- At the time of this report the full Playwright suites had not been rerun after the Phase 10 changes. They have since been rerun (see the audit report): the failures seen then were the local database going down mid-run and one rule working as designed, not product bugs.
- Real emails and SMS: the codes were taken from Supabase's admin API, not from an inbox; no SMS was sent.
- Real money, courier booking, custom domains, the backup restore drill against a populated production database.
- Storage: no product photo was uploaded in this run.
- Test records: the stores `e2e-checkup-*`, their 4 Supabase accounts, the platform test accounts, 2 orders and 2 payments **were deleted from Supabase on 11 October 2026** (`tools/checkup-cleanup.mjs`); the Supabase project now holds no stores.
