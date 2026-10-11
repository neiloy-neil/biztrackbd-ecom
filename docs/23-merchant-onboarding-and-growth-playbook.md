# Merchant Onboarding, Activation & Growth Drip Playbook

Status: COMPLETE SPECIFICATION  
Scope: `apps/marketing`, `apps/admin`, Inngest Drip Workflows, Merchant Success & Growth

---

## 1. Overview & The "Aha! Moment" Target

The primary objective of BizTrackBD's 14-day free trial is guiding new Bangladeshi merchants to their **"Aha! Moment" within the first 72 hours**:
> **The Aha! Moment**: A merchant receives their first real customer order, verifies a bKash TrxID or prints a thermal packing slip, and books a courier pickup in 1 click.

### Trial Conversion Benchmarks:
- **Trial-to-Publish Rate**: `> 65%`
- **First Order in 72h**: `> 35%`
- **Trial-to-Paid Conversion**: `> 22%` (Industry standard: 12-15%)

---

## 2. 4-Step Signup & Instant Demo Seeding (`OnbSignup` through `OnbTemplate`)

When a merchant completes the 3-minute onboarding wizard:
1. **Industry Template Selection**: Merchant selects their vertical (`Fashion`, `Electronics`, `Kids`, `Streetwear`, `General`).
2. **Instant Demo Data Seeding (`seedTenantDemoData`)**:
   - 5 realistic demo products with high-res photos, bilingual descriptions, and variant matrices.
   - 2 collections (e.g. "Eid Collection", "Bestsellers").
   - 1 hero slider banner and 1 announcement bar.
   - 1 sample 5-star customer review.
3. **Immediate Visual Gratification**: The merchant is redirected directly to their live storefront subdomain (`{store}.biztrackbd.com`), seeing a fully designed, populated store from minute one.

---

## 3. Interactive Store Setup Checklist (`AdmDashboard.dc.html`)

Inside the merchant admin, a sticky progress checklist gamifies store completion:

```
+-------------------------------------------------------------------------------+
| Finish setting up your store                                    3 of 6 (50%) |
| [========================---------------------------------------------------] |
|  [x] Add your first products                                                 |
|  [x] Set your logo and brand colors                                          |
|  [x] Choose how customers pay (COD & bKash)                                  |
|  [ ] Set delivery charges (Inside & Outside Dhaka)       [ Start -> ]        |
|  [ ] Connect Pathao or Steadfast courier API                                 |
|  [ ] Publish your store & share on WhatsApp / Facebook                       |
+-------------------------------------------------------------------------------+
```

---

## 4. 14-Day Automated Bilingual Drip Sequence (Inngest Workflows)

Dispatches coordinated **SMS (Bangla)** and **Email (Bilingual)** messages triggered by elapsed time and merchant milestone completion:

### Day 1 (0 Hours) — Welcome & Store Live
- **SMS**: `অভিনন্দন! আপনার অনলাইন স্টোর এখন লাইভ: [store.biztrackbd.com]। আপনার প্রথম ৩টি প্রোডাক্ট যোগ করে বিক্রি শুরু করুন।`
- **Email**: "Welcome to BizTrackBD — Here is your store link and quick-start guide."

---

### Day 2 (24 Hours) — Automated Courier Delivery
- **SMS**: `আপনার পার্সেল ডেলিভারি অটোমেশন করুন! Steadfast বা Pathao কুরিয়ার কানেক্ট করে ১-ক্লিকে পার্সেল বুক করুন: [admin_link]`
- **Email**: "How to connect Steadfast & Pathao in 2 minutes (Step-by-step video guide)."

---

### Day 4 (72 Hours) — Facebook Ads & 1-Click COD Checkout
- **SMS**: `ফেসবুক বিজ্ঞাপনের সেল বাড়ান! BizTrackBD এর ১-ক্লিক ফাস্ট চেকআউট ও পিক্সেল CAPI সেটআপ করুন: [admin_link]`
- **Email**: "How Bangladeshi top brands achieve 3x conversion with 1-Click Fast COD."

---

### Day 7 (168 Hours) — Mid-Trial Performance Check-in
- **Dynamic Content**:
  - *If orders received*: "Great job! You received `X` orders this week worth `৳ Y`. Here is how to print thermal invoices."
  - *If 0 orders received*: "Need help getting your first sale? Book a free 15-minute onboarding call with our growth team."

---

### Day 11 (264 Hours) — 3-Day Expiry Notice
- **SMS**: `আপনার ১৪ দিনের ফ্রি ট্রায়াল শেষ হতে ৩ দিন বাকি। আপনার স্টোর চালু রাখতে এবং কাস্টম ডোমেইন একটিভ করতে প্ল্যান রিনিউ করুন: [billing_link]`
- **Email**: "Your free trial ends in 3 days — Choose your plan (Starter, Pro, Business)."

---

### Day 14 (336 Hours) — Trial Expiration & 3-Day Grace Notice
- **SMS**: `আপনার ফ্রি ট্রায়াল শেষ হয়েছে। আগামী ৩ দিন আপনার স্টোর সচল থাকবে। bKash বা কার্ডের মাধ্যমে সহজেই Pro প্ল্যানে আপগ্রেড করুন: [billing_link]`
- **Email**: "Your trial has expired — 3 days of grace remaining before store pauses."

---

## 5. Sales Retention & Churn Prevention Playbook

1. **High-Intent Merchant Intervention (Hot Leads)**:
   - If a store receives **> 3 orders** during trial, a Super Admin alert triggers in `SaOverview.dc.html`.
   - A dedicated merchant success agent calls the owner to assist with bKash subscription renewal and courier billing questions.
2. **7-Day Trial Extension Offer**:
   - If a store uploaded > 10 products but ran zero orders, the system automatically offers a **1-click 7-day trial extension** in their admin topbar.
3. **Cardless Renewal Accessibility**:
   - Bangladeshi store owners without international credit cards can pay instantly via **bKash Merchant Pay** or **Manual Send Money** with 1-click TrxID submission.
