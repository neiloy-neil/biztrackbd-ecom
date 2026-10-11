# Full project checkup and audit: 11 October 2026

Scope: console logs, server logs and API behaviour; TypeScript; dependency audit; lint; row-level-security audit; every test suite; a walk-through against the real Supabase project; the code against every doc in `docs/` and against the design canvas. This file is the summary; the details are in `checkup/REPORT.md` (the walk-through and screenshot comparison) and `docs/33-codebase-vs-docs-audit.md` (the feature matrix).

## 1. Result at a glance

| Check | Before | After |
|---|---|---|
| TypeScript, 8 packages | clean | clean (`pnpm typecheck`, 12 tasks) |
| Production build | passed, **6 "whole project traced" warnings per app**, build cache 11 GB, disk full | passed, 0 warnings |
| `pnpm audit` | 4 findings (2 critical, 2 moderate) in the test runner | clean (production and development) |
| Lint | none existed | ESLint added: **0 errors**, 8 warnings |
| Core unit tests | 599 | **605** (four new regression tests across the checkup and multi-theme work) |
| Database / media tests | 32 / 17 | 32 / 17 |
| Admin Playwright, 1440 and 390 | 286 passed, 16 failed, 30 not run (machine and database trouble) | **332 passed (166 + 166), 0 failed** |
| Storefront Playwright | 45 | **45 passed** |
| Real sign-in (live Supabase Auth) | 16 | **16 passed**, 0 test accounts left |
| RLS audit | passed on an empty database and on an owner login (meaningless) | **OK with data**: local 35 tables with data, 34 cross-tenant inserts refused; Supabase the same method |
| Browser console, 63 pages crawled | 11 pages with problems | 6, all expected (intentional 404s; plain-text files asking for a favicon) |
| Server logs, 4 apps | no errors or warnings | no errors or warnings |
| API routes | correct | correct (see section 3) |
| Storefront themes | Kapor only | **Kapor, Gadget Studio, Mini Bunny, Axion Wear and Bindu selectable at signup and in Store design** |

> Note: the screenshots in `checkup/screens/` were taken before five themes became selectable, so the marketing templates page and signup template step show four themes as "Coming soon"; they are out of date on that point.

## 2. Findings, what was done, and what is left

### Fixed
| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | High | All three Supabase connection strings used the owner login, which bypasses row-level security: stores could see each other's rows. The earlier RLS audit could not have noticed. | Separate `biztrack_app` / `biztrack_platform` logins created, strings written, each verified to log in as that role (`tools/checkup-roles.mjs`); checklist in docs/17 |
| 2 | High | Supabase's public REST API had grants on every table (476) and function (19) for `anon` and `authenticated`. | Revoked, default privileges changed, rechecked (no rows); documented as a per-migration check |
| 3 | High | Supabase enables RLS on every new table, so `Plan` and `Announcement` returned no rows to the store apps: the signup page crashed. | Migration 16 adds read-only policies; applied to Supabase and locally |
| 4 | Medium | Quick-order address filter never matched: a word-boundary character had been replaced by a literal backspace in the regex. | Fixed, test added, shown to fail on the old regex |
| 5 | Medium | Shopper search turned `%` and `_` into the literal text `${c}` ("100%" found nothing). | Fixed, test added, shown to fail on the old code |
| 6 | Medium | Build bundled the whole project into every app (six dynamic file accesses in the picture driver); the Turborepo cache reached 11 GB and the drive filled up, which broke Chrome and the local database. | `turbopackIgnore` markers on those calls; 11 GB cache cleared; warnings now 0 |
| 7 | Medium | A same-connection referral rule (new in Phase 10) correctly refused the phase 9 test's friend, who arrived from the same address as the referrer. | The test sends the friend from another address; a new test checks the refusal message |
| 8 | Low | Dev-only dependency vulnerabilities (vitest, tinypool). | vitest 3 to 4.1.11; tests re-run |
| 9 | Low | No favicon on any app (a 404 on every page load); no `robots.txt` on marketing, admin or platform; no marketing sitemap; demo pictures 404 on the admin origin. | Added: icons, robots for all, sitemap, demo pictures copied |
| 10 | Low | No linter; 11 unused imports and variables; a BOM written as a literal character; a missing lint rule definition for existing disable comments. | ESLint with Next and hook rules added and cleaned |
| 11 | Low | Docs out of step with the code: 12 undocumented variables, 4 documented but unused, model count, landing route, webhook path, Inngest, GA4/TikTok, email, offboarding. | docs/05, 06, 16, 17, 32, 33 and `.env.example` updated |
| 12 | Info | The 11 October run's first platform finding ("Approve gives no message") was my script reloading the page; the page does show the message. | Report corrected |
| 13 | Feature | Four source storefronts existed but BizTrack's builder, settings reader and stylesheet were hard-wired to Kapor. | Added a typed five-theme registry, released every template at signup, added the Store design picker, isolated draft/publish history per active theme, resolved the active theme from the tenant database, and added responsive theme-specific tokens, copy and composition rules. Shared catalog, cart, checkout, auth and integrations remain unchanged. |

The five-theme implementation deliberately ports the source projects as visual templates, not as duplicated applications. Bespoke tailoring, baby profiles, drops/episodes and electronics warranty/specification behavior remain separate optional modules. Verification after the change: workspace typecheck 12/12; builder 53/53; platform/signup 44/44; production builds passed for storefront, admin and marketing.

### Not fixed, and why
| # | Item | Why not now |
|---|---|---|
| A | The feature gaps in `docs/33` (about 40 items, e.g. automatic discounts, gift cards, flash sales, support desk, "log in as owner", GA4, TikTok, email, template editor, return request form, brand step in signup) | These are features, not defects; each needs a decision. The list is ranked in section 4 |
| B | Marketing site, signup and platform admin are the thinnest match to the design canvas | Design work; see `checkup/REPORT.md` section 3 |
| C | Rotate the Supabase service role key (it was pasted in chat); set up Supabase custom SMTP | Needs you, in the Supabase dashboard |
| D | Turn off the Supabase Data API in the dashboard | I could not verify it was done; the grants are revoked either way |
| E | Strict script CSP, penetration test, shared (multi-instance) rate limiters | Larger pieces of work already listed in docs/32 |
| F | 8 lint warnings (3 unused variables, 4 uses of `any` in the tenant client and two tests, 1 full-page navigation in the order desk) | Intentional or harmless; listed in `checkup/eslint.json` |
| G | The "courier-sync" job reports every check failed in local development | Expected: the local data has fake courier keys |
| H | Test data in Supabase: stores `e2e-checkup-*`, 4 test accounts, a platform account, one order and one payment | Delete when you have finished reviewing; tell me and I will |
| I | Local Postgres lives in a temporary folder and stops when the session ends | Move it to a permanent folder or install it as a service |

## 3. API behaviour checked
Cron routes (`abandoned`, `courier-sync`, `domains`, `loyalty` on admin; `billing` on platform): 401 with no or a wrong secret, 200 with the right one. `/api/media`: 405 for GET, 400 for a bad upload. Courier webhook with an unknown token: 404. Storefront `/api/track`: 204 for POST, 405 for GET. No route returned a 5xx or leaked an error body.

## 4. Suggested order for the open features
1. Platform support: announcements screen and "log in as owner" (the tables and the security protocol already exist).
2. Customer return request form and the courier tracking timeline on the success page (the admin side already exists).
3. Automatic discounts and flash sales (coupons already have the engine).
4. A transactional email sender and a template editor (the table exists).
5. GA4 / Tag Manager events (the vault already stores the keys).
6. The marketing site and signup to match the design canvas.
7. The day-90 offboarding purge.

## 5. How to repeat any of this
`node tools/dev-real.mjs` (apps on Supabase), `node tools/dev-local.mjs` (apps on the local database, logs in `checkup/logs/`), `node tools/checkup-crawl.mjs` (console and network crawl), `node tools/checkup-run.mjs <stage>` (walk-through and screenshots), `node tools/checkup-audit.mjs` (RLS audit on Supabase), `node tools/checkup-migrate.mjs` (apply migrations to Supabase), `node tools/docs-crosscheck.mjs` (docs against code), `pnpm lint`.
