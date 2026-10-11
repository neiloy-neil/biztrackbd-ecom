# Existing Code Reuse Map

Surveyed 10 Oct 2026: `D:\AI\berber-clothing`, `Bindu-Premium-Redesign`, `axionwear`, `gadgetstudiobd-ecom`, `mini-bunny` (all Next.js 16, React 19, Prisma, Supabase Auth). Read from file listings, sizes and spot checks of key files, not a line-by-line audit. Use it to plan Phase 0 to 4 of `docs/16`.

## 1. Read this first: security findings

| Finding | Where | Action |
|---|---|---|
| A Steadfast API key and secret are hard-coded as fallback defaults in source | `berber-clothing/lib/steadfast.ts` (lines around 92 to 107) | Treat those keys as exposed. Rotate them in the Steadfast dashboard. Never copy this file as-is. |
| `.env` is tracked in git | `axionwear`, `gadgetstudiobd-ecom` | Check what it contains. Rotate anything real. Remove from git history before any repo is shared or pushed. |
| Integrations read credentials from `process.env` (Pathao, bKash, Brevo, Meta) | `lib/pathao.ts`, `lib/bkash.ts`, `lib/brevo.ts` | One set of keys for one store. In BizTrackBD these must come from the per-tenant vault (doc 04, 17). |
| No automated tests in any of the five projects | all | The new repo needs the isolation suite and order-path tests from day one. |

## 2. What exists

All five projects share about 85 Prisma models and the same admin and storefront structure. The code is single-tenant: one global Prisma client, a global `Setting` key/value table, no `tenantId`. That is the main porting task. The business logic around it is largely reusable.

Admin has about 55 pages and roughly 150 API routes in the larger projects (berber has the most). The storefront has 40 to 50 routes.

## 3. Reuse map by canvas feature

Effort: **Copy** = near as-is; **Adapt** = port logic, add tenancy, vault, and the canvas UI; **New** = nothing usable.

| Canvas screen or feature | Take from | Effort | Notes |
|---|---|---|---|
| Checkout and order creation (`StrCheckout`, `OrderService`) | `berber-clothing/app/api/store/checkout/route.ts` (566 lines) | Adapt | Already re-validates prices and stock server-side and decrements stock inside a transaction. Add idempotency, atomic `UPDATE ... WHERE stock >= qty`, tenant scoping (doc 27). Berber's version is the most complete (coupons, loyalty, store credit, Meta purchase event, risk check). |
| Bangladesh address (division, district, thana) | `Bindu-Premium-Redesign/lib/bd-geo.ts` (132 lines), `berber/lib/bangladeshAddress.ts` | Copy | Use the Bindu data set. |
| bKash and Nagad payment libs | `lib/bkash.ts`, `lib/nagad.ts` (same in all) | Adapt | Tokenized API integrations. Our v1 needs manual TrxID first, so these are Phase 5+ for automatic payments. Move credentials to the vault. |
| UddoktaPay | `lib/uddoktapay.ts` | Adapt later | A gateway already integrated; SSLCommerz is not in any repo, so that adapter is new. |
| Steadfast booking, tracking, webhooks | `berber/lib/steadfast.ts` (560 lines; other repos have about 90) | Adapt | Largest and most complete. Rewrite credential loading, drop the hard-coded keys, per-tenant webhook token. |
| Pathao | `lib/pathao.ts` (identical in all) | Adapt | Needs OAuth token caching per tenant and a store id per tenant. |
| RedX | none | New | |
| Fraud and courier-history check (`AdmFraud`) | `lib/customerRisk.ts` (Bindu 103, mini-bunny 103, berber 88) | Adapt | Combines own order history with Steadfast's network fraud check. Maps to doc 12. Add the per-store blocklist and the transparent score and reasons shown on the canvas. |
| Abandoned orders (`AdmAbandoned`) | `admin/abandoned-carts`, `api/cron/abandoned-cart`, `AbandonedCart` model | Adapt | Replace the cron route with Inngest (decision). Add call-list statuses and scripts. |
| Quick order desk (`AdmQuickOrder`) | `admin/orders/new` plus `components/admin/ManualOrderForm.tsx`, `draft-orders` | Adapt | A manual order form already exists; rebuild it to the 15-second flow in the canvas. |
| Order list and detail, quick drawer (`AdmOrders`, `AdmOrderDetail`) | `admin/orders`, `OrderDetailsClient.tsx`, `OrderQuickDrawer.tsx`, `orders/bulk` | Adapt | Restyle to the canvas. Add MFS verification card and courier drawer. |
| Print invoice and packing slip (`AdmInvoice`) | `Bindu/.../orders/[id]/packing-slip/page.tsx` (120 lines), `order/[id]/invoice` | Adapt | Add A5 and thermal layouts. |
| Product list and editor, variants | `admin/products`, `ProductForm.tsx`, `products/import` | Adapt | Add Bangla fields, variant matrix and cost price per the canvas. |
| Inventory and stock alerts | `admin/inventory`, `lib/stockAlert.ts` | Adapt | Single warehouse (drop `locations`). |
| Customers, import, risk | `admin/customers`, `customers/import`, `customers/risk` | Adapt | |
| Coupons, auto discounts | `admin/coupons`, `lib/autoDiscount.ts`, `lib/priceResolver.ts` | Adapt | Price resolver is small and reusable as-is after tenancy. |
| Reviews, returns, blog, pages | `admin/reviews`, `admin/returns`, `admin/blog`, `admin/pages` | Adapt | |
| Expenses and reports (`AdmProfit`, `AdmReports`) | `admin/expenses`, `admin/reports`, `lib/analytics.ts` | Adapt | Expenses exist; the P&L waterfall and COD deductions are new. |
| Meta Conversions API | `berber/lib/metaConversionsApi.ts`, `Bindu/lib/capi.ts`, `fbclid.ts`, `MetaPixelTracker.tsx` | Adapt | Add event-id dedup log and the match table (`AdmPixels`). |
| Email (Brevo) | `berber/lib/brevo.ts`, `lib/email.ts` | Adapt | Platform-managed per decision; add per-tenant sender and metering. |
| WhatsApp and SMS | `lib/whatsapp.ts` (berber, mini-bunny), `Bindu/lib/sms.ts` | Adapt | Doc 25 and the SMS aggregator. |
| Loyalty, referral, store credit | `lib/loyalty.ts` (Bindu 141 lines), `referral.ts`, store-credit pages | Adapt | Align to doc 26 (points unlock only after delivery, tiers, referral fraud shield). |
| Workflow automation | `lib/workflowEngine.ts` (143 lines, same everywhere) | Adapt, optional | Triggers like order placed and abandoned cart. Inngest covers most of this; consider dropping. |
| Rate limiting and audit log | `lib/rateLimit.ts`, `lib/auditLog.ts` | Adapt | Rate limit per tenant and IP. |
| Supabase Auth and role check | `lib/auth.ts`, `lib/adminAuth.ts` | Adapt | Same provider as the decision. Extend to three actor types and tenant membership. |
| Tenant-aware routing | `berber/middleware.ts`, `Bindu/proxy.ts` | Adapt | Redirect and header logic exists; hostname to tenant resolution is new. |
| Bespoke module (measurements, fabrics, appointments, cut sheet) | `berber` (`MeasurementProfile`, `BespokeFabric`, `BespokeOrder`, `BespokeAppointment`, admin and storefront routes) | Adapt | Becomes the `bespoke` module. |
| Drops and episodes module | `Bindu`, `axionwear` (`Episode`, `DropNotify`, `admin/drops`, `drops/[slug]`) | Adapt | Becomes the `drops` module. |
| Baby profile module | `mini-bunny` (`BabyProfile`, `api/account/baby-profile`) | Adapt | Becomes the `baby_profiles` module. |
| Storefront theme components | `berber` store components and routes | Adapt | Kapor is the berber port. Convert to section-based theme with the builder manifest (doc 06). |
| Admin shell, sidebar, topbar, charts | `components/admin/AdminShell.tsx`, `Sidebar.tsx`, `RevenueChart.tsx` | Rewrite | Use the canvas shell in `packages/ui`; old components are the old design. |

## 4. Not in any repo (build new)

Multi-tenancy (tenant table, RLS, tenant Prisma client, hostname routing), plans, limits and usage counters, the signup wizard and marketing site, subscription billing and manual payment approval, the super admin panel, secrets vault and integrations screens, SSLCommerz adapter, RedX adapter, COD settlement and reconciliation, the fraud blocklist and cross-store trust stat, landing page builder, theme editor with draft and publish, custom domain provisioning and DNS assistant, plan-limit interceptors, read-only lifecycle, announcements, domain health, dark mode, and the shared `packages/ui`.

## 5. In the repos but not in the canvas or v1 scope

Affiliates, resellers and wallets, memberships and subscriptions, gift cards, flash sales, bundles, order bumps, frequently-bought-together, price rules, wholesale, purchase orders and suppliers, email studio and campaigns, QA pages, stores locator, lookbook and journal pages, contact inbox. Leave them in the old repos. Bring back only what pilot merchants ask for. This keeps v1 around 40 percent smaller than copying everything.

## 6. How to port a feature (repeatable recipe)

1. Copy the lib or route into the matching package (`packages/core` for logic, `apps/admin` for routes).
2. Replace the global `prisma` import with the tenant client from `packages/db` and delete any `where` that assumed a single store.
3. Replace `Setting` key/value reads with `Tenant` fields, `Plan` limits or `TenantIntegration` secrets.
4. Replace `process.env.*` credentials with vault lookups. Delete every credential default.
5. Change Prisma 5.22 imports and types to 7.8 and re-generate.
6. Rebuild the UI from `packages/ui` to match the canvas; keep the data fetching.
7. Add a test: one happy path and one cross-tenant isolation case.
8. Run the canvas visual check for that screen.

## 7. Suggested order of porting (maps to doc 16)

| Phase | Lift first |
|---|---|
| 0 | `priceResolver`, checkout route logic into `OrderService`, `bd-geo`, `auditLog`, `rateLimit` |
| 1 | `auth`, `adminAuth` with tenant membership; vault is new |
| 2 | Kapor storefront from berber; checkout page and address cascade |
| 3 | Orders, order detail, products and editor, inventory, customers, packing slip, manual order form |
| 4 | `steadfast` (clean rewrite), `pathao`, `customerRisk`, returns, expenses and reports |
| 5 | New code: multi-tenant signup, billing, super admin |
| 6 | `abandoned-cart`, `capi`, `loyalty`, `referral`, reviews, blog and pages, `brevo` |
| 7 | Bespoke, drops and baby-profile modules, then other themes |

## 8. Honest estimate

Reuse removes most of the domain and integration work (roughly a third of the total effort). It does not remove the hard part: multi-tenant isolation, billing, the super admin and the builder are new, and every ported feature needs the tenancy and vault changes above. Plan for porting to take about as long as careful rewriting for anything that touches credentials or settings, and much less for pure logic (address data, price rules, loyalty maths).
