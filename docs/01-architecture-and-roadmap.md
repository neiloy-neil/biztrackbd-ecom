# Multi-Tenant Ecommerce SaaS — Architecture & Roadmap

Status: DRAFT for review. No code has been written yet.

## 1. Decisions locked in (from Q&A)

| Area | Decision |
|---|---|
| Market | Bangladesh first (BDT), English + Bangla |
| Tenancy | Shared Postgres DB, `tenantId` on every tenant-owned row, enforced by Postgres RLS + Prisma extension |
| Hosting | Vercel (wildcard subdomain + Domains API for custom domains/SSL) |
| Auth | Supabase Auth, one project, tenant-aware (3 actor types, see §4) |
| Build approach | New monorepo; the 5 existing projects are ported as **themes** |
| Customization | Theme + brand settings -> section builder -> full drag-and-drop builder (phased) |
| Industry features | Optional per-store **modules** (Bespoke, Baby profiles, Drops) |
| Subscription billing | Free trial (14d, no card) + 3 paid tiers; Stripe, SSLCommerz/bKash/Nagad, manual transfer |
| Commission | None, subscription only (keep as a nullable plan field) |
| Store integrations v1 | COD, manual bKash/Nagad (TrxID), Pathao/Steadfast/RedX, SMS + email |
| Super admin | Clients/plans/MRR/churn, impersonate + suspend, per-store orders/GMV/usage, announcements + tickets |
| Onboarding | Guided wizard + seeded demo data |
| V1 features beyond the original plan | Fraud and courier-history check, abandoned order call list, Facebook Pixel and Conversions API, landing pages, quick order desk, COD settlement, profit and loss, loyalty and VIP (see docs/05, 26, 28) |
| Plan limits | Products and monthly orders on every plan; Starter 300 and 500, Pro 2,000 and 3,000, Business unlimited (prices and limits are hypotheses, docs/05) |
| Integrations | Each store pastes its own courier and gateway keys, encrypted per tenant; money goes straight to the store (docs/04, 10) |
| Design | Canvas of 88 artboards is the UI reference (docs/02, docs/29) |

## 2. What the existing projects tell us

All five are Next.js 16 / React 19 / Prisma / Supabase / Zustand with `(store)` and `(admin)` route groups.
About 85-90 models are common to all of them (Product, Variant, Order, Payment, Coupon, Review, Banner, Page, Setting,
ShippingZone, Blog, Loyalty, Affiliate, Workflow, Gift cards, Store credit, ...). That shared set becomes the **core schema**.

| Project | Prisma | DB | Unique models -> module |
|---|---|---|---|
| berber-clothing | 5.22 | Postgres | MeasurementProfile, BespokeFabric/Order/Appointment/TimelineLog -> `bespoke` |
| mini-bunny | 5.22 | Postgres | BabyProfile -> `baby-profiles` |
| Bindu-Premium-Redesign | 7.8 | Postgres | Episode, EpisodeProduct, DropNotify, ProductTags -> `drops` |
| axionwear | 7.8 | Postgres | Episode, EpisodeProduct, DropNotify -> `drops` |
| gadgetstudiobd-ecom | 7.8 | **SQLite** | none (generic electronics theme) |

Consequences: standardize on Prisma 7.8 + Postgres; gadgetstudio needs a data-layer port only.
Schema drift between projects (fields that differ on the "same" model) must be reconciled in Phase 0.

## 3. Target architecture

```
apps/
  marketing/    yourplatform.com        demos, pricing, signup wizard, theme gallery
  storefront/   *.yourplatform.com + custom domains   tenant-resolved by hostname (middleware)
  admin/        admin.yourplatform.com or {tenant}.yourplatform.com/admin   store owner panel
  platform/     super.yourplatform.com  your super admin
packages/
  db/           Prisma schema, tenant-scoped client, RLS migrations
  core/         domain logic: orders, inventory, pricing, coupons, shipping, payments
  themes/       one folder per theme (kapor, gadgetstudio, mini-bunny, axionwear, bindu; kapor is ported from berber-clothing)
  modules/      bespoke, baby-profiles, drops (each: schema extension + admin UI + storefront blocks)
  builder/      section/block registry, page-JSON renderer, editor UI
  billing/      plans, entitlements, Stripe/SSLCommerz/manual adapters
  integrations/ couriers (Pathao/Steadfast/RedX), SMS, email, manual-MFS
  ui/           shared design system
```

**Tenant resolution:** edge middleware reads `Host`. `*.yourplatform.com` -> lookup subdomain; any other host ->
lookup `Domain` table. Result (tenantId, themeId, enabled modules, plan entitlements) is cached at the edge
(Edge Config / KV) and injected as a request header. Unknown host -> marketing 404.

**Data isolation (defense in depth):**
1. Every tenant table has `tenantId` + composite indexes starting with it.
2. Prisma client extension auto-injects `tenantId` on all reads/writes; raw queries banned except in `core`.
3. Postgres RLS policies keyed on `current_setting('app.tenant_id')` as the backstop.
4. Per-tenant storage prefixes in Supabase Storage; per-tenant rate limits.

## 4. Actors and auth

- **Platform admin** (you + staff): `PlatformUser`, role-based, lives on super admin only.
- **Tenant owner/staff:** `TenantMember(userId, tenantId, role)` with roles Owner/Manager/Staff/Support; one user can own several stores.
- **Customer:** `Customer` scoped to a tenant (same email can exist in many stores; never shared).
- Impersonation: platform admin "login as" issues a short-lived, audit-logged, read-flagged session.

## 5. Platform data model (new)

`Tenant`(id, name, subdomain, status[trial|active|past_due|suspended|cancelled], themeId, locale, currency, createdAt)
`Domain`(tenantId, host, verified, sslStatus, primary)
`Plan`(key, name, priceBDT, priceUSD, interval, limits JSON, features JSON, commissionPct?)
`Subscription`(tenantId, planId, status, trialEndsAt, currentPeriodEnd, provider, providerRef)
`Invoice`/`PaymentProof`(tenantId, amount, method, trxId, screenshot, status[pending|approved|rejected]) — manual payments
`TenantModule`(tenantId, moduleKey, enabled)
`ThemeInstall`(tenantId, themeId, settings JSON, pages JSON)  — builder output
`UsageCounter`(tenantId, metric, period, value) — products, orders, storage, staff, SMS
`Announcement`, `SupportTicket`, `TicketMessage`, `PlatformAuditLog`

Entitlements are checked in one place (`billing.can(tenant, "custom_domain")` / `limit(tenant, "products")`), never ad hoc in UI.

## 6. Themes and the builder

- A **theme** = React components + a manifest: supported sections, default page JSON, design tokens, required modules, preview images.
- Every page is stored as JSON: `[{ section: "hero", settings: {...}, blocks: [...] }]`, rendered by the theme's section registry.
  This one format serves all three customization levels:
  1. **Settings:** colors, fonts, logo, banners -> CSS variables / tokens.
  2. **Section builder:** reorder/toggle/edit sections with live preview (Phase 4).
  3. **Full drag-and-drop:** free-form blocks, nesting, responsive controls (Phase 7, on the same JSON).
- Themes only read the **core** data model, so switching theme keeps all products/orders.
- Draft vs published versions, with preview URL and rollback.

## 7. Domains

- Subdomain: wildcard `*.yourplatform.com` on Vercel; reserved-name blocklist (`www`, `admin`, `api`, ...).
- Custom domain: owner enters domain -> platform calls Vercel Domains API -> shows required DNS (CNAME / A) ->
  background job polls verify -> SSL auto-issued -> `Domain.verified = true`. Apex + www redirect handled.
- Gate behind plan entitlement.

## 8. Billing

- Plans: Trial (14d, no card) -> Starter / Pro / Business. Limits: products, staff, storage, SMS credits, custom domain, modules, builder level, "powered by" removal.
- Providers behind one adapter interface:
  - **Stripe** (cards, automated renewals),
  - **SSLCommerz** (bKash/Nagad/cards; renewals via payment link + reminders unless tokenized recurring is available),
  - **Manual** (tenant uploads TrxID/screenshot -> platform admin approves).
- Lifecycle cron: trial ending reminders -> grace period -> read-only mode (storefront stays up, admin writes blocked) -> suspended -> data retention window -> deletion.
- Dunning emails/SMS in Bangla + English.

## 9. Store-level integrations (tenant-configured)

- Payments: COD, manual bKash/Nagad (customer submits TrxID, owner verifies); gateway adapters later.
- Couriers: Pathao, Steadfast, RedX — per-tenant API credentials (encrypted), booking, tracking webhook, label print.
- Notifications: SMS (BD provider adapter, e.g. BulkSMSBD/Alpha SMS) + email (Resend/SES); templates editable per store, Bangla/English.
- Credentials stored encrypted (KMS/envelope), never returned to the client.

## 10. Super admin

Dashboard: tenants by status, signups/day, trial->paid conversion, MRR/ARR, churn, failed payments.
Tenant detail: plan, usage vs limits, orders/GMV, domains, modules, audit log, notes.
Actions: impersonate, suspend/unsuspend, change plan, extend trial, approve manual payments, apply credits.
Comms: announcements (in-admin banner + email), support tickets with assignment and status.
Ops: feature flags per tenant, theme/module registry, health of domain/SSL checks.

## 11. i18n

`next-intl` with `en` and `bn`. Admin UI fully translated; storefront theme strings translated; product/page
content is per-tenant (owner can supply Bangla fields: `name_bn`, etc., or a translations table). BDT formatting with Bangla numerals option.

## 12. Phased Roadmap

The single execution plan is `docs/16-step-by-step-implementation-plan.md`. This section is only a summary so the two cannot drift.

| Phase | Outcome |
|---|---|
| 0 | Monorepo, database with RLS, walking skeleton (one COD order, end to end) |
| 1 | Core engine: OrderService, secrets vault, plan and usage enforcement |
| 2 | Kapor storefront and one-step COD checkout |
| 3 | Merchant admin core, verification desk, quick order desk, mobile admin |
| 4 | Couriers, fraud check, returns, COD settlement, profit and loss |
| 5 | Signup, billing, super admin: the first sellable product |
| 6 | Growth tools: abandoned orders, pixels and CAPI, landing pages, loyalty, reviews, AI copy |
| 7 | Theme editor, media drawer, custom domains |
| 8 | Hardening, tests, pilot |
| Post-v1 | Theme-specific optional modules, chatbot orders (doc 25), app marketplace (doc 20). Physical POS is out of scope. |

## 13. Key risks

1. **Schema drift across the 5 projects** — mitigated by Phase 0 diff before any port.
2. **Cross-tenant data leaks** — RLS + extension + automated leak tests; no raw SQL outside `core`.
3. **Builder scope creep** — single page-JSON format; ship level 2 before level 3.
4. **Recurring payments in BD** — card/MFS tokenization is limited; plan for payment-link renewals and manual approval.
5. **Custom domain operational load** — automate verification and surface clear DNS errors; entitlement-gated.
6. **Noisy neighbors** — per-tenant rate limits, usage counters, pagination caps, background job queues.

## 14. Open questions (answer before Phase 0 ends)

- Platform domain name and brand?
- Tier names and BDT prices; trial length confirmed at 14 days?
- Who are the first 5-10 target clients (to validate the theme set)?
- Data residency / backups expectation (Supabase region)?
- Do existing live stores (if any) need migrating into tenants, or are they demos only?
- Third-party theme marketplace: ever, or never?
