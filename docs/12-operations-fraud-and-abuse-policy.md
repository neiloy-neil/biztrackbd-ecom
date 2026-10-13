# Platform Operations, Fraud Risk Engine & Abuse Policy

Status: COMPLETE SPECIFICATION  
Scope: `apps/platform`, `packages/core`, Platform Operations & Legal Compliance

---

## 1. Algorithmic Delivery Trust Score Engine

In Bangladesh ecommerce, Cash on Delivery (COD) carries severe return and refused-parcel risks. BizTrackBD calculates a dynamic **Delivery Trust Score (0–100)** for every phone number placing an order across the network.

### A. Algorithmic Score Formula

```
Trust Score = (Delivered Parcels / Total Dispatched Parcels) * 100 * TimeRecencyWeight - RefusalPenalty
```

1. **Baseline Ratio**: Total completed deliveries divided by total attempted shipments across all stores connected to supported couriers (Steadfast, Pathao, RedX).
2. **Time-Recency Weight**:
   - Deliveries/Returns within last 30 days: `Weight = 1.0`
   - Deliveries/Returns within 31–90 days: `Weight = 0.8`
   - Deliveries/Returns older than 90 days: `Weight = 0.5`
3. **Refusal Penalty**: Extra `-10` points for every recorded parcel refused at the doorstep within the last 60 days.

### B. Risk Badges & Recommended Action Matrix

| Score Range | Risk Level | Merchant Admin Badge | Default System Recommendation |
|---|---|---|---|
| `> 75` | **Trusted** | Green `Trusted (Score: 88)` | Safe to pack and ship COD immediately. |
| `50 – 75` | **Medium Risk** | Amber `Medium (Score: 62)` | Call customer or send SMS confirmation OTP before packing. |
| `< 50` | **High Risk** | Red `High Risk (Score: 28)` | Pause booking; prompt customer for ৳100 advance delivery fee via bKash. |
| `0 orders` | **New Number** | Gray `First-Time Buyer` | Normal processing; verify address completeness. |

### C. Privacy & Cross-Store Data Protection
- The system **never exposes another merchant's customer names, addresses, or ordered items**.
- Only aggregated anonymized metrics (`X of Y parcels delivered`, `Refusal count`) are queried for the matching phone number.
- Storage: the `PhoneTrustStat` table in doc 08 (section 16) holds delivered, returned and refused counts keyed by a salted hash of the phone number, with no names or addresses. Tenant apps read it only through a `SECURITY DEFINER` function. Per-store blocklists live in `BlockedContact` (doc 08 section 12).

### D. As built (Phase 4)

- **Storage is an event table, not only counts.** The recency weights need to know when each outcome happened, so the platform keeps one row per order outcome in `PhoneTrustEvent` (salted phone hash, a hash of tenant and order, a hash of the tenant, `DELIVERED | RETURNED | REFUSED`, time). `PhoneTrustStat` is refreshed from it as the aggregate. Re-recording an order's outcome corrects it in place (a delivered parcel that later comes back moves from delivered to returned).
- **Access:** the app role has no privileges on either table. `phone_trust_record(...)` and `phone_trust_lookup(hash)` are `SECURITY DEFINER`, take only hashes, and return only counts split by age (30 days, 31 to 90, older, and refusals in 60 days). `PHONE_TRUST_SALT` is platform-wide on purpose (every store must hash a number the same way) and must never change.
- **Score:** weighted delivered / (weighted delivered + weighted not delivered) times 100, minus 10 per refusal in the last 60 days, clamped to 0 to 100. A refusal counts as not delivered. One bad parcel on its own is never High Risk (it needs a second outcome), so a single failed delivery cannot hold every future order.
- **Order flags** (10 points each, on top of the number's own score; "first-time buyer" costs nothing): `LOW_DELIVERY_SUCCESS`, `HIGH_VALUE_COD_NEW_NUMBER` (cash on delivery over ৳5,000, no delivered parcel), `ADDRESS_INCOMPLETE`, `PHONE_MULTIPLE_ADDRESSES` (another live order in the last 30 days to a different district).
- **Holds:** a High Risk cash-on-delivery order placed by the customer gets `fraudReview = HELD`. A courier cannot be booked until the owner releases it (with a note). Prepaid orders and staff-keyed orders are scored, never held. Not built: automatic SMS confirmation OTP before booking, and the automatic ৳100 advance request (the screen recommends it).

---

## 2. Anti-Phishing & Fake Store Detection Scanner

To prevent fraudulent actors from setting up scam stores targeting Bangladeshi consumers:

### A. Protected Brand & Phishing Keyword Scanner
On store creation and subdomain claim, an automated regex scanner matches against protected brand namespaces:
- **Protected Financial Entities**: `bkash`, `nagad`, `rocket`, `upay`, `islami-bank`, `citybank`, `ebl`
- **Major Retail Trademarks**: `daraz`, `aarong`, `yellow`, `apex`, `bata`, `chaldal`, `shwapno`
- **Global Tech & Luxury Brands**: `apple`, `samsung`, `nike`, `gucci`, `rolex`

### B. Automated Quarantine Workflow
1. If a tenant subdomain or store name contains protected keywords without verified official partnership:
   - The store is placed in **Quarantined Status**.
   - Custom domain publishing is locked.
   - Super Admin receives an urgent alert in `SaOverview.dc.html` ("Tenant flagged for brand review").
2. Super Admin can approve with proof of authorization or suspend the tenant with 1 click.

---

## 3. Super Admin Impersonation Security Protocol

Platform administrators occasionally need to "Log in as owner" to assist with theme configuration, courier setup, or bug diagnosis.

### Impersonation Safeguards:
1. **Short-Lived JWT Token**: Issued with a strict 15-minute expiration time.
2. **Persistent Floating Banner**:
   ```
   +---------------------------------------------------------------------------------+
   | ⚠️ IMPERSONATING: Rongdhonu Fashion (Tenant ID: k7Qx92mTa)                     |
   | Super Admin: sumi@biztrack.bd | Session expires in 11:42 | [ Exit Session ]   |
   +---------------------------------------------------------------------------------+
   ```
3. **Restricted Actions During Impersonation**:
   - ❌ Cannot delete custom domains.
   - ❌ Cannot view plaintext integration secrets (AES-256 keys remain masked).
   - ❌ Cannot initiate bulk raw customer PII exports without 2FA re-verification.
4. **Immutable Audit Logging**: Every mutation performed under impersonation is tagged with `actorType: "super_admin_impersonator"` and logged to `SaAudit.dc.html`.

---

## 4. Tenant Suspension, Offboarding & Data Retention

### A. Suspension States:
- **Past-Due Grace Period (Days 1–3)**: Store remains online; banner in merchant admin warns of upcoming renewal.
- **Soft Suspension (Days 4–14)**: Storefront displays friendly temporary maintenance page (`StrOffline.dc.html`); admin accessible in read-only mode (`AdmReadOnly.dc.html`).
- **Hard Suspension (Day 15+)**: Storefront and admin locked. Data archived.

### B. 90-Day Offboarding & Permanent Purge:
1. **Day 1 to 90**: Merchant can download complete data export (Products CSV, Orders CSV, Customers CSV, Media ZIP).
2. **Day 90**: Automated lifecycle cron executes:
   - Deletes all encrypted integration keys (`TenantIntegration`).
   - Removes Vercel/Cloudflare custom domain SSL bindings.
   - Purges media files from Supabase Storage bucket.
   - Soft-deletes tenant database rows.

---

## 5. BTRC Regulatory Compliance for SMS Masking

Under Bangladesh Telecommunication Regulatory Commission (BTRC) guidelines:
1. **Non-Masking SMS (Starter & Pro Plans)**:
   - Dispatched via platform shared numeric shortcodes.
   - Requires no paperwork; active instantly on signup.
2. **Alphanumeric Masking Sender ID (Business Plan)**:
   - Requires business trade license, TIN certificate, and official authorization letter on company letterhead.
   - Super Admin verifies documents and registers the Sender ID with telecom telcos (Grameenphone, Robi, Banglalink, Teletalk).
   - Once BTRC approved, Sender ID is attached to `TenantSetting.maskingSenderId`.
