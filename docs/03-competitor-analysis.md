# Competitor Analysis

Researched 10 Oct 2026 from public pages and vendor blogs. Vendor claims are unverified; prices change. Re-check each vendor's current pricing page before using any number externally.

## What I could not confirm

- **Storola**: nothing found under that name. Closest matches were unrelated products (Storzu, Storista, Storvara). Send me a URL if you meant a specific product.
- **Mobbin**: not a competitor. It is a subscription library of real app and website screens (flows, patterns, Figma plugin). Useful as a design reference for our onboarding, checkout and admin flows, not for features.
- **DeshiCommerz**: no results. Skipped.

## Bangladesh competitors

| | StoreX (storex.com.bd) | Bitcommerz | SeloraX |
|---|---|---|---|
| Positioning | Automation for Facebook-ads sellers; landing pages and storefront | All-in-one with POS and AI | COD-first with fraud and AI calling |
| Builder | Drag-and-drop, unlimited landing pages, 30+ landing designs, storefront templates by category | Drag-and-drop, mobile templates, custom domain | Not stated |
| Pricing seen | Promo: 2 years unlimited for ৳5,000 per seat | ৳1,299 (500 orders/mo), ৳2,999 (2,000 orders), ৳5,999 (unlimited), 7-day trial, no card | Not published on the page I read |
| Payments | bKash, Nagad, Rocket, SSLCommerz, Pay Station | bKash, Nagad, Rocket, SSLCommerz, cards, COD | bKash, Nagad, Rocket, cards, COD |
| Couriers | Pathao, Steadfast, RedX, Bahak, E-Courier, one-click booking | Pathao, Steadfast, RedX, Paperfly, auto-tracking | Steadfast, Pathao, RedX |
| Standout features | Fraud customer checker and blocker, incomplete-order tracking for follow-up calls, auto-call order verification, countdown timers, conditional discounts, Facebook/Google/Meta/TikTok marketing hub | POS with barcode and offline mode, multi-warehouse inventory, branded invoices, AI product descriptions and demand forecasting, Bengali UI | Fraud check from shared merchant courier history, Bangla AI auto-call verification, Messenger and WhatsApp AI sales agent, COD-aware profit accounting, Facebook CAPI |
| Tech note | Node.js, MongoDB | n/a | n/a |

## International reference

- **Shopify**: largest template and app ecosystem, deep code-level customization, expensive and not local-payment-first.
- **Dukaan** (India): fast setup, subdomain plus custom domain, thin templates, India-centric payments. Shows the "simple store for small sellers" shape we are targeting.

## Where BizTrackBD already matches

- bKash/Nagad manual TrxID checkout, COD, SSLCommerz (planned), Pathao/Steadfast/RedX, Bangla UI, custom domains, multi-theme, mobile-first admin.
- Pricing: Starter ৳699, Pro ৳1,499, Business ৳3,499 is below Bitcommerz. Our limits are products, theirs are orders. Order-based limits are easier to sell to small sellers; revisit.

## Gaps we had not planned (competitors all have these)

| Gap | Seen at | Why it matters in Bangladesh |
|---|---|---|
| Fraud and courier-history check on COD orders | StoreX, SeloraX | COD returns are the biggest cost for small sellers. Likely the top reason to switch. |
| Incomplete/abandoned order capture with call list | StoreX | Many orders start on Facebook; phone number captured before checkout completes. |
| Auto-call or SMS order confirmation | StoreX, SeloraX | Sellers phone-confirm every COD order today. |
| Facebook Pixel, Conversions API, TikTok, Google | StoreX, SeloraX | Sellers live on Facebook ads. Needs server-side events with per-store tokens. |
| Landing page builder (single-product pages) | StoreX | Common selling style: one product, one page, one ad. |
| POS with barcode and offline | Bitcommerz | Physical shops that also sell online. |
| Multi-warehouse inventory | Bitcommerz | Fewer small sellers need it; lower priority. |
| Branded invoices and packing slips | Bitcommerz | Needed with courier labels. |
| COD settlement and profit accounting | SeloraX | Sellers need "what did the courier owe me" reconciliation. |
| AI product descriptions (Bangla/English) | Bitcommerz | Cheap to add, saves time. |
| Messenger/WhatsApp order intake | SeloraX | Orders arrive in chat; a quick "create order from chat" screen helps. |
| Countdown timers, conditional offers | StoreX | Campaign tools for sale days. |

## Suggested positioning

Most competitors sell "automation for Facebook sellers". BizTrackBD can win on: real multi-theme storefront quality, a proper section builder, per-store industry modules (bespoke, drops, kids), and a clean mobile admin. Match the fraud check and abandoned-order tools so we are not rejected on a checklist.
