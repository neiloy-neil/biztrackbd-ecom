# Codebase against the docs: audit of 11 October 2026

Method: every section of docs/07 (32 sections), the decisions in docs/05, and the status lines of docs/10 to 28 were checked against the code, the Prisma schema, the running apps and the design canvas screenshots (`checkup/screens/`). Evidence is one of: **built** (code read or behaviour seen running), **partial** (data model or part of it exists), **not built** (no code, and where the schema was checked, no field). Where a doc already says "not built", that is repeated in its own words in docs/16 and is not a new finding. Items marked ◆ were not previously listed as not built anywhere.

## 1. docs/07, section by section

| # | Section | State | Notes |
|---|---|---|---|
| 1 | Merchant dashboard | partial | Greeting, four numbers, 7-day chart, recent orders, setup checklist built. Low-stock panel (shown when something is low) and the 24-hour "waiting long" note are built. ◆ No Today / 7 / 30-day range switch on the dashboard (the reports and profit screens have one), ◆ no campaign tip card |
| 2 | Orders and fulfilment | partial | Tabs, search, payment filter, bulk pack / book courier / print slips and invoices, manual payment check, timeline, courier booking built. ◆ No bulk "Send SMS"; ◆ no courier or district filter chips; printing offers A4, A5 and 80 mm thermal |
| 3 | Abandoned checkouts | built | Capture at the phone number, recovery SMS after 30 minutes, call list, outcomes |
| 4 | Returns, exchanges, store credit | built | Pipeline, exchange, refund, store credit, return pickup booking |
| 5 | COD fraud and trust score | partial | Trust score, flags, holds, blocklist built. Not built (docs/12 says so): automatic SMS confirmation code before booking, automatic ৳100 advance request |
| 6 | Products and variants | partial | Bilingual title and description, images, compare-at price, option and variant editor, categories, SEO fields built. Collections (e.g. "Eid 2026") are not modelled ◆ |
| 7 | Inventory | built | Inline adjustments with a reason, history, shelf code, reorder level. ◆ No printable stock-count sheet |
| 8 | Discounts and coupons | partial | Coupon codes with percentage, fixed amount and free shipping, minimum order, limits, dates. ◆ Not built: automatic discounts, flash sales, gift cards, buy-two-get-one and bundles |
| 9 | Customer CRM | partial | Totals, delivery rate, tags, notes, blocklist, store credit balance, SMS and email consent flags (shown). ◆ No screen to change the consent flags or manage credit by hand |
| 10 | Reviews | partial | Moderation, verified-buyer flag, public reply built. The `photos` field exists; ◆ customers cannot attach photos yet |
| 11 | Reports | partial | Sales, discounts, refunds, payment and channel split, top products, sales by district, CSV export. ◆ Cohort retention and a map-style heatmap are not built (a district list with bars is) |
| 12 | Store settings and policies | partial | Identity, contact, logo, announcement bar, orders pause. ◆ No built-in legal policy templates (terms, privacy, shipping, return); pages can be written by hand |
| 13 | Payment settings | partial | COD on/off, manual bKash and Nagad numbers and kind, instructions. Card gateways (SSLCommerz, Stripe, Aamarpay) are not built, and the optional COD advance fee is not built ◆ |
| 14 | Shipping zones | partial | Zones, flat rates, free-above threshold, estimated days. ◆ No weight-based surcharge |
| 15 | SMS and email | partial | Order, payment, shipping and return SMS through Greenweb; plan credits metered. ◆ No template editor (the `MessageTemplate` table exists and is read only for the abandoned-cart message), ◆ no "out for delivery" message, ◆ no credit top-up flow, no email at all |
| 16 | Domains and SSL | built | Add, DNS assistant, live check, Vercel domains, status, primary, `www` handling. Documented gaps: renewal states |
| 17 | Pixels and server-side events | partial | Meta Pixel and Conversions API with test code and deduplication. ◆ GA4 and Tag Manager are registered as vault providers but nothing sends events; ◆ TikTok pixel not built (docs/05 says v1.1 for TikTok only) |
| 18 | Integrations and vault | built | Encrypted per-store keys for Steadfast, Pathao, RedX; webhook address shown. The webhook path differs from docs/10 section 2 (see docs/05 corrections) |
| 19 | Pages and blog | built | Pages, posts, scheduling, sanitised HTML. Rich-text editor, picture upload inside posts: not built (docs/16) |
| 20 | Staff and roles | built | Four roles plus content editor, invitations, audit log |
| 21 | Billing, limits, grace states | built | Plan tiers from the `Plan` table, product and order counters, 10% soft order buffer, grace, read-only, locked, manual payment proof |
| 22 | Industry modules | partial | Only Loyalty is built and switchable (`/settings/apps`, plan-gated). Bespoke, Drops, Kids profiles, Bookings, Wholesale: not built (listed as "Not available yet") |
| 23 | Theme builder and landing pages | partial | Section editor with live preview, publish and versions, one-product landing pages with COD form. Five themes are registered and selectable (`packages/core/src/builder/theme.ts`: kapor, gadgetstudio, mini-bunny, axionwear, bindu), added after the first part of this audit; their visual fidelity against the source stores has not been reviewed here. Not built (docs/16): drag and drop, section library, media library |
| 24 | Storefront and checkout | partial | One-page checkout with +880 phone, division / district / upazila, zones, COD / bKash / Nagad, customer sign-in by code, tracking page. ◆ No quick-view modal, no image zoom, ◆ no courier tracking timeline on the success page, ◆ customer return request form missing |
| 25 | Super admin | partial | Overview, stores, store detail, payments, plans, domains, audit log, suspension, trial extension, plan change, brand review. ◆ Not built: **log in as owner** (security protocol in docs/12 section 3 is unimplemented), global announcements (the `Announcement` table has no screen), support desk (`SupportTicket` tables, no screen), themes and modules screen, usage and limits screen, per-store GMV and MRR columns |
| 26 | Mobile admin | built | Bottom tabs, dashboard, orders, quick add product, bKash check, courier dispatch, installable. ◆ No full Bangla mode for the whole admin |
| 27 | Onboarding wizard | partial | Five-step wizard, live address check, plan and template choice, sample products. ◆ No brand step (logo, colour, font), ◆ no Google sign-in, ◆ no live preview, owner sets a password at first sign-in instead of at signup |
| 28 | Quick order desk | built | |
| 29 | COD reconciliation | built | |
| 30 | Loyalty and referrals | built | Plus the Phase 10 gaps (levels as settings, expiry, birthday voucher, priority packing, same-connection check) |
| 31 | Profit and loss | built | |
| 32 | Mobile versions of v1 screens | built | |

## 2. Other docs

| Doc | Finding |
|---|---|
| 01, 02, 03 | Principles hold: Bangladesh-first checkout, mobile first, light and dark, 44 px touch targets (checked by the quality tests at 390 and 1440 on every admin screen, both colour schemes). docs/02's marketing and signup screens are the thinnest match to the canvas (see `checkup/REPORT.md` section 3) |
| 04 | Per-store encrypted keys: built. Platform-level SSLCommerz / Stripe / Brevo keys: not read by any code |
| 05 | Corrections table added at the bottom of the file |
| 06 | Five themes are registered (see section 23 above); the section library and manifest-driven theme packages are not built. Landing route is `/l/`, not `/lp/` (fixed in the doc) |
| 08 | All 67 models are described. Four exist with no screen: `Announcement`, `SupportTicket`, `TicketMessage`, `MessageTemplate` (partly) |
| 09 | Canvas guide: the artboards render with `tools/render-canvas.mjs` (the original runtime file is not in the repo) |
| 10 | Webhook path differs; the doc's own section 11 documents the real one |
| 11 | Inngest is not used; cron routes are (docs/05 corrections). No event catalogue beyond `publishEvent`, whose publisher is a stub |
| 12 | Trust score, flags, holds, brand scanner, quarantine: built. Impersonation, the day-90 purge, BTRC masking sender ID: not built |
| 13 | Routing, claims, Edge Config sync, DNS, SSL states: built; renewal states documented as not built |
| 14 | Sitemap, robots, canonical, Open Graph, JSON-LD built. Marketing site had no robots or sitemap until this audit; none of the four apps had a favicon (fixed). docs/14's sample code does not match the real fields (docs/14 says so itself) |
| 15 | The strategy names Testcontainers; the project uses a local Postgres and rebuilds a test database from the migration files, which tests the same thing. Both widths, axe checks, RLS audit: done |
| 18 | The analytics pipeline (`packages/core/src/analytics`) does not exist. `PlatformDailyMetrics` exists as a table; dashboards and reports are computed live from orders |
| 19 | Backups: encrypted, to Supabase Storage (not R2/S3), restore drill passes against the real project. Zero-downtime migration runbook is prose only |
| 20, 24, 25 | Post-v1 or deferred, correctly absent: marketplace SDK, AI copywriter, chat-bot orders |
| 21 | The support desk is not built (see section 25 above) |
| 22 | The public REST API (`/api/v1`) is not built, including the chat endpoints docs/05 mentions |
| 23 | The growth drip emails are not built (no email sender) |
| 26 to 28, 30, 31 | Match the code; docs/26 has a Phase 10 section listing what closed |
| 32 | Security review: updated with Phase 10 and this audit |

## 3. What this audit changed
- Removed or corrected: docs/05 (corrections table), docs/06 (route), docs/17 (missing variables, unread variables, Supabase checklist), `.env.example`.
- Code bugs found by reading and by the new linter, each now with a test that fails on the old code: the quick-order address filter never matched (a mangled word-boundary character), and the shopper search turned `%` and `_` into the literal text `${c}`.
- Housekeeping: favicon on all four apps, `robots.txt` on the three that lacked it, a marketing `sitemap.xml`, demo pictures on the admin origin, a vitest upgrade that clears 4 audit findings, a linter (ESLint) with 0 errors, and a build warning fixed that was bundling the whole project into each app (the build cache had grown to 11 GB).
