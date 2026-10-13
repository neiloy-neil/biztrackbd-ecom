# BizTrackBD: Brand Brief, Feature Inventory, Competitor Gaps and Discovery Questionnaire

Prepared 13 Oct 2026 from the repository (README, `docs/03`, `docs/07`, `docs/23`, `AUDIT-REPORT.md`, `apps/marketing`, `packages/core`). Not yet verified against the live site or live competitor pages. Treat every number as "as written in our own docs" until the owner confirms it.

How to read this file:
- Part A is the brief for the branding manager (what the product is, in plain words).
- Part B is the full feature inventory (every module, not highlights).
- Part C is competitors, and the gap in both directions.
- Part D is the investor/sale readiness audit.
- Part E is the 60 questions the owner must answer. Answers turn this into the brand guidelines, the social plan, and the pitch.

---

## Part A. The product in one page

**What it is:** a multi-tenant ecommerce platform (store builder + back office) for Bangladeshi sellers. One merchant gets a storefront, an admin, a courier and payment workflow, and fraud protection for cash-on-delivery.

**Live addresses found in docs:** biztrack.bd (marketing), admin.biztrack.bd (merchant admin), platform.biztrack.bd (our super admin), `{store}.biztrack.bd` (storefronts). Some docs say `biztrackbd.com`. The brand domain needs one answer (Q3).

**Four apps:** marketing site, storefront (what shoppers see), merchant admin, platform super admin.

**Problem it claims to solve:** COD returns and fake orders, manual courier entry, manual bKash/Nagad TrxID checking, orders arriving by phone/Messenger, Shopify being priced in dollars and card-only.

**Existing voice (from README and marketing pages):** direct, problem-first, Bangladesh-specific, a little combative toward Shopify. Tagline in README banner: "the store builder that thinks in taka". Colors visible in README badges: deep navy `#1A1A4E`, violet `#5B4FE8`, green `#15803D`. Fonts: Hind Siliguri for Bangla. No logo or brand guideline document was found in the repo. The branding manager is starting from zero on identity.

**Audiences (inferred, owner to confirm in Q9 to Q14):**
1. Facebook-page sellers who take orders in chat and want a real store (largest group).
2. One-product ad sellers who need landing pages with COD.
3. Small shops with a few staff, wanting orders, stock, couriers, profit in one place.
4. Agencies and freelancers who build stores for clients (not yet a defined segment).
5. Secondary audiences: investors, acquirers, courier and payment partners.

---

## Part B. Complete feature inventory

Source tags: **[built]** = routes/modules exist in the codebase; **[spec]** = described in docs but not confirmed built; **[live-unverified]** = needs a real-account test (the audit says courier, SMS, Meta and domain checks are still pending). The owner must confirm every [spec] and [live-unverified] item before it appears in public copy.

### 1. Storefront (what the shopper sees)
- Home, collection (`/c/`), product (`/products/`), search, cart, checkout, order tracking page, customer account, blog, custom pages `[built]`
- Bangla and English, switchable per visitor `[built]`
- Division, district, upazila address fields matching courier hierarchies `[built]`
- One-step "fast" COD checkout, prices recalculated server-side (tamper-proof cart) `[built]`
- Product variants, bilingual catalog, reviews with owner replies `[built]`
- Installable PWA and offline page `[built]`
- Sub-second mobile speed claim (<0.8s) `[claim, needs a dated test report]`
- SEO: metadata, sitemap/feed strategy, product catalog XML feeds, domain verification `[built per recent commits]`
- Countdown timers and conditional offers `[spec]`

### 2. Store builder and design
- Full-screen section builder: section list, live preview of the real store, settings panel, undo/redo, drag reorder, click-to-edit in preview, mobile layout (preview on top, tabs below) `[built]`
- Edit home, product, collection and cart pages; draft, publish, version history, one-click rollback `[built]`
- Six templates with live demos: Kapor (fashion), Gadget Studio (tech), Mini Bunny (kids), Axion Wear, Bindu, Berber (streetwear) `[built]`
- Merchant theme builder (colors, fonts, branding) `[built, doc 47]`
- Pages builder for custom pages from sections `[built]`
- Theme SDK, sandboxed apps, OAuth app permissions, revenue share marketplace `[spec only, doc 20]`

### 3. Landing pages for ad campaigns
- One-product landing pages taking COD orders `[built]`
- Livelier look: merchant logo and call buttons in header, color palettes, price badge, moving strip, comparison block, steps, customer-message screenshots, pulsing order button, sticky price bar, rising blocks `[built]`
- Ten redone templates; delete a landing page or a built page from the list after confirmation `[built]`
- Existing real examples folder `Landing Page/` (about 40 product JSONs: belts, attar, ghee, moringa, panjabi, fans, headphones). Useful as real case material, if the merchants consent (Q41)

### 4. Orders and fulfilment
- Orders list with live filters, bulk actions, quick-view drawer `[built]`
- Order detail with state machine and transaction safety `[built]`
- Order check / verification desk (bKash/Nagad TrxID, phone confirmation) `[built]`
- Quick Order Desk: create an order from a chat or phone call `[built]`
- Ship screen: book Steadfast, Pathao, RedX from the order, track parcels `[built, live-unverified]`
- Thermal shipping labels, packing slips, bulk print, branded invoices `[built]`
- Order cancellation tracking (feeds ad platforms) `[built]`
- Returns and exchanges, stock restored, step-by-step record, store credit `[built]`
- Auto-call order verification `[not built; competitor feature]`

### 5. Money and accounting
- COD, manual bKash and Nagad with TrxID capture and one-tap verify `[built]`
- COD settlement and reconciliation: what the courier owes you, short-payment checks from the courier statement `[built]`
- Profit view: sales minus product cost, courier fees, returns, refunds, ads `[built]`
- Reports: sales, GMV `[built]`
- Online payment gateway for shoppers (card/MFS automation): in progress now (uncommitted `packages/core/src/payments/uddoktapay`, storefront `api/payments`). SSLCommerz appears as "planned" in doc 03. The pricing page already says Visa/Mastercard. Status must be confirmed (Q25)
- Merchant's own keys are encrypted and write-only in the vault `[built]`

### 6. Fraud and trust
- Delivery trust score per phone number, built from parcels across stores `[built]`
- Fraud holds on risky COD orders until the merchant calls `[built]`
- Option to require a partial bKash advance on risky orders `[built per marketing copy]`
- Fraud page, security page, audit log of every action, rate limits `[built]`
- Multi-tenant isolation with Postgres row-level security, audited by script `[built]`

### 7. Customers and growth
- Customer CRM with delivery history, detail page `[built]`
- Abandoned-checkout recovery by SMS and a call list `[built]`
- Coupons, discounts, flash sales `[built]`
- Loyalty points, VIP tiers, double-sided referrals with abuse protection `[built]`
- Reviews with moderation `[built]`
- Meta Pixel + server-side Conversions API (deduplicated), Google Analytics 4 with Measurement Protocol, TikTok pixel `[built; live-unverified with Meta Test Events]`
- Product catalog XML feeds for ad platforms `[built]`
- Blog and content pages `[built]`
- WhatsApp/Messenger chatbot, one-click pre-filled checkout links `[spec, doc 25]`
- AI product description / catalog generator, Bangla and English `[spec, doc 24; confirm]`

### 8. Catalog and inventory
- Products create/edit/import (CSV, incl. a Shopify export path), variants, bilingual `[built]`
- Inventory screen, single warehouse `[built]`
- Multi-warehouse, POS with barcode and offline `[not built; competitor has]`
- Industry extension modules (bespoke, drops, kids) `[built per doc 22, confirm]`

### 9. Settings, team and platform
- Store, payments, shipping zones and rates, notifications, invoices, integrations, domains, staff roles and permissions, apps, audit log `[built]`
- Custom domains with automatic verification and SSL `[built, live-unverified with a real domain]`
- Email and SMS engine; bilingual email templates in `docs/email-templates` `[built]`
- Staff invitations (`/join/[token]`), MFA login `[built]`
- Public REST API `[spec, doc 22]`

### 10. Our platform operations (super admin)
- Tenants, plans and limits, payment approval, themes, domains, usage, tickets, inquiries, announcements, audit, MFA enrolment `[built]`
- Subscription billing in taka, 14-day trial, grace period, overage handling; merchant pays us by bKash/Nagad with proof `[built]`
- Support desk with tickets in admin `[built]`

### 11. Acquisition surface (marketing site)
- Home, features, pricing, compare (vs Shopify, with FAQ schema), couriers, migrate, templates, per-template demo, contact, privacy, terms `[built]`
- **Instant demo admin with no signup** and demo stores that reset nightly `[built; strong differentiator]`
- Start wizard with industry template choice and seeded demo data `[built]`
- 14-day bilingual SMS + email drip (7 touchpoints) `[spec, doc 23, confirm wired]`

### 12. Quality signals (for investors and trust copy)
- 650+ unit tests, 400+ browser tests, strict TypeScript, CI, nightly encrypted backups, RLS audit, load and backup-drill scripts `[built per README]`

---

## Part C. Competitors, and the gap in both directions

Source: `docs/03-competitor-analysis.md`, researched 10 Oct 2026 from vendor pages. Vendor claims are unverified and prices change. Re-check before any external use. The owner asked about Storola, DeshiCommerz and Mobbin; the earlier pass found nothing on the first two and Mobbin is a design library, not a competitor.

### Competitor snapshot

| | StoreX | Bitcommerz | SeloraX | Shopify | Dukaan |
|---|---|---|---|---|---|
| Pitch | Automation for Facebook-ads sellers | All-in-one with POS and AI | COD-first, fraud, AI calling | Global leader | Simple store, India |
| Price seen | Promo 2 years ৳5,000/seat | ৳1,299 / 2,999 / 5,999 per month | Not published | about $39 per month | Low |
| Edge | Fraud blocker, incomplete-order calls, auto-call, 30+ landing designs, marketing hub | POS, multi-warehouse, AI descriptions, Bangla UI | Shared courier-history fraud check, Bangla AI auto-call, chat AI sales agent | Ecosystem, templates | Fast setup |

Ours: ৳699 / ৳1,499 / ৳3,499 per month (confirm the plan table in the database, Q27).

### Where we are ahead or equal (use in positioning)
1. Instant demo admin without signup (no competitor listing shows it).
2. Real section builder with draft, publish, rollback, mobile builder, plus 6 full-store templates with live demos.
3. Cross-store delivery trust score with fraud holds.
4. COD settlement + true profit in one place (SeloraX matches on the idea).
5. 0% commission, taka pricing, bKash/Nagad subscription payment.
6. Loyalty/VIP/referrals (not seen at the three BD competitors).
7. Engineering rigor (tenant isolation, tests, backups). Mostly invisible to merchants but the core of an investor story.
8. Order-limits are soft during Eid surges (a trust feature, say it loudly).

### Competitor gaps vs our gaps (what to fill)

| Gap | Who has it | Our state | Priority | Action |
|---|---|---|---|---|
| Auto-call / voice order confirmation (Bangla) | StoreX, SeloraX | Missing | High | Build or partner; at minimum SMS-reply confirm |
| POS with barcode, offline | Bitcommerz | Missing | Medium | Only if offline shops are a target (Q12) |
| Multi-warehouse | Bitcommerz | Missing | Low | Roadmap only |
| AI Bangla copy / catalog generator | Bitcommerz | Spec only | High | Cheap win, ship and market it |
| Chat AI sales agent (Messenger/WhatsApp) | SeloraX | Spec only | High | Orders live in chat; core to the segment |
| Online payment gateway aggregation | All three | In progress (UddoktaPay) | High | Finish, verify with real test payments |
| Marketing hub (FB/Google/TikTok campaign tools) | StoreX | Pixels/CAPI only | Medium | Position pixels+feeds as "ads-ready" |
| 30+ landing designs | StoreX | 10 | Medium | Grow to 20 before launch |
| Social proof: named merchants, numbers, case studies | All | **None visible** (site says "hundreds of merchants", unverified) | **Critical** | 5 pilot merchants with consent |
| Public pricing transparency | Bitcommerz | Yes | Equal | Keep |
| Third-party app marketplace | Shopify | Spec only | Low | Do not mention until built |
| Brand identity, logo, social presence | All | **None in repo** | **Critical** | This engagement |
| Operations unwired (SMS account, Vercel envs, one real parcel per courier, Meta test, real domain) | n/a | Open per AUDIT-REPORT | **Critical** | Close before any paid promotion |

Positioning candidates for the branding manager to test:
- A. "The store builder that thinks in taka" (existing, product-led).
- B. "Stop paying for parcels customers refuse" (fraud-led, pain-led, probably the strongest hook).
- C. "Your Facebook page, as a real shop" (segment-led).

---

## Part D. Investor and sale readiness audit

### What is strong
- Working multi-app product with unusual test depth and documented architecture (47 docs).
- Clear niche, clear pain, local payment and courier fit.
- Low-cost recurring revenue model in taka; 0% commission is a clean story.
- Defensible data asset in time: cross-store delivery trust score (network effect), if volume exists.

### What an investor or acquirer will challenge
| Area | Finding | Risk |
|---|---|---|
| Traction | No evidence of paying merchants, MRR, churn, trial conversion in repo | Critical. Without it this is a code sale, not a business sale |
| Release readiness | AUDIT-REPORT lists pilot ops items still needing real accounts | High |
| Unproven claims on public pages | "Hundreds of merchants", "<0.8s", "saves ৳12,000", "1 in 4 COD parcels rejected", "over 90% COD", "3x conversion", "25% lower CPA", "98% success rate" | High. Needs sources or removal; ad rules and consumer-protection exposure |
| Comparative claims | Compare page states Shopify prices, fees and capabilities as fact | Medium. Needs dated sources and a "last checked" line |
| Fraud score data | Cross-store phone data raises privacy and legal questions in Bangladesh | High. Needs a legal opinion and a consent line in terms |
| Single founder / bus factor | Unknown | High. Q52 |
| Cost to serve | Free-tier plan, SMS credits included, AI cost, per-tenant domains | Medium. Needs unit economics |
| Moat | Competitors have the same checklist; we win on quality and speed | Medium |
| IP | Repo ownership, Lovable link, contractors, licences (fonts, generated art) | Medium. Q55 |
| Compliance | Terms/privacy exist; BTRC/SMS rules, payment regulation (holding no funds is a plus), data protection | Medium |

### Data room checklist to assemble (owner provides)
Cap table and entity papers, bank and revenue proof, merchant list, metrics export (MRR, churn, trial-to-paid), unit economics, product roadmap, security review (`docs/32`), backup drill output, legal opinion on fraud data, brand assets and domains list, contracts with contractors.

---

## Part E. Discovery questionnaire (60 questions)

Answer in any order. Short answers are fine. "I don't know" is a valid answer; it tells us what to research.

### 1. Business basics
1. What is the official company or trade name, and is it registered (RJSC, trade licence, TIN)? In whose name?
2. What does BizTrackBD stand for, and do you want to keep that exact spelling/casing for the brand?
3. Which domain is the brand: biztrack.bd or biztrackbd.com? Do you own both, and where is each registered?
4. Do you own the social handles (Facebook page, Instagram, YouTube, TikTok, LinkedIn, X, WhatsApp Business)? List which exist.
5. Why did you build this, and in one sentence, what do you want it to be in 3 years?
6. Is this your only product, or is there a parent company/agency/other product (the Lovable link and "biztrack" hint at an earlier product)?
7. Who works on it today (founders, developers, support, sales)? Is anyone full-time?
8. What is your goal in the next 6 months: signups, paying merchants, revenue, investment, or sale? Give a number.

### 2. Audience
9. Who is the ideal first customer, described as one real person (what they sell, where, how many orders a day)?
10. Which segment first: Facebook-page sellers, one-product ad sellers, small shops, or agencies?
11. Which cities or districts first, or nationwide?
12. Do offline shops (POS, barcode) matter to you, or online only?
13. What do your best prospects use now (Shopify, WordPress/WooCommerce, StoreX, Bitcommerz, spreadsheets, Facebook inbox)?
14. Do you want to sell to agencies or freelancers who build stores for clients, with a reseller or partner deal?

### 3. Product truth (we must not advertise anything that is not real)
15. Which features in Part B marked [spec] are actually built and live today?
16. Have you completed one real parcel booking each with Steadfast, Pathao, RedX? Which ones?
17. Is real SMS sending live (provider, sender ID, cost per SMS)?
18. Has Meta Conversions API been tested in Test Events with a real pixel?
19. Is a real custom domain working with SSL end to end?
20. Is the AI Bangla copywriter built? Which model, what cost per use, what limit per plan?
21. Is the WhatsApp/Messenger chatbot built, or planned? What is the target date?
22. Is the fraud trust score fed by real courier data? How many parcels and phone numbers are in it?
23. What is the actual measured page speed (LCP) on a mid-range Android on 4G? Is there a saved report we can cite with a date?
24. Is the app Bangla throughout (admin too), or only the storefront?
25. What is the status of online payments (UddoktaPay/SSLCommerz): live, test-mode, or planned? Can a shopper pay by card today?
26. What happens to a merchant's data if they leave (export, deletion)?

### 4. Pricing and commercial model
27. Confirm final plans: Starter ৳699, Pro ৳1,499, Business ৳3,499. Limits by products or by orders? Yearly discount?
28. Is the 14-day trial with no card final? What happens after day 17?
29. What does it cost you per merchant per month (hosting, SMS, AI, storage)? Your break-even number of merchants?
30. Any extra revenue: SMS packs, templates for sale, setup service, courier or payment referral fees, domain resale?
31. Will you offer a launch deal (founding-merchant price, lifetime discount)? Cap it at how many?
32. Who approves a merchant's bKash payment to you, and how fast? Is there an SLA?

### 5. Traction (this decides whether the pitch works)
33. How many stores have signed up, how many are paying, how many are active in the last 30 days?
34. Monthly recurring revenue today? Highest-ever?
35. Trial-to-paid rate and 3-month retention, if known.
36. How many real orders have flowed through the platform, and the total taka value?
37. Where did your current merchants come from (friends, Facebook group, ads, referrals)?
38. What do merchants say they love, and what do they complain about? Any messages, voice notes or reviews you can reuse?
39. Have any merchants stopped? Why?
40. What is your cost to acquire one merchant so far?

### 6. Proof and content assets
41. Which merchants would allow their name, logo, store link and results to be used as case studies? Do you have written consent?
42. Do you have real screenshots, videos or a Loom demo? Who owns the footage?
43. Are the product photos and illustrations in templates legally yours (generated or licensed)? Are fonts licensed for commercial use?
44. Can you record a 60-second screen demo of "order comes in, verify bKash, book courier, print label"? That single video is the best content you have.

### 7. Brand identity
45. If the brand were a person, who would they be (a sharp older cousin who runs a shop, a tech friend, a professional accountant)?
46. Tone: friendly Bangla colloquial, formal, English-with-Bangla mix ("Banglish")? What words must we never use?
47. Primary language of social content: Bangla, English, or both? Bangla script or romanized?
48. Keep the navy/violet/green palette, or open to a fresh identity? Any colors, fonts or symbols you love or hate (or competitors to avoid looking like)?
49. Logo direction: wordmark, symbol, or both? Any ideas (taka sign, parcel, shield for fraud-protection, a storefront)? Should it work in Bangla script too?
50. Which three brands (any industry, any country) feel like what you want to be?

### 8. Competition and positioning
51. Of StoreX, Bitcommerz, SeloraX, Shopify: who do merchants compare you to most? Who worries you?
52. Which one claim do you want to own: protection from refused parcels, speed, price, or "built for Bangladesh"?
53. Are you comfortable naming competitors publicly (compare pages, ads), knowing it needs dated sources?

### 9. Channels, budget and team
54. Which channels do your customers actually use: Facebook groups, YouTube, TikTok, WhatsApp, LinkedIn for investors? Pick two to lead.
55. Monthly marketing budget (content, ads, tools, influencer fees)? Who approves spend?
56. What can the branding manager decide alone (posts, replies, designs), and what needs your approval? Response time for approvals?
57. Do you want a founder-face brand (you on camera) or a faceless company page?
58. Will you run Facebook/Google ads, or organic only for the first 90 days? Is the ad account set up with a verified business?
59. Who answers inbox, comments and WhatsApp for merchants, and in what hours? Support language?

### 10. Investment, sale, legal
60. Are you raising (how much, for what equity, from whom) or selling (whole business or code only, expected price)? What do you want to keep? What is your time horizon?
61. Who owns the IP (code, brand, domains, accounts)? Any co-founders, contractors, or Lovable/third-party terms involved?
62. Any legal advice taken on the cross-store fraud score, the Terms and Privacy pages, and the comparative claims about Shopify?
63. Any existing debts, loans, or promised equity?

---

## Next steps once answers arrive
1. Brand strategy: positioning, voice attribute set, messaging pillars, claims register (every public number with a source).
2. Brand guidelines and logo brief for the branding manager.
3. 90-day social plan by channel with a content calendar: demo videos, merchant stories, refused-parcel math, template showcases, Eid/season campaigns, Bangla how-to shorts.
4. Merchant signup funnel plan with metrics: visit, demo-admin use, signup, publish, first order in 72h, paid.
5. Pitch deck and data room built on actual traction.
6. Fix list for public pages: remove or source unproven claims.
