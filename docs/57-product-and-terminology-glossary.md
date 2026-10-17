# BizTrackBD Product & Terminology Glossary

**Document Number:** 57  
**Date:** 17 October 2026  
**Status:** Approved & Enforced Standard  
**Related Documents:** [docs/51](file:///d:/AI/biztrackbd%20ecom/docs/51-biztrack-business-master-plan.md), [docs/53](file:///d:/AI/biztrackbd%20ecom/docs/53-biztrackbd-marketing-website-research-and-design-brief.md), [docs/55](file:///d:/AI/biztrackbd%20ecom/docs/55-marketing-website-alignment-audit-2026-10-17.md), [docs/56](file:///d:/AI/biztrackbd%20ecom/docs/56-marketing-remediation-backlog-2026-10-17.md)

---

## 1. Executive Summary

This glossary establishes the single authoritative vocabulary and taxonomy across the BizTrackBD ecosystem (Marketing, Admin, Storefront, Platform, APIs, and Documentation). It eliminates conceptual overloading identified in the 17 October 2026 alignment audit (items C4, C5, COPY-003), ensuring uniform customer communication, reliable database modeling, and consistent analytics telemetry.

---

## 2. Product Family Taxonomy

BizTrackBD operates three clearly delineated product modes under a single multi-tenant infrastructure:

| Product Name | Public Marketing Description | Internal Enum (`siteMode`) | Core Workspaces | Target Customer |
|---|---|---|---|---|
| **BizTrackBD Storefront** | Full eCommerce store with product catalog, cart, checkout, bKash/Nagad verification, and automated courier fulfillment. | `ECOMMERCE` | Products, Orders, Inventory, Courier, Payments, Customers | Retail merchants selling physical goods via Cash on Delivery and MFS in Bangladesh. |
| **BizTrackBD Business** | Fast, conversion-focused business website with services, team credentials, quote requests, appointment booking, and centralized lead inbox. | `PORTFOLIO` | Services, Team, Appointments, Leads, Downloads, Custom Pages | Doctors, clinics, restaurants, consulting firms, repair services, and personal creator portfolios. |
| **BizTrackBD Hybrid** | Unified multi-purpose presence combining full business website capabilities with direct eCommerce checkout on one primary custom domain. | `HYBRID` | All Storefront Desks + All Business Desks | Clinics selling supplements, restaurants selling bottled condiments, corporate agencies selling publications. |

> [!IMPORTANT]
> **Public vs. Internal Alignment:**
> - Public marketing, navigation, and customer documentation must strictly use **"BizTrackBD Business"** (never expose the internal database keyword `PORTFOLIO` to prospective merchants).
> - Internal database schemas and Prisma models retain `siteMode: 'PORTFOLIO'` for backward compatibility, mapped bidirectionally at API and routing boundaries.

---

## 3. Plan & Pricing Matrix

All pricing across the platform is unified in Bangladeshi Taka (৳ BDT) with zero foreign transaction fees:

| Plan Tier | Monthly Fee | Annual Prepay (2 Months Free) | Target Audience | Key Feature Boundaries |
|---|---|---|---|---|
| **Starter** | **৳ 399** / mo | ৳ 3,990 / yr | Emerging consultants, individual doctors, boutique portfolios, and emerging retailers. | 1 custom domain, up to 5 structured pages, centralized lead capture, direct WhatsApp dialer, 0% sales commission. |
| **Growth** | **৳ 799** / mo | ৳ 7,990 / yr | Growing retail stores, busy medical chambers, restaurants, and active service contractors. | Up to 20 pages, online booking / appointment desk, courier automation (Steadfast/Pathao), bKash/Nagad direct verification, multi-layer Meta CAPI. |
| **Scale** | **৳ 1,499** / mo | ৳ 14,990 / yr | High-volume retail brands, multi-chamber medical clinics, and multi-staff corporate operations. | Unlimited pages, multi-staff permissions (Owner, Manager, Staff, Content), advanced COD fraud screening, priority Bangladeshi phone support. |

---

## 4. Operational Vocabulary & Naming Conventions

### 4.1. Inquiry vs. Enquiry (Standardized: `Inquiry`)
- **Rule:** Standardize on American English **"Inquiry" / "Inquiries"** across all UI labels, form actions, API routes, and analytics events.
- **Prohibited:** Do not use British "Enquiry" or "Enquiries" in public code or UI to prevent fragmented event schemas.
- **Routes & APIs:**
  - Public marketing contact desk: `/contact`
  - Ingestion API: `POST /api/contact`
  - Admin workspace: `/leads` (Platform inquiries are routed to `/inquiries` for Super Admin).

### 4.2. Inbound Interaction Objects
- **Lead (`Lead`)**: An inbound commercial inquiry submitted via contact forms, quote requests, or download gates. Stored in `TenantLead` with private staff follow-up notes and attribution.
- **Booking / Appointment (`Booking`)**: A scheduled time slot or table reservation submitted for medical chambers, restaurant dining, or service consultations. Stored in `TenantBooking`.
- **Order (`Order`)**: A contractual retail merchandise transaction involving products, SKUs, delivery addresses, and payment status (COD, PAID).

### 4.3. Tenant & Entity Terminology
- **Tenant**: The platform-level multitenant entity representing an individual business account.
- **Store**: Used when referring specifically to an eCommerce retail storefront.
- **Website**: Used when referring to a BizTrack Business site.
- **Subdomain**: The `*.biztrackbd.com` free staging address assigned upon signup.
- **Custom Domain**: A merchant-owned naked domain or subdomain (`example.com`, `www.example.com`) connected via CNAME/A records.

---

## 5. Security, Tracking & Cryptographic Vocabulary

To prevent deceptive marketing and comply with truth-in-advertising standards (audit items C1, COPY-001, COPY-002):

| Approved Accurate Term | Prohibited Overstated Term | Rationale |
|---|---|---|
| **Cryptographic SHA-256 Hashing** | *"SHA-256 Military-Grade Encryption"* | SHA-256 is an irreversible, one-way cryptographic hash function, not reversible encryption. |
| **Dual-Layer Server-Side Resilience** | *"Universal Ad-Blocker Bypass"* | Server events recover signal lost to network/client drops, but strictly honor affirmative user consent and browser privacy regulations. |
| **Real-Time Automated Screening** | *"100% Guaranteed Zero Return Rate"* | Courier algorithms identify delivery risk profiles; they cannot legally or physically guarantee customer parcel acceptance. |
| **Sub-Second LCP Performance** | *"Instant 0.6s Guaranteed Worldwide"* | Real mobile network latency varies by carrier (Grameenphone, Banglalink, Robi, Teletalk); marketing references representative 4G benchmarks with methodology stated. |

---

## 6. Implementation Checklist

- [x] Product modes (`ECOMMERCE`, `PORTFOLIO`, `HYBRID`) bound to unified pricing (PLAN-001).
- [x] Template aliases canonicalized (`apex-corporate` canonical, `corporate-trust` alias) (TPL-001).
- [x] Public contact API hardened with affirmative consent enforcement (API-001).
- [x] Meta CAPI server-side event pipeline (`Lead`, `Schedule`, `CompleteRegistration`) (DATA-002).
- [x] Dual first-touch (`bt_attr_first`) and last-touch (`bt_attr_last`) attribution (DATA-003).
- [x] Public UI navigation and badges aligned with standardized "Inquiries" and Product Family names (COPY-003).
