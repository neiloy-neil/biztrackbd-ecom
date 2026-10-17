# BizTrack Business — Screen-and-Contract Specification (Phase 0)

**Document Reference:** `docs/58-biztrack-business-screen-and-contract-spec.md`  
**Status:** Approved Architectural Specification (Phase 0 Deliverable)  
**Date:** 17 October 2026  
**Depends On:** `51-biztrack-business-master-plan.md`, `54-biztrack-business-platform-admin-backend-api-plan.md`  
**Governs:** Merchant Admin (`apps/admin`), Platform Control Plane (`apps/platform`), Storefront Public APIs (`apps/storefront`), and Core Services (`packages/core`)

---

## Executive Summary

This document fulfills the **Phase 0** gate mandated by Section 13 of `docs/54-biztrack-business-platform-admin-backend-api-plan.md`. It provides the definitive screen-and-contract specification that bridges high-level architecture with production execution across the three operating surfaces of BizTrackBD:

1. **Public Storefront** (`apps/storefront`) — hardens visitor inquiry, reservation, and gated download capture with multi-tier abuse defenses and strict privacy isolation.
2. **Merchant Dashboard** (`apps/admin`) — delivers a mode-aware operational workspace for appointment bookings, customer leads, vertical content, and tracking health.
3. **Platform Control Plane** (`apps/platform`) — empowers platform operators with unified multi-mode telemetry, a prioritized Needs-Attention queue, and atomic mode-transition workflows.

---

## 1. Low-Fidelity UI Wireframes

### Screen 1: Business Home Dashboard (`apps/admin/src/app/(admin)/page.tsx`)
*Mode-aware command center for `PORTFOLIO` and `HYBRID` merchants.*

```text
+----------------------------------------------------------------------------------------------------+
|  BizTrack Admin   [ Dhaka Bistro ▼ ] [ HYBRID Mode ]                 [ 🔔 2 ] [ Staff: Tanvir (Owner) ] |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  👋 Welcome back, Dhaka Bistro!                         [ 🌐 View Live Store ↗ ] [ ➕ Quick Actions ▼ ] |
|  Your site is live on dhakabistro.com • Edge Cached Dhaka Node                                     |
|                                                                                                    |
|  +----------------------------------------------------------------------------------------------+  |
|  | 🚀 ACTIVATION CHECKLIST (4 of 5 Complete)                                            80% [■■■■□] |  |
|  | [✓] Choose Dhaka Bistro Template     [✓] Add Restaurant Menu & Chef Profiles                    |  |
|  | [✓] Connect Custom Domain            [✓] Configure WhatsApp Desk (+8801712345678)               |  |
|  | [👉] Test Live Table Reservation Submission  --> [ Test Reservation Now → ]                      |  |
|  +----------------------------------------------------------------------------------------------+  |
|                                                                                                    |
|  OPERATIONAL TELEMETRY (TODAY)                                                                     |
|  +----------------------+ +----------------------+ +----------------------+ +----------------------+  |
|  | NEW LEADS            | | PENDING BOOKINGS     | | WHATSAPP CONVERSIONS | | STOREFRONT VISITS    |  |
|  | 14                   | | 6                    | | 28                   | | 1,420                |  |
|  | +4 vs yesterday      | | 2 require attention  | | 1-tap chats initiated| | 98.4% uptime (<85ms) |  |
|  +----------------------+ +----------------------+ +----------------------+ +----------------------+  |
|                                                                                                    |
|  +-------------------------------------------------------+ +---------------------------------------+ |
|  | 📥 UNATTENDED INQUIRIES & RESERVATIONS               | | 🩺 SYSTEM & INTEGRATION HEALTH         | |
|  | • [RESERVATION] Table for 4 • Rafiqul Islam (12m ago) | | • Custom Domain: Active (SSL Valid)   | |
|  |   Requested: Today 8:30 PM | 📞 01819234567          | | • Meta CAPI: 99.2% match rate (OK)    | |
|  |   [ 💬 WhatsApp ] [ 👤 Assign ] [ ✓ Confirm ]         | | • SMS Gateway: 450 credits left       | |
|  |                                                       | | • Bot Shield: 8 spam attempts blocked | |
|  | • [QUOTE] Private Banquet Hall • Farhana (45m ago)   | +---------------------------------------+ |
|  |   Requested: 24 Oct | 📞 01711987654                 |                                           |
|  |   [ 💬 WhatsApp ] [ 👤 Assign ] [ 📝 Add Note ]      | ⚡ QUICK SHORTCUTS                        |
|  |                                                       | • [ ➕ Add Menu Item ]                    |
|  | [ View All 20 Active Leads in Inbox → ]               | • [ 🎨 Edit Store Theme ]                 |
|  +-------------------------------------------------------+ • [ 📊 View Campaign UTMs ]              |
+----------------------------------------------------------------------------------------------------+
```

---

### Screen 2: Unified Lead & Booking Workspace (`apps/admin/src/app/(admin)/leads/page.tsx`)
*Lightweight operational desk replacing fragmented email inboxes.*

```text
+----------------------------------------------------------------------------------------------------+
|  Leads & Inquiries   [ All (24) ] [ New (8) ] [ Contacted (10) ] [ Won (4) ] [ Spam (2) ]  [ 📥 Export ] |
+----------------------------------------------------------------------------------------------------+
|  Filters: [ Type: All ▼ ] [ Vertical: Restaurant ▼ ] [ Assignee: All ▼ ] [ Search: Phone or Name... ]    |
|                                                                                                    |
|  +---------------------------------------------------+-------------------------------------------+ |
|  | INQUIRY LIST                                      | SELECTED LEAD DETAIL: #LD-9482            | |
|  |---------------------------------------------------|-------------------------------------------| |
|  | [● NEW] Rafiqul Islam (01819234567)               | Rafiqul Islam • Table Reservation (4 pax) | |
|  |   Table for 4 • Tonight 8:30 PM • 12m ago         | Status: [ NEW ▼ ]  Assigned: [ Tanvir ▼ ] | |
|  |---------------------------------------------------| Source: /reservations (Google Ads / cpc)  | |
|  | [● NEW] Farhana Akter (01711987654)               | Submitted: Today at 7:18 PM (Dhaka Time)  | |
|  |   Corporate Dinner Quote • 45m ago                | Phone: 01819234567 • Email: rafiq@bd.com  | |
|  |---------------------------------------------------|-------------------------------------------| |
|  | [CONTACTED] Dr. Kamal Hossain (01912445566)       | ACTION DESK:                              | |
|  |   Cataract Consultation • Yesterday               | [ 💬 Open WhatsApp Chat ]  [ 📞 Call ]     | |
|  |---------------------------------------------------| [ ✓ Confirm Booking ]      [ ✕ Close ]    | |
|  | [WON] NextGen Tech Ltd (01611002233)              |-------------------------------------------| |
|  |   SaaS Website Design • 2 days ago                | ACTIVITY & AUDIT TIMELINE:                | |
|  |                                                   | • 7:18 PM: Lead captured from Web Form    | |
|  |                                                   | • 7:22 PM: Auto-assigned to Tanvir        | |
|  |                                                   | • 7:25 PM: Tanvir added note:             | |
|  |                                                   |   "Called customer, table 4 arranged at   | |
|  |                                                   |    window side."                          | |
|  |                                                   | [ 📝 Add Internal Note / Interaction... ] | |
|  +---------------------------------------------------+-------------------------------------------+ |
+----------------------------------------------------------------------------------------------------+
```

---

### Screen 3: Tracking & Integration Health (`apps/admin/src/app/(admin)/settings/integrations/page.tsx`)
*Observable privacy-conscious telemetry status for Meta Pixel & CAPI.*

```text
+----------------------------------------------------------------------------------------------------+
|  Marketing & Server Events Tracking                                 [ 🔄 Test Event Simulation ]   |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  +----------------------------------------------------------------------------------------------+  |
|  | 🌐 META PIXEL & CONVERSIONS API (CAPI)                                    STATUS: [ ACTIVE ● ] |  |
|  | Pixel ID: ••••••••••••8491 | Server Endpoint: /api/events/capi (Isolated Edge Proxy)          |  |
|  +----------------------------------------------------------------------------------------------+  |
|                                                                                                    |
|  HEALTH BENCHMARKS (LAST 24 HOURS)                                                                 |
|  +----------------------+ +----------------------+ +----------------------+ +----------------------+  |
|  | EVENTS DISPATCHED    | | DEDUPLICATION RATE   | | MATCH QUALITY SCORE  | | CAPI REJECTION RATE  |  |
|  | 2,481                | | 99.8%                | | 8.8 / 10             | | 0.00% (0 errors)    |  |
|  | Browser + Edge CAPI  | | Shared eventId match | | SHA-256 phone/email  | | All payloads valid  |  |
|  +----------------------+ +----------------------+ +----------------------+ +----------------------+  |
|                                                                                                    |
|  EVENT STREAM DIAGNOSTICS                                                                          |
|  +---------------------+-------------------+---------------------+------------------+-------------+ |
|  | EVENT NAME          | DESTINATION       | IDENTIFIERS HASHED  | EVENT ID         | STATUS      | |
|  |---------------------|-------------------|---------------------|------------------|-------------| |
|  | Lead (Table Book)   | Meta Pixel + CAPI | Phone, IP, UA, fbp  | evt_9482_817291  | [ 200 OK ]  | |
|  | PageView            | Meta Pixel        | fbp, userAgent      | evt_pv_1829103   | [ 200 OK ]  | |
|  | Contact (Inquiry)   | Meta Pixel + CAPI | Phone, Email, IP    | evt_9480_716290  | [ 200 OK ]  | |
|  +---------------------+-------------------+---------------------+------------------+-------------+ |
|                                                                                                    |
|  🔒 PRIVACY POLICY ENFORCEMENT:                                                                    |
|  • Consent Verification: Active (Consent text version: 'v2026.1')                                 |
|  • Zero Medical Data Ingress: Diagnostic symptoms and medical notes strictly stripped from events. |
+----------------------------------------------------------------------------------------------------+
```

---

### Screen 4: Platform Overview with Multi-Mode Metrics (`apps/platform/src/app/(sa)/page.tsx`)
*Super-admin command center showing health across Ecommerce, Business, and Hybrid tenants.*

```text
+----------------------------------------------------------------------------------------------------+
|  BizTrack Platform Control Plane                         [ Search tenants, domains, phone... 🔍 ] |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  PLATFORM COHORT HEALTH (ACTIVE STORES)                                                            |
|  +------------------------+ +------------------------+ +------------------------+ +---------------+  |
|  | BIZTRACK BUSINESS      | | BIZTRACK ECOMMERCE     | | HYBRID TENANTS         | | PLATFORM MRR  |  |
|  | 412 Sites              | | 884 Stores             | | 129 Dual Stores        | | ৳ 1,420,500   |  |
|  | 3,820 leads/wk         | | ৳ 42.8M GMV/mo         | | 1,120 orders + leads   | | +18.4% MoM    |  |
|  | 98.2% Edge cached      | | 1.8% return rate       | | 88% activation rate    | | 94.2% renewal |  |
|  +------------------------+ +------------------------+ +------------------------+ +---------------+  |
|                                                                                                    |
|  🚨 NEEDS ATTENTION QUEUE (Ranked by Severity)                                                     |
|  +----------+--------------------+-------------------------------+-------------------+-----------+  |
|  | SEVERITY | TENANT             | ISSUE DETECTED                | IMPACTED SERVICE  | ACTION    |  |
|  |----------|--------------------|-------------------------------|-------------------|-----------|  |
|  | [CRIT]   | Apex Corporate     | Custom Domain SSL Expired     | / (Storefront)    | [ Fix ]   |  |
|  | [HIGH]   | Dhaka Bistro       | SMS Quota Exhausted (<5)      | SMS Notifications | [ TopUp ] |  |
|  | [WARN]   | Modern Dental Care | High Lead Velocity (>20/min)  | Anti-Abuse Shield | [ Audit ] |  |
|  | [INFO]   | Star Fashion BD    | Mode Transition Requested     | Hybrid Conversion | [ Review ]|  |
|  +----------+--------------------+-------------------------------+-------------------|-----------+  |
+----------------------------------------------------------------------------------------------------+
```

---

### Screen 5: Mode-Aware Tenant Detail (`apps/platform/src/app/(sa)/tenants/[id]/page.tsx`)
*Redacted operator view protecting end-customer privacy.*

```text
+----------------------------------------------------------------------------------------------------+
|  Tenant: Modern Eye Clinic BD   [ PORTFOLIO / CLINIC ] [ Plan: BUSINESS ]   [ Impersonate (Reason) ] |
+----------------------------------------------------------------------------------------------------+
|  Tabs: [ Overview ] [ Website & Pages ] [ Leads & Health ] [ Entitlements ] [ Abuse & Audit Log ]    |
|                                                                                                    |
|  +-------------------------------------------------------+ +---------------------------------------+ |
|  | TENANT IDENTITY & DOMAINS                             | | OPERATIONAL HEALTH SNAPSHOT           | |
|  | • Subdomain: modernclinic.biztrackbd.com             | | • Site Status: Published (v14)        | |
|  | • Custom Domain: modernclinicbd.com (SSL Valid ✓)     | | • Leads Received (30d): 142          | |
|  | • Owner: Dr. M. Rahman (dr.rahman@clinic.com)         | | • Bookings Confirmed: 98              | |
|  | • Phone: 01712****** (Redacted for Support)           | | • Form Conversion Rate: 8.4%          | |
|  | • Site Mode: PORTFOLIO • Vertical: DOCTOR_CLINIC      | | • Abuse Incidents: 0 quarantined      | |
|  +-------------------------------------------------------+ +---------------------------------------+ |
|                                                                                                    |
|  REDACTED LEADS & INQUIRY AUDIT                                                                    |
|  +-------------+---------------------+-------------------+---------------------+------------------+  |
|  | INQUIRY ID  | TYPE                | SUBMITTED AT      | CONTACT STATUS      | PRIVACY REDACT   |  |
|  |-------------|---------------------|-------------------|---------------------|------------------|  |
|  | LD-9482     | APPOINTMENT         | 17 Oct, 7:18 PM   | CONFIRMED           | [REDACTED NAME]  |  |
|  | LD-9480     | CONTACT             | 17 Oct, 6:02 PM   | CONTACTED           | [REDACTED NAME]  |  |
|  +-------------+---------------------+-------------------+---------------------+------------------+  |
|  * Platform staff cannot view patient symptom details or unredacted phone numbers without dual authorization. |
+----------------------------------------------------------------------------------------------------+
```

---

### Screen 6: Mode Transition Review & Dry-Run (`apps/platform/src/app/(sa)/tenants/[id]/transition/page.tsx`)
*Safe two-phase dry-run workflow for converting between Ecommerce, Business, and Hybrid.*

```text
+----------------------------------------------------------------------------------------------------+
|  Mode Transition Workflow — Star Fashion BD                                                        |
+----------------------------------------------------------------------------------------------------+
|  Current Mode: [ ECOMMERCE ]  ----->  Target Mode: [ HYBRID ]                                      |
|                                                                                                    |
|  +----------------------------------------------------------------------------------------------+  |
|  | 🔍 DRY-RUN IMPACT ANALYSIS                                                                   |  |
|  | • Capabilities Gained: +leads, +services, +booking_requests, +portfolio_items, +downloads    |  |
|  | • Capabilities Disabled: None (Ecommerce catalog, carts, checkout & couriers remain active) |  |
|  | • Public Storefront Routes Affected: /services, /appointment, /portfolio added                |  |
|  | • Billing Tier Impact: Upgraded to BUSINESS plan (৳ 1,499/mo)                                |  |
|  | • Data Protection: All existing 412 products, 1,290 orders and customer records PRESERVED   |  |
|  | • Manifest Seeding: Will seed default Dhaka Services template sections if unconfigured      |  |
|  +----------------------------------------------------------------------------------------------+  |
|                                                                                                    |
|  MANDATORY SAFETY CONFIRMATION                                                                     |
|  Reason for Transition: [ Merchant requested dual consulting & apparel retail capabilities     ]  |
|  Staff Authorizer:      Tanvir Ahmed (Super Admin)                                                 |
|  [✓] I have verified customer consent and payment method update for BDT 1,499/mo                   |
|                                                                                                    |
|  [ ✕ Cancel ]                                      [ 🚀 Execute Atomic Mode Transition (Safe) ]   |
+----------------------------------------------------------------------------------------------------+
```

---

## 2. Server-Side Permission Matrix

### 2.1 Merchant Staff Permissions (`packages/core/src/permissions.ts`)
Permissions strictly decouple the broad legacy `customers` permission into dedicated operational areas:

| Area Key | Area Description | `STORE_OWNER` | `STORE_MANAGER` | `TELEMARKETER` (Support) | `CONTENT_EDITOR` | `ORDER_PACKER` |
|---|---|:---:|:---:|:---:|:---:|:---:|
| `website` | Store pages, visual builder, theme & SEO | **Edit** | **Edit** | None | **Edit** | None |
| `content` | Services, portfolio, team, menu, downloads | **Edit** | **Edit** | None | **Edit** | None |
| `leads` | Customer inquiries, assignment, notes & status | **Edit** | **Edit** | **Edit** | None | None |
| `bookings` | Appointments, table reservations & scheduling | **Edit** | **Edit** | **Edit** | None | None |
| `analytics`| Traffic, campaign UTMs & lead conversion | **View** | **View** | None | None | None |
| `marketing`| Meta Pixel, Conversions API, banner announcements | **Edit** | **Edit** | None | None | None |
| `orders` | Commerce orders, courier dispatch, COD fraud | **Edit** | **Edit** | **View** | None | **Edit** |
| `products`| Commerce catalog, inventory & variant prices | **Edit** | **Edit** | **View** | **Edit** | **Edit** |
| `billing` | Payment gateways, plan tier, domain DNS | **Edit** | None | None | None | None |
| `team` | Staff accounts, roles, and audit trail | **Edit** | None | None | None | None |

*Note: High-risk customer data exports (`/api/admin/leads/export`) require explicit `STORE_OWNER` role; ordinary edit rights do not permit bulk data dumping.*

---

### 2.2 Platform Super-Admin Permissions (`packages/core/src/platform/admin.ts`)

| Platform Area | `OWNER` | `FINANCE` | `SUPPORT_LEAD` | `SUPPORT` |
|---|:---:|:---:|:---:|:---:|
| `tenants` (View Directory & Filter) | **Edit** | **View** | **View** | **View** |
| `mode_transition` (Dry-run & Apply) | **Edit** | None | **Controlled Edit** | None |
| `plans` (Tier Limits & Pricing) | **Edit** | **View** | **View** | None |
| `payments` (bKash & MFS Settlements) | **Edit** | **Edit** | **View** | None |
| `templates` (Theme & Manifest Rollouts)| **Edit** | None | **Controlled Edit** | **View** |
| `diagnostics` (Domain & Tracking Health)| **Edit** | **View** | **Edit** | **Edit** |
| `unredacted_data` (PII Escapes) | **Two-Person Approval** | None | **Temporary Approval**| None |
| `support_access` (Tenant Impersonation)| **Approve** | None | **Approve** | **Request** |
| `abuse` (Quarantine / Suspension) | **Edit** | None | **Edit** | **Escalate** |

---

## 3. Public API Request & Response Schemas

### 3.1 Public Lead Submission (`POST /api/site/leads`)

#### Request Headers & Validation Rules
- `Content-Type`: `application/json` (max body size: 16 KB)
- `Idempotency-Key`: Optional UUID string. Cached for 60 seconds to deduplicate double-clicks.
- Rate Limiting: Max 5 submissions/hour per client IP; max 3 submissions/hour per phone number.
- Bot Shield: Rejects if honeypot `hp` contains text, or `elapsedMs` < 1500ms.

#### TypeScript & Zod Validation Contract
```typescript
import { z } from "zod";

export const CreatePublicLeadSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  phone: z.string().trim().regex(/^01[3-9]\d{8}$/, "Please enter a valid 11-digit Bangladeshi mobile number"),
  email: z.string().trim().email("Please enter a valid email address").max(120).optional().nullable(),
  message: z.string().trim().max(1500).optional().nullable(),
  type: z.enum(["CONTACT", "QUOTE", "APPOINTMENT", "RESERVATION", "MEDIA_BOOKING"]).default("CONTACT"),
  sourcePage: z.string().trim().max(200).optional().nullable(),
  utmSource: z.string().trim().max(100).optional().nullable(),
  utmMedium: z.string().trim().max(100).optional().nullable(),
  utmCampaign: z.string().trim().max(100).optional().nullable(),
  referrer: z.string().trim().max(300).optional().nullable(),
  locale: z.enum(["en", "bn"]).default("en"),
  // Strict typed metadata allow-list (rejects arbitrary polluted payloads)
  metadata: z.object({
    serviceId: z.string().max(80).optional(),
    serviceTitle: z.string().max(120).optional(),
    preferredTime: z.string().max(60).optional(),
    companySize: z.string().max(40).optional(),
    budgetRangeBdt: z.string().max(40).optional(),
  }).strict().optional().nullable(),
  // Anti-Bot fields
  hp: z.string().max(100).optional().nullable(),
  elapsedMs: z.number().int().nonnegative().optional().nullable(),
  // Attribution & Deduplication
  eventId: z.string().max(100).optional().nullable(),
  consentGiven: z.boolean().default(true),
  consentTextVersion: z.string().max(40).default("v2026.1"),
});
```

#### Success Response (`200 OK`)
```json
{
  "ok": true,
  "data": {
    "id": "cly891024000108l4f192abc",
    "type": "CONTACT",
    "status": "NEW",
    "whatsAppFollowUpUrl": "https://wa.me/8801712345678?text=%E0%A6%86%E0%A6%B8%E0%A6%B8%E0%A6%BE%E0%A6%B2%E0%A6%BE%E0%A6%AE%E0%A7%81%20%E0%A6%86%E0%A6%B2%E0%A6%BE%E0%A6%87%E0%A6%95%E0%A7%81%E0%A6%AE..."
  },
  "requestId": "req_lead_91823901"
}
```

#### Safe Error Responses
- `429 Too Many Requests`: `{"ok": false, "error": "Too many inquiry attempts. Please try again in an hour.", "code": "RATE_LIMITED", "requestId": "req_..."}`
- `400 Bad Request`: `{"ok": false, "error": "Please enter a valid 11-digit Bangladeshi mobile number", "code": "VALIDATION_FAILED", "field": "phone", "requestId": "req_..."}`

---

### 3.2 Public Booking & Reservation (`POST /api/site/booking-requests`)

#### Validation Contract
```typescript
export const CreatePublicBookingSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^01[3-9]\d{8}$/),
  email: z.string().trim().email().max(120).optional().nullable(),
  serviceName: z.string().trim().max(100).optional().nullable(),
  providerName: z.string().trim().max(100).optional().nullable(),
  requestedDate: z.string().datetime().optional().nullable(),
  requestedTime: z.string().trim().max(60).optional().nullable(),
  partySize: z.number().int().min(1).max(100).optional().nullable(),
  message: z.string().trim().max(1000).optional().nullable(),
  type: z.enum(["APPOINTMENT", "RESERVATION"]).default("APPOINTMENT"),
  sourcePage: z.string().trim().max(200).optional().nullable(),
  hp: z.string().max(100).optional().nullable(),
  elapsedMs: z.number().int().nonnegative().optional().nullable(),
  eventId: z.string().max(100).optional().nullable(),
  consentGiven: z.boolean().default(true),
});
```

---

## 4. Capability & Module Reconciliation Table

This table reconciles legacy commerce add-on apps with core BizTrack Business capabilities into a single source of truth (`packages/core/src/site/capabilities.ts`):

| Capability Key | Customer-Facing Name | Mode Baseline | Vertical Baseline | Min Plan Tier | Dependent Storefront Routes | Dependent Admin Workspaces |
|---|---|---|---|:---:|---|---|
| `website_builder` | Visual Section Builder | `ALL` | All Verticals | STARTER | `/`, `/[slug]` | `/builder`, `/design` |
| `custom_domain` | Custom Domain & SSL | `ALL` | All Verticals | STARTER | Root Host Resolver | `/settings/domains` |
| `leads` | Customer Lead Inbox | `ALL` | All Verticals | STARTER | `/contact`, `/api/site/leads`| `/leads` |
| `services` | Services & Pricing Cards | `BUSINESS`, `HYBRID` | Clinic, Agency, Corporate | STARTER | `/services` | `/services` |
| `portfolio_items` | Case Studies & Projects | `BUSINESS`, `HYBRID` | Agency, Personal, Public | STARTER | `/case-studies` | `/portfolio` |
| `team_profiles` | Practitioner & Staff Bio | `BUSINESS`, `HYBRID` | Clinic, Agency, Corporate | STARTER | `/about`, `/team` | `/team-members` |
| `credentials` | Credentials & Testimonials | `BUSINESS`, `HYBRID` | Clinic, Personal, Public | PRO | `/credentials` | `/credentials` |
| `menu` | Digital Restaurant Menu | `BUSINESS`, `HYBRID` | Restaurant | STARTER | `/menu` | `/menu` |
| `booking_requests` | Booking & Reservations | `BUSINESS`, `HYBRID` | Restaurant, Clinic, Agency| PRO | `/reservations`, `/appointment`| `/bookings` |
| `public_events` | Public Appearances & Events| `BUSINESS`, `HYBRID` | Public Figure, Corporate | PRO | `/events` | `/events` |
| `downloads` | Gated Lead Magnets & CV | `ALL` | All Verticals | STARTER | `/api/downloads/[id]` | `/downloads` |
| `commerce` | Online Cart, COD & Couriers| `ECOMMERCE`, `HYBRID` | Retail / Physical Goods | STARTER | `/products`, `/cart`, `/checkout`| `/products`, `/orders` |
| `meta_pixel_capi` | Meta Pixel & Edge CAPI | `ALL` | All Verticals | STARTER | Client Pixel + Server CAPI | `/settings/integrations` |

---

## 5. Schema Delta & Data-Change Proposal

The following additive Prisma migrations are authorized for execution in Phase 1:

### 5.1 Add Direct Assignment to `SiteLead`
```prisma
// File: packages/db/prisma/schema.prisma

model SiteLead {
  // Existing fields...
  id             String         @id @default(cuid())
  tenantId       String
  type           SiteLeadType   @default(CONTACT)
  status         SiteLeadStatus @default(NEW)
  name           String
  phone          String?
  email          String?
  message        String?
  
  // Phase 1 Additions:
  assignedToUserId String?      // Staff actor responsible for this lead
  
  // Relations:
  activities     SiteLeadActivity[]
  
  @@index([tenantId, assignedToUserId])
}
```

### 5.2 Add Immutable `SiteLeadActivity` Model
```prisma
enum LeadActivityType {
  STATUS_CHANGED
  ASSIGNED
  NOTE_ADDED
  WHATSAPP_CLICKED
  CALL_LOGGED
  EMAIL_DISPATCHED
}

model SiteLeadActivity {
  id           String           @id @default(cuid())
  tenantId     String
  leadId       String
  actorId      String           // Staff user ID or "VISITOR" or "SYSTEM"
  actorName    String
  activityType LeadActivityType
  note         String?          @db.Text
  beforeStatus SiteLeadStatus?
  afterStatus  SiteLeadStatus?
  metadata     Json?            // e.g. { durationSecs: 180, templateUsed: "booking_confirmation" }
  createdAt    DateTime         @default(now())

  lead         SiteLead         @relation(fields: [leadId], references: [id], onDelete: Cascade)

  @@index([tenantId, leadId, createdAt])
}
```

### 5.3 Add `TenantOperation` for Guarded Mode Transitions
```prisma
enum TenantOperationType {
  MODE_TRANSITION
  TEMPLATE_SEED
  DOMAIN_TRANSFER
}

enum TenantOperationStatus {
  PENDING
  COMPLETED
  FAILED
  ROLLED_BACK
}

model TenantOperation {
  id             String                @id @default(cuid())
  tenantId       String
  actorId        String
  type           TenantOperationType
  status         TenantOperationStatus @default(PENDING)
  sourceMode     SiteMode?
  targetMode     SiteMode?
  impactSnapshot Json                  // Capabilities changed, routes affected, before-state
  errorMessage   String?
  createdAt      DateTime              @default(now())
  updatedAt      DateTime              @updatedAt

  tenant         Tenant                @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, createdAt])
}
```

---

## 6. Pilot Acceptance Checklist (5–10 Business Stores)

### 6.1 Pilot Merchant Cohorts
1. **Cohort A — Dhaka Bistro (Restaurant)**:
   - Digital menu viewing with dietary badges.
   - Table reservation request (`partySize: 4`, requested time: 8:30 PM).
   - Instant WhatsApp follow-up link generation.
   - Merchant receives inquiry in `/bookings`, assigns to staff, marks `CONFIRMED`.
2. **Cohort B — Modern Eye & Dental Clinic (Healthcare / Clinic)**:
   - Doctor chamber profile display with verified degrees (`MBBS, FCPS`).
   - Appointment request without medical diagnosis fields (privacy compliance).
   - Patient download card for pre-op guide (W3C APG modal with phone capture).
   - Merchant lead review in `/leads` with note addition.
3. **Cohort C — Apex Creative Agency (Professional Services / Corporate)**:
   - High-fidelity case study gallery.
   - Project quote request with company size and budget selection.
   - Automated conversion tracking via Meta Pixel and CAPI deduplication.
4. **Cohort D — Dual-Engine Hybrid Store (Fashion Retail + Tailoring Consultation)**:
   - Simultaneous active ecommerce catalog with cart and bKash checkout.
   - Custom tailoring measurement booking desk functioning concurrently.

### 6.2 Strict Acceptance Criteria
- [ ] **Zero 404 Routes**: All vertical sub-pages (`/services`, `/appointment`, `/menu`, `/case-studies`) render without 404s.
- [ ] **Sub-100ms TTFB**: Storefront HTML loads in <100ms from Dhaka edge cache.
- [ ] **Bot Rejection**: 100% of honeypot and <1500ms automated submissions cleanly dropped to `SPAM` status.
- [ ] **Data Preserved on Mode Switch**: Switching from `ECOMMERCE` to `HYBRID` leaves 100% of product inventory and historical orders untouched.
- [ ] **Staff Permission Guards**: Content Editor accounts are blocked (`403 Forbidden`) from viewing customer phone numbers and payment keys.

---
**Approval Status:** Confirmed and locked for Phase 1 execution.
