# BizTrackBD: project context (for a Claude project / Cowork research)

**Repository (public):** https://github.com/neiloy-neil/biztrackbd-ecom  (branch `main`)
**Live:** marketing https://biztrack.bd · store admin https://admin.biztrack.bd · platform (super) admin https://platform.biztrack.bd · each store at `https://<store>.biztrack.bd` (or its own verified domain).
**Date of this note:** 15 October 2026.

## What it is
A multi-tenant ecommerce SaaS for small Bangladeshi businesses. A merchant signs up, gets a store on a subdomain (or custom domain), a themed storefront, and a phone-first admin. The platform team runs a separate super admin. Built for how Bangladesh sells: cash on delivery, manual bKash/Nagad payments checked by TrxID, Pathao/Steadfast/RedX couriers, fake-order and courier-fraud protection, Bangla and English everywhere, ৳ currency, Dhaka time (UTC+6).

## Four apps, one monorepo (pnpm + Turborepo)
| App | Path | Purpose |
|---|---|---|
| Marketing | `apps/marketing` | Public site: pricing, templates, signup (`/start`), free courier fraud checker tool, demo |
| Storefront | `apps/storefront` | The customer store (themes, product pages, one-page checkout, account with SMS-code sign-in, order tracking, contact form, back-in-stock requests, draft-order links, landing pages) |
| Admin | `apps/admin` | Merchant admin (mobile-first PWA): orders, couriers, returns, products, inventory, POS, customers, inbox, marketing, reports, COD payouts, profit, store design editor, domains, settings, team |
| Platform | `apps/platform` | Super admin: tenants, plans, payment proofs, domains, themes/modules, announcements, tickets, usage, audit, platform settings (AI, SMS, couriers, payments, mail, fraud checker key) |

Shared packages: `packages/core` (all business logic, ~70 test files), `packages/db` (Prisma schema, migrations, tenant client), `packages/media` (image processing, WebP, EXIF removal), `packages/ui`, `packages/tsconfig`. Tools in `tools/`.

## Stack
Next.js 16.4 (App Router, Turbopack, React 19; **has breaking changes: read `node_modules/next/dist/docs/`; `proxy.ts` replaces middleware; async params/cookies/headers**), Prisma 7.10 with `@prisma/adapter-pg`, PostgreSQL 16 on Supabase, Vitest, Playwright, axe-core, sharp. Hosting: Vercel (one project per app), GitHub Actions for CI, migrations check, backups, smoke.

## How multi-tenancy is enforced (important)
- Every tenant table has a `tenantId` and Postgres **row-level security, enabled and forced**, with a policy `"tenantId" = current_tenant()`.
- The app connects as `biztrack_app` (no bypass). `withTenant(tenantId, fn)` sets `app.current_tenant_id` for one transaction. A separate `biztrack_platform` role serves the super admin.
- Edge routing resolves a request host to a tenant (`resolve_tenant_by_host`), custom domains must be verified, one primary domain per tenant.
- Append-only tables for the app role (audit log, order events, stock adjustments). A cross-store reference guard trigger exists.
- `PlatformConfig` (secrets such as AI/SMS/gateway/fraud keys) is not selectable by the app role; stores read allow-listed keys only through the SQL function `platform_config_value()`.
- The repo's own isolation sweep (`packages/db` tests) checks every table that has a `tenantId`.

## Money and order path (safety rules)
Server-side pricing only (the browser sends ids and quantities), atomic stock (`UPDATE … WHERE stock >= qty`), idempotency keys, an order state machine (PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED, with CANCELLED / RETURNED / REFUNDED), an atomic per-store order counter, max 3 storefront orders per phone per day, COD fee and maximum, per-method payment switches, a paused-store switch. The checkout quote and the order share one pricing module.

## Roles (store admin)
Owner (all), Manager (no billing/team, reports view-only), Order packer (orders, products; customers view), Support/telemarketer (customers edit; orders, products view), Content editor (products, design). Checked in services as well as pages. Platform roles: Owner, Finance, Support lead, Support. Two-factor sign-in via authenticator; real sign-in is Supabase Auth.

## Feature map (what exists today)
- **Orders:** tabs and filters, labels, call note, bulk confirm/cancel/pack/book courier, CSV export, payment-check desk (verify bKash/Nagad by TrxID), quick order desk (reads pasted customer messages), draft orders with a customer link, change items on an open order, SMS the customer, returns/exchanges/refunds, abandoned-checkout recovery, fraud holds and a blocked-number list, courier booking and tracking (Steadfast, Pathao, RedX), printing (slip, invoice, label at A4/A5/80mm).
- **Catalogue:** products with variants and photos, CSV import (Shopify, WooCommerce, own format), categories with one level of sub-categories, inventory with adjustments and history, back-in-stock SMS alerts, barcode label studio, POS (registers, sessions, split payments).
- **Customers:** list, import/export, tags, notes, block, contact inbox answered by SMS, reviews, loyalty points/VIP tiers/referrals.
- **Marketing/growth:** coupons, Meta Pixel + Conversions API, GA4, GTM, TikTok, product feed (`/api/catalog/facebook`), AI studio (Gemini), banners, notifications, flash sale.
- **Money:** sales reports, courier/product/customer reports, COD payout reconciliation, profit and loss, plan billing by bKash/Nagad proof.
- **Store design:** section-based theme editor with versions, undo, preview; landing pages with offers; pages and blog; custom domains with DNS check.
- **Platform:** all of the platform admin list above.

## Current status (honest)
- Phases 0 to 8 of `docs/16-step-by-step-implementation-plan.md` are built. A pilot with real merchants has **not** run. Several later items (WhatsApp commerce suite, more apps) are being added by other sessions.
- Recent work: order handling (labels, bulk, export, change items, drafts), categories, customer import, contact inbox, back-in-stock alerts, POS/AI/marketing suite hardening, production fixes (several 500 pages from server-to-browser function props, missing RLS policies, a missing enum migration), fraud checker key moved into platform settings (never in code).
- **Known open items:** migrations are not auto-applied (`DEPLOY_ENABLED` repo variable is off; run the *Deploy* workflow manually after pushing a migration, otherwise pages that read new columns return 500); some unrelated tests fail on a clean checkout (a reports date-range test, loyalty modules, two UddoktaPay tests that use the dev DB); visual-baseline images for four admin screens are out of date; Windows reserves ports 4010–4012 which the Playwright fake-courier servers use.
- QA: a full manual checklist workbook is at `docs/qa/BizTrackBD-QC-QA-Checklist.xlsx` (about 435 checks).

## Where to read first
`README.md`, then `docs/16-step-by-step-implementation-plan.md` (status blocks per phase and slice), `docs/08-database-schema-and-rls-spec.md`, `docs/27-unified-order-state-machine-and-transaction-safety.md`, `docs/07-complete-features-specification.md`, `docs/32-security-review.md`, `docs/35-production-setup-biztrack-bd.md`, `docs/43-go-live-checklist.md`, `docs/17-environment-variables-and-configuration.md`. Other numbered docs cover couriers/gateways (10), jobs (11), fraud policy (12), routing and domains (13), SEO/performance (14), testing (15), loyalty (26), COD accounting (28), WhatsApp (25).

## Working conventions (for anyone editing)
- Read the relevant Next.js doc in `node_modules/next/dist/docs/` before changing routing/headers/caching; follow `AGENTS.md`.
- Never import values from the `@biztrackbd/core` index inside a `"use client"` file (it pulls in the Postgres driver and breaks the build); use the subpaths (`core/geo`, `core/barcode-render`, `core/reports-presets`, `core/builder-client`, `core/messages-client`) or `import type`.
- Never pass functions or event handlers from a server component to a client component.
- Every new tenant table needs forced row-level security, one policy naming `current_tenant()` with a check on written rows, and the app-role grants; run the isolation sweep.
- Every migration is additive first; code must never read a column the live database lacks. Apply migrations to production right after pushing.
- Secrets live in env or in `PlatformConfig`, never in code, logs, or audit entries. Customer-typed text exported to CSV must be formula-neutralised.
- Tests: `pnpm test`, `pnpm typecheck`, `pnpm build`; admin and storefront Playwright suites run at 390 px and 1440 px.

## Research questions this repo is good for
Bangladesh COD and fake-order economics, bKash/Nagad manual-verification UX, courier API behaviour (Steadfast, Pathao, RedX), multi-tenant Postgres RLS patterns with Prisma, Bangla-first ecommerce UX, SaaS pricing and trial design for small merchants, comparison with Shopify/Woo/local builders (see `docs/03-competitor-analysis.md`).
