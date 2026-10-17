# BizTrack Business — Platform Admin, Merchant Dashboard, Backend and API Plan

**Status:** Design and architecture plan only; no application code is authorized by this document.  
**Prepared:** 17 October 2026  
**Depends on:** `51-biztrack-business-master-plan.md` and `53-biztrackbd-marketing-website-research-and-design-brief.md`  
**Product scope:** BizTrackBD Ecommerce, BizTrack Business, and Hybrid tenants on one platform

## 1. Executive decision

BizTrack Business should not receive a second backend or a disconnected admin product. It should use the existing multi-tenant platform, database, authentication, audit, billing, domain, builder, module, and support foundations. The product surface changes according to the tenant's site mode, vertical, plan, capabilities, and staff permissions.

The platform therefore has three connected operating surfaces:

1. **Public website/storefront** — what a tenant's visitors see.
2. **Merchant dashboard** — where the tenant builds the site and manages inquiries, bookings, content, marketing, staff, and billing.
3. **BizTrackBD platform control plane** — where authorized BizTrackBD staff operate tenants, plans, capabilities, templates, domains, abuse controls, support, privacy, and platform health.

The backend remains the authority. Hiding a navigation item is never treated as authorization. Every read and mutation must enforce tenant, actor, permission, capability, plan entitlement, and resource state on the server.

## 2. What already exists

The repository is materially ahead of a blank-slate design. The new plan should extend the following assets instead of rebuilding them.

| Area | Existing foundation | Design conclusion |
|---|---|---|
| Tenant product type | `siteMode` and `businessVertical` | Keep one tenant model and make all dashboards mode-aware. |
| Modes | `ECOMMERCE`, `PORTFOLIO`, `HYBRID` | Display `PORTFOLIO` as **BizTrack Business** in customer-facing language. Consider an internal rename only through a separate compatibility migration. |
| Business capabilities | Leads, services, portfolio items, team profiles, credentials, menu, booking requests, events, downloads | Use this resolver as the single capability authority after entitlement cleanup. |
| Business data | Leads, booking requests, menu categories/items, content items, downloads | Reuse these models and add workflow records only where a real operational gap exists. |
| Merchant interface | Leads, Services, Portfolio, Team, Menu, Downloads, Pages, Content, Design | Consolidate these into a coherent mode-aware information architecture. |
| Merchant home | A Business/portfolio command center already shows leads, bookings, content and setup progress | Evolve it into a complete activation and operations dashboard. |
| Public capture | Lead and booking routes derive the tenant from the resolved host | Keep host-derived tenancy; harden validation, abuse protection, idempotency and privacy. |
| Platform admin | Tenants, payments/plans, domains, themes/modules, inquiries, support, announcements, usage, team/audit, settings | Extend this control plane with Business-specific filters, health, templates, capabilities and privacy tooling. |
| Audit and impersonation | Platform and tenant audit foundations exist | Require reason, expiry, notification policy and least-privilege support access. |

### 2.1 Gaps that should be treated as priority defects

- Leads and bookings currently reuse the broad `customers` permission area. Business needs dedicated permissions so a content editor, receptionist, salesperson, and analyst can be separated safely.
- Public lead metadata is too open-ended. Form-specific allow-lists should replace arbitrary client-supplied JSON.
- Honeypot and minimum-submit-time controls exist, but distributed rate limiting, origin policy, payload limits, idempotency, bot scoring, and operational abuse visibility are still needed.
- Platform metrics remain commerce-heavy. Business activation, publishing, lead response, booking, form health, domain health, and tracking health need first-class reporting.
- The older module catalogue and newer Business capability resolver overlap. For example, booking concepts must not be represented differently in two entitlement systems.
- Mode transitions need a controlled workflow. Directly changing a string is unsafe when navigation, content, entitlements, billing and public routes depend on the result.
- Platform support should not expose lead bodies or personal information merely because a staff member can open a tenant record.

## 3. Target system shape

```text
Marketing site / signup
          |
          v
Tenant provisioning ---- Plan + capabilities ---- Template seed/version
          |                         |
          v                         v
Merchant dashboard -------- Core domain services -------- Background jobs
          |                         |                         |
          v                         v                         v
Published website -------- Tenant-scoped database ------ Notifications/events
          |                         |
          +------ Analytics --------+
                                    |
                                    v
                       Platform control plane
```

### 3.1 Architectural boundaries

- `apps/storefront` owns public rendering and narrowly scoped visitor submissions.
- `apps/admin` owns authenticated tenant operations.
- `apps/platform` owns cross-tenant platform operations.
- `packages/core` owns authorization, validation, workflows, audit and business rules.
- `packages/db` owns tenant-safe persistence, constraints, indexes and migrations.
- Public routes never accept a browser-provided tenant ID as authority.
- Admin and platform pages call core services; they do not embed business rules in UI actions.
- Cross-tenant reads require a platform actor and explicit platform permission.
- Background jobs use a system actor, stable idempotency key and auditable outcome.

## 4. Platform admin control plane

The platform dashboard is not a larger version of the merchant dashboard. It is an operational control plane focused on platform health, entitlements, support, safety and governance.

### 4.1 Platform overview

The first screen should answer four questions within seconds:

1. Is the platform healthy?
2. Are customers activating successfully?
3. What requires human attention now?
4. Where are revenue, adoption or abuse trends changing?

Recommended top-level metrics:

| Metric group | Measures |
|---|---|
| Business | Active Business sites, published sites, custom-domain sites, leads received, median first-response time, booking requests |
| Commerce | Active stores, GMV, orders, payment health and fulfilment indicators already supported |
| Hybrid | Published Hybrid sites, commerce-enabled rate, leads, orders and cross-mode conversion |
| Activation | Signup → template selected → first page edited → published → domain connected → first lead/order |
| Revenue | MRR/ARR, trials, trial-to-paid, churn, expansion, add-on revenue, revenue by product family |
| Reliability | Form success rate, job failures, webhook failures, domain/SSL failures, publish failures, tracking health |
| Safety | Spam spikes, suspicious submission velocity, quarantined tenants, expiring support access, privacy requests |

Do not mix unlike metrics into one misleading number. A Business tenant can be successful without GMV, and an Ecommerce tenant can be successful without contact-form leads.

### 4.2 “Needs attention” queue

This is the most important operational component. It should rank actionable items by severity and age:

- domain or SSL verification failing;
- published site unavailable or returning repeated errors;
- lead/booking submissions failing or notification delivery exhausted;
- sudden spam or submission-velocity anomaly;
- pixel or server-event destination repeatedly rejected;
- trial near expiry but site not published;
- usage or storage quota above threshold;
- template deployment or content-seed failure;
- queued privacy export/deletion nearing SLA;
- stale support impersonation session;
- billing state inconsistent with effective entitlements;
- tenant mode transition awaiting completion or rollback.

Every item needs: severity, tenant, owner, first detected, latest occurrence, affected capability, recommended action, audit trail and resolution state.

### 4.3 Tenant directory

Add platform filters that reflect the full product:

- product family: Ecommerce, Business, Hybrid;
- vertical;
- lifecycle: trial, active, past due, read-only, suspended, cancelled;
- activation stage;
- plan and add-ons;
- publish status;
- custom-domain/SSL state;
- effective capabilities;
- lead/order activity band;
- country/language;
- template and template version;
- support or abuse flag;
- date created, last admin activity and last public conversion.

Saved operational views should include “Business trials not published,” “domains failing,” “first lead but no response,” “tracking failures,” “quota risk,” and “Hybrid entitlement mismatch.”

### 4.4 Tenant detail

Recommended tab structure:

1. **Overview** — identity, mode, vertical, lifecycle, activation checklist, health summary and recent audit activity.
2. **Website & content** — publish state, template/version, page counts, locales, SEO completeness, broken public routes and content inventory. Platform staff should see status before content bodies.
3. **Leads & bookings** — aggregate counts, queue health, notification health and status distribution. Personal details stay redacted unless an authorized support escalation grants temporary access.
4. **Subscription & entitlements** — plan, add-ons, promotions, overrides and a human-readable explanation of every effective capability.
5. **Usage & quotas** — storage, traffic, AI usage, pages, staff, submissions, events and delivery limits.
6. **Domains & SEO** — DNS, SSL, canonical host, indexability, sitemap freshness, schema validation and redirect state.
7. **Templates & capabilities** — selected theme/template, seed version, compatibility, feature flags and change history.
8. **Integrations & events** — pixel/CAPI destination health, webhook delivery, email/SMS/WhatsApp notification connections and secret status without revealing secret values.
9. **Support access** — tickets, diagnostics, requested access, impersonation history and customer-visible notes.
10. **Audit, privacy & retention** — actor timeline, exports, deletion requests, consent evidence and retention policy.

### 4.5 Mode-transition workflow

Changing Ecommerce, Business or Hybrid affects too much state for a simple select field. The workflow should be:

1. Select target mode and reason.
2. Run a dry-run impact check.
3. Show capabilities gained/lost, navigation changes, affected public routes, billing change and data that will become hidden.
4. Require an authorized actor and tenant confirmation for billable changes.
5. Create an idempotent transition operation.
6. Apply entitlements and seed only missing content; never overwrite edited tenant content.
7. revalidate routes and publish state.
8. Record before/after state in the audit log.
9. Provide a bounded rollback while no destructive follow-up has occurred.

Existing Ecommerce data should never be deleted when commerce is temporarily disabled. It may be hidden and retained according to policy.

### 4.6 Plans, capabilities and overrides

Use one effective-entitlement equation:

```text
effective capability
= product-family baseline
+ plan entitlements
+ purchased add-ons
+ time-bounded platform override
- global kill switch or maintenance state
```

The platform UI must explain the source of each capability. An override requires a reason, creator, start, expiry and audit record. Avoid scattered booleans and avoid enabling commerce merely because a tenant is not on the lowest plan.

Before implementation, reconcile the legacy module catalogue with Business capabilities. There should be one canonical capability registry with metadata for:

- key and customer-facing label;
- applicable modes and verticals;
- required plan/add-on;
- dependencies and conflicts;
- public/admin routes affected;
- quota definition;
- maintenance/kill-switch state;
- rollout state and minimum template version.

### 4.7 Template governance

The current themes/modules area should evolve into **Templates & Capabilities**. A template needs:

- mode and vertical compatibility;
- preview images and demo URL;
- required/recommended capabilities;
- locale support;
- accessibility, performance and SEO review status;
- seed schema version;
- draft, internal review, pilot, published, deprecated and retired states;
- installation count and activation/conversion indicators;
- migration notes and rollback support.

Publishing a template must never mutate existing sites automatically. Seed installation is versioned and idempotent; upgrades require an explicit migration strategy.

### 4.8 Platform staff roles

Keep current Owner, Finance, Support Lead and Support roles, but split platform permission areas more precisely:

| Platform area | Owner | Finance | Support lead | Support |
|---|---:|---:|---:|---:|
| Tenant status and mode | Edit | View | Controlled edit | View |
| Billing and adjustments | Edit | Edit | Limited | None |
| Plans and entitlements | Edit | View | View | None |
| Templates and rollouts | Edit | None | Controlled edit | View |
| Domains and diagnostics | Edit | View | Edit | Edit |
| Lead/booking diagnostics | Metadata | None | Metadata | Metadata |
| Unredacted customer data | Approval required | None | Temporary approval | None |
| Support access | Approve | None | Approve | Request |
| Audit and privacy | Edit | Relevant view | Relevant view | Own actions |
| Abuse and suspension | Edit | None | Edit | Escalate |

“Metadata” means counts, timestamps, delivery state and redacted identifiers—not inquiry bodies, phone numbers or email addresses.

## 5. Merchant dashboard

The merchant dashboard should feel like one focused product, not Ecommerce navigation with unrelated pages appended.

### 5.1 Mode-aware navigation

**BizTrack Business**

- Home
- Website
  - Pages
  - Design
  - Navigation
  - Media
  - Blog
  - SEO
- Content
  - Services
  - Portfolio/projects
  - Team
  - Credentials/testimonials
  - Vertical content: Menu, Events or Downloads
- Leads
  - Inbox
  - Bookings
  - Tasks/follow-ups
- Marketing
  - Analytics
  - Campaign links/UTMs
  - Pixel & CAPI
- Settings
  - Business profile
  - Domains
  - Languages
  - Team & permissions
  - Billing
  - Audit

**Hybrid** uses the same structure and adds Products, Orders, Customers, Payments, Shipping and commerce reports. **Ecommerce** retains its current commerce-first navigation and exposes business features only when entitled.

### 5.2 Business home dashboard

The dashboard should prioritize action over decoration:

- primary setup progress with the next single recommended action;
- new/unassigned leads;
- booking requests awaiting response;
- overdue follow-ups;
- lead sources and conversion trend;
- website visits and top converting pages;
- domain, publish, form and tracking health;
- recent activity;
- quick actions: add service, publish change, respond on WhatsApp, create campaign link.

Avoid an ecommerce-style revenue dashboard when the tenant does not take transactions through BizTrackBD.

### 5.3 Unified lead workspace

Leads and booking requests should behave like a lightweight operational inbox, not a full CRM.

Required views and actions:

- inbox, assigned to me, unassigned, follow-up due, closed and spam;
- filter by source, form, service, page, campaign, status, assignee and date;
- safe search by name/contact with tenant-scoped indexing;
- lead detail timeline;
- assign owner;
- status and qualification outcome;
- internal note and follow-up date;
- click-to-call, email or WhatsApp;
- booking details and confirmation state;
- export with explicit permission and audit;
- bulk spam/close actions with confirmation;
- saved views after the pilot.

Do not add pipelines, deals, invoicing, email automation and customer-data-platform features until usage proves they are needed.

### 5.4 Merchant permissions

Replace the current broad reuse of `customers` with dedicated areas:

- `website` — pages, navigation and site settings;
- `content` — services, portfolio, team, credentials, menu, events and downloads;
- `leads` — personal inquiry data, assignment, notes and exports;
- `bookings` — booking state and customer communications;
- `analytics` — website and conversion reporting;
- `marketing` — campaign links, pixels and server events;
- existing `commerce`, `billing`, `team` and `audit` responsibilities remain separate.

Suggested roles:

| Role | Website/content | Leads | Bookings | Analytics | Marketing | Billing/team |
|---|---|---|---|---|---|---|
| Owner | Edit | Edit/export | Edit | View | Edit | Edit |
| Manager | Edit | Edit/export if granted | Edit | View | Edit | No billing secrets |
| Content editor | Edit | None | None | Limited | None | None |
| Sales/reception | View | Edit | Edit | Limited | None | None |
| Analyst | View | Redacted/none | Redacted/none | View | View | None |

Export is a separate high-risk action, not implied by ordinary edit access.

## 6. Backend domain design

### 6.1 Reuse before adding tables

Keep the current Tenant, SiteLead, BookingRequest, MenuCategory, MenuItem, SiteContentItem and SiteDownload models. The first implementation should not duplicate these into Business-specific tables.

Likely additions after schema review:

| Record | Why it is needed |
|---|---|
| `SiteLeadActivity` | Immutable lead timeline for status changes, assignments, notes, contact attempts and automated events. |
| `SiteLeadAssignment` or assignment fields | Current owner and assignment history; choose the smallest model that preserves auditability. |
| `SiteFormDefinition` / `SiteFormVersion` | Only when merchants can create forms. Pilot templates can remain typed and fixed. |
| `TenantOperation` | Durable status for provisioning, mode changes, template install and rollback. |
| `TemplateDeployment` | Tenant/template/seed version, installed state and migration history. |
| `EventOutbox` and `WebhookDelivery` | Reliable event publishing and external delivery retries when webhooks launch. |
| Daily analytics aggregates | Fast, privacy-conscious dashboard reporting without querying raw event streams. |

Do not add patient records, diagnoses, prescriptions, symptoms, medical files, real-time clinical scheduling, arbitrary form databases or a generic workflow engine.

### 6.2 Lead and booking state

Recommended lead lifecycle:

```text
NEW -> CONTACTED -> QUALIFIED -> WON
  |         |           |
  +---------+-----------+-> CLOSED
  +------------------------> SPAM
```

Recommended booking request lifecycle:

```text
REQUESTED -> CONTACTED -> CONFIRMED -> COMPLETED
     |            |             |
     +------------+-------------+-> CANCELLED
```

State changes run through explicit transition functions. They write an activity and audit event in the same transaction. A booking remains a request until the business confirms it; the public UI must never imply a guaranteed time slot prematurely.

### 6.3 Tenant isolation and transactions

- Every tenant-owned table has `tenantId` and tenant-first indexes for operational queries.
- Core services receive the tenant from the authenticated or host-resolved server context.
- Row-level security remains defense in depth, not the only protection.
- Mutations involving state plus audit/activity use one transaction.
- Cross-tenant platform queries use a distinct platform client and actor.
- Cache keys, jobs, exports, files and analytics dimensions include tenant identity.
- Unique constraints prevent duplicate idempotent submissions and event delivery.

### 6.4 Notifications and background jobs

Jobs required for a reliable Business product:

- lead/booking owner notification with retry and dead-letter handling;
- notification preference and quiet-hour enforcement;
- domain and SSL health checks;
- analytics rollups;
- usage/quota snapshots and threshold notices;
- webhook delivery and replay;
- tracking destination health checks;
- privacy export/deletion workflow;
- retention-based redaction/deletion;
- template deployment and mode-transition orchestration;
- stale operation recovery and reconciliation;
- audit-safe cleanup of expired support sessions and signed exports.

Each job must be idempotent, observable, tenant-scoped, retry-bounded and safe to replay.

## 7. API strategy

### 7.1 Three API classes

1. **Public visitor API** — minimal submission endpoints from the public site.
2. **Authenticated merchant API** — internal dashboard contract, initially implemented through server actions/core services where appropriate.
3. **Platform API** — private cross-tenant operations for the platform control plane.

An external developer API and outbound webhooks should be a later, explicit product. Do not expose internal admin routes merely by documenting them.

### 7.2 Public visitor endpoints

| Method | Endpoint | Purpose | Required controls |
|---|---|---|---|
| `POST` | `/api/site/leads` | Contact, quote and service inquiry | Host-derived tenant, capability check, typed form schema, rate limit, bot controls, idempotency, consent, safe metadata |
| `POST` | `/api/site/booking-requests` | Appointment/reservation request | All lead controls plus allowed service/resource validation and explicit request-not-confirmation language |
| `GET` | `/api/site/form-config/:key` only if needed | Client-safe labels/options | Public fields only, cacheable, no internal rules or secrets |

The existing booking alias should be deprecated to one canonical endpoint with a measured migration period.

Public submission hardening requirements:

- accept only expected content types and bounded body sizes;
- Zod or equivalent per-form validation with normalized phone/email;
- allow-listed source, UTM and metadata keys with length limits;
- tenant, form and IP/device rate limits in a distributed store;
- honeypot and minimum completion time as supporting signals, not sole defenses;
- optional Turnstile/challenge escalation based on risk;
- `Idempotency-Key` or server-issued form token to prevent duplicate submissions;
- canonical-origin policy and CSRF assessment appropriate to the submission model;
- safe error messages with `requestId`, never raw internal exception text;
- uniform response timing where practical to reduce enumeration;
- no advertising event until consent and server-event policy allow it.

### 7.3 Merchant resource contract

The UI can use server actions initially, but core resources should have a stable contract so mobile clients or a public API can be added later.

Representative resource operations:

- list/get/update/assign leads;
- add a lead note or follow-up;
- list/get/transition booking requests;
- list/create/update/archive services, portfolio items, team members, credentials, menu items, events and downloads;
- get/update site profile, SEO, navigation and tracking settings;
- publish, validate and roll back site versions;
- read analytics aggregates;
- create and revoke exports.

Every mutation requires actor, tenant, permission, capability and expected resource version. Use optimistic concurrency (`version` or `If-Match`) for content edited by multiple staff members.

### 7.4 Platform resource contract

Representative operations:

- query tenants by mode, vertical, lifecycle, activation and health;
- read a redacted tenant operational view;
- run a mode-transition dry run and submit/rollback an operation;
- update plans, add-ons and time-bounded entitlement overrides;
- publish/deprecate templates and inspect deployments;
- inspect domain, form, notification, event and tracking health;
- request/approve/end support access;
- initiate privacy export/deletion workflows;
- quarantine, suspend or restore within role and dual-control policy.

High-risk actions require typed reasons, fresh authentication, confirmation UI and complete before/after audit fields. Selected actions—unredacted-data access, destructive privacy completion, owner-role changes and broad template rollout—should support two-person approval.

### 7.5 Common API conventions

If HTTP endpoints are introduced, use consistent conventions:

```json
{
  "data": {},
  "error": null,
  "requestId": "req_..."
}
```

- version external APIs under `/api/v1`; internal Next routes do not need cosmetic versioning but still need stable service contracts;
- cursor pagination for leads, audit and event histories;
- ISO-8601 timestamps with UTC transport and Dhaka-aware display;
- machine-readable error codes plus safe human messages;
- request/correlation IDs through route, service, job and event delivery;
- idempotency for creates and high-risk transitions;
- optimistic concurrency for updates;
- OpenAPI generated from validated request/response schemas when an external API launches;
- scoped tokens, rotation, last-used display and immediate revocation;
- no secrets or sensitive personal data in URLs, logs or analytics properties.

### 7.6 Events and webhooks

Proposed event names:

- `lead.created`
- `lead.assigned`
- `lead.status_changed`
- `booking.requested`
- `booking.status_changed`
- `site.published`
- `domain.verified`
- `domain.failed`
- `tenant.mode_changed`
- `quota.threshold_reached`
- `tracking.destination_failed`

Use a transactional outbox when events must leave the process. Webhook delivery needs signatures, timestamps, replay protection, exponential retry, endpoint disablement after repeated failure, delivery logs and manual replay. Payloads should be minimal by default; personal fields require an explicit scope and merchant choice.

## 8. Analytics, pixels and CAPI management

### 8.1 One event vocabulary

Define product-neutral events that work across modes:

- `page_view`
- `cta_click`
- `whatsapp_click`
- `phone_click`
- `form_start`
- `lead_submit`
- `booking_request`
- `service_view`
- `portfolio_view`
- `menu_view`
- Ecommerce events such as `view_item`, `add_to_cart`, `begin_checkout` and `purchase`

Each event includes tenant, site mode, page, locale, source/medium/campaign, consent state, stable event ID and timestamp. Never send inquiry text, medical context, phone, email or names as advertising parameters.

### 8.2 Tracking dashboard

Merchant tracking UI should show:

- destination and connection state;
- browser pixel and server event enabled state;
- consent requirements;
- most recent accepted/rejected event;
- event match/deduplication health;
- test-event mode;
- redacted error explanation;
- disconnect/delete action;
- audit history.

Platform staff see destination health and error codes across tenants, not tenant secret values or visitor identities.

### 8.3 Pixel/CAPI correctness

- browser and server copies share an `event_id` for deduplication;
- server events are generated from authoritative backend outcomes, not arbitrary browser claims;
- consent state is propagated and enforced;
- personal identifiers are normalized and hashed only where the destination contract and applicable consent permit it;
- secrets are encrypted and accessed only through the integration vault;
- retries do not create new event IDs;
- destination failures do not fail the lead or booking transaction;
- tracking is observable but isolated from the critical submission path.

## 9. Privacy, security and abuse controls

- Collect the minimum fields each form actually requires.
- Give doctors/clinics a clear prohibition on symptoms, diagnoses, prescriptions and medical files in the generic booking form.
- Store consent text/version and timestamp when consent is the legal basis for a follow-up or tracking action.
- Redact personal data in platform screens, logs, analytics, traces and error reports.
- Define configurable retention for spam, closed leads, exports, delivery logs and raw analytics.
- Encrypt integration secrets and sensitive exports; signed download URLs expire quickly.
- Make CSV exports formula-injection safe and auditable.
- Require reauthentication for exports, secret changes, support access, suspension and privacy actions.
- Apply same-origin/content-type/body-size rules and distributed rate limiting at the edge/API boundary.
- Record actor, tenant, purpose, request ID, IP where appropriate, before/after state and result for privileged actions.
- Support account and tenant erasure without silently breaking financial/audit retention requirements; document retained legal records.

## 10. Observability and service objectives

Operational dashboards should measure:

- public form availability and successful-submission rate;
- p50/p95/p99 submission latency;
- duplicate prevention rate;
- notification queue age and terminal failure count;
- publish success and propagation time;
- domain/SSL verification time;
- webhook and pixel/CAPI acceptance rate;
- mode-transition and template-deployment failures;
- cross-tenant access-denial anomalies;
- privacy-request age;
- Business activation and first-value time.

Initial targets should be established from pilot traffic, then published as internal SLOs. Alerts must be actionable and routed by owning subsystem; avoid alerting on vanity-volume changes alone.

## 11. Delivery sequence

### Phase 0 — Reconcile and baseline

- inventory current screens, services, schemas, migrations and tests against this plan;
- select one canonical capability registry and document migration from legacy modules;
- document current API schemas and threat model;
- define Business activation funnel and event vocabulary;
- decide whether `PORTFOLIO` remains the durable internal mode name;
- create low-fidelity merchant and platform wireframes before implementation.

**Exit:** every proposed change is classified as reuse, hardening, redesign, addition or post-pilot.

### Phase 1 — Security and permission foundation

- introduce dedicated Business permission areas and migrate checks;
- harden public lead/booking validation, metadata, rate limiting and idempotency;
- standardize safe errors and request IDs;
- add lead activity/assignment only if the workflow requires it;
- verify tenant isolation, audit and RLS with negative tests.

**Exit:** the existing Business workflow can be safely piloted without relying on `customers` permissions or weak public submission controls.

### Phase 2 — Merchant operating experience

- ship mode-aware navigation and dashboard;
- consolidate leads/bookings into the operational workspace;
- expose site, domain, form and tracking health;
- implement role-aware Business staff workflows;
- add activation and setup guidance.

**Exit:** pilot tenants can publish, receive, assign, respond to and measure inquiries without platform staff operating the tenant for them.

### Phase 3 — Platform control plane

- add mode/vertical/activation filters and metrics;
- deliver mode-aware tenant detail and needs-attention queue;
- implement entitlement explanation and guarded mode transitions;
- deliver template lifecycle/deployment visibility;
- enforce support-access, privacy and redaction workflows.

**Exit:** BizTrackBD staff can diagnose and operate Business tenants without unsafe direct database work or unrestricted personal-data access.

### Phase 4 — Analytics and reliable integrations

- analytics aggregation and consent-aware event collection;
- pixel/CAPI health and deduplication;
- durable event outbox and webhook deliveries;
- quota, delivery and reliability reporting.

**Exit:** conversion reporting and integrations are traceable end-to-end without being on the critical submission path.

### Phase 5 — External API, only after demand

- validate partner use cases;
- publish scoped `/api/v1` resources and OpenAPI;
- token lifecycle, scopes, quotas and developer logs;
- webhook self-service and replay.

**Exit:** at least one validated integration requires an external API and the internal contract has proven stable.

## 12. Verification matrix

Before release, test at least:

| Concern | Required proof |
|---|---|
| Tenant isolation | Users, jobs, cache, exports and platform views cannot cross tenant boundaries. |
| Permissions | Every Business action has positive and negative tests for relevant roles. |
| Capabilities | UI and service deny unavailable features; global kill switches take effect. |
| Public abuse | Rate, duplicate, oversized, invalid-origin, bot and malformed payload cases fail safely. |
| State transitions | Invalid lead/booking/mode transitions are rejected and valid ones are atomic/audited. |
| Privacy | Redaction, support access, export, retention and deletion paths are verified. |
| Templates | Install is idempotent, edited content is preserved and incompatible capability combinations are blocked. |
| Tracking | Consent, event ID deduplication, secret protection and retry semantics are correct. |
| Reliability | Notification/event retries, dead-letter visibility and replay do not duplicate the primary operation. |
| Accessibility | Merchant and platform workflows are keyboard-usable, labelled and readable at supported breakpoints. |
| Performance | Large lead/audit lists paginate; platform aggregates avoid unbounded cross-tenant scans. |

## 13. What should happen next

The immediate next deliverable should be a **screen-and-contract specification**, not code. It should contain:

1. Low-fidelity wireframes for the Business Home, Lead Workspace, Tracking Health, Platform Overview, Tenant Detail and Mode Transition Review screens.
2. A permission matrix mapped from each visible action to a server-side permission.
3. Request/response schemas for public lead and booking submission, including validation and safe errors.
4. A current-to-target capability/module reconciliation table.
5. A data-change proposal limited to confirmed workflow gaps.
6. A testable acceptance checklist for the 5–10 business pilot.

Only after those six artifacts are approved should implementation be split into security/API foundation, merchant experience, platform control plane and analytics workstreams.

