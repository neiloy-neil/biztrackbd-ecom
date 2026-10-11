# Release hardening, free-tier operation, and the next build order (plan of 11 October 2026)

Decisions taken on 11 October 2026: run the test and pilot period on free plans of **Vercel (Hobby)**, **Supabase** and **Cloudflare**; scheduled jobs run from **Supabase**; the repository is connected **directly to GitHub** (no Lovable) with CI and CD; the next features are built in this order: platform admin screens, customer returns and tracking, marketing site and signup, discounts and notifications. The Supabase test data from the checkup is deleted.

Free-plan limits below are from general knowledge of these services and change often; **check each provider's current pricing page before relying on a number.**

## 1. Two things to settle before real merchants pay

1. **Vercel Hobby is for non-commercial use.** Its terms exclude commercial use. A pilot where merchants pay a monthly fee, or sell through the platform, is commercial. Hobby is fine for **testing and demos**; before the first paying merchant, move the four apps to **Vercel Pro** (about US$20 per member per month) or to one of the alternatives in section 4. Everything built here works on either.
2. **Supabase Free has no backups and pauses after a week with no activity.** Production data needs the backup job in section 2.3, and the scheduled sweeps (every 5 minutes) keep the project active. Move to Supabase Pro (about US$25 a month, daily backups, no pausing) before the first paying merchant as well.

## 2. How the free stack fits together

| Concern | Where it runs | Notes |
|---|---|---|
| Four Next.js apps | Vercel (Hobby for testing) | One Vercel project per app, Root Directory `apps/<name>`. Function time limits on Hobby are short (tens of seconds); keep each scheduled sweep under that (see 2.2) |
| Database | Supabase Postgres, region Mumbai (`ap-south-1`) | Use the session pooler string; the apps connect as `biztrack_app` / `biztrack_platform` (docs/17 checklist) |
| Sign-in | Supabase Auth | Default email sender is rate-limited: add custom SMTP (Brevo, Resend and Amazon SES have free tiers) before sign-in codes matter |
| Pictures | Supabase Storage (public bucket) | 1 GB free; pictures are re-encoded to WebP and small. Cloudflare in front caches them |
| DNS, TLS, CDN, firewall | Cloudflare (free) | Proxy the marketing, admin and platform hosts; add Turnstile (free CAPTCHA) to signup and sign-in when abuse appears |
| Backups | GitHub Actions nightly job to Supabase Storage or Cloudflare R2 | See 2.3. R2 gives 10 GB free with no download fee |
| Scheduled jobs | Supabase `pg_cron` + `pg_net` | See 2.1 |
| Custom domains for stores | Vercel domains API today | Cloudflare for SaaS (custom hostnames) is an alternative with a free allowance of hostnames; evaluate when the first store brings its own domain |
| CI and CD | GitHub Actions | `.github/workflows/ci.yml`, `e2e.yml`, `deploy.yml`; free minutes are plentiful for a public repository and limited (about 2,000 a month) for a private one |

### 2.1 Scheduled jobs from Supabase
The apps already expose the jobs as HTTP endpoints guarded by `Authorization: Bearer $CRON_SECRET`. Supabase calls them: `pg_cron` fires on a schedule and `pg_net` makes the HTTP request. Schedules:

| Job | Endpoint | When |
|---|---|---|
| Abandoned-checkout recovery | `POST <admin>/api/cron/abandoned` | every 5 minutes |
| Courier status sync | `POST <admin>/api/cron/courier-sync` | every 30 minutes |
| Domain checks | `POST <admin>/api/cron/domains` | every 5 minutes |
| Loyalty (expiry, warnings, birthdays) | `POST <admin>/api/cron/loyalty` | daily, 02:00 Dhaka (20:00 UTC) |
| Billing states and reminders | `POST <platform>/api/cron/billing` | daily, 03:00 Dhaka (21:00 UTC) |

Built and tested against the real Supabase project with a placeholder address (install, one manual call, removal): `tools/supabase-schedule.mjs` installs these jobs (it needs the deployed admin and platform addresses and the secret, and cannot be proven until something is deployed). The secret is stored in Supabase Vault, not in the job text. The `pg_net` schema is owned by Supabase and its functions stay callable by the API roles; that is harmless only while the schema is not exposed by the Data API (the default), so keep "Exposed schemas" at `public` only or switch the Data API off. Keep each job under the platform's time limit by processing a bounded batch per call (each sweep is safe to repeat).

### 2.2 Free-tier fit of the code (checks to do)
- Cron routes set `maxDuration`; Hobby caps it (lower it to 60 or less until on Pro).
- Per-process rate limiters: on serverless, each instance has its own memory, so limits are weaker than they look. Cloudflare rate limiting or Turnstile covers the sign-in paths until a shared store is added.
- Connection pool: serverless opens many short connections. Use the pooler and keep `DB_POOL_MAX` at 1 to 3 per instance.

### 2.3 Backups without a server
`pg_dump` cannot run inside a Vercel function. A scheduled GitHub Actions workflow runs the existing encrypted backup pipeline (dump, AES-256-GCM, upload) against Supabase each night and keeps the last 14 copies in a private bucket; the restore drill (`pnpm drill:backup`) is run monthly. Needs repository secrets `SUPABASE_DB_URL`, `BACKUP_ENCRYPTION_KEY_HEX`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. A second copy outside Supabase (R2) is recommended once R2 credentials exist.

## 4. Alternatives and suggestions
| Option | Cost | When it makes sense |
|---|---|---|
| **Stay on this stack, upgrade Vercel and Supabase to Pro at the first paying merchant** | about US$45 a month | Simplest; nothing to rebuild. Recommended |
| **Cloudflare Workers or Pages for the Next apps** (OpenNext adapter) | free tier allows commercial use; Workers has a daily request cap | Cheapest at pilot scale, but a technical spike is needed first: Prisma with the Postgres driver adapter and Next 16 on Workers is unproven here |
| **One small server (VPS) with Docker and Caddy**, Cloudflare in front, Supabase for the database | about US$5 a month | Most predictable, no function time limits, cron by plain system cron; you run the server |
| **Fly.io, Railway or Render** | small monthly cost | Container hosting without managing a server; keep Supabase and Cloudflare |
| **Neon or Supabase paid for the database** | varies | Only if Supabase's limits bind; the code uses plain Postgres plus its Auth and Storage |

Other free helpers worth adding: Cloudflare Turnstile (bot protection), Better Stack or UptimeRobot (uptime pings, also keep apps warm), Sentry free tier (error tracking), Cloudflare Web Analytics.

## 5. Plan, in order

### A. Release hardening (this plan's first part)
| # | Task | State |
|---|---|---|
| A1 | Build output small, size budget (`pnpm check:size`) | done |
| A2 | Real lint; `pnpm verify` and `pnpm e2e` at the root; known browser failures resolved | done |
| A3 | Docs 16 and 32 reconciled; one open-gates list | done |
| A4 | Environment docs and `.env.example` complete | done |
| A5 | GitHub Actions CI, E2E, CD and backup workflows; secrets helper | written; private repository `neiloy-neil/biztrackbd-ecom` created; secrets set: `SUPABASE_DB_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; the workflows have not run on GitHub yet |
| A6 | Supabase cron schedule tool; lower `maxDuration` for Hobby | done (tool tested on the real project; `maxDuration = 60`) |
| A7 | Nightly backup workflow | written; runner tested against Supabase Storage; not yet run on GitHub |
| A8 | Test data removed from Supabase | done |
| A9 | Deployment: register `biztrack.bd`, put it on Cloudflare, create the four Vercel projects and set their variables | needs you; step by step in docs/35 |
| A10 | Rotate the Supabase service role key and the sms.net.bd API key (both were pasted into chat); Brevo SMTP in Supabase Auth | needs you |
| A12 | SMS through sms.net.bd and email through Brevo | senders built and tested (docs/17 Messaging); the sms.net.bd key is valid, balance 0.10, recharge needed; Brevo key not yet provided |
| A13 | First platform admin | row created in Supabase for `neiloyfarhad@gmail.com`; set password and authenticator at the platform login once deployed (`tools/platform-admin.mjs` makes more) |
| A11 | One real parcel per courier, Meta Test Events, one real custom domain | needs real accounts |

### B. Features, in your order
1. **Platform admin screens** (docs/07 section 25): announcements (the table exists; owners see them in the admin), support tickets with replies and internal notes (tables exist), "log in as owner" with a 15-minute session, banner and audit (docs/12 section 3), usage and limits, richer store detail (tabs, domains, modules, notes, usage bars, MRR and GMV), dark sidebar and the missing navigation items, payment desk with the screenshot and the checks. Accept: each screen has tests, impersonation is refused for actions docs/12 forbids, and every impersonated change is audited.
2. **Customer returns and tracking**: a return request form on the customer's order (reason, photos, exchange or refund), the request reaching the existing admin returns pipeline, and the courier tracking timeline on the order page. Accept: end-to-end test from the customer's request to the admin refund.
3. **Marketing site and signup to match the design**: product preview, template gallery with previews and filters (five templates are now selectable), full pricing with toggle and comparison table, four-column footer, FAQ answers, split signup with the dark "what happens next" panel, brand step (logo, colour, language), live store preview, owner password at signup. Accept: side-by-side comparison against the canvas shows the sections present; accessibility checks pass.
4. **Discounts and notifications**: automatic discounts, flash sales (start and end), the notifications centre in the admin (`AdmNotifications`), message template editor (the table exists), "out for delivery" message. Gift cards and bundles only after these.

#### B1 in detail (platform admin), built in this order, each with tests
| Step | What | Notes |
|---|---|---|
| B1.1 | Dark sidebar with the designed navigation (Overview, Tenants, Payments and plans, Domains, Themes and modules, Support tickets, Announcements, Usage and limits, Team and audit log) and the "PLATFORM ADMIN" tag | `SaSidebar`; counts for pending payments and open tickets |
| B1.2 | Announcements: create with audience (all, a plan, one store), channels (banner now; email and SMS when a sender exists), start and end, English and Bangla; owners see current ones as a dismissible banner in the store admin | `Announcement` table exists; app roles already have read access (migration 16) |
| B1.3 | Support tickets: owners open and reply from the store admin; platform desk with list, filters (open, mine, waiting on store, solved), thread, internal notes, assignment, priority, status, saved replies, first-reply time | `SupportTicket`, `TicketMessage` exist; system messages carry store context (domain check, plan, usage) |
| B1.4 | Usage and limits: stores near or over their plan's products, orders, staff, SMS and storage limits | reads existing counters |
| B1.5 | Store detail: tabs (overview, subscription, usage, domains, modules, support, audit), KPI cards (orders and sales in 30 days, products, customers), internal notes, usage bars; store list gains plan, MRR, orders, sales, last active | notes need a small new table (`TenantNote`), the only migration in this step |
| B1.6 | Overview: MRR history chart, newest signups, trial-to-paid funnel, "needs you" cards | the daily billing job writes the daily snapshot into `PlatformDailyMetrics` |
| B1.7 | "Log in as owner": a 60-second one-time link from the platform to the store admin that starts a 15-minute session with a permanent banner and an exit button; blocked actions per docs/12 section 3 (removing domains, bulk customer exports); every change audited with the impersonator | signed cookie, not a Supabase session; reviewed against docs/32 before release |
| B1.8 | Payment desk as master and detail with the checks next to the claim | the payment screenshot panel needs an upload on the owner's payment form first |

### C. After the pilot starts
Day-90 offboarding purge; GA4 and Tag Manager events; email sending; strict script CSP; shared rate limits; independent penetration test; deeper review of the four newly ported themes against their source stores.

## 6. What stays outside this repository
Real credentials (Vercel, Supabase, SMS, couriers, Meta) live only in the providers' settings and in GitHub secrets; `tools/github-secrets.mjs` sets the GitHub ones without printing them. Nothing is pushed or deployed until you connect the repository and say so.
