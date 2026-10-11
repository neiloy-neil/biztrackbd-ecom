# BizTrackBD Ecom — Complete Features & Screen Inventory Specification

Status: COMPLETE SPECIFICATION  
Source: `design/canvas/project/` (88 Design Canvas HTML Artboards & Data Logic; index in `docs/29-design-canvas-screen-index.md`)

---

## Table of Contents
1. [Merchant Dashboard & Operations (`AdmDashboard`)](#1-merchant-dashboard--operations)
2. [Order Processing & Fulfillment (`AdmOrders`, `AdmOrderDetail`, `AdmInvoice`)](#2-order-processing--fulfillment)
3. [Abandoned Checkout Capture & Telemarketing Call List (`AdmAbandoned`)](#3-abandoned-checkout-capture--telemarketing-call-list)
4. [Returns, Exchanges & Store Credit (`AdmReturns`)](#4-returns-exchanges--store-credit)
5. [COD Fraud Prevention & Courier Trust Score (`AdmFraud`)](#5-cod-fraud-prevention--courier-trust-score)
6. [Products, Variants & Bilingual Catalog (`AdmProducts`, `AdmProductEditor`)](#6-products-variants--bilingual-catalog)
7. [Inventory Management, Single Warehouse (`AdmInventory`)](#7-inventory-management-single-warehouse)
8. [Discounts, Coupons, Flash Sales & Promos (`AdmCoupons`)](#8-discounts-coupons-flash-sales--promos)
9. [Customer CRM, VIP Tiers & Delivery History (`AdmCustomers`, `AdmCustomerDetail`)](#9-customer-crm-vip-tiers--delivery-history)
10. [Customer Reviews & Rating Moderation (`AdmReviews`)](#10-customer-reviews--rating-moderation)
11. [Analytics, GMV & Sales Reporting (`AdmReports`)](#11-analytics-gmv--sales-reporting)
12. [Store Settings & Policies (`AdmStoreDetails`)](#12-store-settings--policies)
13. [Payment Settings & Manual MFS Flow (`AdmPayments`)](#13-payment-settings--manual-mfs-flow)
14. [Shipping Zones & Delivery Rates (`AdmShipping`)](#14-shipping-zones--delivery-rates)
15. [SMS & Email Notification Engine (`AdmNotifications`)](#15-sms--email-notification-engine)
16. [Custom Domains & Edge SSL (`AdmDomains`)](#16-custom-domains--edge-ssl)
17. [Marketing Pixels & Server-Side CAPI (`AdmPixels`)](#17-marketing-pixels--server-side-capi)
18. [Store Integrations & Secret Vault (`AdmIntegrations`)](#18-store-integrations--secret-vault)
19. [Pages & Blog CMS (`AdmPagesBlog`)](#19-pages--blog-cms)
20. [Staff Access & Permission Roles (`AdmStaff`)](#20-staff-access--permission-roles)
21. [Subscription Billing, Overage & Grace States (`AdmBilling`, `AdmLimit`, `AdmReadOnly`)](#21-subscription-billing-overage--grace-states)
22. [Industry Extension Modules (`AdmApps`)](#22-industry-extension-modules)
23. [Theme Builder & 1-Product Landing Pages (`BldEditor`, `BldLanding`, `BldLibrary`, `BldTheme`)](#23-theme-builder--1-product-landing-pages)
24. [Storefront Experience & 1-Click Fast Checkout (`StrHome`, `StrProduct`, `StrCheckout`, `StrSuccess`, `StrAccount`, `StrOffline`)](#24-storefront-experience--1-click-fast-checkout)
25. [Super Admin Platform Operations (`SaOverview`, `SaTenants`, `SaTenant`, `SaPlans`, `SaPayments`, `SaTickets`, `SaAnnouncements`, `SaThemes`, `SaDomains`, `SaAudit`)](#25-super-admin-platform-operations)
26. [Mobile Admin Web App (`MobDashboard`, `MobOrders`, `MobOrderBn`, `MobAddProduct`, `MobCourier`, `MobBkash`, `MobMore`)](#26-mobile-admin-web-app)
27. [Self-Service Onboarding Wizard (`OnbSignup`, `OnbStore`, `OnbBrand`, `OnbTemplate`, `OnbSubdomain`, `OnbMobile`)](#27-self-service-onboarding-wizard)
28. [Quick Order Desk (Chat and Phone Orders)](#28-quick-order-desk-chat-and-phone-orders)
29. [COD Settlement and Reconciliation](#29-cod-settlement-and-reconciliation)
30. [Loyalty, VIP Tiers and Referrals (Admin)](#30-loyalty-vip-tiers-and-referrals-admin)
31. [Profit and Loss](#31-profit-and-loss)
32. [Mobile Versions of v1 Screens](#32-mobile-versions-of-v1-screens)

---

## 1. Merchant Dashboard & Operations
- **File Reference**: `design/canvas/project/AdmDashboard.dc.html`
- **Purpose**: Daily operational command center for Bangladeshi store owners.
- **Key Features & UI Elements**:
  - **Greeting & Operational Summary**: Shows current date, pending packing load ("4 orders need packing today"), and quick time range filters (Today, Last 7 days, Last 30 days).
  - **Top KPI Cards**:
    1. *New Orders*: Count with delta vs. yesterday.
    2. *To Pack and Ship*: Orders awaiting dispatch, with highlighted amber warnings for orders waiting > 24 hours.
    3. *Sales Today*: Net BDT revenue with percentage delta.
    4. *Awaiting Payment Check*: Direct badge for pending manual bKash/Nagad TrxIDs.
  - **Revenue Chart**: Area sparkline graph visualizing 7-day revenue curve against prior period benchmark.
  - **Recent Orders Feed**: Compact order table displaying Order ID, Customer Name, Area/District, Payment Status badge, Fulfillment Status badge, and Total.
  - **Store Setup Progress Bar**: Step-by-step checklist (Add products, Brand colors, Payment setup, Shipping rates, Connect courier, Publish store) with completion percentage.
  - **Low Stock Radar**: Urgent inventory warning card listing items with `< reorder_level` remaining.
  - **Seasonal Campaign Banner**: Contextual merchant tip card (e.g. "Eid collection tips: Add free-delivery banner above ৳ 2,000 to lift basket size").

---

## 2. Order Processing & Fulfillment
- **File References**: `design/canvas/project/AdmOrders.dc.html`, `design/canvas/project/AdmOrderDetail.dc.html`, `design/canvas/project/AdmInvoice.dc.html`
- **Purpose**: Order management, automated courier booking, invoice printing, and manual payment verification.
- **Key Features & UI Elements**:
  - **Order Filter Tabs**: `All`, `New`, `To pack`, `Shipped`, `Delivered`, `Returns`.
  - **Search & Multi-Filters**: Filter by Order number, customer name, phone number, payment method, courier provider (Pathao, Steadfast, RedX), district, date range.
  - **Bulk Operations Floating Bar**:
    - *Book Courier*: Single-click batch dispatch to merchant's connected courier account.
    - *Print Labels / Invoices*: Batch thermal 80mm or A4/A5 packing slip generation.
    - *Mark as Packed*: Updates order fulfillment status and sends SMS to customer.
    - *Send SMS*: Dispatches custom or template SMS updates.
  - **Order Detail View (`AdmOrderDetail`)**:
    - *Line Items Table*: Product thumb, title, variant, SKU, quantity, unit price, line total.
    - *Order Financial Breakdown*: Subtotal, Delivery Fee (Inside/Outside Dhaka), Applied Coupon discount, Total.
    - *Manual bKash/Nagad Verification Card*: Displays customer sender phone number, claimed TrxID, order total, and 1-click `Mark as Paid` or `Payment Not Received` actions.
    - *Interactive Audit Timeline*: Chronological event log (Order placed, TrxID submitted, SMS dispatched, Courier pickup scheduled, Out for delivery) with team internal notes input.
    - *Delivery & Courier Dispatch Drawer*: Comparison of live courier rates (Pathao vs. Steadfast vs. Self-delivery) and instant pickup booking button.
  - **Print Document Engine (`AdmInvoice`)**:
    - Generates tax-compliant invoices, packing slips, and courier stickers.
    - Supported Formats: A4, A5, and Thermal 80mm roll.
    - Customizable options: Store logo toggle, SKU visibility, order tracking QR code, custom Bangla/English return policy footer.

---

## 3. Abandoned Checkout Capture & Telemarketing Call List
- **File Reference**: `design/canvas/project/AdmAbandoned.dc.html`
- **Purpose**: Converts dropped checkouts into confirmed orders via proactive Bangladeshi phone outreach.
- **Key Features & UI Elements**:
  - **Zero-Friction Trigger**: Captures customer details and cart contents the moment a valid 11-digit Bangladesh mobile number is entered at checkout.
  - **Recovery Pipeline**: Filter abandoned carts by stage: `To call`, `Called`, `Recovered`, `Not interested`.
  - **KPI Metrics**: Total dropped carts (7d), Total value left behind, Recovery rate %, Total recovered revenue.
  - **Integrated Telemarketing Drawer**:
    - *Customer Info*: Name, mobile number, district/upazila, cart age.
    - *Cart Contents & Value*: Line items and total value.
    - *Suggested Bangla Call Script*: e.g., *"Assalamu alaikum, I am calling from Rongdhonu Fashion. You left a Printed Kurti in your cart. Can I help you finish the order? We can send it tomorrow."*
    - *1-Click Call & SMS*: Instant phone dialer and SMS recovery link dispatch.
    - *Call Outcome Logging*: Tag outcome as `Will order`, `Order created`, `No answer`, `Not interested`.
    - *Direct Order Conversion*: 1-click button to transform abandoned checkout into an active COD order.

---

## 4. Returns, Exchanges & Store Credit
- **File Reference**: `design/canvas/project/AdmReturns.dc.html`
- **Purpose**: Structured return and exchange workflow for Bangladeshi apparel & retail.
- **Key Features & UI Elements**:
  - **Return Pipeline Tabs**: `Requested`, `Approved`, `Parcel coming back`, `Refunded`, `Declined`.
  - **Return Metrics**: Waiting requests count, Parcels in transit back to merchant, 30-day Return rate %, 30-day Refunded amount (BDT).
  - **Resolution Drawer**:
    - *Customer Feedback & Photos*: Reason for return, customer comment, uploaded parcel photos.
    - *Action Options*:
      1. *Exchange for Different Variant*: Displays live stock availability for the replacement size/color.
      2. *Refund to bKash/Nagad*: Process payout back to customer's wallet.
      3. *Store Credit*: Issues credit directly to customer profile.
    - *Automated Return Courier Booking*: Schedules courier pickup from customer doorstep.

---

## 5. COD Fraud Prevention & Courier Trust Score
- **File Reference**: `design/canvas/project/AdmFraud.dc.html`
- **Purpose**: Protects merchants against fake COD orders, parcel refusals, and wasted delivery fees.
- **Key Features & UI Elements**:
  - **Delivery Trust Score**: Calculates customer reliability score (0–100) based on phone number delivery success rate across courier APIs.
  - **Real-time Risk Flags**:
    - *Low Delivery Success Rate* (e.g. "2 of 5 parcels delivered, 3 refused at door").
    - *High-Value COD Risk* (COD orders > ৳ 5,000 from first-time numbers).
    - *Phone Number Re-use* (Same number placing orders to multiple contradictory addresses).
    - *Incomplete Address* (Missing upazila/house details).
  - **Automated Risk Rules**:
    - Automatically hold high-risk orders for manual review.
    - Flag orders when delivery success < 50%.
    - Require advance bKash/Nagad delivery fee payment for risky COD orders.
    - Rate limit: Max 3 orders per phone number per day.
    - Automated SMS OTP confirmation before booking courier.
  - **Custom Blocklist**: Merchant-controlled phone blacklist with reasons for blocking.

---

## 6. Products, Variants & Bilingual Catalog
- **File References**: `design/canvas/project/AdmProducts.dc.html`, `design/canvas/project/AdmProductEditor.dc.html`
- **Purpose**: Rich catalog management tailored for multi-variant products in Bangladesh.
- **Key Features & UI Elements**:
  - **Bilingual Content Editor**: Toggle between English and বাংলা for product title, summary, and rich-text description.
  - **Image Gallery & Drag-and-Drop Reorder**: Set primary cover image, drag to rearrange angles.
  - **Comprehensive Pricing & Margin Calculator**:
    - *Retail Price*, *Compare-at Price* (shows strike-through discount percentage), *Cost per Item*.
    - Auto-calculated Profit margin % and gross profit in BDT.
  - **Variant Matrix Generator**: Multi-option matrix (Size: S, M, L, XL; Color: Navy, Off-white) with per-variant SKU, barcode, price override, and stock allocation.
  - **Taxonomy & Organization**: Category, Collections (e.g. Eid 2026, Bestsellers), and search tags.
  - **Search Engine Snippet Preview**: Google SERP preview showing page title, meta description, and clean URL handle.

---

## 7. Inventory Management, Single Warehouse
- **File Reference**: `design/canvas/project/AdmInventory.dc.html`
- **Purpose**: Real-time stock tracking for one central warehouse or godown per store. Multi-location stock, outlet transfers and split shipments are out of scope (docs/05); physical POS is excluded.
- **Key Features & UI Elements**:
  - **KPIs**: Units in stock, Total stock value at cost (BDT), Low stock alert count, Out of stock count.
  - **Inventory Table**: Product name, variant, SKU, optional shelf code (`ProductVariant.shelfCode`), committed stock (ordered but not yet shipped), reorder level (`ProductVariant.reorderLevel`), available to sell.
  - **Quick Inline Stock Adjustments**: Edit stock directly in the table with instant save and an audit entry.
  - **Export & Stock Count Sheet**: Printable count sheet for the warehouse.

---

## 8. Discounts, Coupons, Flash Sales & Promos
- **File Reference**: `design/canvas/project/AdmCoupons.dc.html`
- **Purpose**: Revenue optimization tools for promotional campaigns.
- **Key Features & UI Elements**:
  - **Discount Engine Tabs**: `Coupon codes`, `Automatic discounts`, `Flash sales`, `Gift cards`.
  - **Coupon Types**:
    - *Percentage Discount* (e.g. 10% off).
    - *Fixed Taka Off* (e.g. ৳ 100 off).
    - *Free Delivery* (e.g. Free delivery inside Dhaka over ৳ 2,000).
    - *BOGO / Bundle Offers* (Buy 2 Get 1 Free).
  - **Usage Constraints**: Minimum order value, Total redemption limit, Per-customer usage limit, Start/End expiration schedule.
  - **Automatic Summary Generator**: Dynamic plain-language rule explanation generated as settings change.

---

## 9. Customer CRM, VIP Tiers & Delivery History
- **File References**: `design/canvas/project/AdmCustomers.dc.html`, `design/canvas/project/AdmCustomerDetail.dc.html`
- **Purpose**: Customer lifetime value (LTV) tracking and segmentation.
- **Key Features & UI Elements**:
  - **Customer Profile Metrics**: Total Spent (BDT), Total Orders, Average Order Value (AOV), Delivery Success Rate %.
  - **VIP & Customer Tagging**: Tags like `VIP`, `Eid Buyer`, `Wholesale`, `Risk`.
  - **Order History & Activity Log**: Full timeline of purchases, review submissions, and SMS touchpoints.
  - **Store Credit & Loyalty Balance**: Direct balance management for store credit and loyalty points.
  - **Marketing Consent Toggles**: Track opt-in status for promotional SMS and Email.

---

## 10. Customer Reviews & Rating Moderation
- **File Reference**: `design/canvas/project/AdmReviews.dc.html`
- **Purpose**: Social proof management and customer feedback moderation.
- **Key Features & UI Elements**:
  - **Star Rating & Photo Reviews**: Displays star ratings, customer review text, and customer-uploaded product photos.
  - **Verified Buyer Badging**: Cross-referenced with order history.
  - **Moderation Workflow**: `Published`, `Pending Review`, `Spam/Hidden`.
  - **Merchant Public Reply**: Store owner replies published directly beneath customer reviews.

---

## 11. Analytics, GMV & Sales Reporting
- **File Reference**: `design/canvas/project/AdmReports.dc.html`
- **Purpose**: High-level and granular business intelligence.
- **Key Features & UI Elements**:
  - **Revenue Analytics**: Gross Sales, Net Sales, Discounts, Refunds, Net Shipping Collected.
  - **Channel & Payment Breakdown**: COD vs. bKash vs. Nagad vs. Cards distribution.
  - **Geographic Sales Heatmap**: Top ordering divisions and districts across Bangladesh (Dhaka North, Dhaka South, Chattogram, Sylhet, etc.).
  - **Top Performing Products & Collections**: Sorted by volume and revenue contribution.
  - **Cohort Retention & Re-order Rates**: Percentage of first-time vs. repeat buyers.

---

## 12. Store Settings & Policies
- **File Reference**: `design/canvas/project/AdmStoreDetails.dc.html`
- **Purpose**: Store identity, contact details, currency, time zone, and legal policies.
- **Key Features & UI Elements**:
  - **Store Identity**: Store name, legal business name, brand tagline, logo uploader.
  - **Contact & Support**: Customer support phone number, support email, physical shop/warehouse address.
  - **Standard Legal Policies**: Built-in templates for Terms of Service, Privacy Policy, Shipping Policy, and Return/Exchange Policy.

---

## 13. Payment Settings & Manual MFS Flow
- **File Reference**: `design/canvas/project/AdmPayments.dc.html`
- **Purpose**: Merchant payment setup for automated gateways and manual mobile banking.
- **Key Features & UI Elements**:
  - **Cash on Delivery (COD)**: Toggle COD on/off, optional advance delivery fee requirement.
  - **Manual bKash & Nagad**: Merchant/Personal wallet number configuration, customer instructions, TrxID validation prompt.
  - **Payment Gateways**: SSLCommerz, Stripe, and Aamarpay toggle with test/live mode switch.

---

## 14. Shipping Zones & Delivery Rates
- **File Reference**: `design/canvas/project/AdmShipping.dc.html`
- **Purpose**: Flexible delivery fee rules for Bangladesh geography.
- **Key Features & UI Elements**:
  - **Zone Configuration**:
    - *Inside Dhaka City* (e.g. Flat ৳ 70–80).
    - *Dhaka Suburbs* (Savar, Gazipur, Narayanganj).
    - *Outside Dhaka / All Bangladesh* (e.g. Flat ৳ 120–150).
  - **Conditional Shipping Rules**: Free shipping on orders over specified threshold (e.g. Free shipping above ৳ 2,500).
  - **Weight-Based Surcharges**: Extra fee per kg over base parcel weight.

---

## 15. SMS & Email Notification Engine
- **File Reference**: `design/canvas/project/AdmNotifications.dc.html`
- **Purpose**: Automated customer transaction alerts and merchant notifications.
- **Key Features & UI Elements**:
  - **Automated SMS Triggers**:
    - Order Placed / Confirmation.
    - Manual bKash/Nagad Payment Approved.
    - Courier Picked Up & Tracking ID Dispatched.
    - Out for Delivery Alert.
    - Return Request Approved.
  - **Bilingual SMS Templates**: Customize templates in English or বাংলা with dynamic tags (`{{order_id}}`, `{{customer_name}}`, `{{total}}`, `{{tracking_link}}`).
  - **SMS Credit Balance & Top-Up**: Usage counter and instant credit purchase.

---

## 16. Custom Domains & Edge SSL
- **File Reference**: `design/canvas/project/AdmDomains.dc.html`
- **Purpose**: Custom domain connection with automated SSL certificate provisioning.
- **Key Features & UI Elements**:
  - **Subdomain**: Default `{store}.biztrackbd.com` free on all plans.
  - **Custom Domain Connection**: Connect custom domain (e.g. `rongdhonufashion.com`).
  - **DNS Assistant**: Step-by-step CNAME and A record instructions with automatic live DNS propagation checker.
  - **SSL Status**: Real-time Let's Encrypt SSL certificate issuance status.

---

## 17. Marketing Pixels & Server-Side CAPI
- **File Reference**: `design/canvas/project/AdmPixels.dc.html`
- **Purpose**: High-accuracy marketing tracking to bypass iOS ad-blockers and browser restrictions.
- **Key Features & UI Elements**:
  - **Facebook Pixel + Conversions API (CAPI)**:
    - Browser Pixel ID + Encrypted CAPI Access Token.
    - Test Event Code support.
  - **Deduplicated Event Stream**: Tracks `PageView`, `ViewContent`, `AddToCart`, `InitiateCheckout`, `AddPaymentInfo`, `Purchase` with matching status indicators.
  - **Google Analytics 4 & GTM**: Measurement ID input for GA4 and Google Tag Manager.
  - **TikTok Pixel**: Upgrade prompt / connection for Business plan.

---

## 18. Store Integrations & Secret Vault
- **File Reference**: `design/canvas/project/AdmIntegrations.dc.html`
- **Purpose**: Secure per-tenant credential management for courier and payment partners.
- **Key Features & UI Elements**:
  - **Couriers**: Steadfast (API Key & Secret Key), Pathao (Client ID, Client Secret, Store ID, Username/Password), RedX (API Token).
  - **Security Architecture**: Credentials encrypted with AES-256 before database write; never displayed in plain text after save.
  - **Webhook IPN URLs**: Copyable dedicated webhook URLs for SSLCommerz, Steadfast, and Pathao status synchronization.

---

## 19. Pages & Blog CMS
- **File Reference**: `design/canvas/project/AdmPagesBlog.dc.html`
- **Purpose**: Content marketing and custom informational pages.
- **Key Features & UI Elements**:
  - **Custom Pages CMS**: About Us, Contact, Outlet Locations, Size Guide.
  - **Blog & Articles CMS**: Rich text post editor, feature image uploader, author assignment, tag organization, SEO meta tags.

---

## 20. Staff Access & Permission Roles
- **File Reference**: `design/canvas/project/AdmStaff.dc.html`
- **Purpose**: Multi-user team management with granular permission controls.
- **Key Features & UI Elements**:
  - **Roles**:
    1. *Owner*: Full system access, billing, integration keys, domain management.
    2. *Manager*: Full catalog, order, and marketing access; cannot change billing or view secret integration keys.
    3. *Fulfillment Staff*: Orders, packing slips, courier dispatch only.
    4. *Support Agent*: Order lookup, customer view, reviews, and customer messages.
  - **Audit Logging**: Logs which staff member packed, modified, or refunded an order. Implemented as an append-only `AuditLog` (doc 16 Phase 1); status changes are also in `OrderStateLog`.
  - **Implementation mapping**: Owner = `STORE_OWNER`, Manager = `STORE_MANAGER`, Fulfilment Staff = `ORDER_PACKER`, Support Agent = `TELEMARKETER`; `CONTENT_EDITOR` (catalog and design only) is an addition.

---

## 21. Subscription Billing, Overage & Grace States
- **File References**: `design/canvas/project/AdmBilling.dc.html`, `design/canvas/project/AdmLimit.dc.html`, `design/canvas/project/AdmReadOnly.dc.html`
- **Purpose**: Transparent plan tracking, manual/automated payments, and grace period handling.
- **Key Features & UI Elements**:
  - **Plan Tiers**: Starter (৳ 699/mo), Pro (৳ 1,499/mo), Business (৳ 3,499/mo). Prices and limits are hypotheses and live in the `Plan` table (doc 08 section 11), not in code.
  - **Limits**: Starter 300 products and 500 orders a month; Pro 2,000 and 3,000; Business unlimited. Also staff, storage, SMS credits and landing pages per `Plan.limits`.
  - **Dual Counters**: Product count and monthly order volume tracking against quota (`UsageCounter`).
  - **Limit Reached Handling (`AdmLimit`)**:
    - Hard limit on creating products above plan threshold.
    - Soft buffer on monthly orders (+10% grace buffer with warning banner; customer checkouts remain live).
  - **Suspended / Read-Only State (`AdmReadOnly`)**:
    - Applied after unpaid grace period.
    - Storefront displays friendly temporary offline notice.
    - Admin remains accessible in read-only mode with data export tool and 1-click reactivation billing modal.

---

## 22. Industry Extension Modules
- **File Reference**: `design/canvas/project/AdmApps.dc.html`
- **Purpose**: Turn-key modular extensions that adapt the store to specialized industries.
- **Key Features & UI Elements**:
  - **Bespoke Tailoring**: Customer measurement profiles, custom fabric selection, tailor fitting notes, appointment booking.
  - **Drops & Streetwear Launches**: Release countdown timer, drop notification SMS sign-ups, anti-bot purchase limits.
  - **Baby & Kids Profiles**: Child name and birth month recording for age-specific sizing suggestions and milestone promo triggers.
  - **Loyalty & Referrals**: Points per Taka spent, customer referral links, store credit cashback.
  - **Wholesale / B2B**: Tiered pricing by order volume, minimum order quantities (MOQ), tax exemption settings.

---

## 23. Theme Builder & 1-Product Landing Pages
- **File References**: `design/canvas/project/BldEditor.dc.html`, `design/canvas/project/BldLanding.dc.html`, `design/canvas/project/AdmLanding.dc.html` (list), `design/canvas/project/MobLanding.dc.html`, `design/canvas/project/BldLibrary.dc.html`, `design/canvas/project/BldTheme.dc.html`
- **Purpose**: Visual section-based storefront customizer and high-converting Meta ad landing page creator.
- **Key Features & UI Elements**:
  - **Live Visual Customizer (`BldEditor`)**:
    - Drag-and-drop section reordering.
    - Live `postMessage` preview bridge (Desktop, Tablet, Mobile views).
    - Section customization (Hero Sliders, Featured Collections, Grid Banners, Video Highlights, Testimonials, FAQ Accordion).
  - **1-Product Landing Page Builder (`BldLanding`)**:
    - Dedicated single-product conversion funnels.
    - Embedded fast 1-click COD checkout form right below product pitch.
    - Timer countdowns, social proof popups, variant bundles.
  - **Theme Library (`BldLibrary`)**: Switch between flagship themes (`Kapor`, `Mini Bunny`, `Bindu`, `AxionWear`, `GadgetStudio`) without losing catalog data.

---

## 24. Storefront Experience & 1-Click Fast Checkout
- **File References**: `design/canvas/project/StrHome.dc.html`, `design/canvas/project/StrProduct.dc.html`, `design/canvas/project/StrCheckout.dc.html`, `design/canvas/project/StrSuccess.dc.html`, `design/canvas/project/StrAccount.dc.html`, `design/canvas/project/StrOffline.dc.html`
- **Purpose**: Ultra-fast, mobile-first buyer journey designed for high conversion in Bangladesh.
- **Key Features & UI Elements**:
  - **Mobile-First Storefront**: Sticky bottom navigation bar, quick view modal, instant search with auto-suggest.
  - **Product Page (`StrProduct`)**: High-res image zoom, size chart modal, stock availability indicator, sticky "Buy Now" and "Add to Cart" CTAs.
  - **1-Page Fast Checkout (`StrCheckout`)**:
    - Customer contact (+880 phone auto-formatter).
    - Integrated division/district/upazila address selectors.
    - Automatic delivery fee calculation (Inside Dhaka ৳ 80 / Outside Dhaka ৳ 130).
    - Payment selector: Cash on Delivery (COD), bKash Send Money with TrxID input, Nagad, and Online Cards.
  - **Order Confirmation Page (`StrSuccess`)**: Instant order summary, courier tracking timeline, and WhatsApp store contact button.
  - **Customer Portal (`StrAccount`)**: Mobile OTP login to view past orders, live courier tracking status, and return request forms.

---

## 25. Super Admin Platform Operations
- **File References**: `design/canvas/project/SaOverview.dc.html`, `design/canvas/project/SaTenants.dc.html`, `design/canvas/project/SaTenant.dc.html`, `design/canvas/project/SaPlans.dc.html`, `design/canvas/project/SaPayments.dc.html`, `design/canvas/project/SaTickets.dc.html`, `design/canvas/project/SaAnnouncements.dc.html`, `design/canvas/project/SaThemes.dc.html`, `design/canvas/project/SaDomains.dc.html`, `design/canvas/project/SaAudit.dc.html`
- **Purpose**: Complete platform control panel for BizTrackBD operations, billing, and merchant support.
- **Key Features & UI Elements**:
  - **Platform KPI Overview (`SaOverview`)**: Platform MRR, Paying Stores count, Active Trials count, Churn rate %, Trial-to-Paid conversion funnel.
  - **Tenant Management (`SaTenants`, `SaTenant`)**:
    - Search by store name, subdomain, custom domain, owner phone/email.
    - Deep tenant inspect: GMV, order volume, storage usage, staff accounts, SMS usage.
    - **Security-Audited Impersonation**: "Log in as Owner" with short-lived session and full audit trail.
    - **Suspension Controls**: Temporary suspension / reactivation toggle with merchant notification reason.
  - **Manual Payment Approvals Queue (`SaPayments`)**:
    - Review merchant bKash/Nagad subscription payments.
    - View payment screenshot, claimed TrxID, sender number.
    - 1-click `Approve and Activate Plan` or `Reject with Note`.
  - **Global Announcements (`SaAnnouncements`)**: Broadcast maintenance notices, feature launches, and Eid greetings across all tenant admin dashboards.
  - **Support Desk (`SaTickets`)**: Ticket management with customer context, priority assignment, internal notes, and email/SMS reply dispatch.

---

## 26. Mobile Admin Web App
- **File References**: `design/canvas/project/MobDashboard.dc.html`, `design/canvas/project/MobOrders.dc.html`, `design/canvas/project/MobOrderBn.dc.html`, `design/canvas/project/MobAddProduct.dc.html`, `design/canvas/project/MobCourier.dc.html`, `design/canvas/project/MobBkash.dc.html`, `design/canvas/project/MobMore.dc.html`
- **Purpose**: Frictionless mobile web app for store owners managing sales on smartphones on the go.
- **Key Features & UI Elements**:
  - **Bottom Mobile Navigation Bar**: `Home`, `Orders`, `Products`, `Payment Check`, `More`.
  - **Full Bangla Mode (`MobOrderBn`)**: Complete native Bangla UI for order review and customer phone dialing.
  - **Fast Product Creation (`MobAddProduct`)**: Quick smartphone camera photo snap, price, and stock entry in under 60 seconds.
  - **1-Tap bKash Verification (`MobBkash`)**: Match TrxID and approve payment while checking bKash merchant notifications.
  - **On-the-go Courier Dispatch (`MobCourier`)**: Book Pathao/Steadfast pickups directly from smartphone.

---

## 27. Self-Service Onboarding Wizard
- **File References**: `design/canvas/project/OnbSignup.dc.html`, `design/canvas/project/OnbStore.dc.html`, `design/canvas/project/OnbBrand.dc.html`, `design/canvas/project/OnbTemplate.dc.html`, `design/canvas/project/OnbSubdomain.dc.html`, `design/canvas/project/OnbMobile.dc.html`
- **Purpose**: 4-step guided merchant setup that delivers a live store in under 3 minutes.
- **Key Features & UI Elements**:
  - **Step 1 — Signup**: Mobile number + OTP or Google sign-in.
  - **Step 2 — Store Profile**: Store name, category (Fashion, Electronics, Kids, Organic, Cosmetics), physical district.
  - **Step 3 — Brand Identity**: Logo upload, primary brand color picker, brand font selection.
  - **Step 4 — Theme Selection & Subdomain**: Pick starter template with live preview and claim `{storename}.biztrackbd.com` handle.
  - **Demo Data Seeding**: Automatically populates store with 5 realistic demo products, collections, and banners so merchant immediately sees a populated storefront.

---

## 28. Quick Order Desk (Chat and Phone Orders)
- **File References**: `AdmQuickOrder.dc.html`, `MobQuickOrder.dc.html`
- **Purpose**: Key in orders that arrive on Messenger, WhatsApp, Instagram or the phone in about 15 seconds (docs/28 section 4).
- **Key Features**: Paste-the-message helper that extracts phone, name, district and product names (rule-based, the owner confirms each field); phone lookup shows returning customer, order count and delivery success; district and delivery charge filled automatically; source chips (`Order.channel` = `QUICK_MESSENGER`, `QUICK_WHATSAPP`, `QUICK_PHONE`, `QUICK_INSTAGRAM`); payment COD or already paid by bKash/Nagad; Create only, or Create and book courier; Ctrl+Enter starts the next order; timer and daily count.
- **Mobile**: one scrolling form with a pinned total and action bar.

---

## 29. COD Settlement and Reconciliation
- **File References**: `AdmCodRecon.dc.html`, `MobCodRecon.dc.html`
- **Purpose**: Check that each courier paid the cash it collected (docs/28 section 2).
- **Key Features**: Tiles for courier owes you, received, waiting, does not match; tabs per courier and payout history; filters Needs checking, Matched, Not paid yet, Returns; per-consignment table of expected vs paid with a result (`MATCHED`, `SHORT_PAID`, `MISSING`, `RETURNED`); detail panel with fee breakdown and a possible reason; Raise dispute and Mark matched; Import statement (CSV) and Sync couriers now.

---

## 30. Loyalty, VIP Tiers and Referrals (Admin)
- **File Reference**: `AdmLoyalty.dc.html`
- **Purpose**: Configure and monitor the points engine in docs/26.
- **Key Features**: Members, points waiting for delivery, points used, referral orders; VIP tier table (Bronze, Silver, Gold, Platinum with the thresholds, multipliers and perks of docs/26 section 4); earning and redeeming rules; points unlock only when the courier marks the parcel delivered; referral reward settings and link; top members.

---

## 31. Profit and Loss
- **File Reference**: `AdmProfit.dc.html`
- **Purpose**: Net profit after products, couriers, COD and gateway fees, returns, discounts and ads (docs/28 section 7).
- **Key Features**: Delivered sales, total costs, net profit, margin; line-by-line waterfall; profit by day; "biggest leak" callout; owner-entered expenses (`Expense`: ads, packaging, rent and salaries).

---

## 32. Mobile Versions of v1 Screens
- **File References**: `MobFraud`, `MobAbandoned`, `MobPixels`, `MobLanding`, `MobQuickOrder`, `MobCodRecon`
- Owner admin is a first-class mobile app (docs/05). Each screen above has a 390 x 844 layout with large touch targets and a pinned primary action. The landing page builder is desktop only; mobile shows the list with Edit and Share.
