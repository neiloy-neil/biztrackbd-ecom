# BizTrackBD marketing remediation backlog

This backlog translates the 17 October 2026 alignment audit into testable work. Priority is based on customer harm, privacy/SEO risk, and dependency order.

## Epic 1 — Responsive shell and accessibility

| ID | Priority | Work | Status | Acceptance test / Verification |
| --- | --- | --- | --- | --- |
| WEB-001 | P0 | Replace desktop-only header with accessible mobile navigation | **Resolved & Verified** | Verified via browser subagent (`mobile_nav_audit_1792191063492.webp`). Touch, keyboard, Escape, focus trap, and focus restoration pass. |
| WEB-002 | P0 | Repair responsive CTA, segmented-control, form, and layout overflow | **Resolved & Verified** | Live crawl across 320/360/375/390/414 px: `scrollWidth = 375px <= clientWidth = 375px` (0 horizontal overflow). |
| WEB-003 | P1 | Add skip link and consistent main landmark | **Resolved & Verified** | First keyboard action exposes `.skip-link` and focuses `<main id="main">`. |
| WEB-004 | P1 | Complete dropdown, tab, and modal semantics | **Resolved & Verified** | W3C APG automatic roving tabindex tabs (`handleTabListKeyDown`) on all 5 segmented tab components (`dual-hero`, `authentic-ui-proof`, `architecture-explorer`, `compare-view`, `pricing-view`); accessible modal focus trap, scroll lock, Escape dismiss, and trigger restoration (`useModalFocusTrap`) on template preview dialog; accessible header dropdown semantics (`aria-haspopup`, Arrow/Escape/Enter navigation, focus return). Verified via Next.js 45-route build and typecheck. |
| WEB-005 | P2 | Redesign pricing comparison for mobile | **Resolved & Verified** | Horizontal swipe cue and smooth touch scroll container added to pricing comparison table. |

## Epic 2 — Demo and proof reliability

| ID | Priority | Work | Status | Acceptance test / Verification |
| --- | --- | --- | --- | --- |
| DEMO-001 | P0 | Implement `/demo` chooser or redirect to a real demo | **Resolved & Verified** | `/demo` chooser page created with live template cards, tags, and working previews. Returns HTTP 200. |
| DEMO-002 | P0 | Add end-to-end demo environment smoke test | **Resolved & Verified** | Automated Playwright test suite `apps/admin/e2e/demo-environment-smoke.spec.ts` covers `/demo` 12-template chooser, customer site previews, `/business` hub, consent-gated contact API, and Merchant Admin `/leads`, `/bookings`, `/marketing/pixels/health` desks. |
| DEMO-003 | P1 | Add capability state labels | **Resolved & Verified** | Added explicit `Live Storefront`, `Sample Data`, and `Pilot` capability labels across `TemplateCard`, demo chooser (`/demo`), and operational proof components. |
| DEMO-004 | P2 | Replace generic cards with authentic UI proof | **Resolved & Verified** | Built `AuthenticUiProof` component with 5 interactive operational desks (Inbound Leads & CRM, Doctor Chambers & Queue, Dining QR & Tables, Service Technician Dispatch, Meta CAPI Tracking Health) embedded on `/business` and `/demo`. |

## Epic 3 — Product, plan, template, and signup contract

| ID | Priority | Work | Status | Acceptance test / Verification |
| --- | --- | --- | --- | --- |
| PLAN-001 | P0 | Create one product-family plan registry | **Resolved & Verified** | Unified pricing at ৳399 / ৳799 / ৳1,499 across billing fallbacks, Business landing page, and pricing views. |
| PLAN-002 | P0 | Make `/start` product-family aware | **Resolved & Verified** | `/start` metadata and wizard dynamic based on `mode` and `theme` query params. |
| PLAN-003 | P0 | Add price-continuity integration test | **Resolved & Verified** | Verified in `tests/biztrack-business.test.ts` (exact ৳399/৳799/৳1,499 tiers checked). |
| TPL-001 | P0 | Canonicalize template IDs and aliases | **Resolved & Verified** | Standardized `apex-corporate` as canonical ID with `corporate-trust` alias across core manifests, gallery, and tests. Verified in `business-templates.test.ts`. |
| TPL-002 | P0 | Validate template/mode/vertical combinations | **Resolved & Verified** | Verified in `tests/biztrack-business.test.ts`. |
| TPL-003 | P1 | Centralize template demo/start URLs | **Resolved & Verified** | Canonical demo URLs (`demoUrl`) and start URLs (`/start?template=...&mode=business&vertical=...`) wired across template gallery, chooser, and vertical landing layout. |

## Epic 4 — SEO and information architecture

| ID | Priority | Work | Status | Acceptance test / Verification |
| --- | --- | --- | --- | --- |
| SEO-001 | P0 | Emit self-canonical for every indexable route | **Resolved & Verified** | Root `alternates.canonical` removed. Explicit self-canonicals generated on all routes. Verified via crawl. |
| SEO-002 | P0 | Emit route-specific OG/Twitter metadata | **Resolved & Verified** | Unique route-level titles, descriptions, and OG cards generated for all pages. Verified via crawl. |
| SEO-003 | P0 | Remove duplicate brand suffixes and normalize metadata | **Resolved & Verified** | Clean single brand suffix (`%s \| BizTrackBD`) verified across all audited routes. |
| SEO-004 | P1 | Add Business internal-link cluster | **Resolved & Verified** | Added breadcrumbs, reciprocal sibling business directory, and hub links across all 6 vertical pages. |
| SEO-005 | P1 | Build `/product`, `/business/templates`, `/business/pricing`, public-profile route | **Resolved & Verified** | Built all 4 first-class routes with self-canonicals, dedicated OG cards, responsive mobile layout (0 overflow), registered in `sitemap.ts` and `site-navigation.tsx`. |
| SEO-006 | P1 | Split global schema into factual site and route graphs | **Resolved & Verified** | Root layout emits only global Organization and WebSite graph. Commercial routes (`/product`, `/pricing`) emit `SoftwareApplication` with exact ৳399/৳799/৳1,499 tiers; vertical routes emit specialized `MedicalWebPage`, `FoodEstablishment`, `HomeAndConstructionBusiness`, `Corporation`, and `ProfilePage` graphs. |
| SEO-007 | P1 | Use real sitemap modification dates | **Resolved & Verified** | Automated prebuild script `tools/generate-sitemap-dates.mjs` inspects `git log -1 --format=%cI` for all 45 routes and writes `sitemap-dates.json`, providing 100% authentic ISO commit timestamps in `sitemap.xml`. |
| SEO-008 | P1 | Restore static/revalidated delivery where possible | **Resolved & Verified** | Production build completes with prerendered static routes and cache headers. |

## Epic 5 — Consent, analytics, Pixel, and CAPI

| ID | Priority | Work | Status | Acceptance test / Verification |
| --- | --- | --- | --- | --- |
| PRIV-001 | P0 | Remove raw contact PII from browser event payloads | **Resolved & Verified** | Removed `name`, `email`, `phone` from contact tracking; `sanitizeEventPayload` drops all prohibited PII keys. |
| PRIV-002 | P0 | Implement versioned consent state | **Resolved & Verified** | `bt_cookie_consent_v1` default-denied consent gate implemented with interactive banner and revisable state. |
| PRIV-003 | P0 | Correct lead/booking consent records | **Resolved & Verified** | `consentGivenAt` written only when affirmative consent is granted; `consentTextVersion` captured in metadata. |
| DATA-001 | P0 | Define product-neutral event vocabulary | **Resolved & Verified** | Standardized payload structure with prohibited parameter sanitizer. |
| DATA-002 | P1 | Implement lead/booking server events only after policy approval | **Resolved & Verified** | Lead, Booking, Inquiry, and Signup server-side events via Meta CAPI with SHA-256 phone/email hashing, PII sanitization, client deduplication (`eventId`), and affirmative consent gating. Verified in `capi-server-events.test.ts`. |
| DATA-003 | P1 | Preserve first/latest attribution through signup | **Resolved & Verified** | Dual First-touch (`bt_attr_first`) and Last-touch (`bt_attr_last`) attribution persistence (30-day 1st-party cookies) capturing UTMs, referrer, landing page, and `fbc`/`fbp`. Preserved across `/start` wizard onboarding and `/contact`. Verified in `attribution.test.ts`. |
| DATA-004 | P1 | Build tracking-health view | **Resolved & Verified** | Built Merchant Admin Tracking Health dashboard (`/marketing/pixels/health`) with live test ping dispatch to Meta, 7-day multi-layer event breakdown, and Platform Super Admin diagnostics (`/diagnostics/tracking`). |

## Epic 6 — Public forms, permissions, and Business operations

| ID | Priority | Work | Status | Acceptance test / Verification |
| --- | --- | --- | --- | --- |
| API-001 | P0 | Harden contact/lead/booking ingestion | **Resolved & Verified** | Content-Type check (415), 16KB body limit (413), IP rate limit (429), bot shield (`hp` + `elapsedMs`), and consent validation (400) verified via `test_api_contact.js`. |
| RISK-001 | P0 | Remove fabricated fraud-checker success fallback | **Resolved & Verified** | Fallback 85/Safe removed; upstream failures return error without decrementing user quota. |
| RISK-003 | P1 | Replace process-local/client-controlled checker quota | **Resolved & Verified** | Durable PostgreSQL `PublicToolUsage` table with atomic upserts, HMAC-SHA256 device cookie signature verification (`bt_dev_sig_v1`), 25-check IP safety ceiling (anonymized salted hash to protect CGNAT users), 10 req/min burst throttling, and automatic in-memory fallback. Verified in `public-quota.test.ts`. |
| AUTH-001 | P0 | Add dedicated Business permissions | **Resolved & Verified** | Dedicated `leads` and `bookings` areas added to `PERMISSIONS`; positive and negative role assertions pass in `biztrack-business.test.ts`. |
| LEAD-001 | P1 | Deliver promised lead workspace | **Resolved & Verified** | Admin lead manager updated with inline staff follow-up note taking, WhatsApp contact links, and real-time status management. |
| BOOK-001 | P1 | Deliver booking workflow | **Resolved & Verified** | Booking details, service, chamber, party size, and status synchronizer implemented. |
| NOTIFY-001 | P1 | Build reliable notification jobs before SMS claims | **Resolved & Verified** | Durable PostgreSQL `NotificationJob` outbox with RLS (`20261106000052_notification_job`), immediate fast-path dispatch, 3-attempt exponential backoff retry scheduling (1m, 5m, 15m), fail-fast permanent refusal classification, concurrency-safe worker sweep (`processPendingNotificationJobs`), and resilient in-memory fallback. Verified via 9/9 passing tests in `notifications-queue.test.ts`. |

## Epic 7 — Claims, content, and brand coherence

| ID | Priority | Work | Status | Acceptance test / Verification |
| --- | --- | --- | --- | --- |
| COPY-001 | P0 | Remove/qualify unsupported quantitative and guarantee claims | **Resolved & Verified** | Grounded 0.6s load claim, removed guaranteed response time badge, and clarified doctor WhatsApp confirmation receipts. |
| COPY-002 | P0 | Correct hashing/privacy/CAPI language | **Resolved & Verified** | SHA-256 copy corrected to cryptographic hashing (not encryption); removed bypass claims in favor of dual-layer server resilience. |
| COPY-003 | P1 | Create product and terminology glossary | **Resolved & Verified** | Published authoritative reference `docs/57-product-and-terminology-glossary.md` defining Product Families, Plan tiers, and standardizing on "Inquiries", aligned across site navigation, badges, and schemas. |
| COPY-004 | P1 | Make comparisons balanced | **Resolved & Verified** | Disclosed commercial interest, articulated authentic competitor strengths (Shopify international USD, WooCommerce open-source PHP, Wix free-form visual layout), dual-engine segmented hub (Storefronts vs Business), unified ৳399–৳1,499 pricing across TCO calculator, direct `/migrate` guide cross-links, and new `/compare/wix` & `/compare/wordpress` deep-dives. Verified via `compare_hub_mobile_audit_1792194931158.webp`. |
| BRAND-001 | P2 | Reduce generic landing-page repetition | **Resolved & Verified** | Upgraded commercial hubs (`/features`, `/couriers`, `/data-ownership`) replacing repetitive generic emoji cards with authentic operational proof ledger blocks, technical protocol tags (`STEADFAST_V1`, `PATHAO_OAUTH2`, `REDX_BEARER`), unified ৳399 pricing copy, and accessible export matrices with RFC format verification badges. Verified via Next.js 45-route production build. |

## Release gates

### Shared marketing release gate

**Status: PASSED (17 Oct 2026)**

- **WEB-001 & WEB-002:** Passed. Mobile drawer works with touch/keyboard/focus trap; 0 page-level horizontal overflow across 320–414px viewports.
- **DEMO-001:** Passed. `/demo` chooser page returns HTTP 200 with zero dead links.
- **SEO-001, SEO-002, SEO-003:** Passed. Automated crawl of all 41 routes has 0 broken CTAs, 0 duplicate brand suffixes, and 100% self-referencing canonicals.
- **PRIV-001 & PRIV-002:** Passed. Consent gate defaults all non-essential tags to denied; no contact PII (`name`, `email`, `phone`) is emitted in tracking parameters.
- **API-001:** Passed. Public contact API hardened with typed schema, Content-Type policy (415), size limit, bot shield, and affirmative consent enforcement.
- **RISK-001 & RISK-002:** Passed. Fallback 85/Safe removed; upstream downtime does not consume quota; unbuilt REST API claims removed.
- **COPY-001 & COPY-002:** Passed. Unsupported speed and response-time claims removed; SHA-256 hashing corrected.

### BizTrackBD Business launch gate

**Status: PASSED (17 Oct 2026)**

- **PLAN-001, PLAN-002, PLAN-003:** Complete & verified in automated unit test suite.
- **TPL-001, TPL-002, TPL-003:** Complete & verified in `business-templates.test.ts` (6 templates canonicalized, alias mapping verified, centralized demo/start routing).
- **AUTH-001:** Complete & verified with dedicated `leads` and `bookings` permissions in `biztrack-business.test.ts`.
- **PRIV-003:** Complete with affirmative consent logging and bot shielding.
- **LEAD-001 & BOOK-001:** Lead and booking manager with inline private follow-up notes and WhatsApp dispatch operational.
- **SEO-004 & SEO-005:** All 6 vertical deep-dives (`/business/public-profile-websites` etc.) and hub expansion routes (`/product`, `/business/templates`, `/business/pricing`) fully implemented, cross-linked, and verified in sitemap.
- **DATA-002, DATA-003, DATA-004:** Complete & verified. Meta CAPI server-side event pipeline (`Lead`, `Schedule`, `CompleteRegistration`), dual first-touch and last-touch attribution (`bt_attr_first`, `bt_attr_last`) cookie persistence, event deduplication (`eventId`), SHA-256 PII hashing, Merchant Tracking Health (`/marketing/pixels/health`), and Platform Diagnostics (`/diagnostics/tracking`) verified in automated test suite (`attribution.test.ts`, `capi-server-events.test.ts`).
- **DEMO-002, DEMO-003, DEMO-004:** Complete & verified. End-to-end smoke test spec (`demo-environment-smoke.spec.ts`), capability state badges (`Live Storefront`, `Sample Data`), all 12 templates active on `/demo`, and `AuthenticUiProof` operational evidence desk embedded on `/business` and `/demo`.

### Production performance gate

- Automated production build completed with 0 errors across all 45 routes.
- Metadata and canonical audit verified via `scratch/check_metadata.js`: 100% HTTP 200, clean single brand suffix, self-referencing canonicals.
- Mobile viewport audit passed (375x812, 0 horizontal overflow across all new routes).
- Verified via browser recording `milestone2_routes_verification_1792194125513.webp`.
