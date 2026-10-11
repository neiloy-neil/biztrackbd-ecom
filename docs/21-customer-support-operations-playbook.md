# Customer Support Operations, SLA Playbook & WhatsApp Escalation

Status: COMPLETE SPECIFICATION  
Scope: `apps/platform` (`SaTickets.dc.html`), Support Operations & Merchant Care

---

## 1. Support Triage Framework & Response SLAs

All support inquiries initiated by store owners from their admin panel flow into the **Super Admin Support Desk (`SaTickets.dc.html`)**.

### SLA Response Targets:

| Priority Level | Qualifying Incident Examples | Response SLA | Target Resolution |
|---|---|---|---|
| 🔴 **Critical (P1)** | Storefront 500 error, Checkout broken, SSL cert expired on live campaign | `< 15 Minutes` | `< 2 Hours` |
| 🟠 **Urgent (P2)** | Manual bKash/Nagad subscription pending approval, Courier booking API failure | `< 1 Hour` | `< 4 Hours` |
| 🔵 **Normal (P3)** | Theme builder guidance, CSV product import help, Shipping rate advice | `< 4 Hours` | `< 12 Hours` |
| ⚪ **Low (P4)** | Feature suggestions, general feedback | `< 24 Hours` | N/A |

- **Operating Hours**: **9:00 AM to 10:00 PM (Asia/Dhaka time), 7 days a week**. Critical checkout outages trigger automated on-call SMS alerts 24/7.

---

## 2. Super Admin Support Desk Operations (`SaTickets.dc.html`)

### Ticket Lifecycle Workflow:
```
[ New Ticket Created by Merchant ]
                 |
                 v
   [ Automated Categorization & Severity Tagging ]
                 |
                 v
     [ Support Agent Assigned & History Inspected ]
                 |
                 v
 [ Diagnosis via 15-min Audited Impersonation if needed ]
                 |
                 v
 [ Agent Dispatches Bilingual Response via Ticket & SMS/Email ]
                 |
                 v
       [ Ticket Resolved / Customer Confirmation ]
```

---

## 3. Bilingual Response Macros (English & বাংলা)

Support agents use pre-approved canned macros for common support scenarios:

### Macro 1: Custom Domain DNS Propagation Issue
- **English**:
  > *"Assalamu alaikum. We checked your domain `[domain.com]`. The CNAME record is currently missing or pointing to the wrong IP. Please log in to your domain provider (e.g. Namecheap, GoDaddy) and add a CNAME record for `www` pointing to `cname.vercel-dns.com` and an A record for `@` pointing to `76.76.21.21`. Once updated, it will verify automatically within 30 minutes."*
- **বাংলা**:
  > *"আসসালামু আলাইকুম। আমরা আপনার ডোমেইন `[domain.com]` চেক করেছি। আপনার ডোমেইন প্রোভাইডারে (Namecheap/GoDaddy) CNAME রেকর্ডটি সঠিকভাবে সেট করা হয়নি। অনুগ্রহ করে `@` রেকর্ডের জন্য A Record `76.76.21.21` এবং `www` এর জন্য CNAME Record `cname.vercel-dns.com` সেট করুন। ৩০ মিনিটের মধ্যে ডোমেইনটি স্বয়ংক্রিয়ভাবে একটিভ হয়ে যাবে।"*

---

### Macro 2: Steadfast / Pathao Courier API Key Error
- **English**:
  > *"Assalamu alaikum. Your courier connection failed because the API key/password has expired or is invalid. Please log in to your Steadfast/Pathao merchant portal, generate a new API Key/Secret, and paste it into Settings -> Integrations in your store admin. Let us know once updated so we can run a test booking."*
- **বাংলা**:
  > *"আসসালামু আলাইকুম। আপনার কুরিয়ার একাউন্টের API কি অথবা পাসওয়ার্ডটি এক্সপায়ার বা ভুল দেখাচ্ছে। অনুগ্রহ করে Steadfast/Pathao মার্চেন্ট পোর্টালে লগইন করে নতুন API Key সংগ্রহ করুন এবং আপনার স্টোরের Settings -> Integrations পেজে সেভ করুন।"*

---

### Macro 3: Manual bKash/Nagad Subscription Approval Notice
- **English**:
  > *"Assalamu alaikum. We have verified your TrxID `[TrxID]` for the `[Plan]` plan. Your subscription is now active! You have full access to custom domains, courier booking, and advanced features. Thank you for choosing BizTrackBD!"*
- **বাংলা**:
  > *"আসসালামু আলাইকুম। আপনার পেমেন্ট TrxID `[TrxID]` ভেরিফাই করা হয়েছে এবং আপনার `[Plan]` সাবস্ক্রিপশনটি একটিভ করা হয়েছে। এখন থেকে আপনি সকল প্রিমিয়াম ফিচার ব্যবহার করতে পারবেন। BizTrackBD-র সাথে থাকার জন্য ধন্যবাদ!"*

---

## 4. WhatsApp VIP Escalation Protocol

For merchants on the **Business Plan (৳3,499/mo)**:
1. **Direct 1-Tap Escalation**: A floating **"VIP WhatsApp Support"** button appears in their admin topbar.
2. **Context Pre-Population**: Clicking opens WhatsApp Web / Mobile with pre-filled context:
   ```
   https://wa.me/8801700000000?text=Hi%20BizTrack%20Support,%20Store:%20Rongdhonu%20Fashion%20(k7Qx92mTa),%20Plan:%20Business.%20Issue:%20
   ```
3. **Dedicated Senior Agent**: Automatically routes to senior technical support agents for instant real-time resolution.

---

## 5. Consumer Abuse & Fraudulent Merchant Reporting

If a retail buyer reports a merchant for fraudulent behavior (e.g. collecting bKash advance payment and refusing delivery):
1. **Intake**: Buyer files complaint via platform abuse page (`biztrackbd.com/report-abuse`).
2. **Investigation**: Support agent checks merchant's order history, bKash TrxID claims, and delivery tracking.
3. **Warning & 24h Proof Request**: Merchant is notified via SMS/Email to provide valid courier tracking proof within 24 hours.
4. **Suspension**: If merchant fails to provide proof or multiple verified complaints accumulate, Super Admin executes **1-Click Tenant Suspension**, locking the store and preventing further customer transactions.
