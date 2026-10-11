# Decisions Log

Newest first. Each row is a decision the owner confirmed in conversation.

## 11 Oct 2026

| Topic | Decision | Consequence |
|---|---|---|
| Five storefront templates released | Ship `kapor`, `gadgetstudio`, `mini-bunny`, `axionwear`, and `bindu` as selectable visual templates on the shared multi-tenant renderer. Keep bespoke, baby profiles, drops/episodes, warranty/specification, and other industry behavior as separate modules rather than embedding it into themes. | Signup and the owner design screen can select any template; each template keeps isolated drafts and publish history while catalog, orders, checkout, content, auth, and integrations remain shared. |

## 10 Oct 2026

| Topic | Decision | Consequence |
|---|---|---|
| Docs aligned with canvas (10 Oct 2026) | One roadmap (doc 16) and one schema (doc 08, 61 models); real theme IDs only (`kapor` at launch, then `gadgetstudio`, `mini-bunny`, `axionwear`, `bindu`); single warehouse inventory; loyalty tiers follow doc 26; Brevo and platform DB role added to doc 17; marketplace marked post-v1 | Removes the conflicts listed in doc 30; canvas gallery, inventory and loyalty screens updated to match |
| Refined Launch Roadmap & Priorities | (1) Launch 1 flagship fashion theme (`kapor`) first, expanding to others post-v1; (2) Prioritize 15-sec manual chat order intake & 1-click WhatsApp links over complex AI bots; (3) Defer 3rd-party marketplace; (4) Physical POS 100% excluded; (5) Make COD courier booking & settlement reconciliation the core of v1; (6) Mobile Admin as a first-class citizen; (7) Transparent fraud score with dispute controls; (8) Pricing tiers treated as test hypotheses | Razor-sharp execution focus, fastest time-to-market with highest merchant commercial value, zero scope creep (see doc 01 & doc 28) |
| Commercial Excellence & COD Reconciliation | Complete COD courier receivables reconciliation engine with automated statement matching (Steadfast/Pathao/RedX) + 1-screen Order Verification & Fraud Dispatch Command Center + 15-second Quick Chat/Phone Order Desk + Merchant Net Profit P&L Accounting (COGS, courier deductions, return losses, ad spend) | 100% financial clarity on courier payouts, 75% faster order verification, frictionless F-commerce intake, crystal clear merchant net profit (see doc 28) |
| P0 & P1 Audit Remediation | Remediated database RLS with restricted DB role (`biztrack_app`), session context `SET LOCAL app.current_tenant_id`, and cross-tenant FK triggers; synchronized all 42 models in Doc 08; created Doc 27 Unified Order State Machine with atomic inventory decrement; fixed Doc 19 with AES-256-GCM stream encryption and automated restore drill; updated Doc 22 with ApiKeyCredential token lifecycle and HMAC webhooks | Ironclad multi-tenant security, zero cross-tenant contamination, zero overselling, guaranteed disaster recovery, synchronized data contracts (see docs 08, 19, 22, 27) |
| Custom Domain DNS & Dual-Hostname | Dual SSL provisioning (`mystore.com` + `www.mystore.com`) with 308 Permanent Canonical Redirect + In-app DNS Assistant with Google DoH check and step-by-step guides for BD registrars (DianaHost, ExonHost, IT Nut) | Zero SEO dilution from duplicate content, effortless DNS setup for non-technical merchants, automated SSL renewal (see doc 13) |
| Theme Asset Drawer & Stock Graphics | Unified slide-over Media Drawer in Theme Customizer with in-browser aspect ratio cropping, auto-WebP compression, and ready-made Bengali seasonal banner templates (Eid, Baishakh, Puja, Flash Sale, Winter) | Zero-friction storefront styling for non-designer merchants, zero blurry/distorted banners on mobile, instant professional launch (see doc 06) |
| Inventory & Fulfillment Scope | Single Central Warehouse / Godown per store; exclude complex multi-warehouse routing and split shipments | Clean, ultra-fast inventory tracking, single-parcel courier dispatch, zero split COD accounting confusion |
| Customer Loyalty, VIP Tiers & Referrals | Fraud-safe points engine (points unlock only when courier marks status DELIVERED) + 4-tier VIP progression (Bronze, Silver, Gold, Platinum with spend multipliers and free shipping) + Double-sided verified viral referrals | High repeat purchase rates, zero COD return reward fraud, word-of-mouth referral growth (see doc 26) |
| WhatsApp/Messenger Chatbot Orders | Headless HMAC-authenticated webhook API (`/api/v1/chat/*`) for ManyChat/Botpress bots + Dynamic 72h signed 1-click checkout short links (`/c/[shortCode]`) + Automated WhatsApp Cloud API status alerts with Greenweb SMS fallback | Direct F-commerce chatbot conversions, high mobile checkout completion rates, unified parcel tracking notifications (see doc 25) |
| AI Copywriter & Catalog Generator | Google Gemini 2.5 Flash with multimodal photo analysis, 4 cultural tone presets (Dhaka Youth, Traditional, Luxury, Tech), monthly tier quotas (Starter 50, Pro 250, Business 1,000/BYO key), and in-editor Magic Wand + 20-image bulk batch wizard | Instant high-conversion Bengali/English listings, zero-friction merchant catalog creation, Zod-enforced structured outputs (see doc 24) |
| Scope Boundary & Retail POS | Exclude physical retail POS / barcode scanner hardware features; focus 100% on Online Ecommerce SaaS (Storefront, Landing Pages, Telemarketing, Couriers, CAPI, Admin) | Streamlined architecture, zero offline hardware bridge complexity, maximum focus on high-conversion online merchant workflows |
| Fraud and risk check | Hybrid model: Platform-aggregated delivery trust score (by phone number success/return rate) + isolated per-tenant custom blocklists | Privacy-safe score calculation; immediate flagging of high-return risk COD orders |
| Landing page builder | Dedicated Landing Page entity with embedded 1-click COD checkout form + custom builder blocks | Distinct route `/lp/[slug]`; bypasses cart; instant conversions for Meta ads |
| Marketing tracking & CAPI | Facebook Pixel + Server-Side CAPI + Google Tag Manager (GTM)/GA4 for v1; TikTok Pixel in v1.1 | Server-side event forwarding via Inngest; browser GTM injection |
| Plan limits enforcement | Hard limit on product creation; Soft overage with 10% grace buffer + warning alerts on monthly orders | Zero disruption to live checkouts during sales surges; clear upgrade prompts |
| SMS & Masking | Platform shared non-masking SMS aggregator (Greenweb/Reve/Elitbuzz) for Starter/Pro; custom BTRC masking / BYO-gateway for Business | Flexible messaging tiers; regulatory compliance with BTRC requirements |
| Custom domains | Connect-only via CNAME/A records pointing to Vercel/Cloudflare proxy with automated SSL + in-app setup guides | No registrar complexity; automated cert provisioning |
| Subscription payments | Dual-channel: Automated recurring gateway (SSLCommerz/Stripe) + Manual MFS (bKash/Nagad TrxID) with 3-day grace and Super Admin approval | Smooth billing for Bangladeshi cardless merchants with fraud protection |
| Background jobs & queues | Inngest for event queues, cron triggers, step-retries, and async webhook dispatching | Reliable serverless order sync, courier booking, SMS triggers, and CAPI |
| Monorepo & Toolchain | Turborepo + pnpm workspace with Next.js 16 (App Router), Prisma 7.8 (PostgreSQL + RLS), Tailwind CSS / tokens, TypeScript | High-performance modular architecture across marketing, storefront, admin, and platform apps |
| Store integrations | Each store pastes its own courier and gateway keys | Encrypted per-tenant `TenantIntegration` rows; adapters per provider (see doc 04) |
| Money flow | Customer payments go straight to the store | No payout system; no funds held by BizTrackBD |
| Email and SMS | Platform-managed (Brevo and SMS) with plan credits; bring-your-own later | Per-tenant usage meters; credit purchase flow; sender identity rules |
| V1 features added from competitor review | Fraud and courier-history check; abandoned order capture with call list; Facebook Pixel and Conversions API; landing page builder (one-product pages) | New admin screens, new storefront blocks, new schema; Phase 2 and 3 scope grows |
| Plan limits | Both products and monthly orders | Entitlement checks on two counters; pricing page and billing UI show both |
| Second-wave features | POS with barcode and offline; AI auto-call or SMS order confirmation; AI product descriptions; Messenger/WhatsApp order intake | Not in v1; keep data model open (locations, sales channel on orders) |
| Offboarding | Read-only, export, delete after 90 days | Lifecycle cron; export tool; secrets deleted at day 90 |

## Earlier decisions

See `docs/01-architecture-and-roadmap.md` section 1 and `docs/02-uiux-plan.md` section 0.

## Remaining Open Questions for Later Phases

1. Subscription invoices: VAT, legal entity details, invoice PDF generator, and bKash/Nagad customer payment receipt templates.
2. Terms, privacy, acceptable use, and automated abuse/phishing store detection and suspension.
3. Support model: Support ticket SLA, business hours, Bangla and English coverage, and WhatsApp escalation integration.
4. Theme roadmap: Guidelines and SDK for 3rd-party theme developers after the first five flagship themes.



## Corrections found by the 11 October 2026 checkup
| Topic | Said above | What is built |
|---|---|---|
| Model count | "61 models" (doc 08) | 67 models in `schema.prisma`; all are described in doc 08 |
| Background jobs | "Inngest for event queues, cron triggers, step-retries" | Scheduled sweeps are plain cron routes called with `Authorization: Bearer $CRON_SECRET` (`/api/cron/abandoned`, `courier-sync`, `domains`, `loyalty` on the admin app; `billing` on the platform app). No Inngest, no step retries; each sweep is safe to run twice. Revisit if a job needs retries or fan-out |
| Landing page route | `/lp/[slug]` | `/l/[slug]` (docs/06 section on landing pages still says `/lp/`) |
| Courier webhook address | `POST /api/webhooks/steadfast/{tenantId}` (doc 10 section 2) | `POST /api/webhooks/courier/<integration token>` on the admin app (doc 10 section 11 already says so) |
| Marketing tracking | "GTM/GA4 for v1; TikTok in v1.1" | Meta Pixel and Conversions API only. GA4, Tag Manager and TikTok are not built |
| Subscription payments | "SSLCommerz/Stripe plus manual bKash/Nagad" | Manual bKash/Nagad with Super Admin approval only |
| Email | "Platform-managed (Brevo and SMS)" | SMS through sms.net.bd or Greenweb; a Brevo sender is built and tested but no feature sends email through it yet. Sign-in emails come from Supabase Auth |
| Offboarding | "Delete after 90 days" | Read-only and export are built; the day-90 purge is not |
