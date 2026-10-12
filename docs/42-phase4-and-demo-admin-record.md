# Phase 4 and the demo admin: what was built (12 October 2026)

A record of the store admin rebuild (docs/40) and the demo admin (docs/41). Briefs: docs/36 (decisions), docs/40 (Phase 4 plan), docs/41 (demo admin plan).

## Store admin screens (Phase 4)
| Area | What changed |
|---|---|
| Integrations | Cards in groups, a drawer per provider, plain labels, test/live switch, write-only secrets. |
| Settings | One layout with a section list (pills on a phone). Store details in tabs with a sticky save bar. New **Customer messages** and **Invoices** sections. |
| Orders | Live search, filter chips, bulk bar (pack, book, print), quick-view drawer. New phone desks: **Check payments** (`/orders/check`) and **Book couriers** (`/orders/ship`). |
| Products | Live filters (search, category, collection, status tabs with counts), list or grid, select-all with publish / draft / archive, **CSV import** with a template (up to 200 rows, errors by line). |
| Dashboard | Sales chart for 7, 30 or 90 days with the previous period as a dashed line, setup checklist, low stock, tips. |
| Long pages | COD payouts in tabs (Parcels, Import, History). Customers with a quick-view drawer. Inventory with a stock drawer. |
| Customer messages | Order received, payment confirmed, shipped, delivered, cancelled, cart reminder. English and Bangla texts, insertable details, live preview, SMS-part counter. **Off until switched on**; each message uses one SMS credit, skips opted-out customers and stops at the plan allowance. |
| Invoices | Logo, SKU, prices on the slip, footer note, default paper (A4, A5, thermal) with a live preview of the real print page (`/orders/print?sample=1`). |
| Storefront | While orders are paused: a strip on every page and a "short break" notice in place of checkout. |

## Demo admin (docs/41)
- `/demo` on the admin host lists the six demo stores; `/demo/start?template=<id>` makes a private copy and signs the visitor in (cookie `bt_demo`, signed, names one demo store, opens nothing else).
- A copy has the template's products and pictures (reused by address), a published home page, 13 starter orders over two weeks, and a new sample order at most every 3 minutes (when the dashboard or orders list loads), up to 40.
- Limits: 3 hours, 50 at once, 3 starts an hour per visitor. Cleanup every 15 minutes (`/api/cron/demo-sweep`, scheduled in Supabase).
- Simulated: SMS (nothing sent), couriers (a pretend Steadfast and Pathao whose status moves with time). Locked with a "not in the demo" note: plan and billing, domains, team, integrations, apps, pausing the store, imports, exports, uploads.
- **Keep this store**: the banner button carries a secret code to signup; products, categories, pictures (copied into the new store's storage), store details and the home page come across. The code works once and ends with the demo.
- Marketing: "Try the admin" on each template card, the home page, pricing and templates pages.

## Operations learned the hard way
- **Function region.** The four apps ran in US East (`iad1`) while Supabase is in Mumbai, so every query cost a long round trip. Each app's `vercel.json` now sets `bom1`. Starting a demo went from over 60 seconds to about 4.
- **Connection limit.** Supabase's session pooler allows 15 connections on the free plan. Each server instance holds `DB_POOL_MAX` (Vercel has 1), and idle instances keep theirs. The real fix is Supabase's transaction pooler (port 6543) in `DATABASE_URL`.
- **Admin layout must not need the platform database credential.** It does not exist in the admin project. `tests/security.test.ts` fails if the store-side announcement lookup uses it.
- **Smoke test.** `tools/smoke.mjs` (21 checks, run by `.github/workflows/smoke.yml` after each production deployment and hourly) opens the marketing site, storefronts, admin sign-in, and a whole signed-in admin through a demo, and fails on any 500.
- Vercel sometimes fails a build with `git_info_fail`. It is a platform error: push again (or press Redeploy).

## Migrations added
17 `demo_stores`, 18 `tenant_notes`, 19 `tenant_notes_rls`, 20 `demo_sessions`, 21 `demo_keep`.

## Tests added
Core: messages (16), demo sessions and keep-this-store (17), products and CSV import, dashboard series, security rules. End to end (phone and desktop widths): products, long pages, messages and invoices, demo admin, marketing entry points and the keep journey, phone desks, paused store.
