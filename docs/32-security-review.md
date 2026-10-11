# Security Review and Pilot Readiness (Phase 8)

This is a review by the people who wrote the code, with automated checks where a check can be automated. It is not a penetration test. Anything it says is "fine" means "we looked and found nothing", not "proven safe". Section 4 is the honest list of what stands between this code and a pilot.

## Current status and open gates (11 October 2026)
This is the one canonical list. Sections 3 and 4 below are the Phase 8 snapshot; where they disagree with this list, this list is right.

**Done since Phase 8 (Phase 10 and the 11 October checkup):** real sign-in for stores and the platform team with two-step for the platform; picture storage and backups on Supabase Storage; two people editing one design page are told (stale saves refused); row-level security verified on live data in Supabase with the restricted roles; the dependency audit is clean; build output is small (about 23 MB per app); ESLint runs with no errors.

**Open gates before a pilot:**
1. Nothing runs in production yet: no deployment, no cron callers configured (`/api/cron/abandoned` 5 min, `courier-sync` 30 min, `domains` 5 min, `loyalty` daily, platform `/api/cron/billing` daily), no CI.
2. Backups: the pipeline and the restore drill pass against the real Supabase project; **no schedule runs it** and there is no second copy outside Supabase.
3. SMS is not live (Greenweb account and registered sender needed); Supabase custom SMTP is not set, so sign-in emails are rate-limited.
4. Courier adapters, the Meta Conversions API and the Vercel Domains client were tested against fakes; one real parcel per courier, Events Manager Test Events and one real domain are still to do.
5. Rotate the Supabase service role key (it was pasted into a chat) and any key that was ever committed in the source projects being ported.
6. Weaker than it should be: no strict `script-src` CSP; rate limits are per process; no independent penetration test; customer data deletion on request is not built.

## 1. Method

1. **Automated, repeatable** (run in the normal test suites): the tenant isolation sweep over every table, static checks over the source, the dependency audit.
2. **Manual reading** of the parts where a mistake costs the most: the order path, sign-in codes, the secrets vault, webhooks, uploads, the editor preview, domain connection.
3. **Measured behaviour**: the order path under contention, and a restore of a real backup.

Re-run it all:

| Check | Command |
|---|---|
| Isolation of every tenant table, on the populated dev database | `pnpm audit:rls` |
| Isolation, structure and behaviour, on a fresh test database | `pnpm --filter @biztrackbd/db test` |
| Action authorisation, secrets, risky patterns | `pnpm --filter @biztrackbd/core test` (`tests/security.test.ts`) |
| Dependencies with known advisories | `pnpm audit --prod` |
| Backup, restore, tamper refusal | `pnpm drill:backup` |
| Orders under pressure | `pnpm load:orders` |

## 2. What was checked and what it found

| Area | Check | Result |
|---|---|---|
| Tenant isolation | Every table with a `tenantId` (60), as the restricted app role: nothing visible with no tenant; no other tenant's row readable, changeable, deletable; a copied row cannot be inserted | Holds on all 60 (31 cross-tenant inserts attempted on the populated database, all refused). `PlatformAuditLog` has no grant for the app role at all |
| App role | Not a superuser, cannot bypass row-level security | Holds |
| Who may call an action | Every exported action in the admin (30+) and platform apps checks the caller before its first call into the core | Holds. Two files are public on purpose: accepting an invitation (the secret token is the credential) and the development stand-ins |
| Route handlers | Signed in, signed by a secret, or on a one-item allow-list | Holds. The only open route is the store-photo reader, which is public on purpose |
| Development sign-in | Refuses to run when `NODE_ENV=production` | Holds (both apps) |
| Secrets in source | Cloud keys, private keys, tokens, database URLs with a password | None found |
| Script injection | `eval`, `new Function`; `dangerouslySetInnerHTML` outside JSON-LD, validated CSS or sanitised HTML | None found |
| Logging | Phone numbers, tokens, passwords, codes, TrxIDs in log calls | None found |
| Editor input | Section text has markup stripped; links must be `https://` or a path on the store; pictures must be the store's own uploads or `https://`; colours must be hex; a page and its settings are validated again on the server and again in the browser before drawing | Holds (52 tests including injection attempts) |
| Editor preview | A signed link (HMAC, two hours, one store, read-only); the frame accepts messages only from the window that framed it and from the configured admin origin | Holds. See section 4 for the framing note |
| Domain claims | A claimed name routes nothing until DNS is correct and the host confirms it; a claim nobody verified for a day does not block the real owner | Holds |
| Order path | Under 4 times more buyers than stock: never oversold, never negative; the same order sent five times at once creates one order | Holds (3,000 attempts) |
| Uploads | Type and size checked, re-encoded, path shape checked, per-person rate limit | Holds, with the per-process limiter caveat in section 4 |
| Dependencies | `pnpm audit --prod` | Three advisories in Prisma's command-line tooling (mysql2, which we do not use; deepmerge-ts). Pinned to patched versions; now clean |
| Backups | Encrypted at rest, authenticated, a changed byte or a wrong key refused, a restore is byte-for-byte equal in rows and keeps the isolation | Holds locally (section 4 for what is missing) |

## 2b. Added in Phase 9

| Area | What was checked | Result |
|---|---|---|
| Spending points and the VIP discount | Both depend on `verifiedCustomerId`, which only the storefront server sets, from the signed session cookie, and only when that customer owns the number being ordered with. A guest who types a Gold customer's number gets no discount and cannot spend points | Holds (tests: guest refused, other store's customer id refused) |
| Points double-spend | Four orders racing for one balance | Exactly one placed; the balance never goes negative |
| Ledger tampering | Changing points, kind, account or order on a ledger row; deleting a row as the app; two earns for one order | All refused by the database |
| Referral abuse | Own code, existing customer, repeat use of a phone, the referrer's own address, a cart under the minimum | Refused with a reason. Not covered: the same person on a new phone and a new address |
| Pages and blog text | Scripts, event handlers, styles, iframes, javascript links, non-https pictures, a blog cover picture that is not an upload or https | Removed or refused (the same allow-list as product descriptions); an end-to-end test checks a script in a page never runs |
| Admin access | Pages and blog need store-design rights; loyalty needs marketing rights; fulfilment staff are sent away | Holds |

Items 12 and 15 below also apply to these screens (the per-process limiter and last-save-wins).

## 3. Fixed during this review

- **Missing security headers** on all four apps. Added: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a `Permissions-Policy` that turns off camera, microphone, location, payment and USB, a `Content-Security-Policy` of `object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors ...`, HSTS in production, and `X-Frame-Options: DENY` on the admin, platform and marketing apps. The storefront may be framed by the store admin only on `/preview` and `/l/*`.
- **Dependency advisories** (above).
- **A defence-in-depth gap**: the domain "Check now" action relied on the function it called to check the caller. It now checks first, and a test enforces the rule everywhere.
- **Dark-mode contrast**: not a security issue; found by the same sweep of every screen.

## 4. Open items, and the pilot blockers

**Blockers: nothing below can be skipped for a pilot.**

1. **(Resolved in Phase 10.) Real sign-in for store staff and the platform team was not built at the time of Phase 8.** Both apps use a development stand-in (`DEV_AUTH=1`, a cookie picks the person) that refuses to run in production. Until Supabase Auth (or equivalent) replaces `apps/admin/src/lib/session.ts` and `apps/platform/src/lib/session.ts`, there is no way for a merchant to sign in to a deployed store. The rest of the code does not need to change: both files return the same session shape. The platform team also needs two-factor sign-in (docs/12 section 3), which is not built.
2. **No deployment exists.** Nothing has run on Vercel or Supabase. The domain client, the edge routing push and the cron schedules have only been run against local stand-ins.
3. **(Resolved in Phase 10: Supabase Storage driver, and the storage counter goes down.) Photos were stored on local disk.** A Supabase Storage driver is needed; the storage counter also does not go down when a photo is replaced or removed.
4. **Schedulers are not configured.** These endpoints need a caller with `Authorization: Bearer $CRON_SECRET`: `/api/cron/courier-sync` (30 min), `/api/cron/abandoned` (5 min), `/api/cron/domains` (5 min), and the platform's `/api/cron/billing` (daily). The backup job (03:00 Dhaka) does not exist yet.
5. **Offsite backups are not wired.** The encrypted pipeline and the restore drill exist and pass locally; a Cloudflare R2 `BackupStore`, its credentials, and the lifecycle rule do not. Supabase point-in-time recovery is a setting to switch on and test on the real project. The 60-minute recovery target is not demonstrated for a real database (the local drill restored 3,400 rows in 2.4 seconds).
6. **SMS is not live.** A Greenweb account and a registered sender are needed for sign-in codes and abandoned-checkout messages; development logs them.

**Before real money moves:**

7. Courier adapters (Steadfast, Pathao, RedX) were written from documentation and tested against fakes. Book one test parcel per courier and compare the status words.
8. The Meta Conversions API was tested against a local fake only; the browser Pixel logged an invalid-currency warning for BDT once. Check Events Manager's Test Events on first use.
9. The Vercel Domains client reads `config.misconfigured` and `project domain verified`; confirm with one real test domain.
10. A person who did not write this code should attempt a penetration test, particularly of: sign-in (once it exists), the invitation link, the order access link, the cron endpoints, uploads, and the editor preview link.

**Weaker than it should be:**

11. No strict `script-src`. The Meta Pixel and Next's inline bootstrap need nonces first; until then a bug that injected markup would not be stopped by the browser.
12. Rate limits for uploads and some sign-in paths are per server process; with several servers they multiply. Move them to the edge or a shared store.
13. The editor preview page may be framed only by the store admin. If `NEXT_PUBLIC_ADMIN_URL` is missing in production the header fails closed (only the store itself may frame it, so the editor preview stops working), and the page shows nothing without the signed link either way.
14. `PREVIEW_SECRET` must be the same in the admin and the storefront; production refuses to create a preview link without a secret.
15. *(Resolved in Phase 10.)* Two people editing the same page used to overwrite each other's draft; a stale save is now refused and the editor offers a choice.
16. No cookie consent banner. Not required for Bangladesh; needed if the store sells to the EU.
17. Customer data deletion on request is not built; a phone number's delivery outcomes are never forgotten.


## 2c. Added in Phase 10
- **Real sign-in.** Staff and platform sign in with Supabase Auth; the apps keep httpOnly cookies and refresh them in `proxy.ts`. A token is re-checked with Supabase (cached 30 seconds), so a disabled account stops working quickly. Staff are tied to stores only by a confirmed email, through `SECURITY DEFINER` functions; a person with no row gets nothing. The stand-in sign-in exists only when `DEV_AUTH=1` and `NODE_ENV` is not production.
- **Platform admins** need a verified authenticator (TOTP) and an `aal2` session; there is no password-only path.
- **Owner and password reset** use an emailed code that proves the email before a password is chosen, so nobody can claim an address first.
- **Passwords** 10 to 72 characters. Failed attempts per email and address are limited (per process: a multi-instance deployment needs a shared store).
- **Pictures** live in a public bucket under the store's own folder; deleting a product picture removes the file and gives the storage back. Backups are encrypted before upload to a private bucket.
- **Checked against the real project:** `apps/admin/e2e-real` (16 tests: sign-in, wrong password, two-step, invitations, platform, limiter) and the opt-in live storage and backup tests.
- **Still open:** a strict script content-security-policy, an independent penetration test, the pilot, rotating the service role key that was shared in chat, custom SMTP for Supabase email (the default sender is rate-limited), per-process limiters, pictures kept inside builder JSON are not released from storage on removal, and a deleted picture can be served from the CDN for about a minute.


## 2d. Added by the 11 October 2026 checkup
- **Row-level security was shown to hold on live data in Supabase** with the restricted role: each store sees only its own rows, and with no store set the app role sees nothing. The first run was invalid because the apps used the owner login; the checklist in docs/17 now says how to check which login an app uses.
- **Supabase specifics found:** public REST API grants to `anon` and `authenticated` (revoked); automatic RLS on new tables hiding two readable tables (policies in migration 16).
- **Code:** dependency audit clean (production and development); ESLint added; the search escaping bug (`%` and `_`) was a correctness bug, not an injection (the value was a bound parameter either way).
- **Still open:** strict script CSP, penetration test, rotating the service role key, shared rate limiters, Supabase custom SMTP.
