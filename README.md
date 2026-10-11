# BizTrackBD Ecom

Multi-tenant ecommerce SaaS for Bangladeshi businesses: owners pick a template, get a subdomain, run their own store and admin, and can add a custom domain. The platform owner manages tenants, plans and payments.

## Folder layout

| Path | What it is |
|---|---|
| `docs/01-architecture-and-roadmap.md` | Product decisions, multi-tenant architecture, data model, phased roadmap |
| `docs/02-uiux-plan.md` | UI/UX principles, brand foundation, IA, flows, screen inventory |
| `docs/03-competitor-analysis.md` | StoreX, Bitcommerz, SeloraX, Dukaan, Shopify; gaps we found |
| `docs/04-integrations-and-secrets.md` | Per-store keys, encryption, adapters, webhooks, env, money flow |
| `docs/05-decisions-log.md` | Confirmed decisions and the open question list |
| `docs/06-theme-builder-and-manifest-spec.md` | Theme architecture, JSON schemas, live preview bridge, token system, starter themes |
| `docs/07-complete-features-specification.md` | Exhaustive feature specification covering all 78 design canvas HTML artboards & workflows |
| `docs/08-database-schema-and-rls-spec.md` | Complete Prisma schema, enums, multi-tenant composite indexes, and PostgreSQL RLS policies |
| `docs/09-design-canvas-implementation-guide.md` | Design canvas living code guide, tokens extraction, UI primitive mapping, screen-to-route matrix |
| `docs/10-courier-and-gateway-integration-protocol.md` | Courier (Steadfast, Pathao, RedX) and Payment (SSLCommerz, bKash, Nagad) adapter protocols |
| `docs/11-background-jobs-and-queues-spec.md` | Inngest event catalog, abandoned cart sleep workflows, CAPI batching, and courier crons |
| `docs/12-operations-fraud-and-abuse-policy.md` | Delivery trust score algorithm, anti-phishing scanner, super admin impersonation audit, BTRC SMS rules |
| `docs/13-edge-routing-and-domain-ssl-architecture.md` | Edge middleware hostname routing, Vercel Edge Config sub-5ms caching, automated SSL provisioning |
| `docs/14-seo-performance-and-caching-strategy.md` | Media storage isolation, WebP/AVIF compression for 3G/4G, dynamic sitemaps, OpenGraph previews |
| `docs/15-testing-and-qa-strategy.md` | 3-tier testing suite, multi-tenant RLS isolation assertion tests, Playwright E2E checkout suite |
| `docs/16-step-by-step-implementation-plan.md` | Master 8-phase sprint execution plan, package dependency graph, acceptance criteria |
| `docs/17-environment-variables-and-configuration.md` | Master .env.example, AES-256-GCM secret vault implementation, key distribution matrix |
| `docs/18-analytics-and-metrics-aggregation.md` | Daily store rollups (`DailyStoreMetrics`), Inngest midnight rollups, sub-50ms dashboard caching |
| `docs/19-disaster-recovery-and-backups.md` | Dual-tier backups (Supabase PITR + R2/S3 dumps), zero-downtime Prisma migrations, DR runbook |
| `docs/20-theme-sdk-and-app-marketplace-spec.md` | Third-party developer SDK, sandboxed App Bridge postMessage protocol, marketplace 80/20 split |
| `docs/21-customer-support-operations-playbook.md` | Support SLA tiers (Critical 15m), Super Admin ticket desk, bilingual response macros, VIP WhatsApp |
| `docs/22-public-rest-api-specification.md` | Public REST API & OpenAPI 3.0 spec (`/v1/products`, `/v1/orders`, `/v1/inventory`, webhooks) |
| `docs/23-merchant-onboarding-and-growth-playbook.md` | 14-day trial funnel, 72h "Aha!" moment, automated Inngest drip sequences, seed data protocol |
| `docs/24-ai-copywriter-and-catalog-generator-spec.md` | Google Gemini 2.5 Flash multimodal copywriter, tone presets, token quotas, and bulk catalog wizard |
| `docs/25-whatsapp-messenger-chatbot-and-webhook-spec.md` | Headless chatbot order webhooks, 1-click short links (`/c/[code]`), and WhatsApp Cloud API notifications |
| `docs/26-customer-loyalty-vip-tiers-and-referrals-spec.md` | Fraud-safe loyalty points, 4-tier VIP progression, and double-sided verified referral rewards |
| `docs/27-unified-order-state-machine-and-transaction-safety.md` | Unified order creation service, atomic inventory reservation, idempotency replay shield, state machine |
| `docs/28-commercial-excellence-cod-reconciliation-and-accounting-spec.md` | COD courier settlement reconciliation, 1-screen verification desk, quick order intake, P&L profit engine |
| `docs/29-design-canvas-screen-index.md` | Index of all 88 canvas artboards by page, with sizes and governing docs |
| `docs/30-docs-vs-canvas-review-and-kickoff.md` | Cross-check of all docs against the canvas, conflicts to resolve, and how to start implementing |
| `docs/31-existing-code-reuse-map.md` | What to reuse from berber, Bindu, axionwear, gadgetstudio and mini-bunny, security findings, port recipe |
| `design/canvas/project/` | Source of the UI/UX design canvas (88 artboards, `.dc.html` files plus `canvas.json` layout index) |

## Live design canvas

https://claude.ai/artifact/Xijw4oUtceT6DdE8Uhg5PJ (private, owner only until shared from its Share menu)

The canvas is the working design file. `design/canvas/project/` is a snapshot of its source, kept here so the designs live with the project.

## Canvas contents (9 pages, 88 artboards)

Full list with sizes: `docs/29-design-canvas-screen-index.md`.

| Page | Artboards |
|---|---|
| Foundations | Color, type, space, rules; component kit; dark mode admin dashboard |
| Marketing | Home, template gallery, pricing, mobile home |
| Signup and onboarding | Signup, wizard steps 1 to 4, mobile wizard |
| Owner admin (desktop) | Dashboard, orders, order detail, quick order desk, fraud and risk, abandoned orders, returns, COD settlement, products, product editor, inventory, reviews, customers, customer detail, coupons, landing pages, pixels, loyalty and VIP, reports, profit and loss, pages and blog, invoice, settings (store details, payments, shipping, integrations, notifications, domains, billing, staff), apps and modules, read-only state, plan limit |
| Owner admin (mobile) | Home, orders, order detail (Bangla), add product, courier, bKash check, more, fraud, abandoned orders, pixels, landing pages, quick order, COD settlement |
| Theme builder | Section editor, theme settings, theme library, landing page builder |
| Storefront and checkout (theme: Kapor) | Desktop home, mobile home, product, checkout, order placed, my orders, store paused |
| Super admin | Overview, tenants, tenant detail, payment approvals, plans and entitlements, domain health, themes and modules, tickets, announcements, audit log |
| Shared components | Sidebar, topbar, mobile tabs, settings nav, wizard preview, marketing header and footer, super admin sidebar |

## Design decisions

- Brand from The Digital Dude: Plus Jakarta Sans, indigo `#5B4FE8`, navy `#1A1A4E`, lavender `#F4F3FF`. Flat fills only, no gradients or glows.
- Text colors were darkened from the first draft so they pass 4.5:1 on white (ink-3 `#6B6B8D`, success `#15803D`).
- Pills for marketing and signup calls to action, 8px rounded rectangles in the dense admin.
- Realistic Bangladesh data throughout: BDT, bKash and Nagad TrxID flow, Pathao, Steadfast and RedX, division/district/upazila address.
- Plan limits used in the mocks: Starter ৳699, Pro ৳1,499, Business ৳3,499. Custom domain, courier booking and industry modules start at Pro. The card and mobile banking gateway and the section builder on every page are Business.

## Known gaps

- Fonts load from Google Fonts in the canvas. Bangla uses Hind Siliguri.
- Page heights were measured with fallback fonts; adjust frames in the canvas if real fonts change a layout.
- Dark mode is drawn for the admin dashboard only.
- Not drawn: risk rules and blocklist pages, mobile loyalty and profit and loss, empty and error states for every list.

## Run it locally

Needs Node 22, pnpm 10 and a Postgres 16.

```bash
pnpm install
cp .env.example .env.local        # point the four database URLs at your Postgres
pnpm db:migrate                   # applies the schema and RLS (run as the owner role, DIRECT_URL)
psql "$DIRECT_URL" -v app_pw="'choose-one'" -v platform_pw="'choose-another'" -f scripts/db-roles.sql
pnpm db:seed                      # demo store: rongdhonu
pnpm test                         # isolation and order-service suites against the test database
# apps: storefront :3000, admin :3001, marketing :3002 (signup), platform :3003 (super admin)
pnpm --filter @biztrackbd/storefront dev   # http://rongdhonu.localhost:3000
pnpm --filter @biztrackbd/admin dev        # http://localhost:3001/orders  (DEV_AUTH=1)
pnpm canvas:measure               # checks every design board for clipping
```

The app role's password in `DATABASE_URL` must match the one set by `scripts/db-roles.sql`.
