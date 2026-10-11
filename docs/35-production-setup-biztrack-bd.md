# Production setup for biztrack.bd (Vercel, Supabase, Cloudflare, GitHub)

Written 11 October 2026 from the code as it stands. **Nothing here has been run yet**: no domain is registered, no Vercel project exists. Work through it top to bottom; each step says how to check it. Read docs/34 first for the free-plan limits (Vercel Hobby is for testing, not for paying merchants).

## 1. Addresses

| What | Address | Vercel project (Root Directory) |
|---|---|---|
| Marketing site, signup | `https://biztrack.bd` and `https://www.biztrack.bd` (redirect to the apex) | `biztrack-marketing` (`apps/marketing`) |
| Store admin (merchant login) | `https://admin.biztrack.bd/login` | `biztrack-admin` (`apps/admin`) |
| Platform admin | `https://platform.biztrack.bd/login` | `biztrack-platform` (`apps/platform`) |
| Every store's website | `https://<store>.biztrack.bd` (wildcard `*.biztrack.bd`) | `biztrack-storefront` (`apps/storefront`) |
| Custom domains of stores | `https://theirshop.com` pointing at `cname.biztrack.bd` | the storefront project |

`www`, `admin`, `platform`, `app`, `api` and about 70 other labels are reserved so no store can claim them (`packages/core/src/routing/host.ts`).

## 2. Order of work

1. **Register `biztrack.bd`** with an accredited `.bd` registrar. Ask them: can I change the nameservers to Cloudflare's? (If not, keep their DNS and add the records there; wildcard certificates then need Vercel's nameservers or another approach, see section 5.)
2. **Cloudflare**: add the domain (free plan), switch the nameservers at the registrar, wait until Cloudflare shows the domain Active.
3. **Vercel**: create the four projects from the GitHub repository (Import Git Repository), set each project's **Root Directory** as in the table, and set the variables in section 3. Add the domains to the right projects: `biztrack.bd` and `www.biztrack.bd` to marketing, `admin.biztrack.bd` to admin, `platform.biztrack.bd` to platform, `*.biztrack.bd` and `cname.biztrack.bd` to storefront.
4. **Cloudflare DNS** (see section 4 for the records), then set SSL/TLS mode to **Full (strict)**.
5. **Supabase**: Authentication, URL Configuration: Site URL `https://admin.biztrack.bd`; add `https://platform.biztrack.bd` to the redirect URLs. Authentication, SMTP settings: Brevo SMTP details (otherwise sign-in emails are rate-limited to a few an hour). Turn the Data API off (or keep Exposed schemas at `public` only).
6. **GitHub**: the repository is `neiloy-neil/biztrackbd-ecom` (private). Secrets already set: `SUPABASE_DB_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Still to add: `BACKUP_ENCRYPTION_KEY_HEX` (make it with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and **keep a second copy in a password manager**), `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_ADMIN`, `VERCEL_PROJECT_ID_STOREFRONT`, `VERCEL_PROJECT_ID_MARKETING`, `VERCEL_PROJECT_ID_PLATFORM`. `node tools/github-secrets.mjs neiloy-neil/biztrackbd-ecom --yes` sets any that are in `.env.local`. Create a GitHub Environment named `production` with yourself as required reviewer.
7. **Schedulers**: after the first deploy, `node tools/supabase-schedule.mjs --admin https://admin.biztrack.bd --platform https://platform.biztrack.bd --yes` (needs `CRON_SECRET` in `.env.local`, equal to the value in the Vercel projects).
8. **First platform admin**: already created in Supabase for `neiloyfarhad@gmail.com`. Open `https://platform.biztrack.bd/login/start`, enter the email, type the emailed code, choose a password, set up the authenticator.
9. **Smoke test**: sign up a store at `biztrack.bd/start`, sign in at `admin.biztrack.bd`, approve it at `platform.biztrack.bd`, order from `<store>.biztrack.bd`.

## 3. Environment variables per Vercel project

Derived by reading the code (searches for `process.env` in each app and in the shared packages), then checked against docs/17. **Treat as a starting list: if a page fails with a missing-variable message on the first deploy, add it and tell me so this table can be corrected.** Never put a value in the repository; set them in Vercel (Project, Settings, Environment Variables, Production).

**All four projects**
- `DATABASE_URL`: the `biztrack_app` login on the Supabase session pooler (`postgresql://biztrack_app.<ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`). **Never the owner login.**
- `DB_POOL_MAX=1` (serverless opens many short connections; raise only if you see waits)
- `NEXT_PUBLIC_ROOT_DOMAIN=biztrack.bd`

**biztrack-marketing**: `NEXT_PUBLIC_MARKETING_URL=https://biztrack.bd`, `NEXT_PUBLIC_ADMIN_URL=https://admin.biztrack.bd`, `NEXT_PUBLIC_DEMO_STORE_URL=https://<a demo store>.biztrack.bd`.

**biztrack-admin**: `ADMIN_ORIGIN=https://admin.biztrack.bd`, `NEXT_PUBLIC_ADMIN_URL`, `CRON_SECRET`, `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `MEDIA_DRIVER=supabase`, `MEDIA_BUCKET=store-media`, `INTEGRATION_VAULT_SECRET`, `INTEGRATION_VAULT_KEY_ID`, `PREVIEW_SECRET` (same as storefront), `CUSTOMER_AUTH_SECRET` (same as storefront), `PHONE_TRUST_SALT` (same everywhere, never changed), `PLATFORM_BKASH_NUMBER`, `PLATFORM_NAGAD_NUMBER`, `PLATFORM_A_RECORD`, `PLATFORM_CNAME_TARGET=cname.biztrack.bd`, `VERCEL_TOKEN`, `VERCEL_PROJECT_ID` (the storefront project), `EDGE_CONFIG`, the SMS and email variables.

**biztrack-platform**: `PLATFORM_DATABASE_URL` (the `biztrack_platform` login), `CRON_SECRET`, `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PLATFORM_BKASH_NUMBER`, `PLATFORM_NAGAD_NUMBER`, the SMS variables (payment and billing messages), `PHONE_TRUST_SALT`.

**biztrack-storefront**: `NEXT_PUBLIC_ADMIN_URL=https://admin.biztrack.bd` (lets the editor frame the preview), `CUSTOMER_AUTH_SECRET`, `PREVIEW_SECRET`, `PHONE_TRUST_SALT`, `EDGE_CONFIG`, `INTEGRATION_VAULT_SECRET` and `INTEGRATION_VAULT_KEY_ID` (server-side ad events), `NEXT_PUBLIC_SUPABASE_URL` (picture addresses), `MEDIA_DRIVER=supabase`, the SMS variables (customer sign-in codes).

**SMS** (admin, platform, storefront): `SMS_PROVIDER=smsnetbd`, `SMS_NET_BD_API_KEY`, optional `SMS_SENDER_ID`. Recharge the sms.net.bd account first: until then it can only send to the account owner's registered number.
**Email** (admin, platform): `BREVO_API_KEY`, `EMAIL_FROM=no-reply@biztrack.bd`, `EMAIL_FROM_NAME=BizTrackBD`. Verify the sender domain in Brevo (it gives you SPF and DKIM records to add in Cloudflare).

**Function time limits on Hobby**: the cron routes now declare `maxDuration = 60` (the Hobby ceiling at the time of writing; check the current limit). Every sweep is safe to run again, so one that needs longer simply continues on its next call. Raise it on a paid plan if sweeps need more.

## 4. Cloudflare DNS records

| Type | Name | Content | Proxy |
|---|---|---|---|
| A or CNAME | `@` | the value Vercel shows for the marketing project | proxied |
| CNAME | `www` | `cname.vercel-dns.com` (or the value Vercel shows) | proxied |
| CNAME | `admin` | the value Vercel shows | proxied |
| CNAME | `platform` | the value Vercel shows | proxied |
| CNAME | `*` | the value Vercel shows for the storefront | proxied |
| CNAME | `cname` | the storefront target (what store owners point their own domains at) | **DNS only** (grey cloud): stores' CNAMEs must resolve to the real target |
| TXT / CNAME | Brevo's SPF, DKIM and DMARC records | as given by Brevo | DNS only |

Do not proxy a record Vercel needs to verify until Vercel shows the domain as valid; then turn the proxy on and set SSL/TLS to Full (strict). Cloudflare's free universal certificate covers `biztrack.bd` and `*.biztrack.bd` (one level), which is what store subdomains use.

## 5. If the registrar will not let you use Cloudflare nameservers
Either keep the registrar's DNS and use Vercel's nameservers for the wildcard (Vercel then issues the wildcard certificate), or move the domain. Ask the registrar this before paying.

## 6. Afterwards: day-two checks
Run the Supabase grant check from docs/17 after every migration. Watch the GitHub Actions Backup run for a week, then do a restore drill. Move Vercel and Supabase to paid plans before the first paying merchant (docs/34).
