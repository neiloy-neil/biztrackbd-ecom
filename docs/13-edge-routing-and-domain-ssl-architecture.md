# Edge Routing, Middleware & Custom Domain SSL Architecture

Status: routing, domain claims and Edge Config sync BUILT (Phase 1). DNS verification, Vercel Domains API, SSL and the DNS assistant UI are Phase 7.  
Scope: `apps/storefront/src/proxy.ts`, `packages/core/src/routing/`, `packages/core/src/domains/`, Vercel Edge Config

---

## 1. Overview & Architecture

BizTrackBD handles multi-tenancy at the edge with **sub-5ms request routing**:

```
+-----------------------------------------------------------------------------------+
| Visitor / Customer Request (e.g. rongdhonufashion.com or kapor.biztrack.bd)    |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
| Vercel Edge Middleware (Global Edge Network)                                      |
|  1. Read Host header: "rongdhonufashion.com"                                      |
|  2. Lookup in Vercel Edge Config (Global In-Memory KV: ~1-3ms latency)            |
|  3. Resolved: { tenantId: "k7Qx92mTa", themeId: "kapor", status: "ACTIVE" }       |
|  4. Rewrite to internal route & inject request headers:                           |
|     - x-tenant-id: "k7Qx92mTa"                                                    |
|     - x-theme-id: "kapor"                                                         |
|     - x-tenant-status: "ACTIVE"                                                   |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
| Next.js App Router (RSC)                                                          |
|  - Reads x-tenant-id from headers()                                               |
|  - Executes Prisma query with tenant isolation                                    |
|  - Renders theme components from packages/themes/kapor                            |
+-----------------------------------------------------------------------------------+
```

---

## 2. Proxy (`apps/storefront/src/proxy.ts`), built in Phase 1

Next.js 16 renamed Middleware to **Proxy** and it runs on the **Node.js runtime** by default, so it can query Postgres directly. The Edge Config design below is an optional accelerator, not a requirement.

Request flow:
1. Normalise the Host header (`normalizeHost`: lowercase, strip port and trailing dot, reject IPs, IPv6, underscores, non-ASCII, empty or over-long labels).
2. Look the host up in a `HostDirectory`: Edge Config first when `EDGE_CONFIG` is set, then Postgres (`resolve_host_entry`), behind an in-process cache (15 s for stores, 5 s for misses, de-duplicated, stale entries served for up to 5 min if the database is down).
3. `decideRoute` (pure, in `packages/core/src/routing/decide.ts`) returns one of: `marketing` (root domain and www), `not_found` (unknown, reserved, nested or malformed host), `redirect` (308), `offline` (suspended or cancelled, a 503 page), or `serve`.
4. Any inbound header starting `x-bt-` is deleted, then the proxy sets `x-bt-tenant-id`, `x-bt-subdomain`, `x-bt-theme`, `x-bt-locale`, `x-bt-status` and `x-bt-route`. The app trusts only these. With no headers there is no store (fail closed); there is never a default store.
5. If the directory is unreachable and nothing is cached, the proxy answers 503 rather than guessing.

Rules:
- A store lives at exactly `<subdomain>.<root>`. Nested names such as `a.b.<root>` and look-alikes such as `<subdomain>.<root>.evil.com` are not stores. (The first version of `resolve_tenant_by_host` matched only the first label; migration 5 fixed that.)
- Only **verified** custom domains route. Claiming a domain you do not control routes nothing.
- Canonical host: `www.shop.com` redirects to the primary domain (308, path and query kept); the platform subdomain and any secondary domain also redirect to the primary domain once the store has one. Redirect targets come only from the directory, never from the request, so there is no open redirect. Apex is canonical; a www-canonical preference is not built.
- Reserved subdomains (`admin`, `api`, `www`, `app`, `mail`, `checkout` and others, `RESERVED_SUBDOMAINS`) never resolve and cannot be claimed (`validateSubdomain`).
- The matcher skips `_next` and static files but includes `/api`, because webhook and payment callbacks arrive on store hostnames and need the same header clean-up.

## 3. Vercel Domains API Client (Phase 7, built; tested against a local stand-in only)

The client lives in `packages/core/src/domains/verify.ts` (`vercelFromEnv`). It is used when `VERCEL_TOKEN` and `VERCEL_PROJECT_ID` are set (and `VERCEL_TEAM_ID` for a team project). It adds the name, then reads the domain config (`misconfigured`) and the project domain (`verified`); both must be good before the domain is marked Connected. The code below is the reference shape from Vercel's documentation.

Integrates with Vercel's REST API for custom domain provisioning and SSL lifecycle:

```typescript
const VERCEL_API_URL = "https://api.vercel.com";
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID!;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
const VERCEL_AUTH_BEARER = `Bearer ${process.env.VERCEL_AUTH_TOKEN}`;

function getVercelParams() {
  return VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : "";
}

export async function addDomainToVercel(domain: string) {
  const response = await fetch(
    `${VERCEL_API_URL}/v9/projects/${VERCEL_PROJECT_ID}/domains${getVercelParams()}`,
    {
      method: "POST",
      headers: {
        Authorization: VERCEL_AUTH_BEARER,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: domain }),
    }
  );

  return response.json();
}

export async function removeDomainFromVercel(domain: string) {
  const response = await fetch(
    `${VERCEL_API_URL}/v9/projects/${VERCEL_PROJECT_ID}/domains/${domain}${getVercelParams()}`,
    {
      method: "DELETE",
      headers: { Authorization: VERCEL_AUTH_BEARER },
    }
  );

  return response.json();
}

export async function checkDomainStatusFromVercel(domain: string) {
  const response = await fetch(
    `${VERCEL_API_URL}/v9/projects/${VERCEL_PROJECT_ID}/domains/${domain}${getVercelParams()}`,
    {
      method: "GET",
      headers: { Authorization: VERCEL_AUTH_BEARER },
    }
  );

  const data = await response.json();
  
  return {
    verified: data.verified === true,
    configured: data.misconfigured === false,
    sslStatus: data.verified ? "active" : "pending",
  };
}
```

---

## 4. Edge Config Real-Time Mutation Protocol (built, untested against a real Vercel account)

`syncTenantRouting(tenantId)` (`packages/core/src/routing/edge-config.ts`) recomputes every hostname a store answers on (its subdomain, each verified domain and its www twin) and sends one `PATCH /v1/edge-config/{id}/items` with upserts, plus deletes for removed domains. Keys are `domain:<host>`; values are `HostEntry` (tenantId, subdomain, themeId, locale, status, matched, primaryDomain, redirectWww). It needs `EDGE_CONFIG_ID` and `VERCEL_AUTH_TOKEN` (and `VERCEL_TEAM_ID` for teams); without them it does nothing and Postgres answers.

- Postgres is the source of truth. A failed push is logged, the change still succeeds, and a `routing/sync-failed` event is published for a retry sweep. Re-running `confirmDomainVerified` also re-pushes.
- Call `syncTenantRouting` whenever a store's status, theme, locale or subdomain changes, not only for domains. Today the domain service calls it; the billing and theme flows must as they are built.
- The request shape is covered by tests against a fake `fetch`. It has not run against Vercel itself.

## 5. Inngest DNS Verification Background Polling Worker

> **Phase 7 built this as a cron sweep, not Inngest.** `GET or POST /api/cron/domains` (store admin, behind `CRON_SECRET`, every 5 minutes) runs `sweepDomains()`, which checks every domain claimed in the last 7 days that is not yet Connected, and every connected domain whose certificate is not issued, at most once per 2 minutes each (the SQL function `domains_to_check()`). The open Domains page also re-checks every 10 seconds while a domain is connecting. The Inngest version below is the original design and is not used.

When a custom domain is added, Inngest runs a polling worker to check DNS propagation and SSL issuance:

```typescript
import { inngest } from "../client";
import { db } from "@biztrackbd/db";
import { checkDomainStatusFromVercel, syncTenantToEdgeConfig } from "@biztrackbd/core";

export const pollDomainVerification = inngest.createFunction(
  {
    id: "domain-verification-polling",
    name: "Custom Domain DNS & SSL Polling",
  },
  { event: "domain/registered" },
  async ({ event, step }) => {
    const { tenantId, domainId, host } = event.data;

    for (let attempt = 1; attempt <= 48; attempt++) {
      // Wait 1 minute between checks (up to 48 hours total)
      await step.sleep(`wait-attempt-${attempt}`, "1m");

      const status = await step.run(`check-dns-${attempt}`, async () => {
        return checkDomainStatusFromVercel(host);
      });

      if (status.verified && status.configured) {
        // Step A: Update database
        await step.run("update-db-domain-active", async () => {
          await db.domain.update({
            where: { id: domainId },
            data: { verified: true, sslStatus: "active" },
          });
        });

        // Step B: Sync to Edge Config for instant edge routing
        await step.run("sync-edge-config", async () => {
          const tenant = await db.tenant.findUniqueOrThrow({ where: { id: tenantId } });
          await syncTenantToEdgeConfig(host, {
            tenantId: tenant.id,
            themeId: tenant.themeId,
            status: tenant.status,
            planTier: tenant.planTier,
            customDomain: host,
          });
        });

        return { status: "domain_successfully_verified", host };
      }
    }

    return { status: "verification_timed_out_needs_manual_retry" };
  }
);
```

---

## 6. Dual-Hostname Canonical Redirection & BD Registrar Guides

### 6.1 Dual-Hostname Provisioning & 308 Redirect
Whenever a merchant connects a custom domain (e.g. `rongdhonufashion.com`):
1. **Dual Provisioning**: The system calls Vercel Domains API / Cloudflare for SaaS to register and provision Let's Encrypt SSL certificates for BOTH:
   - Root / Apex domain: `rongdhonufashion.com`
   - Subdomain: `www.rongdhonufashion.com`
2. **Canonical 308 Redirect**: Edge Middleware detects `www.` requests and executes a `308 Permanent Redirect` to the apex domain (or vice versa based on merchant preference), preserving 100% SEO link equity.

### 6.2 In-App DNS Assistant & Google DoH Check
On the Custom Domain Settings screen (`/admin/settings/domain`):
- **1-Click Copy Buttons**: For `A Record` (`76.76.21.21`) and `CNAME Record` (`cname.biztrack.bd`).
- **Instant DoH Check**: A "Verify DNS Now" button directly queries Google DNS over HTTPS (`https://dns.google/resolve?name=${domain}&type=A`) to show live propagation status in real-time.

### 6.3 Step-by-Step Bangladesh Registrar Guides
The UI includes expandable visual guides with copy-paste instructions for the top registrars used by Bangladeshi merchants:
1. **DianaHost / ExonHost / IT Nut Hosting (cPanel / DirectAdmin)**:
   - Zone Editor -> Add A Record for `@` -> `76.76.21.21`.
   - Add CNAME for `www` -> `cname.biztrack.bd`.
2. **Namecheap / GoDaddy / Cloudflare**:
   - Advanced DNS -> CNAME Flattening / Alias Record setup.

