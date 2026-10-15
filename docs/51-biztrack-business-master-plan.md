# BizTrack Business — Portfolio, Business Website and Hybrid Commerce Master Plan

**Status:** Approved planning baseline; no implementation has started from this document.  
**Prepared:** 16 October 2026  
**Product name:** BizTrack Business  
**Target:** Bangladesh first, Bangla and English  
**Pilot target:** 5–10 real businesses, then public beta  
**Requested first usable release:** 4–6 weeks  

## 1. Executive decision

BizTrackBD should become one multi-tenant website platform with three explicit site modes:

1. **Ecommerce** — the current product and behavior.
2. **Portfolio** — a business or personal website without the commerce operating surface.
3. **Hybrid** — a portfolio/business website with selected commerce capabilities.

The public product family is **BizTrack Business**. The existing ecommerce product remains an Ecommerce-mode experience under the same platform. Existing tenants are migrated to `ECOMMERCE` and must see no navigation, route, storefront, billing, or operational behavior change.

The first launch covers six verticals:

- Restaurant
- Doctor or clinic
- Public figure
- Business or company
- Service provider
- Personal portfolio

The builder remains **section-based drag and drop with responsive presets**. This is a deliberate product choice, not a temporary imitation of a free-form canvas: it is safer on mobile, easier for small-business owners, compatible with the current JSON/version system, and achievable in the pilot window.

## 2. What is feasible in 4–6 weeks

### Pilot commitment

The pilot can include:

- All three site modes and all six vertical choices.
- Ten starter templates.
- Custom domains and subdomains.
- Home and custom pages using the existing draft, preview, publish, history, and rollback system.
- Blog and page-level SEO.
- Contact/lead inbox with WhatsApp and phone actions.
- Request-based appointments and reservations followed by owner confirmation.
- Basic website and lead analytics.
- Structured restaurant menu, public QR menu, downloadable CV/profile file, services, portfolio, credentials, events, and team sections.
- Existing manual bKash/Nagad instructions or safe payment links for deposits; no new card-data handling.
- AI copy and constrained AI page-draft generation using the existing AI gateway and quota system.
- A 5–10 business controlled pilot.

### Post-pilot commitments

The following remain in the product plan but are not pilot release gates:

- Real-time slot inventory, calendar conflict prevention, rescheduling, and two-way calendar sync.
- Full Facebook scraping/import. It depends on permissions and platform APIs and must not rely on brittle page scraping.
- Arbitrary existing-site import. The safe first version is a URL/content import assistant with an explicit review step.
- AI image generation. The media workflow, moderation, provenance, cost controls, and rights confirmation must be completed first.
- Full advance-payment/refund accounting for appointments and reservations.
- Free-position Webflow-style layout editing.
- Patient records, diagnoses, prescriptions, symptoms, or any clinical workflow.

## 3. Product model

### 3.1 Mode, vertical, theme, template, and capability are separate

| Concept | Purpose | Example |
|---|---|---|
| Site mode | Determines the broad operating surface | `ECOMMERCE`, `PORTFOLIO`, `HYBRID` |
| Business vertical | Supplies recommended content and onboarding | `RESTAURANT`, `DOCTOR_CLINIC`, `PUBLIC_FIGURE` |
| Theme/look | Controls visual tokens and component presentation | Existing looks plus future business looks |
| Template | Seeds pages, sections, navigation, and sample content | “Modern Clinic”, “Dhaka Bistro” |
| Capability | Enables behavior and admin/public routes | `leads`, `booking_requests`, `menu`, `commerce` |

A visual template must never silently enable operational behavior. A restaurant template can recommend the menu and reservation capabilities, but the tenant capability resolver remains the authority.

### 3.2 Typed values

Application validation should expose these types even if additive database fields initially use strings to reduce enum-migration risk:

```ts
type SiteMode = "ECOMMERCE" | "PORTFOLIO" | "HYBRID";

type BusinessVertical =
  | "RESTAURANT"
  | "DOCTOR_CLINIC"
  | "PUBLIC_FIGURE"
  | "BUSINESS_COMPANY"
  | "SERVICE_PROVIDER"
  | "PERSONAL_PORTFOLIO";
```

Recommended additive tenant fields:

```prisma
siteMode         String @default("ECOMMERCE")
businessVertical String?
```

The migration must set all existing rows to `ECOMMERCE`. New signups explicitly provide both values. No existing production code may read a new column until the migration is deployed according to the repository's additive-first migration rule.

## 4. Capability matrix

Capabilities are resolved from site mode, plan entitlements, tenant modules, and platform maintenance switches. UI visibility is not authorization; every service enforces the same resolver.

| Capability | Ecommerce | Portfolio | Hybrid | Pilot |
|---|:---:|:---:|:---:|:---:|
| Website builder, pages, blog, media | Yes | Yes | Yes | Yes |
| Custom domain and bilingual SEO | Yes | Yes | Yes | Yes |
| Contact leads and inbox | Yes | Yes | Yes | Yes |
| Services, team, credentials, portfolio | Optional | Yes | Yes | Yes |
| Restaurant menu and QR menu | Optional | By vertical | By vertical | Yes |
| Appointment/reservation requests | Optional | Optional | Optional | Yes |
| Real-time scheduling | Optional | Optional | Optional | Later |
| Products, inventory, cart, checkout | Yes | No | Optional | Existing only |
| Orders, courier, returns, COD finance | Yes | No | With commerce | Existing only |
| Deposit/payment instructions or link | Existing methods | Optional | Optional | Limited |
| AI copy and page draft | By plan | By plan | By plan | Yes |
| AI image generation | By plan | By plan | By plan | Later |
| Existing-site/Facebook import | By plan | By plan | By plan | Assisted beta/later |

### 4.1 Capability resolver

Create one core resolver, for example `packages/core/src/site/capabilities.ts`:

```ts
resolveTenantCapabilities({ siteMode, vertical, plan, modules, maintenance })
```

It returns explicit booleans such as:

- `website_builder`
- `custom_domain`
- `blog`
- `leads`
- `analytics`
- `services`
- `portfolio_items`
- `team_profiles`
- `credentials`
- `menu`
- `booking_requests`
- `public_events`
- `downloads`
- `commerce`
- `payments`
- `ai_copy`
- `ai_page_draft`

Do not scatter `siteMode === ...` checks through pages and services.

## 5. Ten launch templates

Because all six verticals are selected but the launch count is ten, use two templates for the four broadest commercial verticals and one for each specialist portfolio vertical:

| Vertical | Template | Default page set |
|---|---|---|
| Restaurant | Dhaka Bistro | Home, Menu, Gallery, Reservations, Contact |
| Restaurant | Café Minimal | Home, Menu, Story, Location, Contact |
| Doctor/clinic | Modern Clinic | Home, Doctors, Services, Chambers, Appointment, FAQ |
| Doctor/clinic | Specialist Profile | Home, About, Qualifications, Publications, Chambers, Appointment |
| Business/company | Corporate Trust | Home, About, Services, Team, Projects, Contact |
| Business/company | Startup Launch | Home, Product/Service, Results, Team, Blog, Contact |
| Service provider | Local Service Pro | Home, Services, Coverage, Pricing, Reviews, Quote Request |
| Service provider | Creative Studio | Home, Work, Services, Process, Team, Contact |
| Public figure | Public Voice | Home, Biography, Media, Appearances, Gallery, Contact |
| Personal portfolio | Portfolio Focus | Home, About, Work, CV, Testimonials, Contact |

Each template contains Bangla and English starter copy, but the tenant owns the final content. Templates seed data; they do not fork rendering or business logic.

## 6. Vertical public-site blueprints

### 6.1 Restaurant

**Primary journey:** understand the food and atmosphere, find the location/hours, open the menu, then call, WhatsApp, or request a reservation.

- Home: announcement, hero, featured dishes, menu categories, gallery, testimonials, hours/location, reservation CTA.
- Menu: category navigation, item name, Bangla name, description, price, dietary labels, availability.
- About/story.
- Gallery.
- Reservation request.
- Contact/location.
- QR target: canonical `/menu`; QR can be downloaded as PNG/SVG for tables and print.

### 6.2 Doctor or clinic

**Primary journey:** verify qualifications and practice areas, find chambers and hours, then request an appointment.

- Home: professional hero, specialties, credentials, chamber summary, appointment CTA.
- Doctor/team profiles.
- Services/specialties.
- Qualifications, memberships, publications.
- Chambers and schedules.
- Appointment request.
- Patient information/FAQ and contact.

The site must state that an appointment request is not confirmed until the clinic responds. The form collects only contact and scheduling data. It must not ask for symptoms, diagnoses, prescriptions, or medical documents in the pilot.

### 6.3 Public figure

**Primary journey:** understand the person's work, see credible media and upcoming appearances, then submit an enquiry.

- Home: hero, biography, featured work, latest media, upcoming appearances.
- Biography.
- Work/achievements.
- Media and press links.
- Events/appearances.
- Gallery/video.
- Contact/booking enquiry.

### 6.4 Business or company

**Primary journey:** understand the offer, see proof, evaluate the team, then request a consultation or quote.

- Home: value proposition, services, proof/statistics, case studies, testimonials, client logos, CTA.
- About.
- Services.
- Projects/case studies.
- Team.
- Blog/resources.
- Contact/quote request.

### 6.5 Service provider

**Primary journey:** identify the right service, see price/coverage/proof, then call, WhatsApp, or request service.

- Home: service area, top services, trust points, testimonials, CTA.
- Services and optional starting prices.
- Portfolio/before-after.
- Coverage area and hours.
- Reviews/testimonials.
- Quote or appointment request.
- Contact.

### 6.6 Personal portfolio

**Primary journey:** learn the person's skills, review work, download the CV, then make contact.

- Home: introduction, selected work, skills, experience, CTA.
- About.
- Portfolio/projects.
- Experience and education timeline.
- CV/resume download.
- Testimonials.
- Contact and social links.

## 7. Builder and section registry

### 7.1 Preserve the current foundation

Continue using:

- `Page` for page identity, slug, publish state, and SEO.
- `ThemeVersion` for draft/published section JSON, version history, preview, and rollback.
- `ThemeInstall` and the typed theme/template registries.
- The current section definition as the single source for editor fields, validation, and defaults.

Do not create one renderer per vertical.

### 7.2 Registry changes

Evolve `SectionDef` with optional metadata:

```ts
interface SectionDef {
  // existing fields
  modes?: SiteMode[];
  verticals?: BusinessVertical[];
  capabilities?: string[];
  category?: "hero" | "content" | "proof" | "contact" | "vertical" | "commerce";
  dataSource?: "settings" | "section" | "services" | "menu" | "events" | "portfolio";
}
```

The library filters recommendations by vertical and capabilities, while compatible generic sections remain available to every mode.

Keep `home` and `custom` as the main portfolio page kinds. Do not introduce a page kind for every vertical. Ecommerce's `product`, `collection`, and `cart` remain system layouts gated by `commerce`.

### 7.3 Pilot section inventory

**Global and navigation**

- Announcement bar
- Header/navigation variants
- Footer/contact/social variants
- Language switcher
- Floating call/WhatsApp actions

**Hero and calls to action**

- General hero
- Profile hero
- Business hero with lead CTA
- Split-image CTA
- Booking/reservation CTA

**Identity and content**

- About/story
- Biography
- Rich text
- Statistics
- Values/features
- Timeline: career, experience, education
- Skills and tools
- Download card for CV, brochure, profile, or menu PDF

**Services and proof**

- Service cards
- Pricing/starting-price cards
- Process/steps
- Portfolio/project grid
- Case-study spotlight
- Before/after gallery
- Team/doctor cards
- Credentials, awards, memberships
- Publications
- Testimonials
- Client/logo wall
- FAQ

**Restaurant**

- Featured dishes
- Menu category navigation
- Menu item list/grid
- Opening hours
- Location/map
- QR menu download/share
- Reservation request form

**Doctor/clinic**

- Specialties
- Doctor profile
- Qualifications/registrations
- Chamber locations
- Weekly schedule display
- Appointment request form
- Medical disclaimer

**Public figure**

- Media/press links
- Video gallery
- Achievements
- Upcoming appearances/events
- Booking/media enquiry

**Lead generation**

- Contact form
- Quote request
- Appointment/reservation request
- Newsletter opt-in
- Map and service area

### 7.4 QR and downloads

- Generate QR codes locally from verified canonical tenant URLs; do not send tenant URLs to an untrusted QR service.
- Default restaurant QR target is `/menu`.
- Permit downloadable public PDF assets such as CV, company profile, brochure, or menu.
- Validate file type and size, store under the tenant prefix, remove risky metadata where supported, and make public/private status explicit.
- Downloads require an accessible text link in addition to the QR.

## 8. Information architecture and admin navigation

### 8.1 Portfolio-mode navigation

1. **Home** — setup progress, visits, leads, pending requests, quick actions.
2. **Website**
   - Design
   - Pages
   - Blog
   - Navigation
   - Media
3. **Business content** — items vary by capability:
   - Services
   - Portfolio/projects
   - Team or doctors
   - Credentials/publications
   - Menu
   - Events/appearances
4. **Leads**
   - Inbox
   - Appointment/reservation requests
   - Contacts/export
5. **Marketing**
   - SEO and social preview
   - Analytics
   - Pixels
   - AI studio
6. **Apps**
7. **Settings**
   - Business profile
   - Domains
   - Languages
   - Team and permissions
   - Billing
   - Audit and support

### 8.2 Ecommerce and Hybrid behavior

- Ecommerce keeps the existing navigation unchanged.
- Hybrid shows the Website and Leads surfaces plus only the enabled commerce groups.
- Navigation filtering uses the core capability resolver, not a second list of mode-specific ad hoc checks.
- Search placeholder and dashboard metrics change by mode: portfolio search covers pages, leads, services, menu items, and projects instead of orders/products/customers.

### 8.3 Onboarding

Proposed signup flow:

1. Account and owner identity.
2. “What are you building?” — Ecommerce, Business website/portfolio, or Both.
3. Business vertical.
4. Name, phone, WhatsApp, location/service area, and language.
5. Template selection filtered by vertical.
6. Brand colors/logo and primary CTA.
7. Capability choices such as menu or appointment requests.
8. Subdomain, plan, and creation.

Seed the selected template and a mode-appropriate checklist. Never seed fake public testimonials, registrations, qualifications, clients, or medical claims.

## 9. Data model

### 9.1 Pilot database additions

All new tenant tables require `tenantId`, composite tenant-first indexes, forced RLS, `current_tenant()` policies with write checks, app-role grants, and inclusion in the isolation sweep.

**Tenant additions**

- `siteMode String @default("ECOMMERCE")`
- `businessVertical String?`

**SiteLead**

- Identity/contact: name, phone, email.
- Type: contact, quote, appointment, reservation, media booking.
- Message and structured request metadata.
- Source page, UTM fields, referrer, language.
- Status: new, contacted, qualified, won, closed, spam.
- Consent timestamp and audit fields.

**BookingRequest**

- Lead relation.
- Requested date/time, timezone, party size or service/provider reference.
- Status: requested, contacted, confirmed, declined, cancelled, completed.
- Owner note remains private.
- No medical/clinical detail fields.

**MenuCategory / MenuItem**

- Bilingual names and descriptions.
- Price, optional compare price, image, dietary labels, availability, order.
- No inventory or checkout coupling unless commerce is enabled later.

**SiteContentItem** for pilot structured reusable content

- `kind`: service, portfolio, team, credential, publication, event.
- Slug, bilingual title/summary/body, image/media, dates, links, ordering, publish state.
- Typed Zod schemas per kind validate `data Json`; unknown fields are dropped.
- This provides one RLS-protected list/admin framework during the pilot without six nearly identical tables.
- Promote a kind to a dedicated model only when its workflow or query needs materially diverge.

**SiteDownload**

- Public asset reference, label, language, kind, file size/type, publish state, optional replacement history.

### 9.2 Existing model reuse

- `Page` and `ThemeVersion`: public pages and layouts.
- `BlogPost`: editorial content.
- Existing media/storage records: images and public files after type support is validated.
- `TenantModule`: tenant capability overrides/add-ons.
- `Plan.limits`: pages, leads/month, storage, AI quota, menu items, content items.
- Existing audit log and usage counters.

### 9.3 Avoid premature models

Do not build patient, medical-record, table-allocation, calendar-event synchronization, or payment-ledger models in the pilot. Their operational and compliance requirements exceed request-based lead capture.

## 10. Service, API and routing plan

### 10.1 Core modules

Add focused modules under `packages/core/src/site/`:

- `mode.ts` — validators and labels.
- `capabilities.ts` — single resolver.
- `profile.ts` — public business/profile settings.
- `content.ts` — structured content CRUD and validation.
- `leads.ts` — public capture and owner workflow.
- `bookings.ts` — request status workflow.
- `menu.ts` — restaurant menu CRUD and public reads.
- `analytics.ts` — privacy-conscious page/CTA/lead rollups.
- `templates.ts` — vertical template manifests and seed orchestration.
- `qr.ts` — canonical URL QR output.

Every write accepts `tenantId` and a server-derived actor or verified public tenant context. Never accept a browser-supplied tenant ID as authority.

### 10.2 Public routes

Portfolio mode serves:

- `/` — mode-aware home renderer.
- `/p/[slug]` or the current canonical custom-page form, with one canonical format selected before implementation.
- `/blog` and `/blog/[slug]`.
- `/menu` for restaurant tenants.
- `/api/site/leads`.
- `/api/site/booking-requests`.
- `/downloads/[id]` or a signed/public media URL according to asset visibility.

Commerce-only routes (`/products`, `/cart`, `/checkout`, order/account routes, feeds) return a normal 404 for Portfolio mode and do not appear in navigation, sitemap, or internal links. Hybrid exposes them only when `commerce` is enabled.

### 10.3 Public form protection

- Same-site/origin validation where applicable.
- Edge/IP rate limits plus phone/email/tenant limits.
- Honeypot and minimum-completion-time signal.
- Length and character validation.
- Duplicate suppression/idempotency.
- Server-stamped tenant, source URL, and timestamps.
- Safe audit data; do not log full private messages.
- CSV exports remain formula-neutralized.

## 11. AI and import plan

### 11.1 Pilot AI

Reuse the existing Gemini gateway, usage accounting, plan quotas, and platform-configured secrets.

**AI copy**

- Generates bilingual draft headings, summaries, FAQs, service descriptions, and CTAs.
- Inputs include vertical, audience, tone, verified business facts, and chosen language.
- Output is validated against section field schemas and always requires owner review.
- The prompt forbids invented qualifications, registrations, clients, awards, reviews, prices, health outcomes, or guarantees.

**AI page draft**

- Selects from allow-listed section types and produces settings only.
- Runs through `validatePage` and `normalizeSettings` before a draft is saved.
- Never publishes automatically.

### 11.2 Import

- **Pilot option:** paste text or provide an owned public URL, preview extracted facts/media links, select items, then create an unpublished draft.
- Respect robots/access failures; do not bypass authentication or anti-bot controls.
- Do not copy third-party copyrighted text/images automatically.
- Facebook import is post-pilot unless an approved API connection and permission model are available.

### 11.3 AI images

Plan for post-pilot only. Require generation quotas, moderation, clear disclosure/provenance metadata where appropriate, rights confirmation, tenant media ownership, and an explicit owner approval step.

## 12. Payments and booking boundary

The pilot booking flow is a lead workflow:

```text
Visitor request → NEW → CONTACTED → CONFIRMED or DECLINED
                              → CANCELLED → COMPLETED
```

- The public screen says “Request an appointment/reservation,” not “Book instantly.”
- Confirmation comes from the owner by phone, WhatsApp, SMS, or email.
- Online payment in the pilot means an owner-configured payment instruction or link after confirmation, using existing trusted mechanisms where possible.
- Do not collect card data.
- Do not mark a request confirmed merely because a payment reference was entered.
- Real-time availability and deposit/refund accounting are a separate post-pilot slice.

## 13. Analytics

Portfolio dashboards replace sales-first metrics with:

- Unique visits and page views.
- Top pages and traffic sources.
- Call, WhatsApp, download, map, and booking CTA clicks.
- New leads and request statuses.
- Visit-to-lead conversion.
- Menu views and QR-origin sessions for restaurants.
- CV/profile downloads for portfolios.

Hybrid mode can show website/leads and sales panels without mixing definitions. Analytics events must be allow-listed; never place contact form message text, health details, phone numbers, emails, or owner private notes in analytics payloads.

## 14. SEO, accessibility and performance

### 14.1 SEO

- Canonical URL derived from the verified primary domain.
- Per-page bilingual title, description, Open Graph image, and share preview.
- Sitemap includes only public routes enabled for the tenant mode.
- Cart, checkout, account, admin, preview, drafts, form-success, and private download routes remain `noindex`.
- Correct locale alternates only when both language variants genuinely exist.
- Mode/vertical-aware structured data:
  - `Restaurant` for restaurants.
  - `Physician` or appropriate medical/business types for verified doctor/clinic facts.
  - `Person` for public figures and personal portfolios.
  - `Organization`, `LocalBusiness`, or an appropriate subtype for companies and services.
- Do not emit aggregate ratings without eligible, visible, first-party review evidence.
- Use stable URLs and redirects when a slug changes.

### 14.2 Accessibility

- Semantic heading order and landmarks.
- Keyboard-operable builder controls and public navigation.
- Visible labels and errors for every form.
- Alt-text field and decorative-image choice.
- Sufficient contrast for tenant-selected colors; block unsafe foreground/background pairs.
- QR codes always accompanied by a normal link.
- Appointment status and errors announced accessibly.
- Test at 390 px and 1440 px plus keyboard and axe checks.

### 14.3 Performance

- Preserve server rendering and avoid shipping editor code to public pages.
- Use image dimensions, responsive sizes, AVIF/WebP, and current media limits.
- Lazy-load below-the-fold galleries and video embeds.
- Menu and structured content public reads use tenant-scoped caching with publish invalidation.
- Performance acceptance with realistic restaurant/portfolio photography, not only small demo assets.

## 15. Security and privacy

- Forced RLS and tenant isolation for every new model.
- Capability checks in service code, not UI only.
- Audit create/update/delete/publish/status operations without secrets or private messages.
- Sanitize or structurally render all owner content; never accept arbitrary script/style/HTML from AI or import.
- Restrict external links to safe schemes and protect new-tab links.
- Validate uploads by detected type, not filename alone.
- Define lead retention and owner deletion/export behavior before public beta.
- Add explicit consent wording and a tenant privacy page link to public forms.
- Doctor sites are marketing and appointment-request sites, not healthcare record systems.
- Prohibit claims such as guaranteed cure, unverified registration, fabricated testimonials, or “best doctor” generated by AI.
- Continue secrets in environment or `PlatformConfig`; never embed provider keys in template JSON.

## 16. Pricing and entitlements

The user's chosen entry price is **৳399/month**. Treat these as pilot hypotheses to validate against conversion, support burden, AI usage, storage, SMS, and payment costs.

| Portfolio plan | Pilot price | Intended limits/features |
|---|---:|---|
| Starter | ৳399/month | 5 pages, custom domain, 1 site, bilingual fields, lead inbox, 25 AI actions/month, basic analytics, 1 staff owner |
| Business | ৳799/month | 20 pages, booking requests or menu, 250 structured items, 150 AI actions/month, lead export, pixels, 3 staff |
| Business Plus | ৳1,499/month | 50 pages, advanced vertical modules, 500 AI actions/month, higher storage/leads, 8 staff, priority support, Hybrid eligibility |

Annual plans can offer approximately two months free after pilot economics are measured.

Rules:

- Ecommerce plans and entitlements remain unchanged for existing tenants.
- Portfolio plans are dedicated lower-priced plans, as selected.
- Hybrid requires a commerce-capable plan or an explicit commerce add-on; it must not unlock expensive order/courier operations at the ৳399 tier.
- Custom domain is part of the MVP and should be available on every paid portfolio tier.
- Trial can reuse the current 14-day lifecycle.
- Plan limits live in `Plan.limits` and the centralized capability/limit services, not hard-coded page checks.

## 17. Backward-compatible migration

### Stage A — database first

1. Add nullable/defaulted tenant fields and new tables without changing existing reads.
2. Apply migration to staging and production through the established deploy workflow.
3. Verify all existing tenants read as `ECOMMERCE`.
4. Add RLS policies, grants, tenant indexes, and isolation sweep coverage in the same migration series.

### Stage B — dark code path

1. Add typed validators and capability resolver.
2. Keep every existing tenant on the existing ecommerce path.
3. Hide Portfolio/Hybrid creation behind a platform feature flag.
4. Seed internal demo tenants only.

### Stage C — controlled pilot

1. Enable new signup modes only for invited pilot owners or platform staff.
2. Verify no commerce routes or navigation appear for Portfolio tenants.
3. Verify Ecommerce snapshots and end-to-end flows remain unchanged.
4. Add an audited platform action to change mode; do not expose self-service conversion initially.

### Stage D — public beta

1. Enable public Portfolio signup and portfolio pricing.
2. Keep Ecommerce-to-Portfolio downgrade and data-deletion behavior manual until retention rules are proven.
3. Permit Portfolio-to-Hybrid upgrade because it is additive; seed no products automatically.

## 18. Six-week execution roadmap

The schedule assumes one focused implementation stream, prompt product decisions, existing infrastructure reuse, and no production-grade real-time booking/import/image generation.

### Week 1 — foundation and compatibility

- Finalize mode, vertical, capability, and entitlement contracts.
- Add additive database migration, RLS, grants, indexes, and tests.
- Implement capability resolver and feature flag.
- Make admin navigation capability-aware while preserving Ecommerce output.
- Add mode-aware public routing/sitemap guards.
- Create internal Portfolio and Hybrid demo tenants.

**Exit gate:** all existing Ecommerce unit/E2E tests pass unchanged; isolation sweep includes every new table; Portfolio tenant cannot reach commerce routes.

### Week 2 — builder and site shell

- Add section metadata and filtered library.
- Build public business header/footer, navigation, contact actions, business profile settings, and theme-safe reusable sections.
- Add template manifest support for mode, vertical, required capabilities, page seeds, and navigation seeds.
- Implement first five templates: one per major structure, not superficial color swaps.
- Extend preview/publish/history regression tests.

**Exit gate:** internal users can create, edit, preview, publish, and roll back a bilingual portfolio site without a product or order.

### Week 3 — vertical data and leads

- Implement SiteLead, BookingRequest, Menu models/services/admin/public flows.
- Implement SiteContentItem and SiteDownload.
- Add restaurant menu, QR, CV/download, services, portfolio, team, credentials, events, and request sections.
- Add rate limits, honeypot, idempotency/duplicate controls, consent text, and lead-status audit.

**Exit gate:** each vertical's primary visitor journey produces the right owner action; doctor forms contain no clinical fields.

### Week 4 — onboarding, pricing, analytics, and AI

- Extend signup with site mode, vertical, filtered template, CTA, and capabilities.
- Add Portfolio plan cards and entitlement limits without changing Ecommerce plans.
- Add website/CTA/lead analytics rollups and mode-aware dashboard.
- Ship constrained AI copy and page-draft generation.
- Complete all ten templates and bilingual seed content.

**Exit gate:** an invited owner can sign up, publish a custom-domain-ready site, receive a lead, and understand usage/plan limits without staff database work.

### Week 5 — hardening and pilot preparation

- Run mobile/desktop Playwright, axe, SEO, schema, form-abuse, RLS, migration, and performance checks.
- Review Bangla copy with a native reviewer.
- Prepare pilot onboarding, support scripts, privacy text, deletion/export process, and incident rollback.
- Populate demo/template screenshots and marketing pages.
- Fix all release-blocking findings; defer assisted import if quality is not safe.

**Exit gate:** release checklist passes and no critical/high security, tenant isolation, accessibility, or data-loss defect remains.

### Week 6 — controlled pilot and beta decision

- Onboard 5–10 businesses across at least four verticals, including one doctor/clinic and one restaurant.
- Observe setup with consent; record completion time and support friction.
- Triage daily, ship small reversible fixes, and avoid schema churn without migration review.
- Measure activation, publish rate, first-lead time, conversion intent, performance, and support volume.
- Decide public beta, limited extension, or another pilot cycle.

**Exit gate:** at least five real sites published, at least three tenants receive a genuine lead/request, no cross-tenant or data-loss incident, and owners can make common edits without staff intervention.

## 19. Acceptance criteria

### Platform and compatibility

- Every existing tenant resolves to Ecommerce and retains its current navigation and public commerce behavior.
- Portfolio tenants have no cart, checkout, product feed, order/account, courier, inventory, or COD operations in UI, sitemap, or routable public surface.
- Hybrid capabilities can be added without changing theme or losing page content.
- A visual template does not implicitly enable a behavioral module.

### Builder

- Section add, edit, duplicate, drag reorder, hide/remove where allowed, draft, preview, publish, history, rollback, and conflict handling work for portfolio pages.
- Every new section validates server-side; unknown settings are dropped and unsafe values rejected.
- Templates seed ten distinguishable, usable page systems with Bangla/English fields.
- Changing a template/look never deletes leads, menu data, services, portfolio items, or business settings.

### Leads, bookings, and vertical content

- Public submission creates exactly one tenant-scoped record under repeat/idempotent submission.
- Owners can filter, open, update, export, and delete according to permission and retention rules.
- Appointment/reservation requests are visibly unconfirmed until an owner changes status.
- Restaurant menu can be published independently of commerce products.
- QR resolves to the verified canonical menu URL.
- CV/download link works with keyboard and screen readers and exposes a safe file.

### AI

- AI creates only unpublished drafts.
- Output passes existing builder validation.
- Quotas and audit events are applied.
- Generated copy cannot invent professional credentials, health outcomes, reviews, clients, prices, or awards from missing facts.

### Quality

- New tenant tables pass forced-RLS isolation tests.
- Critical journeys pass at 390 px and 1440 px.
- No serious axe violations in onboarding, builder, lead inbox, menu, booking request, or public templates.
- SEO metadata, canonical, sitemap, robots, language alternates, and structured data are mode-aware and validated.
- Performance is checked using realistic images on a deployed preview.

## 20. Test strategy

### Unit and service tests

- Full mode × vertical × plan × module capability matrix.
- Section eligibility and validation.
- Template manifest validation and seed determinism.
- Lead and booking state transitions.
- Menu ordering, bilingual fallbacks, and publish visibility.
- QR canonical URL construction.
- Plan limits and AI quotas.
- SEO/schema builders by vertical.

### Database and security tests

- Migration default preserves all existing tenant behavior.
- Cross-tenant read/write/delete attempts fail for every new table.
- App role cannot bypass RLS.
- Public capture resolves tenant from trusted host context.
- Rate limits, duplicate submission, CSV neutralization, and audit redaction.

### End-to-end tests

- One golden flow per vertical from signup/template to published site.
- Portfolio visitor submits contact and request forms.
- Restaurant menu QR target and reservation request.
- Doctor credentials/chambers and non-clinical appointment request.
- Personal portfolio CV download.
- Admin lead status workflow.
- Hybrid enables commerce without losing portfolio pages.
- Existing Ecommerce checkout/order/courier regression suite.

### Release commands

Follow repository guidance and installed-package documentation before altering Turborepo or Next.js behavior. The release gate includes:

```text
node tools/docs-crosscheck.mjs
pnpm typecheck
focused core/db tests run serially where database resets can conflict
pnpm build
admin and storefront Playwright at mobile and desktop sizes
```

On Windows, treat junction permissions and concurrent database-reset failures as environment/test-isolation issues and rerun under the established safe conditions before judging code correctness.

## 21. Repository implementation map

| Area | Expected locations |
|---|---|
| Schema, migration, RLS, isolation | `packages/db/prisma/schema.prisma`, migrations, DB tests |
| Mode and capabilities | `packages/core/src/site/`, `packages/core/src/modules/` |
| Builder sections and filtering | `packages/core/src/builder/registry.ts`, `versions.ts`, `theme.ts`, builder tests |
| Template seeding and demos | `packages/core/src/platform/templates.ts`, demo seed/session modules |
| Signup and pricing | `packages/core/src/platform/signup.ts`, `apps/marketing/src/app/start`, pricing components |
| Capability-aware admin shell | `apps/admin/src/app/(admin)/layout.tsx`, shell search/count services |
| Portfolio admin features | new routes under `apps/admin/src/app/(admin)/` for leads/content/menu/requests |
| Public renderer and routes | `apps/storefront/src/app/(store)/`, section renderer/components, sitemap/robots |
| Host routing | existing `proxy.ts` and core routing directory; no separate tenant resolver |
| AI | existing AI gateway/usage modules plus site-specific schemas/prompts |
| Platform controls | plan editor, tenant details, modules/maintenance screens |
| Documentation | update docs 01, 05, 06, 07, 08, 14, 15, 16, 17, 23, 24, 43 after implementation |

Before routing, header, caching, or proxy changes, read the installed Next.js 16.4 documentation in `node_modules/next/dist/docs/`. Before changing Turborepo configuration or commands, resolve the installed `turbo` package from the relevant workspace and read its bundled `docs/README.md` and relevant pages.

## 22. Pilot metrics and decision rules

### Primary metric

**Paying portfolio tenants** after trial/pilot, as selected.

### Leading indicators

- Signup-to-published-site rate.
- Median time from signup to first publish.
- Percentage connecting a custom domain.
- Percentage receiving a genuine lead within 14 days.
- Lead/booking response time.
- Template change and builder failure rate.
- Support contacts per activated tenant.
- AI suggestion acceptance/edit rate.
- Mobile performance and form completion.

### Suggested beta thresholds

- At least 70% of assisted pilot tenants publish.
- Median first publish under 60 minutes with template content.
- At least 60% configure a primary CTA.
- At least five sites remain active through the pilot.
- At least three tenants receive a genuine enquiry/request.
- No tenant-isolation, data-loss, payment, or privacy incident.
- No repeated blocker requiring staff database edits for ordinary content changes.

These are pilot decision thresholds, not market forecasts.

## 23. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Ecommerce logic leaks into portfolio UX | Central capability resolver, route guards, mode-specific E2E assertions |
| Six verticals become six codebases | One renderer and registry; templates seed data; behavior stays in capabilities |
| Ten templates are color variations | Require materially different information architecture and proof in template acceptance |
| Four-to-six-week scope overruns | Hold real-time booking, deep imports, AI images, and payment accounting after pilot |
| AI fabricates sensitive claims | Fact-bound prompts, forbidden-claim checks, unpublished output, owner review |
| Doctor sites collect health data | Contact/schedule fields only; explicit scope and form review |
| Spam overwhelms owners | Edge limits, honeypot, duplicate control, spam status, optional verification later |
| Low ৳399 margin | Tiered limits, AI quotas, cost monitoring, pilot price validation |
| Existing tenants regress | Default Ecommerce migration, dark launch, golden regression suite |
| New schema reaches code before production DB | Additive-first migration and deployment gate already required by the repo |
| Imported content violates rights or is wrong | Preview/select/review flow; no automatic publish; approved APIs only |

## 24. Explicitly out of scope for the pilot

- Clinical records or telemedicine.
- Real-time calendar availability and external calendar sync.
- Restaurant table/floor allocation.
- Full CRM automation or call center.
- Arbitrary custom code, plugins, scripts, CSS, or HTML pasted by tenants.
- Free-form absolute-position canvas.
- Native mobile applications.
- Full social network scraping.
- AI publishing without human review.
- Marketplace for third-party templates.
- Automatic conversion or deletion of existing ecommerce data.

## 25. Decisions that can wait until implementation discovery

These do not block the master plan:

- Whether public custom pages retain `/p/<slug>` or move to root-level slugs. Decide once, with redirect/collision rules, before creating new templates.
- Exact storage/page/lead limits after cost-model review.
- Whether BizTrack Business is the umbrella marketing name or a named plan family under BizTrackBD.
- Whether a Hybrid tenant can self-enable commerce during beta or requires staff approval.
- Which approved external provider, if any, handles transactional email for lead notifications.

## 26. Definition of done for the initiative

BizTrack Business is ready for public beta when a Bangladeshi owner in any selected vertical can sign up, select an appropriate bilingual template, publish a fast custom-domain website, manage its pages without code, receive and act on a lead/request, understand their plan and analytics, and upgrade later to Hybrid—while every existing ecommerce tenant continues operating unchanged and all tenant data remains isolated.
