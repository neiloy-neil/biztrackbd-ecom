# Production setup for biztrack.bd (Vercel, Supabase, GitHub)

Written 11 October 2026 and updated as the setup was done. The domain is registered, the four Vercel projects are live, and the domain's nameservers point at Vercel (section 4). Work through it top to bottom; each step says how to check it. Read docs/34 first for the free-plan limits (Vercel Hobby is for testing, not for paying merchants).

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

1. **Register `biztrack.bd`** with an accredited `.bd` registrar. It must let you change the nameservers.
2. **Nameservers**: at the registrar set `ns1.vercel-dns.com` and `ns2.vercel-dns.com`. `.bd` registries can take hours to publish the change; check with `nslookup -type=NS biztrack.bd dns.bd`. Vercel then serves the DNS and issues the wildcard certificate for `*.biztrack.bd` by itself. (Cloudflare was tried first: it cannot give Vercel a wildcard certificate, which broke store subdomains with a 525 error. See section 4.)
3. **Vercel**: create the four projects from the GitHub repository (Import Git Repository), set each project's **Root Directory** as in the table, and set the variables in section 3. Add the domains to the right projects: `biztrack.bd` and `www.biztrack.bd` to marketing, `admin.biztrack.bd` to admin, `platform.biztrack.bd` to platform, `*.biztrack.bd` and `cname.biztrack.bd` to storefront.
4. **DNS records**: Vercel creates the records for the domains you add to projects. Add the email records yourself (section 4).
5. **Supabase**: Authentication, URL Configuration: Site URL `https://admin.biztrack.bd`; add `https://platform.biztrack.bd` to the redirect URLs. Authentication, SMTP settings: Brevo SMTP details (otherwise sign-in emails are rate-limited to a few an hour). Turn the Data API off (or keep Exposed schemas at `public` only). **Email templates (required):** under Authentication, Email Templates, edit both **Magic Link** and **Confirm signup** so the body shows the code, not a link: `<h2>{{ .Token }}</h2>`. The apps sign people in with a 6-digit code; the default templates only send a link, which lands on the admin login page and never shows the code.
6. **GitHub**: the repository is `neiloy-neil/biztrackbd-ecom` (public). Secrets already set: `SUPABASE_DB_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Still to add: `BACKUP_ENCRYPTION_KEY_HEX` (make it with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and **keep a second copy in a password manager**), `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_ADMIN`, `VERCEL_PROJECT_ID_STOREFRONT`, `VERCEL_PROJECT_ID_MARKETING`, `VERCEL_PROJECT_ID_PLATFORM`. `node tools/github-secrets.mjs neiloy-neil/biztrackbd-ecom --yes` sets any that are in `.env.local`. Create a GitHub Environment named `production` with yourself as required reviewer.
7. **Schedulers**: after the first deploy, `node tools/supabase-schedule.mjs --admin https://admin.biztrack.bd --platform https://platform.biztrack.bd --yes` (needs `CRON_SECRET` in `.env.local`, equal to the value in the Vercel projects).
8. **First platform admin**: already created in Supabase for `neiloyfarhad@gmail.com`. Open `https://platform.biztrack.bd/login/start`, enter the email, type the emailed code, choose a password, set up the authenticator.
9. **Smoke test**: sign up a store at `biztrack.bd/start`, sign in at `admin.biztrack.bd`, approve it at `platform.biztrack.bd`, order from `<store>.biztrack.bd`.

## 3. Environment variables per Vercel project

Derived by reading the code (searches for `process.env` in each app and in the shared packages), then checked against docs/17. **Treat as a starting list: if a page fails with a missing-variable message on the first deploy, add it and tell me so this table can be corrected.** Never put a value in the repository; set them in Vercel (Project, Settings, Environment Variables, Production).

**All four projects**
- `DATABASE_URL`: the `biztrack_app` login on the Supabase session pooler (`postgresql://biztrack_app.<ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`). **Never the owner login.**
- `DB_POOL_MAX=1` (serverless opens many short connections; raise only if you see waits)
- `NEXT_PUBLIC_ROOT_DOMAIN=biztrack.bd`

**biztrack-marketing**: `NEXT_PUBLIC_MARKETING_URL=https://biztrack.bd`, `NEXT_PUBLIC_ADMIN_URL=https://admin.biztrack.bd`, and the picture-storage settings (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MEDIA_DRIVER=supabase`, `MEDIA_BUCKET=store-media`): signup draws the sample product pictures. The demo links on `/templates` are built from `NEXT_PUBLIC_ROOT_DOMAIN`.

**biztrack-admin**: `ADMIN_ORIGIN=https://admin.biztrack.bd`, `NEXT_PUBLIC_ADMIN_URL`, `CRON_SECRET`, `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `MEDIA_DRIVER=supabase`, `MEDIA_BUCKET=store-media`, `INTEGRATION_VAULT_SECRET`, `INTEGRATION_VAULT_KEY_ID`, `PREVIEW_SECRET` (same as storefront), `CUSTOMER_AUTH_SECRET` (same as storefront), `PHONE_TRUST_SALT` (same everywhere, never changed), `PLATFORM_BKASH_NUMBER`, `PLATFORM_NAGAD_NUMBER`, `PLATFORM_A_RECORD`, `PLATFORM_CNAME_TARGET=cname.biztrack.bd`, `PLATFORM_VERCEL_TOKEN`, `PLATFORM_VERCEL_PROJECT_ID` (the storefront project), `PLATFORM_VERCEL_TEAM_ID`, `EDGE_CONFIG_ID`, `EDGE_CONFIG`, the SMS and email variables.

**biztrack-platform**: `PLATFORM_DATABASE_URL` (the `biztrack_platform` login), `CRON_SECRET`, `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PLATFORM_BKASH_NUMBER`, `PLATFORM_NAGAD_NUMBER`, the SMS variables (payment and billing messages), `PHONE_TRUST_SALT`.

**biztrack-storefront**: `NEXT_PUBLIC_ADMIN_URL=https://admin.biztrack.bd` (lets the editor frame the preview), `CUSTOMER_AUTH_SECRET`, `PREVIEW_SECRET`, `PHONE_TRUST_SALT`, `EDGE_CONFIG`, `INTEGRATION_VAULT_SECRET` and `INTEGRATION_VAULT_KEY_ID` (server-side ad events), `NEXT_PUBLIC_SUPABASE_URL` (picture addresses), `MEDIA_DRIVER=supabase`, the SMS variables (customer sign-in codes).

**SMS** (admin, platform, storefront): `SMS_PROVIDER=smsnetbd`, `SMS_NET_BD_API_KEY`, optional `SMS_SENDER_ID`. Recharge the sms.net.bd account first: until then it can only send to the account owner's registered number.
**Email** (admin, platform): `BREVO_API_KEY`, `EMAIL_FROM=no-reply@biztrack.bd`, `EMAIL_FROM_NAME=BizTrackBD`. Verify the sender domain in Brevo (it gives you SPF and DKIM records to add in Vercel DNS).

**Function time limits on Hobby**: the cron routes now declare `maxDuration = 60` (the Hobby ceiling at the time of writing; check the current limit). Every sweep is safe to run again, so one that needs longer simply continues on its next call. Raise it on a paid plan if sweeps need more.

## 4. DNS (Vercel nameservers)

The domain's nameservers are `ns1.vercel-dns.com` and `ns2.vercel-dns.com`, so Vercel is the DNS host. Every domain added to a project (`biztrack.bd`, `www`, `admin`, `platform`, `cname`, `*`) is served automatically, and Vercel issues a certificate for each, including the wildcard. Check with `vercel domains inspect biztrack.bd` (both nameservers should show a tick).

**Records you add yourself** (`vercel dns add biztrack.bd <name> <type> <value>`; `@` is the apex):

| Type | Name | Value |
|---|---|---|
| TXT | `@` | `brevo-code:<the code Brevo shows>` |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com` |
| CNAME | `brevo1._domainkey` | `b1.biztrack-bd.dkim.brevo.com` |
| CNAME | `brevo2._domainkey` | `b2.biztrack-bd.dkim.brevo.com` |

Check a made-up store name: `https://anything.biztrack.bd/` should answer 404 ("no such store") over valid TLS.

**Why not Cloudflare in front.** Cloudflare as the DNS host with the proxy on gave 525 errors for store subdomains: Vercel has no certificate for `<store>.biztrack.bd` unless it controls the nameservers. The three workarounds were a per-store Vercel domain (capped at 50 on Hobby), a Cloudflare rule that rewrites the host (fragile, needs a trusted header), or Vercel nameservers (chosen). Cloudflare can still be used for Turnstile, R2 or Web Analytics without being the DNS host. If you leave Vercel later, Cloudflare for SaaS (custom hostnames) is the route for store domains.

## 5. Store domains and custom domains
A merchant's own domain (`theirshop.com`) works by a CNAME to `cname.biztrack.bd` (or an A record for a bare domain). The admin adds the domain to the storefront project through the Vercel API, so it needs `PLATFORM_VERCEL_TOKEN`, `PLATFORM_VERCEL_PROJECT_ID`, `EDGE_CONFIG_ID` and `EDGE_CONFIG`. These are not set yet; create them when the first merchant asks. Vercel Hobby caps domains per project; Pro raises it.

## 5b. Template demo stores (docs/38)
Five public demo stores: `kapor`, `gadgetstudio`, `minibunny`, `axionwear`, `bindu` on `.biztrack.bd`, flagged `isDemo`, left out of revenue, trials and billing, refusing orders, sign-in codes and reviews.
1. Apply migration 17 (the `isDemo` column): `pnpm --filter @biztrackbd/db exec prisma migrate deploy` with the owner connection (or let the Deploy workflow do it).
2. Build them: `pnpm --filter @biztrackbd/core exec tsx scripts/demo-stores.ts all --target supabase` (uses `SUPABASE_APP_DB_URL` and the storage keys from `.env.local`). Safe to run again; it rebuilds from scratch and refuses to touch a store that is not a demo.
3. Nightly refresh: `node tools/supabase-schedule.mjs ... --yes` now also installs five `biztrack-demo-*` jobs (04:00 to 04:08 Dhaka) that call `/api/cron/demo-reset?template=<id>`.
4. Marketing previews: `node tools/demo-previews.mjs --base https://{host}.biztrack.bd` after the demos are live, then commit `apps/marketing/public/templates/`.

## 6. Afterwards: day-two checks
Run the Supabase grant check from docs/17 after every migration. Watch the GitHub Actions Backup run for a week, then do a restore drill. Move Vercel and Supabase to paid plans before the first paying merchant (docs/34).
