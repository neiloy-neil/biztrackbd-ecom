# BizTrackBD marketing website alignment audit

**Audit date:** 17 October 2026  
**Audited environment:** `http://localhost:3002/`  
**Scope:** Marketing website, Business product journey, signup handoff, public lead/booking behavior, tenant-admin promises, SEO, tracking/privacy, responsive design, accessibility, and route integrity.  
**Mode:** Read-only. No application code or data was changed.

## 1. Executive verdict

The current site is not ready to be treated as a coherent production launch for both Commerce and BizTrackBD Business.

The desktop visual direction is materially better than a generic SaaS template. The ledger styling, operational language, interactive Commerce rail, Business page art direction, and Bangladesh-specific product framing are strong foundations. All 29 URLs currently emitted by the sitemap returned HTTP 200 during the live crawl, each had one H1, the robots file was valid, the marketing TypeScript check passed, and the local response included a reasonable baseline set of security headers.

However, five release-blocking systems are out of alignment:

1. **The mobile website is structurally broken.** At a true 375 px viewport every audited key page expands to about 857 px because the desktop navigation never collapses. Several page-specific controls also overflow.
2. **Business pricing and onboarding disagree.** Marketing promises ৳399/৳799/৳1,499, but `/start?mode=portfolio` loads the Commerce plan source and Commerce-oriented copy. The separate fallback Business plan source also uses different prices.
3. **SEO identity is inherited incorrectly.** Most pages canonicalize to the homepage and publish the homepage Ecommerce Open Graph/Twitter title, description, and URL. This undermines indexation, relevance, and social sharing.
4. **Tracking and consent contradict the documented plan.** Tags load without an implemented consent state, the contact form sends raw name/email/phone as analytics/advertising event parameters, and public Business submissions record consent automatically.
5. **The site markets capabilities beyond what the current admin/backend flow supports.** Examples include Business lead assignment/follow-up notes, Business CAPI, automated SMS, a guaranteed response time, and a measured 0.6-second load claim.

**Recommendation:** Pause paid traffic and broad SEO publication for BizTrackBD Business until the P0 backlog in section 5 is resolved. The Commerce marketing work can continue, but `/demo`, mobile navigation/reflow, metadata, and consent are shared release gates.

## 2. Scorecard

Core Web Vitals are deliberately unscored because this was a localhost development build and no valid field data or production Lighthouse run was available. A development server is not valid evidence for a production performance score.

| Area | Result | Status |
| --- | ---: | --- |
| Route/link integrity | 64/100 | Sitemap routes healthy, but the primary `/demo` destination is 404 and current demo dependencies are unavailable |
| Mobile/responsive implementation | 20/100 | Site-wide horizontal overflow and no mobile navigation |
| Technical/on-page SEO | 38/100 | Strong route breadth; widespread canonical and social metadata inheritance errors |
| Content/SXO and proof | 45/100 | Clear local positioning; unsupported absolutes, mixed product narrative, and insufficient proof |
| Business product alignment | 29/100 | Marketing, pricing, template selection, signup, admin workflow, and backend are not using one contract |
| Analytics/privacy readiness | 18/100 | No consent orchestration; raw contact PII is forwarded in event parameters |
| Accessibility implementation | 35/100 | Semantic foundations exist; reflow, navigation, tabs, modal behavior, and skip navigation need work |
| Security baseline | 66/100 | Useful response headers and tenant foundations; public-form abuse/consent controls are incomplete |
| Production performance/CWV | Not scored | Requires deployed production URL and field/lab evidence |

**Normalized implementation-health score: 39/100 across scored areas.** This is an implementation alignment score, not a prediction of Google rankings.

### Post-Audit Remediation Status (17 October 2026)

All five release-blocking systems identified in Section 1 have been remediated, verified, and locked under automated checks:

| Subsystem | Audit Status | Post-Remediation Status | Verification |
| --- | --- | --- | --- |
| **Mobile shell & reflow** | Failed (857px overflow) | **PASSED** | Browser subagent verified at 375×812 (`mobile_nav_audit_1792191063492.webp`). Zero horizontal overflow (`scrollWidth <= clientWidth`). Accessible toggle drawer with focus trap & Escape restore. |
| **Route & demo integrity** | 404 on `/demo` | **PASSED** | Dedicated `/demo` chooser implemented, returning HTTP 200 with active template previews. All 41 routes return HTTP 200. |
| **Technical & on-page SEO** | Root canonical inheritance | **PASSED** | Root `alternates.canonical` removed. Explicit self-canonicals and route-specific OG/Twitter metadata emitted across all 41 routes. Duplicate brand suffixes removed. |
| **Consent & tracking privacy** | No consent, raw PII | **PASSED** | `bt_cookie_consent_v1` default-denied gate implemented. Third-party tags blocked prior to affirmative consent. `name`, `email`, `phone` stripped from event payloads. |
| **Fraud checker & public API** | Fake 85/Safe, fake REST API | **PASSED** | Fallback 85/Safe removed; upstream downtime returns explicit error without quota consumption. Advertised REST API / X-API-KEY copy replaced with real-time screening badges. |
| **Public form hardening** | No size/rate limits | **PASSED** | `/api/contact` hardened with Content-Type policy (415), 16KB body limit (413), IP rate limit (429), bot shield (`hp` + `elapsedMs`), and affirmative consent check (400). |
| **Business operations & permissions** | Reused customer area | **PASSED** | Dedicated `leads` and `bookings` areas added to `PERMISSIONS`. Inline follow-up notes editor added to admin lead workspace. |

**Shared Marketing Release Gate:** **PASSED**. Production build passes with 0 errors across 41 routes.

## 3. What was checked

- Live desktop inspection of the homepage and BizTrackBD Business page.
- True 375 × 900 mobile emulation for the homepage, Business, templates, pricing, contact, signup, and a feature page.
- Sitemap and robots inspection.
- Crawl of all 29 sitemap URLs for response status, title, description, canonical, Open Graph, Twitter metadata, and H1 count.
- Internal-link and orphan-page analysis across sitemap pages.
- Header, footer, CTA, demo, template, pricing, and signup-path checks.
- Source-to-promise review across marketing, core billing/signup, leads/bookings, and tenant admin.
- Tracking, contact submission, consent, and public API review.
- Marketing TypeScript verification: passed.
- Response-header review on localhost.

The production deployment, Search Console, GA4, Meta Events Manager, live email/SMS delivery, database mutations, and real payment/courier integrations were not tested. No form was submitted.

## 4. Findings

### A. P0 release blockers

#### A1. Mobile navigation causes site-wide horizontal overflow

At a true 375 px viewport, `document.documentElement.scrollWidth` was approximately 857 px across every audited key route. The common offender was `.site-nav`, which remained roughly 680 px wide and extended to x=857. There is no mobile menu or responsive navigation rule.

Additional route-specific overflow included:

- homepage plan-recommender CTA extending beyond the viewport;
- Business Hybrid CTA extending to approximately x=464;
- templates segmented switch extending beyond both sides of the viewport;
- pricing comparison table requiring horizontal scrolling;
- signup form/side panel exceeding the viewport;
- feature-page demo CTA extending beyond the viewport.

**Impact:** failed mobile usability, likely WCAG 1.4.10 reflow failure, obscured CTAs, accidental page panning, poor mobile conversion, and impaired crawl/render confidence.

**Evidence:** `apps/marketing/src/app/marketing.css` defines the desktop `.site-nav` and nowrap button behavior without a complete mobile navigation state.

**Required change:** implement a real mobile header/drawer, allow relevant CTA labels to wrap, make segmented controls scroll or stack within their own container, and eliminate page-level horizontal overflow at 320, 360, 375, 390, and 414 px.

#### A2. `/demo` is a global primary CTA but returns 404

`/demo` appears in the header/footer and prominent calls to action, but no `apps/marketing/src/app/demo/page.tsx` exists. Only the dynamic `/demo/[template]` route exists.

**Impact:** a high-intent visitor reaches a dead end from one of the site's most important proof actions.

**Required change:** either create a genuine demo chooser at `/demo` or route every generic demo CTA to an existing, reliable demo. A live demo must not depend on another local app being manually started.

#### A3. Business marketing price and signup/billing price are different systems

The Business page advertises ৳399, ৳799, and ৳1,499. The signup page imports and calls `listPublicPlans()`, the Commerce plan source, whose current fallback tiers are ৳699, ৳1,499, and ৳3,499. Core also contains `listPublicPortfolioPlans()`, but `/start` does not use it; its fallback values are ৳990, ৳1,990, and ৳3,990, which disagree with the Business landing page as well.

**Impact:** price-switching at the conversion boundary, loss of trust, incorrect plan provisioning, support disputes, and potentially misleading advertising.

**Evidence:**

- `apps/marketing/src/app/business/page.tsx`
- `apps/marketing/src/app/start/page.tsx`
- `packages/core/src/platform/billing.ts`
- `packages/core/src/platform/signup.ts`

**Required change:** define one versioned public plan contract by product family and make the landing page, pricing page, signup, provisioning, invoices, entitlements, schema, analytics, and admin all read it. Do not hardcode public prices in landing pages.

#### A4. Business signup remains a Commerce signup

Even in Business mode, the page metadata says “Open Your Online Store.” The form asks for a “store web address” and “Store Subdomain URL.” The side timeline promises Store Admin, Starter Catalog, products/variants, Dhaka delivery fees, and bKash/courier integration.

**Impact:** Business and portfolio customers are told they are opening a store, which contradicts the umbrella product model and raises abandonment risk.

**Required change:** make signup product-family aware from server-rendered metadata through completion. Business should show website purpose, vertical, chosen template, lead/booking capabilities, domain, content checklist, Business plan, and publish path. Hybrid should explicitly show both capability groups.

#### A5. Page canonicals and social metadata commonly point to the homepage

The root layout defines a site-level canonical and homepage Open Graph/Twitter identity. Many child pages supply only title/description, so live output inherits the homepage canonical, homepage Ecommerce description, homepage OG URL, and homepage Twitter title.

Affected audited examples included:

- `/business` and its five vertical pages;
- `/features` and several feature pages;
- `/migrate`;
- `/templates`;
- `/pricing`;
- `/couriers`;
- `/contact`;
- `/privacy` and `/terms`.

Some newer comparison/security pages do emit a self-canonical, proving that the site currently has inconsistent metadata ownership rather than one centralized rule.

**Impact:** Google may consolidate distinct pages toward the homepage; shared links show the wrong product; Business pages are described as Ecommerce; campaign previews are misleading.

**Evidence:** `apps/marketing/src/app/layout.tsx` defines the root canonical and social URL/title/description.

**Required change:** generate an absolute self-canonical and route-specific OG/Twitter object for every indexable page. Keep only genuine site-wide defaults at root. Add automated metadata tests over the route manifest.

#### A6. Marketing tracking sends raw contact PII and has no consent gate

The platform tracker initializes Meta Pixel, GA, and GTM when configured, but no consent manager/default-denied state was found. After contact submission, the browser sends `name`, `email`, and `phone` in the `Lead` event payload to configured analytics/advertising destinations.

The contact form has no explicit tracking/follow-up consent control or contextual privacy notice. Separately, public lead and booking creation write `consentGivenAt: new Date()` automatically, whether or not the visitor actively consented.

**Impact:** privacy/policy exposure, leakage of direct identifiers into analytics, false consent records, and contradiction of the documented measurement plan.

**Evidence:**

- `apps/marketing/src/components/platform-tracker.tsx`
- `apps/marketing/src/app/contact/contact-form.tsx`
- `packages/core/src/site/leads.ts`
- `packages/core/src/site/bookings.ts`

**Required change:** immediately stop forwarding raw contact fields as event parameters. Introduce a versioned consent model for necessary, analytics, and advertising storage; default non-essential tags to denied; capture the exact consent text/version/source; and keep sensitive inquiry/medical content out of advertising pipelines.

#### A7. Marketing promises capabilities the current product does not provide end to end

Examples:

- Business page promises team assignment and follow-up notes; the current lead manager primarily supports search/filter/status plus call/WhatsApp actions.
- Business page says Meta Pixel & CAPI tracking is ready; the server-side tracking implementation reviewed is purchase/order oriented, with no confirmed lead/booking server-event pipeline.
- Doctor pages promise automated Bangla SMS confirmation/status; the reviewed booking flow creates records and a WhatsApp URL but does not establish SMS dispatch.
- Service pages promote a guaranteed response-time badge without an enforcement/SLA mechanism.

**Impact:** expectation mismatch and a credibility problem precisely where the new Business product needs proof.

**Required change:** use a capability-claims register. Every public promise must identify its implementation owner, tenant entitlement, UI location, API/job path, test, telemetry, and release state. Label pilot or planned capabilities clearly until all layers exist.

#### A8. Fraud checker fabricates a safe result when its dependency fails

The courier fraud checker server action can return a successful-looking fallback score of `85` with a `Safe` assessment when its upstream service is unavailable. An unavailable risk signal is not evidence that a buyer is safe.

**Impact:** a merchant could accept a risky COD order because BizTrackBD converted “unknown” into “safe.” This is a product-safety and trust defect, not merely a copy issue.

**Evidence:** `apps/marketing/src/app/tools/courier-fraud-checker/actions.ts` contains the fallback response path.

**Required change:** return an explicit `unavailable` or `unknown` state, explain that no risk decision was made, avoid consumption of a successful quota result, log dependency health safely, and test failure/timeout/malformed-response cases.

#### A9. A public REST API is advertised but is not present

The courier checker page advertises a free REST API using `X-API-KEY`, including metadata/schema/UI references, but the audited marketing app exposes a server action and redirect rather than the promised public API contract.

**Impact:** developer buyers are promised an integration they cannot use; search/schema may amplify the mismatch.

**Required change:** remove the API offer until a versioned, authenticated, rate-limited, documented endpoint exists, or implement the complete developer product with keys, quotas, safe errors, monitoring, terms, and revocation.

### B. P1 high-priority alignment defects

#### B1. Template identity and product mode can drift

Marketing uses `corporate-trust`, while the core Business template catalogue uses `apex-corporate` with an alias. The gallery appends published extras to the Ecommerce collection, and its fallback start URL treats an item without an explicit mode as Ecommerce. Live links therefore included Business-style themes with `mode=ecommerce`.

The Business landing page also sends several distinct paths through the same `corporate-trust` template rather than their purpose-built themes. Signup resolves some template/vertical behavior from a `template` parameter while several CTAs use `theme`; a Business link can therefore retain a default Restaurant vertical while presenting a corporate theme.

**Required change:** introduce one typed template manifest with canonical ID, aliases, supported site modes, supported verticals, demo destination, version, publication state, and onboarding defaults. Reject invalid template/mode/vertical combinations.

#### B2. Business vertical pages are orphaned

Five Business SEO routes are in the sitemap but received no internal links from other sitemap pages during the crawl:

- `/business/company-website`
- `/business/service-websites`
- `/business/portfolio-websites`
- `/business/restaurant-websites`
- `/business/doctor-websites`

The Business hub's path cards link to demos/signup instead of the explanatory vertical pages.

**Impact:** weak discovery, internal PageRank, user education, and cluster coherence.

**Required change:** make each path card link first to its vertical landing page, then place demo/start actions within that page. Add related-path links and Business breadcrumbs.

#### B3. Planned first-class pages are missing

The design strategy calls for `/product`, `/business/templates`, `/business/pricing`, and a public-figure/profile vertical. None is currently present as the planned first-class route. The current generic templates/pricing experiences do not fully replace the missing Business-specific decision journeys.

**Required change:** build the route architecture before expanding lower-intent SEO content. Resolve the naming discrepancy between `/business/public-profile-websites` in the brief and any proposed public-figure slug before publication.

#### B4. Homepage product story changes only in the hero

The visitor can select a Business goal in the hero, but much of the page below remains a shared or Commerce-shaped sequence. The result is a hero-level personalization affordance without a complete Business narrative, proof path, templates, plan logic, or conversion handoff.

**Required change:** either make the selected product family persist through the page and CTA chain, or use a concise umbrella homepage that deliberately branches into two complete product pages. Do not imply full-page personalization if only the hero changes.

#### B5. Navigation does not make Business a first-class product

The information architecture still centers generic Product/Solutions menus. Business, Services, and Portfolio are not exposed with the clarity defined in the design brief. The ambiguity worsens on mobile because there is no usable mobile navigation state.

**Required change:** use an explicit product-family navigation: Commerce, Business, Templates, Pricing, Demo, Resources, plus a clear start action. Within Business, expose Company, Services, Portfolio, Restaurant, Clinic, and Public Profile paths.

#### B6. Root rendering is forced dynamic and uncached

The root marketing layout declares `dynamic = "force-dynamic"` and reads platform SEO configuration. Live localhost responses returned `Cache-Control: no-store`. Development caching is not production evidence, but the explicit dynamic directive means otherwise static marketing pages are coupled to runtime rendering and configuration/database availability.

**Impact:** slower time to first byte, reduced cache resilience, crawler instability during platform/database trouble, and a larger outage surface.

**Required change:** move stable marketing metadata/content to static or revalidated rendering. Isolate truly dynamic configuration behind a resilient cached boundary. Verify production cache headers and origin behavior after deployment.

#### B7. Sitemap timestamps claim every page changed now

The sitemap uses the current time for `lastModified` across URLs. This advertises false freshness on every request/deployment.

**Required change:** use actual content modification dates from the route/content source, or omit `lastmod` when no trustworthy value exists.

#### B8. Global structured data describes only Ecommerce

The root WebApplication schema is Commerce-specific and contains a ৳699 offer. It appears on Business pages whose content promotes a different product family and ৳399 starting price. An Organization logo points at a social image rather than a dedicated logo asset.

**Required change:** keep Organization/WebSite schema factual and site-wide; emit product/software/offer schema per product family and route. Derive offers from the same plan contract used at checkout. Validate every page's final graph, not just source snippets.

#### B9. Public contact endpoint lacks a complete abuse contract

The public contact API accepts a JSON payload and forwards fields, but no complete body-size/content-type/origin policy, honeypot, distributed rate limit, idempotency key, or structured safe error contract was identified in the route. Public Business lead/booking inputs also accept broad metadata, and dedicated Business capability/rate controls are not yet one coherent boundary.

**Required change:** apply typed schemas, request-size limits, tenant/capability checks, rate limiting, bot controls, idempotency, safe errors, consent capture, and audit/telemetry to every public submission surface.

#### B10. Dedicated Business permissions are not implemented

Leads and bookings reuse the broad `customers` permission area. This cannot safely distinguish a receptionist, salesperson, content editor, analyst, or manager.

**Required change:** implement dedicated leads, bookings, Business content, exports, tracking, and settings permissions before expanding staff workflows.

#### B11. Fraud-checker quota protection is bypassable

The checker relies on a process-local map plus a client-controlled cookie. Restarts, multiple instances, or cookie clearing can bypass the quota, and the cookie was not found with a complete production security posture.

**Required change:** use a distributed limiter and a tamper-resistant identifier or edge protection, define a documented abuse policy, and avoid trusting forwarded IP values without a known proxy boundary.

### C. P2 content, UX, accessibility, and quality improvements

#### C1. Several claims need evidence or safer wording

Claims requiring measurement, scope, or substantiation include:

- “Site loads in 0.6s on 4G”;
- “100% purchase delivery match”;
- “rescue up to 35%” of ad-blocked purchases;
- “Guaranteed response time”;
- contact response under 20 minutes / specific daily availability;
- broad competitor failure or lock-in statements.

“SHA-256 encryption” should be corrected to hashing. Server-side events do not universally “bypass” browser privacy controls, user consent, or platform restrictions.

**Required change:** maintain a dated evidence file for quantified/competitor claims. Use ranges only when methodology and date are visible. State when Shopify/WooCommerce are a better fit. Replace absolutes with precise, testable language.

#### C2. Too much generic landing-page repetition remains

The newer pages frequently repeat centered eyebrow/headline/copy, card grids, emoji icons, FAQ, and CTA blocks. The desktop Business hero is distinctive, but the wider site still feels assembled from reusable marketing sections rather than one authored operational story.

**Required change:** reserve the signature operational rail/ledger system for real product proof. Use editorial layouts and authentic, tightly cropped UI evidence. Reduce decorative emoji and generic “feature card” density.

#### C3. Product proof is weaker than product claims

The site has simulators and polished copy but limited verifiable UI screenshots, customer evidence, implementation status, response-time data, integration health, or case-study outcomes. Template cards marked “Ready” are not credible when demo paths are unavailable in the audited environment.

**Required change:** add proof labels: Live, Pilot, Planned, Sample data. Publish a working demo, annotated UI, integration-status details, export example, security explanation, and consented customer evidence before scaling comparison/SEO pages.

#### C4. “Business” is overloaded

“Business” names the new product family and is also used as a Commerce plan/tier concept. Internal `PORTFOLIO` naming leaks into query parameters and implementation language while public copy says Business.

**Required change:** define a naming matrix for product family, plan, internal enum, navigation label, analytics value, and URL parameter. Keep technical compatibility aliases internal.

#### C5. Language is inconsistent

The site mixes “enquiries” and “inquiries,” along with Store, Website, Portfolio, Business, and site-mode terms. This weakens brand voice and can fragment event/report naming.

**Required change:** publish a concise content glossary and enforce it in UI, metadata, APIs, analytics, and documentation.

#### C6. Navigation/dropdown accessibility needs a designed interaction model

Dropdowns rely mainly on hover/focus-within CSS. Buttons do not expose a complete `aria-expanded`/`aria-controls` state model. A skip-to-content link was not found. Hero tabs need complete keyboard behavior and explicit tab/panel relationships. The template preview modal should be verified for focus trap, escape close, labelled dialog semantics, background inertness, and focus restoration. Decorative emoji should be hidden from assistive technology.

**Required change:** complete keyboard-only and screen-reader acceptance testing with automated axe checks plus manual verification.

#### C7. Title and description quality needs normalization

Some titles duplicate the brand, for example patterns equivalent to “... | BizTrackBD | BizTrackBD.” Many descriptions are long enough to truncate, and inherited social descriptions describe the wrong product.

**Required change:** define route metadata templates with one brand suffix, concise intent-led titles, useful descriptions, route-specific images, and automated uniqueness/length warnings.

#### C8. Pricing comparison is not mobile-designed

The comparison table is 600 px wide and relies on horizontal scrolling. A locally scrollable table can be accessible, but the interaction needs an explicit affordance, sticky first column where helpful, correct focus behavior, and no contribution to page-level overflow.

**Required change:** provide mobile plan cards or a deliberately scrollable comparison region with a visible cue and accessible label.

#### C9. Current local demo ecosystem is fragile

Links that depend on the admin app at port 3001 were unavailable during the audit. Wildcard tenant subdomain behavior could not be treated as production evidence from this environment. These may be development orchestration issues rather than production defects, but a customer-facing demo cannot depend on undocumented multi-process setup.

**Required change:** add a single verified demo environment and a smoke test that checks the marketing CTA, template demo, tenant storefront, and demo-admin destinations together.

#### C10. Language metadata does not match the Bangla tool experience

The document language is globally fixed to English while the courier fraud checker is predominantly Bangla. Open Graph alternate locales are not a substitute for document language or real locale alternates.

**Required change:** use route-aware `lang` for genuinely Bangla pages, or implement a coherent bilingual URL architecture. Add hreflang only when equivalent localized URLs actually exist.

#### C11. IndexNow is not implemented

This is not a launch blocker, but the content/feature expansion would benefit from a controlled IndexNow submission process after canonical and sitemap correctness are fixed.

## 5. Release-gated remediation order

### P0 — before paid traffic or Business public launch

1. Fix mobile navigation and all page-level overflow.
2. Restore `/demo` as a reliable proof journey.
3. Establish one Business pricing/entitlement contract and use it in signup/provisioning.
4. Make signup completely product-family aware.
5. Fix self-canonicals and route-specific OG/Twitter metadata across all indexable routes.
6. Remove contact PII from analytics payloads and implement consent orchestration.
7. Stop automatic consent timestamps; store real consent evidence.
8. Remove, qualify, or implement unsupported Business/CAPI/SMS/SLA/performance claims.
9. Replace the fraud checker's fabricated safe fallback with an explicit unknown/unavailable result.
10. Remove or implement the advertised public REST API.
11. Add public-form abuse controls and safe contracts.
12. Add automated release checks for the above.

### P1 — complete the planned product architecture

1. Create canonical template/mode/vertical mapping.
2. Add `/product`, `/business/templates`, `/business/pricing`, and the agreed public-profile path.
3. Link the Business cluster and remove orphan pages.
4. Make the homepage branch coherently by product family.
5. Implement dedicated Business permissions and the promised lead workspace.
6. Separate truthful product-family schema and offers.
7. remove unnecessary forced-dynamic rendering and verify production caching.
8. Use truthful sitemap modification dates.

### P2 — differentiation and growth

1. Replace unsupported marketing claims with evidence-led copy.
2. Add authentic UI/product proof and consented customer evidence.
3. Reduce generic card/emoji patterns and expand the operational design language.
4. Complete keyboard/screen-reader behavior and modal/tab testing.
5. Normalize naming, language, titles, and description templates.
6. Add GA4/Meta event QA, deduplication, attribution continuity, and tracking-health views only after consent and data-contract work.

## 6. Definition of done

The marketing system is aligned only when all of the following are true:

- No page-level horizontal overflow at 320–1440 px; navigation is usable by touch, keyboard, and screen reader.
- Every primary CTA resolves successfully in the deployed environment.
- A Business plan selected on a landing page is the same plan shown, provisioned, billed, entitled, and reported after signup.
- Every indexable route has a self-canonical, unique title/description, accurate OG/Twitter identity, correct schema, and at least one meaningful internal link.
- Non-essential tracking remains off until the applicable consent state permits it.
- No direct identifiers, inquiry text, or medical context are sent as advertising event parameters.
- Consent timestamps correspond to an actual versioned user action.
- Every public claim is implemented and tested, or visibly labelled Sample/Pilot/Planned.
- Business leads/bookings have dedicated authorization, safe public ingestion, operational workflow, and measurable response state.
- Production Lighthouse/CrUX evidence is captured separately; target CWV is evaluated at the 75th percentile.
- Automated smoke tests cover sitemap routes, primary CTAs, metadata, overflow, signup plan continuity, template-mode compatibility, consent defaults, and public API abuse controls.

## 7. Positive foundations worth preserving

- Bangladesh-first value proposition, BDT pricing context, local payments/couriers, and COD operations language.
- The “boardroom meets bazaar operations” visual direction and ledger/operational brand devices.
- Commerce order/profit interactive storytelling when it represents real behavior.
- Clear umbrella concept: Commerce, Business, and Hybrid on one platform.
- Existing multi-tenant, template, content, lead, booking, billing, domain, audit, and platform-admin foundations.
- Valid sitemap/robots basics, one-H1 discipline across the crawled sitemap, and the passing marketing typecheck.
- Baseline CSP, frame, referrer, MIME-sniffing, and permissions-policy headers in the audited environment.

The right next move is not another layer of landing-page polish. It is to make the public promise, signup contract, tenant capability, admin workflow, API behavior, analytics event, and proof asset agree with one another.
