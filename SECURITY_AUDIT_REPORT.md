# Security Audit Report

**Date:** 4 November 2026 · **Branch:** `claude/monorepo-security-audit-3f7475` · **Method:** targeted code review plus automated checks. No production system, database or credential was touched.

## 1. Executive summary

The codebase is in better shape than most at this stage: no secrets are committed, the dependency audit is clean, raw SQL is parameterised, cron and payment-callback endpoints are authenticated or re-verified at the gateway, and security headers are set. Three confirmed weaknesses were found and fixed in this pass (two High, one Medium). **This is not a complete audit.** It covered the highest-risk surfaces (section 3 lists what was and was not inspected). Section 15 lists what is still unknown. Do not read this report as a statement that the system is secure.

| Severity | Found | Fixed | Remaining |
|---|---|---|---|
| Critical | 0 | 0 | 0 |
| High | 2 | 2 (code) | 0 code; 1 needs a deploy step (set `WHATSAPP_GATEWAY_SECRET`) |
| Medium | 3 | 1 | 2 |
| Low | 3 | 0 | 3 |

## 2. Monorepo architecture

pnpm 10.33 workspace, Turborepo 2.x, Node 22+. Next.js 16 apps deployed to Vercel (region `bom1`), Prisma 7 on Postgres (Supabase) with row-level security, 68 migrations.

| Path | Role | Security boundary |
|---|---|---|
| `apps/admin` | Merchant back office, mobile API `/api/mobile/v1`, cron, webhooks | Staff session (Supabase JWT cookies), `requireAction(...)` permission checks |
| `apps/storefront` | Public shop, checkout, customer OTP accounts, public REST `/api/v1` (API key + rate limit), payment callbacks | Anonymous plus customer session; tenant resolved from host |
| `apps/platform` | Super-admin, plan billing, cron | Separate DB role (`PLATFORM_DATABASE_URL`) |
| `apps/marketing` | Public site, contact/tracking endpoints | Anonymous |
| `packages/core` | All business logic, auth, vault, payments, webhooks | Shared by every app |
| `packages/db` | Prisma client, `withTenant` (sets tenant for RLS), RLS audit | Tenant isolation |
| `packages/media`, `ui`, `tsconfig` | Media storage, UI, config | – |
| `tools/whatsapp-gateway` | Standalone Baileys service | Network service, separate deploy |
| `.github/workflows` | ci, e2e, deploy, migrations, backup, smoke, template-previews | All set `permissions: contents: read` |

## 3. Scope: what was and was not audited

**Inspected:** repository secret patterns (tracked files) and tracked file names in git history; `.gitignore`; all cron routes; all payment callback/IPN/webhook routes; WhatsApp webhook and gateway; admin impersonation route; admin `proxy.ts` session refresh; security headers in both Next configs; raw SQL usage; `dangerouslySetInnerHTML` sites (sanitisation spot-checked); outbound `fetch` of merchant-supplied URLs; CI workflow permissions; `pnpm audit --prod`.

**Not inspected in depth (treat as unverified):** the 68 RLS migrations and policies (the `audit:rls` script and `rls-sweep` tests need a database and were not run); the ~45 mobile API routes' individual auth checks; the `/api/v1` API-key guard internals; file upload handlers (`api/media`, `api/returns/upload`); the ~100 server actions' per-action permission checks; customer OTP and session signing; the credential vault; git history *contents* (only file names and HEAD were pattern-scanned); Docker (none found) and Vercel project settings; dev-only dependencies.

## 4–7. Findings, severity, evidence

**F1 — High — WhatsApp webhook fails open; gateway has no authentication.** `apps/admin/src/app/api/webhooks/whatsapp/route.ts` only checked the token `if (process.env.WHATSAPP_GATEWAY_SECRET && …)`, so with the variable unset (it appeared nowhere else in the repo) anyone could POST `{event:"message.inbound", tenantId, phone, message}` and drive the order-bot for any tenant, or mark a WhatsApp connection CONNECTED. The comparison was a plain `!==`. The gateway itself (`tools/whatsapp-gateway/server.mjs`) never sent a token, answered every route unauthenticated, sent `Access-Control-Allow-Origin: *`, and echoed internal error messages. *Scenario:* an attacker who can reach the gateway port sends messages as any store; anyone on the internet can forge inbound customer messages to the webhook.

**F2 — High — Server-side request forgery via merchant-supplied URLs.** Merchant webhook targets (`validateWebhookUrl`, `dispatchOutboundWebhook` in `packages/core/src/messaging/webhook.ts`) accepted any http(s) URL including `localhost`, private ranges and `169.254.169.254`, followed redirects, and returned the endpoint's status and first 200 response bytes in the delivery log. The WhatsApp `gatewayUrl` (`packages/core/src/whatsapp/service.ts` `saveWhatsAppConfig`, used by `session.ts`) was likewise unvalidated and fetched server-side. *Scenario:* a store admin sets the webhook URL to the cloud metadata service or an internal host and reads the response through the delivery log. There was no SSRF guard anywhere in the repo.

**F3 — Medium — Under-payment accepted (SSLCommerz).** `packages/core/src/payments/sslcommerz.ts` logged a warning when the verified amount differed from the order total, then still marked the order PAID. Exploitation needs a valid transaction id from the same store, so the real risk is low, but the check was clearly meant to enforce.

**F4 — Medium — UddoktaPay store webhook and callback do not compare amount** (`packages/core/src/payments/uddoktapay.ts` `processUddoktaPayOrderSuccess`). Not fixed here: the verified-invoice shape returned by the gateway client was not checked for a reliable amount field, and changing payment acceptance blind could reject real payments. Needs a look with a sandbox account.

**F5 — Medium — Content-Security-Policy has no `script-src`.** Acknowledged in `next.config.ts` comments (Meta Pixel and Next inline bootstrap need nonces). XSS impact is therefore not limited by CSP. Mitigated by server-side HTML sanitisation (`sanitizeProductHtml`).

**F6 — Low — In-memory rate limiting** in `apps/marketing/src/app/api/contact/route.ts` and `track/route.ts` (a `Map`) is per serverless instance, so it is a weak abuse limit on Vercel.

**F7 — Low — Residual SSRF window:** the new guard resolves DNS and rejects private answers, but the connection resolves again, so DNS rebinding is narrowed, not eliminated. Closing it needs a connection-pinning HTTP agent.

**F8 — Low — `WHATSAPP_GATEWAY_SECRET` not in `turbo.json` `globalPassThroughEnv`;** only matters for test runs under Turbo strict env mode.

**Checked and found sound:** no committed secrets (pattern scan of tracked files, only placeholder DB URLs in docs/CI); `.env*` ignored, only `.env.example` ever added in history; cron routes use constant-time `Bearer` comparison and fail closed in production (the outbox route's dev fallback is gated on `NODE_ENV !== "production"`); the plan-billing and store payment webhooks re-fetch the invoice from the gateway rather than trusting the request; the one `$queryRawUnsafe` (`packages/core/src/customers/auth.ts:104`) uses a bound parameter; HSTS, `X-Content-Type-Options`, frame protection and `Referrer-Policy` are set; impersonation `next` redirect is allow-listed.

## 8. Fixes applied (uncommitted in this worktree)

| Finding | Change |
|---|---|
| F1 | `route.ts`: constant-time token check; in production returns 503 if the secret is unset, 401 if wrong; checks auth before reading the body; no longer echoes error text. `server.mjs`: requires the token on every route except `/health` (health no longer reports session counts), sends it on webhook calls, exits at startup in production without the secret, CORS removed. `session.ts`/`service.ts`: all calls to the platform gateway send the token (`whatsAppGatewayHeaders`), and only to the platform gateway so a store's own gateway never receives the secret. `.env.example` documents it. |
| F2 | New `packages/core/src/net/safe-url.ts` (`checkPublicHttpUrl`, `assertPublicHttpUrl`, `isPrivateAddress`; IPv4, IPv6, mapped addresses, internal suffixes, credentials in URL). Applied to webhook URL validation, to webhook delivery (DNS check at send time, `redirect: "manual"`), to saving `gatewayUrl` (https required in production), and to `resolveWhatsAppGatewayUrl` (a stored non-public store URL is ignored in favour of the platform gateway). Loopback/private stay allowed outside production so local development and tests are unchanged. |
| F3 | Underpayment (beyond a 1.0 tolerance) or a non-numeric amount now throws `ValidationError` and the order is not marked paid. Overpayment is still accepted. |

New tests: `packages/core/tests/safe-url.test.ts`.

## 9. Needs manual action

1. **Before deploying F1's change:** generate a 32+ character random value and set `WHATSAPP_GATEWAY_SECRET` identically on the admin app and the gateway host. Until then the webhook returns 503 in production and the gateway will not start. Also keep the gateway off the public internet (private network or firewall allow-list).
2. Any merchant who already stored a non-https or private `gatewayUrl` or webhook URL will have it ignored (gateway) or failing delivery (webhook) and will need to re-enter a public https address.
3. F4 (UddoktaPay amount check), F5 (nonce-based CSP) and F6 (shared rate-limit store such as Upstash/Redis) need design decisions or external services.
4. Rotate the Supabase service role key as already noted in `AUDIT-REPORT.md` (pilot operations item); this audit could not verify its state.

## 10. Dependency audit

`pnpm audit --prod`: **No known vulnerabilities found.** Dev-only dependencies, outdated packages, abandoned packages and duplicate versions were not assessed. `@whiskeysockets/baileys` (unofficial WhatsApp client) is a supply-chain and terms-of-service risk worth a separate decision. `pnpm.onlyBuiltDependencies` restricts install scripts to Prisma and esbuild, which is good practice.

## 11. Database and RLS

Not verified in this pass. The repo has a migration-based RLS design, `withTenant` tenant scoping, a dedicated platform DB role, `rls-sweep.test.ts`, `isolation.test.ts` and `pnpm audit:rls`, all of which require a running database. They were not run. Run `pnpm audit:rls` and `pnpm --filter @biztrackbd/db test` against a scratch database before relying on tenant isolation. Several migrations are named "fix_rls_on_new_tables" / "fix_rls_on_recent_tables", which shows RLS was missed on new tables at least twice; the sweep test is the control that catches that.

## 12. Authentication and authorization

Observed: Supabase JWT cookies refreshed in `proxy.ts` with `httpOnly` cookies; impersonation uses a signed ticket and an `httpOnly`, `sameSite=lax`, `secure`-in-production cookie; staff actions go through `requireAction(...)`; the public API uses API keys with rate limiting. Not verified: per-route checks on mobile and server-action surfaces (section 3).

## 13. Infrastructure and deployment

No Dockerfiles. CI workflows set minimal `permissions`. Third-party actions are pinned to major tags (`@v4`), not commit SHAs; all are first-party GitHub or the official pnpm action (Low). Deploy, backup and migration workflows were read only for permissions, not logic. Vercel project settings and HTTPS redirects are outside the repo and not verified.

## 14. Tests and verification (what was actually run)

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile --ignore-scripts`, `pnpm db:generate` | OK |
| Typecheck: core, admin, storefront, platform | Pass |
| `pnpm lint` (eslint) | 0 errors, 484 warnings (pre-existing, mostly `no-explicit-any`) |
| Vitest: `safe-url`, `webhook-management`, `webhook-wiring`, `whatsapp`, `sslcommerz` | 75 passed, 1 failed |
| The 1 failure | `sslcommerz.test.ts` "processes order success…" fails with `DATABASE_URL is not set` before reaching changed code; it needs a database and was not run. Its fixture pays 1850 for a 1850 order, so the new check should pass, but this is **not verified**. |
| Build, marketing typecheck, full core suite, DB/RLS tests, Playwright e2e | **Not run** |
| WhatsApp gateway | `node --check` syntax only; not run against WhatsApp |

## 15. Remaining risks

Unverified RLS and tenant isolation; unreviewed mobile and server-action authorisation; unexamined upload handlers and vault; DNS-rebinding window (F7); no `script-src`; weak per-instance rate limits; git history contents not scanned for secrets (run `gitleaks detect` or `trufflehog git file://.` locally); dev dependencies unaudited.

## 16. Roadmap

1. **Now:** set `WHATSAPP_GATEWAY_SECRET` on both sides, review and commit this diff, run the DB-backed test suites (`sslcommerz`, `isolation`, `rls-sweep`, `audit:rls`) and the e2e suites.
2. **This sprint:** run a history-wide secret scan; review mobile API and server-action authorisation systematically (every route calls a permission check, with a test that enumerates routes); amount check for UddoktaPay (F4); audit upload handlers (type, size, path handling).
3. **Next:** shared rate limiting; nonce-based CSP; pin GitHub Actions to SHAs and add Dependabot and `pnpm audit` on dev dependencies to CI; connection-pinned HTTP agent for outbound merchant URLs.
