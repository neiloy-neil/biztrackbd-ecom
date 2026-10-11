# BizTrackBD Ecom — Codebase vs Design and Documentation Audit

**Audit date:** 11 October 2026 (Asia/Dhaka)  
**Scope:** all tracked workspace source under `apps/`, `packages/`, `tools/`, `design/`, and `docs/`; generated `.next` output and the existing `checkup/` evidence were reviewed but are not treated as source of truth.  
**Method:** repository inventory, schema/docs/route/env mechanical cross-check, code reading, production build, typecheck, database/core/media tests, canvas measurement, Playwright test inventory, and manual review of reference-vs-actual screenshot composites.

## Executive conclusion

The transactional core is substantially implemented and unusually well tested. The schema matches the database specification, tenant isolation tests pass, the production build completes, and the 88-board design canvas has no clipping. The repository is **not yet a reliable pilot/deployment candidate**, however, because its release gates are incomplete, production output is pathologically large, several external systems remain unverified or unscheduled, the browser suites are outside the root test command and have known unresolved failures, and the implemented UI is materially thinner than the approved canvas in marketing, onboarding, and super-admin.

The highest-value next move is not another feature. It is a short release-hardening pass that fixes build tracing, makes the root quality gate real, resolves/reruns Playwright, and reconciles the phase/status documentation.

## Resolution status (added later on 11 October 2026, each item checked against the code)

| Finding | Status | Evidence |
|---|---|---|
| P1 Production bundles trace most of the repository | **Fixed** | The six dynamic file accesses in `packages/media/src/index.ts` carry `turbopackIgnore`; the build prints no tracing warnings; traced output is about 23 MB per app (`pnpm check:size`, budget 150 MB, runs in CI). The `.next` sizes quoted above were the pre-fix output plus the dev cache; the 11 GB Turborepo cache that filled the drive was cleared |
| P1 `pnpm lint` ran zero tasks | **Fixed** | Root `lint` is now `eslint .` (config `eslint.config.mjs`): 0 errors, 8 warnings. It no longer goes through Turbo |
| P1 Root test command skips the browser suites | **Fixed** | `pnpm e2e`, `e2e:admin`, `e2e:storefront`, `e2e:real`, `verify`, `verify:full` added; `.github/workflows/ci.yml` (every PR and push), `e2e.yml` (manual and nightly), `deploy.yml`, `backup.yml` written (not yet run on GitHub) |
| P1 Known Playwright failures | **Fixed** | Both failures were not product bugs (database stopped mid-run; a Phase 10 rule correctly refused the same-connection test). Two real issues from the new theme code were found by the rerun: a test probing the wrong element for the live accent, and design-screen baselines that needed the new template picker. Suites rerun in full |
| P1 Pilot operations unwired | **Partly done** | Done: Supabase cron installer (`tools/supabase-schedule.mjs`, tested on the real project with a placeholder address), nightly encrypted backup runner (`packages/core/scripts/backup-run.ts`, tested against Supabase Storage including retention), CI/CD. Still needs you or real accounts: create the Vercel projects and environment variables, rotate the service role key, custom SMTP, SMS account, one real parcel per courier, Meta Test Events, one real domain (docs/34 section 5, A9 to A11) |
| P1 Status documentation contradicts the code | **Fixed** | Current-status blocks at the top of docs 16 and 32, stale snapshot lines marked historical, one canonical open-gates list |
| P2 Marketing and onboarding below the design | **Open** | Third in the agreed build order (docs/34 B3) |
| P2 Super-admin coverage gap | **Open** | First in the agreed build order (docs/34 B1) |
| P2 Admin and builder interaction model; `AdmNotifications` has no route | **Open** | Confirmed: no notifications route exists. Fourth in the build order (docs/34 B4) |
| P2 Storefront merchandising | **Open** | Not scheduled |
| P2 Multi-theme runtime | **Implemented separately, then verified** | The registry exists in `packages/core/src/builder/theme.ts`; typecheck, unit tests, builds and (after one test fix) browser suites cover it. Visual fidelity of each theme against its source store has not been reviewed |
| P2 Environment documentation | **Fixed** | docs/17 and `.env.example` list every variable found; unread variables are marked planned |
| Test counts quoted here | **Corrected** | Core 603 (not 599), storefront 46 defined: 45 run plus 1 skipped on desktop by design |

## Priority findings

### P1 — Production bundles trace most of the repository

Both admin and storefront import `readImage()` from the same module that contains dynamic `process.cwd()`, `resolve`, `stat`, and `readFile` calls (`packages/media/src/index.ts:24-26`, `193-200`). Next/Turbopack warns that this causes the whole project to be traced into server output.

Fresh build output sizes:

| App | `.next` size |
|---|---:|
| admin | ~1,303 MB |
| storefront | ~652 MB |
| platform | ~416 MB |
| marketing | ~230 MB |

The build completed only after leaving the Windows sandbox (junction creation is required), then emitted disk-space warnings with roughly 1.1 GB free on `D:`. This can exceed deployment artifact limits, expose unnecessary source/assets to the deployment package, and make builds slow or flaky.

**Required:** separate local-disk serving into a development/self-hosting-only module or route, statically scope file tracing, and verify the deployed trace. Add an artifact-size budget to CI.

### P1 — The root quality gate gives false confidence

`pnpm lint` exits `0` while running **zero tasks**. The root declares `turbo run lint` (`package.json:8`), but no workspace package defines a `lint` script.

`pnpm test` runs only package scripts named `test` (`package.json:10`). Admin and storefront expose their browser suites as `e2e` (`apps/admin/package.json:10`, `apps/storefront/package.json:10`), so the root test command does not run them. Current inventory is 332 admin Playwright tests and 46 storefront Playwright tests.

The latest repository checkup explicitly records unresolved browser failures (`checkup/REPORT.md:73`): the Phase 7 rollback test, the Phase 9 referral checkout test, and two visual baselines. This audit listed the suites but did not run all 378 browser tests because they mutate the seeded development fixture, start five services, and the drive was nearly full after the production build.

**Required:** add real lint scripts/config, add `e2e`/`e2e:ci` orchestration to the root/CI, fail when Turbo executes zero tasks, and rerun the browser suites from a clean test fixture.

### P1 — Pilot operations still depend on unwired or unverified external systems

The repository's own security review still identifies the live gates (`docs/32-security-review.md:67-78`, with Phase 10 corrections at `91-98`):

- cron callers are not configured for courier sync, abandoned checkout, domains, loyalty, and billing;
- offsite backup scheduling and real recovery-time proof are absent;
- courier adapters, Meta CAPI, and Vercel Domains were primarily tested against local fakes;
- shared/distributed rate limiting is not implemented;
- strict `script-src` CSP and an independent penetration test remain open;
- customer-data deletion/retention handling remains incomplete;
- the service-role key documented as having been shared must be rotated;
- custom SMTP and live SMS deliverability are not production-proven.

Real Supabase sign-in, platform TOTP, and Supabase media storage **are now implemented** (`docs/32-security-review.md:91-97`); they should not remain listed as blockers elsewhere.

### P1 — Status documentation contradicts the current code

`docs/16-step-by-step-implementation-plan.md` repeatedly says real sign-in, platform 2FA, and Supabase media are missing (`64`, `71`, `117`, `145`, `177`, `187`). Phase 10 code and `docs/32-security-review.md:91-97` say all three were added and tested against the real project.

The security review itself has the stale blocker list at `66-70` immediately before the Phase 10 correction at `91-98`. This is a release risk because a reader cannot determine which pilot gates are current.

**Required:** add a dated “current status” section at the top of docs 16 and 32, mark historical phase snapshots as historical, and keep one canonical open-gates list.

### P2 — Marketing and onboarding are materially below the approved design

The approved UX requires a screenshot-led marketing home, live template demos, a complete pricing comparison, and a split onboarding flow with live preview (`docs/02-uiux-plan.md:103-110`, `139-147`). The current implementation is structurally valid but visibly thinner:

- marketing home lacks the large product preview, template gallery, pricing section, strong closing CTA, full FAQ answers, and four-column footer;
- templates are text tiles rather than live/screenshot previews and lack category filters;
- pricing lacks monthly/yearly toggle and comparison matrix;
- signup is a centred five-step form rather than the split layout, and lacks Google sign-in, password creation, the brand step, and live store preview.

Evidence: `checkup/screens/compare/01-marketing-home.png` and signup comparisons `05` through `09`.

### P2 — Super-admin has the largest functional/design coverage gap

The design calls for tenant health, MRR/churn, funnel, support tickets, announcements, themes/modules registry, usage/limits, detailed tenant tabs, notes, domains, modules, impersonation, and a richer payment-verification desk (`docs/02-uiux-plan.md:168-169`). Current platform routes cover overview, tenants, payments, plans, domains, and audit only.

Missing or materially incomplete compared with the canvas/spec:

- Support tickets (`SaTickets`)
- Announcements (`SaAnnouncements`)
- Themes and modules registry (`SaThemes`)
- Usage and limits view
- “Log in as owner” impersonation
- tenant tabs, internal notes, module/domain detail, per-tenant MRR/GMV
- payment screenshot/checklist workflow
- full overview MRR history, newest signups, and trial funnel

The schema already contains `SupportTicket`, `Announcement`, `TenantModule`, and `ThemeVersion`, so the gap is primarily services/routes/UI rather than data modelling. Evidence: `checkup/screens/compare/46-platform-overview.png` through `52-platform-audit.png` and `docs/16-step-by-step-implementation-plan.md:135-145`.

### P2 — Admin and builder match the design language, not the complete interaction model

Admin uses the correct brand, typography, dense cards, Bangladeshi data, permissions, responsive layout, and core workflows. The most visible gaps are:

- dashboard lacks the designed top bar, plan card, low-stock panel, and richer sales/recent-orders density;
- orders omit several designed filters/columns and the selected-row action treatment;
- product lists lack thumbnails/grid switch/import workflow;
- `AdmNotifications` has no route;
- the builder uses buttons rather than drag-and-drop, has no saved-section/media library, and does not provide the full three-pane/page/block editing model required by `docs/02-uiux-plan.md:165-166`;
- all five visual templates are now selectable, but saved-section/media libraries, block trees and drag-and-drop remain absent.

Evidence: `checkup/screens/compare/10-owner-dashboard.png` onward and the design-builder comparisons.

### P2 — Storefront is close in structure but thinner in merchandising

Kapor implements tenant routing, catalogue, cart, checkout, account, localization, SEO routes, loyalty/referrals, pages/blog, and builder-published sections. Against the canvas it lacks some merchandising richness: announcement bar/hero artwork in the checked fixture, four-card product density, sale/best-pick badges, compare-at prices, and image-rich category panels. Evidence: `checkup/screens/compare/53-store-home.png` through `58-store-home-mobile.png`.

The canvas itself is healthy: `pnpm canvas:measure` measured all 88 boards and reported **No clipped boards**.

### P2 — Deferred theme sources exist, but BizTrack does not yet have a multi-theme runtime

The external repositories are complete single-store applications, not drop-in theme packages. They duplicate their own Next app, admin, API routes, Prisma schema, auth, checkout, and integrations. They should be mined for storefront presentation and selected domain behavior; copying the applications wholesale would fork the platform and reintroduce tenant, security, and maintenance problems.

| Documented theme | Source reviewed | Assessment |
|---|---|---|
| `kapor` | `D:\AI\berber-clothing` | Already the source adapted into the shipped Kapor storefront. Its remaining value is the bespoke tailoring/measurement/appointment/monogram feature set, not a second visual theme. |
| `gadgetstudio` | `D:\AI\gadgetstudiobd-ecom` | Best next visual port and the documented first post-pilot theme. Warranty, comparison, bundles, and flash-sale presentation need explicit shared product attributes/services before parity. |
| `mini-bunny` | `D:\AI\mini-bunny` | Viable kids-store visual port. Its differentiator is the baby-profile/age-aware experience; the database model exists in BizTrack, but no service, route, or UI currently uses it. |
| `axionwear` | `D:\AI\axionwear` | Highest-complexity port: scheduled products, drops/waitlist, episodes, countdowns, comparison, bundles, and a dark streetwear presentation. BizTrack has `DropLaunch`/`DropNotify` tables, but the drops module is explicitly marked unbuilt. |
| `bindu` | `D:\AI\Bindu-Premium-Redesign` | This fifth documented source exists but was omitted from the four supplied paths. A light inventory found another full application with drops/episodes/bundles/flash-sale components; it needs a dedicated visual and semantic review before treating it as the intended beauty/lifestyle theme. |

Implemented after this audit on 11 October 2026:

- a typed registry now exposes all five templates at signup and in the owner design screen;
- builder drafts, publishing, history, preview and rollback resolve the active tenant theme and keep each theme's history isolated;
- the storefront resolves the current theme from the database and applies theme-specific tokens, copy and composition across shared commerce routes;
- signup, switching and history isolation have regression coverage, and the storefront, admin and marketing production builds pass;
- specialized `MeasurementProfile`, `BabyProfile`, `DropLaunch`, `DropNotify`, warranty/specification and episode behavior remains separate and is not falsely activated by a visual theme choice.

Security hygiene must precede reuse. Both Axionwear and Gadget Studio track a `.env` file containing names for database, payment, courier, Supabase service-role, and upload credentials. Values were not reproduced in this report; treat all real credentials ever committed there as exposed, rotate them, purge them from history where appropriate, and copy no environment file. The Berber source also contains the hard-coded Steadfast fallback-key issue already identified by the repository reuse map.

**Remaining theme work:** deepen the visual fidelity against each source application and implement optional domain modules independently. Keep shared commerce, auth, admin, integrations, and Prisma ownership inside BizTrack.

### P2 — Environment/configuration documentation is out of sync

Fresh `tools/docs-crosscheck.mjs` output found:

- used in code but missing from docs 17: `ADMIN_ORIGIN`, `DB_POOL_MAX`, `DEV_SMS_OUTBOX`, `DEV_TENANT_SUBDOMAIN`, the E2E outbox/DNS variables, `RUNS`, `SEED_URL`, `TEST_DATABASE_URL`, and `TEST_DIRECT_URL`;
- used in code but missing from `.env.example`: the above plus `ALLOW_PROD_DRILL`, `EDGE_CONFIG`, `NEXT_PUBLIC_DEMO_STORE_URL`, and `STORE_URL`;
- many documented variables not read directly by runtime code, some because functionality is deferred or values are accessed through alternative names.

The script also reports the old documented Steadfast webhook as missing, but doc 10 later supersedes it with the implemented tokenized generic courier webhook. This is an internal documentation contradiction, not a missing route. `/api/ai/batch-catalog` remains specification-only and should be clearly labelled deferred in doc 24.

## Confirmed strengths

- **Database/source alignment:** all 67 Prisma models are named in doc 08; no doc-08 model is absent from the schema.
- **Tenant isolation:** 32 database tests passed against the guarded local `biztrack_test` database, including RLS, cross-tenant foreign keys, restricted-role behavior, and pool-context leakage.
- **Domain behavior:** 599 core tests passed (1 optional live backup/storage test skipped), covering orders, idempotency, inventory contention, auth, billing, couriers, fraud, returns, COD reconciliation, profit, loyalty, referrals, builder, domains, and security.
- **Media:** 17 tests passed (1 live Supabase test skipped), including re-encoding and decompression-bomb limits.
- **Compilation:** `pnpm typecheck` completed 12 tasks successfully. `pnpm build` completed all 8 build tasks outside the Windows sandbox.
- **Security posture:** authorization/static security tests pass; real Supabase auth and platform TOTP are present; secrets are write-only/encrypted; RLS is broad and behavior-tested.
- **Design source quality:** 88/88 canvas boards render without clipping.
- **Browser-test breadth:** 332 admin and 46 storefront Playwright tests are defined across mobile and desktop, including accessibility and visual baselines—even though they are not part of the root gate and were not fully rerun here.

## Verification ledger

| Check | Result |
|---|---|
| `node tools/docs-crosscheck.mjs` | Completed; schema aligned; env and route/doc drift found |
| `pnpm typecheck` | Passed: 12/12 tasks |
| `pnpm build` | Passed outside sandbox: 8/8 tasks; dynamic FS tracing and disk-space warnings |
| `pnpm test` | Passed outside sandbox: DB 32, core 599, media 17; 2 opt-in live tests skipped |
| `pnpm lint` | Exit 0, but 0 tasks executed — invalid gate |
| `pnpm canvas:measure` | Passed: 88 boards, no clipping |
| Admin Playwright | 332 tests listed; full run not executed; existing report records unresolved failures |
| Storefront Playwright | 46 tests listed; full run not executed |

## Recommended remediation order

1. Fix media/file-tracing output and add a deployment artifact-size budget.
2. Make lint real; add root/CI browser orchestration; diagnose and rerun the known Playwright failures.
3. Reconcile docs 16/32 and environment documentation into a single current release checklist.
4. Wire and verify production operations: schedulers, backup target/restore, shared rate limits, key rotation, SMTP/SMS, one real courier parcel, Meta Test Events, and one real custom domain.
5. Close the marketing/onboarding design gap before acquisition work.
6. Build the missing super-admin operational surfaces before scaling merchant count.
7. Iterate admin/storefront visual richness after the release gates; keep other themes, AI batch catalog, chatbot, and marketplace explicitly post-pilot unless priorities change.

## Audit boundary

No production deployment, third-party live account, real-money payment, real courier booking, full browser suite, dependency-advisory refresh, or independent penetration test was performed in this audit. Those are release gates, not claims implied by the passing local suites.
