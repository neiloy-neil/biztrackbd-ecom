# BizTrackBD QA/QC roadmap (launch target: 25 October 2026)

Test-only pass. Nothing is fixed during it; every defect becomes a finding in `qa/findings.json` with a screenshot. Skills used: `biztrack-qa-context`, `biztrack-qa-evidence`, `biztrack-qa-phases` (in `.claude/skills/`). An older manual checklist (about 435 checks) is at `docs/qa/BizTrackBD-QC-QA-Checklist.xlsx`; this roadmap is organised by feature so it can be tracked in `qa/coverage.json`.

**Environment:** private Postgres on port 54329 (`biztrack_qa_test`), four apps via `tools/qa-stack.mjs`, outbound keys blanked. The real Supabase project is never touched.

## Feature inventory

Codebase size: 4 apps, **243 routes** (marketing 42, storefront 48, admin 131, platform 22), 5 packages. Feature IDs below are the unit of tracking.

### A. Marketing site (`apps/marketing`) → P2
| ID | Feature |
|---|---|
| A1 | Home, product, features pages (5 feature deep-dives) |
| A2 | Pricing (commerce) and Business pricing; plan/price consistency with admin billing |
| A3 | Template gallery (store + business tabs), preview modal, "Use template" links |
| A4 | Business verticals pages (restaurant, doctor, company, service, portfolio, public figure) |
| A5 | Comparison pages (Shopify, Wix, WooCommerce, WordPress, Pathao Commerce) |
| A6 | Signup wizard `/start` (5 steps, plan, template, mode, vertical) and `/start/done` |
| A7 | Demo redirect `/demo`, `/demo/[template]` |
| A8 | Free courier fraud-checker tool and `/fraud-check`, `/couriers` |
| A9 | Migration guides (Shopify, WooCommerce), data-ownership, security, privacy, terms |
| A10 | Contact form `/api/contact` (rate limit, validation) |
| A11 | SEO: metadata, sitemap, robots, JSON-LD, canonical, Open Graph |

### B. Storefront (`apps/storefront`) → P3
| ID | Feature |
|---|---|
| B1 | Home with section-built layout, announcement, hero, featured products, categories |
| B2 | Search and category pages, filters, sort, pagination |
| B3 | Product page: variants, stock, reviews, related, size guide, gallery |
| B4 | Cart: quantities, coupon (EID10), shipping estimate, bundles/bump |
| B5 | One-page checkout: address (division/district/upazila), COD, bKash/Nagad TrxID, server-side pricing |
| B6 | Order confirmation and tracking `/order/[id]`, `/api/track` |
| B7 | Customer account: SMS-code sign-in, orders, addresses, loyalty, referrals |
| B8 | Bangla/English switch, ৳ formatting, Dhaka time |
| B9 | Landing pages `/l/[slug]` (one-product ads), draft-order links `/draft/[code]`, drops, go/ref/partner links |
| B10 | Blog, custom pages, contact form, wholesale register |
| B11 | Business-mode pages: menu, reservations, bookings, leads, table orders |
| B12 | Public REST API `/api/v1` (products, orders, inventory), feeds (`/api/feed`, facebook catalog) |
| B13 | Payment callbacks (bKash, SSLCommerz, UddoktaPay) and returns upload |
| B14 | Offline/unknown-store/404 pages, custom domains and host resolution |
| B15 | Pixels/CAPI events, social-proof popups, FOMO widgets |

### C. Merchant admin (`apps/admin`) → P4, P7
| ID | Feature |
|---|---|
| C1 | Sign-in (dev stand-in and real), MFA, store chooser, roles and permissions, start-pass, impersonation |
| C2 | Dashboard / overview, global search, shell counts, notifications |
| C3 | Orders: list, filters, quick view, detail, status machine, bulk actions, export, print (slip/invoice/label), notes |
| C4 | Order creation: quick order desk, draft orders + customer link, change items on open order |
| C5 | Payment-check desk (bKash/Nagad TrxID verification) |
| C6 | Couriers: book Steadfast/Pathao/RedX, tracking sync, webhooks, COD reconciliation |
| C7 | Returns and exchanges, refunds, stock restore |
| C8 | Products: CRUD, variants, photos, CSV import (Shopify/Woo/own), categories, barcodes label studio, wholesale |
| C9 | Inventory: adjustments, history, low-stock and back-in-stock alerts |
| C10 | Customers: list, profile, import/export, tags, notes, block, inbox replies by SMS, reviews |
| C11 | POS: registers, sessions, split payments, receipts |
| C12 | Fraud: blocked numbers, risk holds, trust score |
| C13 | Marketing: coupons, campaigns, bundles, drops, loyalty/VIP/referrals, affiliates, banner, abandoned recovery, AI studio, WhatsApp, pixels + health, notifications |
| C14 | Reports: sales, products, customers, couriers, exports; finance: COD payouts, profit, realtime analytics |
| C15 | Design: section builder (draft/publish/versions/rollback), theme styling engine, header/footer, custom pages, template switcher, template update offer |
| C16 | Site/business: menu, services, leads, portfolio, events, downloads, content, publications, landing pages, pages |
| C17 | Settings: store, payments, shipping, notifications, domains, staff, mode, apps, integrations (encrypted keys), webhooks, developer, audit, invoices, import, AI |
| C18 | Billing: plan, trial, pay by proof, mode-specific plans, locked state |
| C19 | Demo admin sessions (`/demo`), UI kit, support tickets |

### D. Platform admin (`apps/platform`) → P5, P6
| ID | Feature |
|---|---|
| D1 | Sign-in with authenticator (MFA), roles (Owner, Finance, Support lead, Support) |
| D2 | Overview metrics, tenants list and detail (suspend, plan change, notes, quota, impersonate) |
| D3 | Payment proofs approval, plans and limits, announcements, tickets, inquiries |
| D4 | Domains monitoring, usage, audit log, diagnostics, platform settings (secrets) |
| D5 | Themes and modules: module kill-switch and min-plan |
| D6 | Template pipeline: upload JSON, download, status, Template Studio workshops, save as template, Generate previews |
| D7 | Billing cron `/api/cron/billing` |

### E. Core packages → P0, P8, P9
| ID | Feature |
|---|---|
| E1 | `packages/db`: schema, 70+ migrations, forced RLS, roles, isolation sweep (`pnpm audit:rls`) |
| E2 | `packages/core`: order state machine, pricing, stock, idempotency, outbox worker (SMS, WhatsApp, email, Meta CAPI, webhooks), billing lifecycle, fraud, loyalty, messaging |
| E3 | `packages/media`: image pipeline (WebP, EXIF stripped), storage drivers |
| E4 | Cron endpoints (abandoned, courier-sync, demo-reset/sweep, domains, loyalty, outbox, stock-alerts, billing) and their auth |
| E5 | CI/CD, deploy, backup, migrations, smoke workflows; env documentation |

## Phases

| Phase | Scope | Method | Exit criterion |
|---|---|---|---|
| **P0** Build health | Typecheck, lint, unit tests (core 91 files), dependency audit, build, bundle size | Commands against the private DB; results into `qa/p0/` | All results recorded; every failure a finding |
| **P1** Route crawl | All routes of all four apps at 1440 and 390 | `qa/crawl.mjs`: status, console/page errors, failed requests, axe count, horizontal overflow, screenshot | 100% of routes loaded and logged |
| **P2** Marketing and signup | A1-A11 | Browser: click through, form validation, signup end to end creating a store on the private DB | Signup yields a working store and admin sign-in |
| **P3** Storefront and checkout | B1-B15 | Browser: browse, add to cart, coupon, COD checkout, tracking, SMS code from `qa/logs/sms.jsonl`, tamper checks (price/qty) | An order placed and visible in admin; stock reduced once |
| **P4** Merchant admin | C1-C19 | Browser: full order lifecycle, products, returns, POS, customers, reports, settings, team roles, design editor publish/rollback | Each feature pass/fail in coverage ledger |
| **P5** Platform admin | D1-D5, D7 | Browser: tenants, payments, plans, domains, audit | Each feature pass/fail |
| **P6** Template pipeline | D6 | Upload both example JSONs, invalid files, workshop create/open/save, apply to a store, marketing gallery, previews | Uploaded template reaches gallery, signup and merchant picker; invalid files rejected |
| **P7** Business mode | B11, C16 and templates | Create business sites (restaurant, clinic), menu, bookings, leads, custom pages | Each vertical works end to end |
| **P8** Integration boundaries | Payment gateways, couriers, SMS, WhatsApp, Meta CAPI, webhooks, cron | Call endpoints with bad/missing auth and malformed payloads; verify error paths, idempotency, signature checks | No unauthenticated state change; failures degrade safely |
| **P9** Security and isolation | E1, E4, authz | Role matrix on every admin route, cross-tenant URL probing, IDOR, CSRF on actions, headers, XSS probe on barcode/POS (known suspect), secret scan, RLS audit | No S1 open |
| **P10** A11y, responsive, performance | All crawled pages | axe results, keyboard path through checkout, 390px overflow list, vitals script | Counts recorded per page |
| **P11** Launch readiness | Vercel, env, migrations, backups, monitoring, legal | Vercel MCP (read-only), docs/43 go-live checklist, DNS/domain, secrets, support readiness | Go/no-go table with owners |

## Rules
- Severity S1-S4 and `launchBlocker` as in `biztrack-qa-evidence`.
- Coverage ledger `qa/coverage.json` is the source of the progress numbers in the report.
- Anything that needs a real third-party account (bKash live, courier keys, real SMS gateway, Supabase Auth email) is tested to its boundary and listed as "blocked: needs account" with a launch task.
- Stale baseline: `qa/evidence/P1/platform/01-login-*.png` came from a probe run and is superseded by `14-login-*.png`.
