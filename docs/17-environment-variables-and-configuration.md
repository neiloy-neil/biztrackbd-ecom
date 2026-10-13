# Environment Variables, Configuration & Secrets Catalog

Status: COMPLETE SPECIFICATION  
Scope: All Apps (`marketing`, `storefront`, `admin`, `platform`) & Packages (`db`, `core`, `integrations`)

---

## 1. Master `.env.example` Template

Create a `.env.local` in your workspace root or individual app directories using these keys:

```bash
# ==============================================================================
# 1. DATABASE & POSTGRESQL (SUPABASE / PRISMA)
# ==============================================================================
# Transaction-pooled connection string (for serverless queries via Prisma)
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direct connection string (required for Prisma migrations)
DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"

# Platform role with BYPASSRLS (docs/08 section 3.4). Set ONLY in apps/platform and platform Inngest jobs, never in admin or storefront.
PLATFORM_DATABASE_URL="postgresql://biztrack_platform:[password]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

# ==============================================================================
# 2. SUPABASE AUTH & STORAGE
# ==============================================================================
NEXT_PUBLIC_SUPABASE_URL="https://[your-project-id].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOi..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET="store-assets"

# ==============================================================================
# 3. DOMAINS, HOSTING & EDGE CONFIG (VERCEL)
# ==============================================================================
NEXT_PUBLIC_ROOT_DOMAIN="biztrack.bd"
NEXT_PUBLIC_APP_URL="https://app.biztrack.bd"
NEXT_PUBLIC_PLATFORM_URL="https://super.biztrack.bd"

# Vercel Edge Config connection string (for sub-5ms edge hostname lookups)
EDGE_CONFIG="https://edge-config.vercel.com/ecfg_...[token]"
EDGE_CONFIG_ID="ecfg_..."

# Vercel Domains API (for custom domain registration & SSL issuance)
VERCEL_PROJECT_ID="prj_..."
VERCEL_TEAM_ID="team_..." # Optional, leave blank if personal account
VERCEL_AUTH_TOKEN="vca_..."

# ==============================================================================
# 4. CREDENTIALS ENCRYPTION VAULT (AES-256-GCM)
# ==============================================================================
# 32-byte hex string used to encrypt tenant courier & payment secrets
# Generate with: node -e "console.log(crypto.randomBytes(32).toString('hex'))"
INTEGRATION_VAULT_SECRET="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
INTEGRATION_VAULT_KEY_ID="v1" # stored in TenantIntegration.secretKeyId so keys can be rotated

# ==============================================================================
# 5. INNGEST BACKGROUND QUEUES & CRONS
# ==============================================================================
INNGEST_EVENT_KEY="local" # In production: "inng_evt_..."
INNGEST_SIGNING_KEY="local" # In production: "signkey-prod-..."
INNGEST_DEV_SERVER_URL="http://127.0.0.1:8288"

# ==============================================================================
# 6. PLATFORM SMS AGGREGATOR (GREENWEB / REVE)
# ==============================================================================
GREENWEB_SMS_TOKEN="your_greenweb_api_token"
DEFAULT_SMS_SENDER_ID="" # Blank for non-masking, or "BIZTRACK" if approved

# ==============================================================================
# 6b. PLATFORM EMAIL (BREVO), platform-managed with per-store plan quotas (docs/04, docs/05)
# ==============================================================================
BREVO_API_KEY="xkeysib-..."
BREVO_SENDER_EMAIL="orders@mail.biztrack.bd" # verified sender domain (SPF and DKIM)
BREVO_WEBHOOK_SECRET="..." # verifies delivery and bounce webhooks
# Stores that bring their own Brevo key keep it in TenantIntegration (provider BREVO_BYO), never here.

# ==============================================================================
# 7. PLATFORM SAAS SUBSCRIPTION BILLING
# ==============================================================================
# Stripe (Global Cards)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."

# SSLCommerz (Bangladesh Platform Subscriptions)
PLATFORM_SSLCOMMERZ_STORE_ID="biztrackbd0live"
PLATFORM_SSLCOMMERZ_STORE_PASSWD="password"
PLATFORM_SSLCOMMERZ_IS_LIVE="false" # false for sandbox, true for live

# Manual bKash / Nagad Platform Receiver Numbers (displayed to tenants in billing)
PLATFORM_BKASH_MERCHANT_NUMBER="01898-765432"
PLATFORM_NAGAD_MERCHANT_NUMBER="01898-765432"
```

---

## 2. Secrets Encryption Vault (`packages/core/src/vault/`)

Built in Phase 1. AES-256-GCM with these properties (the earlier sample here had none of the first three):

- **Per-integration keys.** Each tenant and provider gets its own key, derived from the master key with HKDF (salt = tenantId, info = provider).
- **Bound to its row.** tenantId, provider and mode are authenticated data. A ciphertext copied to another store, provider or mode fails to decrypt.
- **Rotation.** `INTEGRATION_VAULT_KEYS="v1:<64 hex>,v2:<64 hex>"` with `INTEGRATION_VAULT_KEY_ID` naming the active key. Rows record `secretKeyId`, old rows keep decrypting, and `reencryptTenantSecrets()` moves a store to the active key. `INTEGRATION_VAULT_SECRET` alone still works for a single key.
- **Stored format.** `base64(iv[12] | authTag[16] | ciphertext)` in `TenantIntegration.secretCipher`. Keys are read when used, not at import, so a missing key fails loudly with a clear message.
- **Write-only.** `listIntegrations()` returns which fields are set, never values. `loadCredentials()` is server-side only, for the courier and payment adapters. Decryption failures are deliberately uninformative.
- **Webhook tokens.** URLs carry a random `integrationToken`; `resolve_integration_by_token()` (SECURITY DEFINER) maps it to a store. `rotateWebhookToken()` invalidates a leaked URL.
- **Tests:** `packages/core/tests/vault.test.ts` (21).

---

## 3. Environment Variable Distribution Matrix

| Variable | Scope | Used By |
|---|---|---|
| `DATABASE_URL` | Server Only | `packages/db`, Next.js Server Components, API routes |
| `DIRECT_URL` | CLI Only | Prisma Migration Engine (`prisma migrate dev`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Client & Server | Auth sessions, Storage image URLs |
| `SUPABASE_SERVICE_ROLE_KEY` | Server Only | Creating and deleting sign-in accounts (staff invitations), uploading to and deleting from the storage buckets, backups. Never in code, docs or chat; rotate it if it was ever pasted anywhere. |
| `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY` | Server (the anon key may be public) | Sign-in (`/auth/v1`), two-step codes, storage. Without `SUPABASE_URL` the apps refuse to sign anyone in outside development. |
| `DEV_AUTH` | Development only | `1` turns on the stand-in sign-in (role switcher). Ignored when `NODE_ENV=production`. |
| `MEDIA_DRIVER`, `MEDIA_BUCKET` | Server Only | `supabase` keeps pictures in the public bucket (default `store-media`); otherwise a local folder. |
| `RUN_LIVE_SUPABASE` | Tests only | `1` runs the opt-in tests against the real project (storage, backup drill). |
| `EDGE_CONFIG` | Edge Middleware | `apps/storefront/middleware.ts` |
| `VERCEL_AUTH_TOKEN` | Server Only | Custom domain provisioning in `packages/core` |
| `INTEGRATION_VAULT_SECRET` | Server Only | Encrypting/decrypting per-tenant courier & payment keys |
| `PHONE_TRUST_SALT` | Server Only | Salting the phone hashes of the cross-store delivery trust record (docs/12). Same in every app, never rotated. Falls back to `CUSTOMER_AUTH_SECRET`; required in production |
| `CRON_SECRET` | Server Only | Bearer token that authorises `/api/cron/courier-sync` (store admin, every 30 minutes), `/api/cron/abandoned` (store admin, every 5 minutes), `/api/cron/loyalty` (store admin, once a day: expires idle points, warns first, sends birthday vouchers), `/api/cron/domains` (store admin, every 5 minutes) and `/api/cron/billing` (platform app, daily) |
| `BACKUP_ENCRYPTION_KEY_HEX` | Server Only | 64 hex characters (32 bytes). Encrypts backups; keep a copy somewhere other than the database host, because a backup cannot be opened without it. The drill makes a throwaway key when unset |
| `PG_BIN` | Tooling | Folder holding `pg_dump` and `psql`, when they are not on PATH (the backup drill) |
| `ALLOW_PROD_DRILL` | Tooling | Set to run the restore drill next to a database whose URL contains `prod`. Leave unset |
| `VITALS_HOST` | Tooling | The storefront address the web vitals audit measures. Default `http://rongdhonu.localhost:3000` |
| `PREVIEW_SECRET` | Server Only | Signs the editor's preview link. Must be the SAME in the store admin and the storefront. Falls back to `CRON_SECRET`; required in production |
| `PLATFORM_A_RECORD` | Server Only | The IP address owners create an A record for (bare domains). Default `76.76.21.21` |
| `PLATFORM_CNAME_TARGET` | Server Only | The name owners point a CNAME at (subdomains), for example `cname.biztrack.bd` |
| `VERCEL_TOKEN` | Server Only | Lets the store admin and the platform app add and read domains on the storefront's Vercel project. Without it a correct DNS record waits at "getting the certificate" |
| `VERCEL_PROJECT_ID` | Server Only | The storefront project that serves custom domains |
| `VERCEL_TEAM_ID` | Server Only | Only for a team-owned project |
| `VERCEL_API_URL` | Development only | Points the domains client at a local stand-in. Leave unset in production |
| `DEV_DNS_FILE` | Development only | A JSON file of DNS answers read instead of real DNS, for tests. Ignored when `NODE_ENV=production` |
| `GREENWEB_SMS_TOKEN` | Server Only | The platform's shared SMS account: abandoned-checkout recovery and sign-in codes. Without it production refuses to send and development logs the message |
| `META_GRAPH_URL` | Development only | Points the Conversions API at a local fake. Ignored when `NODE_ENV=production` |
| `PLATFORM_BKASH_NUMBER`, `PLATFORM_BKASH_KIND`, `PLATFORM_NAGAD_NUMBER`, `PLATFORM_NAGAD_KIND` | Store admin | Where stores send subscription money; shown on every store's billing screen |
| `NEXT_PUBLIC_ADMIN_URL`, `NEXT_PUBLIC_MARKETING_URL`, `NEXT_PUBLIC_DEMO_STORE_URL` | Marketing site | Links on the signup success page, metadata and the templates page |
| `COURIER_BASE_URL_STEADFAST` (and `_PATHAO`, `_REDX`) | Development only | Points a courier adapter at a local stand-in. Ignored when `NODE_ENV=production` |
| `INNGEST_SIGNING_KEY` | Server Only | Verifying incoming Inngest background event webhooks |
| `GREENWEB_SMS_TOKEN` | Server Only | Sending order confirmation and OTP SMS in Bangladesh |
| `BREVO_API_KEY` | Server Only | Order, payment and recovery emails sent as the store; metered per tenant in `UsageCounter` |
| `PLATFORM_DATABASE_URL` | Platform app only | Cross-tenant reads for the super admin through the `biztrack_platform` role |
| `STRIPE_SECRET_KEY` | Server Only | SaaS subscription checkout sessions and renewals |
| `PLATFORM_SSLCOMMERZ_STORE_ID`| Server Only | Bangladeshi card and MFS subscription checkout |

## Supabase deployment checklist (found in the 11 October 2026 checkup)
1. **Three different logins.** Owner (`postgres.<ref>`): migrations and seeding only. `biztrack_app.<ref>`: the store apps (`DATABASE_URL`). `biztrack_platform.<ref>`: the platform app (`PLATFORM_DATABASE_URL`). Giving the apps the owner login switches row-level security off for every store. Check with `SELECT current_user, (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user)`: the app must say `biztrack_app, false`. `node tools/checkup-roles.mjs` sets the two passwords and does this check.
2. **Use the session pooler** (`aws-0-<region>.pooler.supabase.com:5432`, user `role.<ref>`) from networks without IPv6; the direct host is IPv6-only.
3. **Supabase enables RLS on every new table** (event trigger `ensure_rls`). A table meant to be readable needs an explicit policy (migration 16 does this for `Plan` and `Announcement`). A new table with no policy is invisible to the store apps.
4. **Close the public REST API.** After every migration, run in the SQL editor and expect no rows: `SELECT grantee, count(*) FROM information_schema.role_table_grants WHERE table_schema = 'public' AND grantee IN ('anon','authenticated') GROUP BY grantee;`. If rows appear: `REVOKE ALL ON ALL TABLES/SEQUENCES/FUNCTIONS IN SCHEMA public FROM anon, authenticated;` and `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES/SEQUENCES/FUNCTIONS FROM anon, authenticated;`. Also switch the Data API off in the dashboard.
5. **The RLS audit proves nothing on an empty database.** Run `pnpm audit:rls` (with `DIRECT_URL` = owner, `DATABASE_URL` = `biztrack_app`) only after two stores hold data; `tools/checkup-audit.mjs` does this.
6. **Starting the apps against Supabase:** `node tools/dev-real.mjs` (not `pnpm dev`: turbo strips unknown variables and the apps fall back to the local database).


## Variables found in code but missing from the table above (checkup, 11 October 2026)
| Variable | Scope | Used by |
|---|---|---|
| `ADMIN_ORIGIN` | Server Only | The public address of the store admin, used in staff invitation links. Default `http://localhost:3001`. Set it in production. |
| `DB_POOL_MAX` | Server Only | Connections per app process (`packages/db/src/client.ts`). Default 5. Keep it low behind the Supabase pooler. |
| `NEXT_PUBLIC_MARKETING_URL` | Marketing | Canonical address of the marketing site (metadata, `robots.txt`, `sitemap.xml`). |
| `NEXT_PUBLIC_DEMO_STORE_URL` | Marketing | Where "See a live store" on the templates page points. |
| `EDGE_CONFIG` | Storefront edge | Vercel Edge Config connection string for host routing (docs/13). |
| `DEV_TENANT_SUBDOMAIN` | Development only | Which store the development sign-in acts in. Ignored unless `DEV_AUTH=1`. |
| `SEED_URL` | Scripts | The database `packages/db/scripts/seed-plans.ts` writes the three plans into. |
| `ALLOW_PROD_DRILL` | Scripts | Lets the backup restore drill run next to a database whose address contains "prod". Never set it in an app. |
| `TEST_DATABASE_URL`, `TEST_DIRECT_URL` | Tests only | The throw-away test database (app role and owner). |
| `DEV_SMS_OUTBOX`, `E2E_*` (`E2E_ADMIN_SMS_OUTBOX`, `E2E_STORE_SMS_OUTBOX`, `E2E_SMS_OUTBOX_PATH`, `E2E_DNS_FILE`) | Tests only | File paths the end-to-end tests use to read messages the apps would have sent and to fake DNS answers. |
| `STORE_URL`, `VITALS_HOST` | Scripts | The store address the load-time measuring scripts visit. |

### Documented above but not read by any code yet
`INNGEST_SIGNING_KEY` (background jobs run as cron routes instead, see docs/05), `STRIPE_SECRET_KEY` and `PLATFORM_SSLCOMMERZ_STORE_ID` (no card gateway is built; subscriptions are paid by bKash or Nagad and approved by hand). They are planned, not dead; do not set them expecting an effect.

## Messaging (added 11 October 2026)
| Variable | Scope | Used by |
|---|---|---|
| `SMS_PROVIDER` | Server Only | `smsnetbd` (default when its key is set) or `greenweb`; **`log` (or `off`) keeps messages in the server log whatever keys are present. Use `log` in `.env.local` and on previews, `smsnetbd` only in production.** A test outbox (`DEV_SMS_OUTBOX`) always overrides it |
| `SMS_NET_BD_API_KEY` | Server Only | sms.net.bd (Alpha SMS) API key. Until the account's first recharge it can only send to the registered number (error 421) |
| `SMS_SENDER_ID` | Server Only | Optional approved sender ID for sms.net.bd |
| `GREENWEB_SMS_TOKEN` | Server Only | Greenweb token, the alternative provider |
| `BREVO_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME` | Server Only | Brevo transactional email (`createBrevoSender`). Both the key and `EMAIL_FROM` must be set. The sender exists and is tested; owner notices and message templates that use it are in the notifications work (docs/34 B4). Sign-in emails are still sent by Supabase Auth: put Brevo's SMTP details into Supabase (Authentication, SMTP settings) as well |

## Vercel API variables were renamed (11 October 2026)
Vercel's dashboard refuses to save a project variable whose name starts with `VERCEL_` (it reported `Environment variable "VERCEL_TOKEN" is invalid`). The app variables that call Vercel's API are now `PLATFORM_VERCEL_TOKEN`, `PLATFORM_VERCEL_PROJECT_ID` (the storefront project), `PLATFORM_VERCEL_TEAM_ID` (optional) and, for development only, `PLATFORM_VERCEL_API_URL`; `EDGE_CONFIG_ID` is unchanged. The old `VERCEL_TOKEN`, `VERCEL_AUTH_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` and `VERCEL_API_URL` still work as a fallback on a developer machine and in the tests, but must not be set in Vercel. GitHub secrets named `VERCEL_*` are unaffected (GitHub allows them, and the Vercel CLI reads `VERCEL_TOKEN` from the environment).
