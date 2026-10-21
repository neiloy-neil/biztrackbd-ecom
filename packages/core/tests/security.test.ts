import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static checks over the source, so a new endpoint cannot ship without a decision about who may call it.
 * They read the code, they do not run it: the behaviour is covered by the Playwright suites.
 */
const ROOT = join(__dirname, "..", "..", "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "e2e" || name === ".turbo") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const rel = (p: string) => relative(ROOT, p).replace(/\\/g, "/");
const src = (app: string) => walk(join(ROOT, "apps", app, "src"));

/** The exported async functions of a "use server" file, with their bodies. */
const text = (f: string) => readFileSync(f, "utf8");
function serverFunctions(file: string): { name: string; body: string }[] {
  const text = readFileSync(file, "utf8");
  if (!/^\s*["']use server["']/.test(text)) return [];
  const parts = text.split(/\nexport async function /).slice(1);
  return parts.map((p) => ({ name: p.slice(0, p.indexOf("(")), body: p }));
}

const AUTH = /\b(requireAction|requireAccess|getSession|getCustomerSession|getStore|authorised)\(/;

describe("who can call each admin and platform action", () => {
  // Public on purpose, each with its own protection.
  const PUBLIC = new Set([
    "apps/admin/src/app/join/[token]/actions.ts", // accepting an invitation: the secret token in the address is the credential
    "apps/admin/src/app/(admin)/dev-actions.ts", // development stand-in; refuses to run in production (checked below)
    "apps/platform/src/app/(sa)/dev-actions.ts",
    "apps/admin/src/app/(admin)/theme-actions.ts", // light or dark look on this device: a cookie, no store data
    "apps/admin/src/app/(admin)/lang-actions.ts", // English or Bangla on this device: a cookie, no store data
    "apps/admin/src/app/login/actions.ts", // these ARE the sign-in: each step that needs a person checks the token itself, and the rest (password, code) is what proves them
    "apps/platform/src/app/login/actions.ts",
  ]);

  for (const app of ["admin", "platform"]) {
    const files = src(app).filter((f) => /actions\.ts$/.test(f) && !PUBLIC.has(rel(f)));
    it(`every exported action in the ${app} app checks the caller before doing anything`, () => {
      const missing: string[] = [];
      let count = 0;
      for (const f of files) {
        for (const fn of serverFunctions(f)) {
          count++;
          // The check must come before the first call into the core (a write), so look at what precedes it.
          // A helper in the same file (like reviews' run) counts if its own body checks the caller.
          const helper = /async function run\(/.test(text(f)) && AUTH.test(text(f).slice(text(f).indexOf("async function run("), text(f).indexOf("async function run(") + 400));
          const usesHelper = helper && fn.body.includes("await run(");
          const firstAuth = usesHelper ? 0 : fn.body.search(AUTH);
          const firstCore = fn.body.search(/\bawait \w+\(\s*s\.(tenantId|actor)/);
          if (firstAuth === -1 || (firstCore !== -1 && firstAuth > firstCore)) missing.push(`${rel(f)}: ${fn.name}`);
        }
      }
      expect(count).toBeGreaterThan(app === "admin" ? 30 : 5);
      expect(missing).toEqual([]);
    });
  }

  it("route handlers in the admin and platform apps are signed-in, signed by a secret, or on an allow-list", () => {
    const routes = [...src("admin"), ...src("platform")].filter((f) => /[\\/]route\.ts$/.test(f));
    expect(routes.length).toBeGreaterThan(5);
    const open: string[] = [];
    // Public on purpose: store photos, which the public storefront shows anyway (random ids, path shape checked, read-only).
    // The demo admin's door (docs/41): starting is limited per visitor and capped for everyone, and a demo copy can reach nothing but itself;
    // leaving only forgets a cookie.
    // The product feed alias (/api/feed/facebook.xml and friends): a public product feed for Meta and Google, which must be fetchable without signing in.
    // It only rewrites to /api/catalog/facebook, which lists published products (what the public store shows) for the store named in ?store=.
    const PUBLIC_ROUTES = new Set([
      "apps/admin/src/app/api/feed/[format]/route.ts",
      "apps/admin/src/app/media/[...path]/route.ts",
      "apps/admin/src/app/demo/start/route.ts",
      "apps/admin/src/app/demo/exit/route.ts",
      "apps/admin/src/app/api/webhooks/whatsapp/route.ts",
      // UddoktaPay's plan-payment webhook: called by the gateway, so there is no session. Nothing in the request is trusted: the invoice id is
      // looked up at the gateway with BizTrackBD's own key and only a COMPLETED answer activates anything (a repeat is applied once).
      "apps/platform/src/app/api/webhooks/uddoktapay/route.ts",
      // Where the payer lands after UddoktaPay. It only asks the gateway whether the payment went through and redirects; it writes nothing.
      "apps/admin/src/app/api/billing/uddoktapay/callback/route.ts",
    ]);
    for (const f of routes.filter((r) => !PUBLIC_ROUTES.has(rel(r)))) {
      const text = readFileSync(f, "utf8");
      const guarded = /getSession(OrNull)?\(|requireAccess\(|requireAction\(|authorised\(|CRON_SECRET|verify|signature|token/i.test(text);
      if (!guarded) open.push(rel(f));
    }
    expect(open).toEqual([]);
    // The plan-payment webhook is only safe because it verifies the invoice with the gateway before doing anything.
    expect(readFileSync(join(ROOT, "apps/platform/src/app/api/webhooks/uddoktapay/route.ts"), "utf8")).toMatch(/processUddoktaPaySubscriptionSuccess\(/);
    expect(readFileSync(join(ROOT, "packages/core/src/payments/uddoktapay.ts"), "utf8")).toMatch(/status !== "COMPLETED"/);
    // ...and the admin return page must stay read-only: the store apps' database role cannot write subscriptions, and activating on a
    // redirect anyone can hit would be the wrong place for it.
    const callback = readFileSync(join(ROOT, "apps/admin/src/app/api/billing/uddoktapay/callback/route.ts"), "utf8");
    expect(callback).toMatch(/checkUddoktaPayPlanInvoice\(/);
    expect(callback).not.toMatch(/processUddoktaPaySubscriptionSuccess/);
    // The one public route that creates something must be the one that enforces the limits.
    expect(readFileSync(join(ROOT, "apps/admin/src/app/demo/start/route.ts"), "utf8")).toMatch(/createDemoSession\(/);
    expect(readFileSync(join(ROOT, "packages/core/src/demo/session.ts"), "utf8")).toMatch(/DemoLimitError[\s\S]*DemoBusyError/);
  });

  it("code the store admin runs on every page never needs the platform database credential (the admin project does not have it)", () => {
    // Store-side functions of platform/announcements.ts run in apps/admin's layout. Building the platform client there throws and every admin page answers 500.
    const text = readFileSync(join(ROOT, "packages/core/src/platform/announcements.ts"), "utf8");
    const start = text.indexOf("export async function getActiveAnnouncementsForTenant");
    expect(start).toBeGreaterThan(0);
    const next = text.indexOf("\nexport ", start + 10);
    const body = text.slice(start, next === -1 ? undefined : next);
    expect(body).not.toMatch(/dbOf\(|getPlatformPrisma\(/);
  });

  it("the development sign-in stand-ins refuse to run in production, and real sign-in is the default", () => {
    for (const f of ["apps/admin/src/lib/auth.ts", "apps/platform/src/lib/auth.ts"]) {
      const text = readFileSync(join(ROOT, f), "utf8");
      expect(text, f).toMatch(/authMode = \(\): "dev" \| "supabase" => \(process\.env\.DEV_AUTH === "1" && process\.env\.NODE_ENV !== "production" \? "dev" : "supabase"\)/);
    }
    for (const f of ["apps/admin/src/app/(admin)/dev-actions.ts", "apps/platform/src/app/(sa)/dev-actions.ts"]) {
      expect(readFileSync(join(ROOT, f), "utf8"), f).toMatch(/DEV_AUTH !== "1" \|\| process\.env\.NODE_ENV === "production"/);
    }
  });

  it("signed-in pages never take the store or the person from the request", () => {
    // The store comes from the account's memberships (checked against the signed token), never from a header or the URL.
    for (const f of ["apps/admin/src/lib/session.ts"]) {
      const text = readFileSync(join(ROOT, f), "utf8");
      expect(text, f).toMatch(/staffMemberships\(user\)/);
      expect(text, f).not.toMatch(/searchParams|req\.url|x-tenant/i);
    }
  });
});

describe("secrets and risky patterns in the source", () => {
  const all = ["admin", "platform", "storefront", "marketing"].flatMap((a) => src(a)).concat(walk(join(ROOT, "packages", "core", "src")), walk(join(ROOT, "packages", "db", "src")));
  const code = all.filter((f) => /\.(ts|tsx)$/.test(f));

  it("has no key, token or password written into the code", () => {
    const hits: string[] = [];
    const patterns = [/sk_(live|test)_[A-Za-z0-9]{16,}/, /AKIA[0-9A-Z]{16}/, /-----BEGIN (RSA |EC )?PRIVATE KEY-----/, /xox[bp]-[A-Za-z0-9-]{20,}/, /ghp_[A-Za-z0-9]{30,}/, /postgres(ql)?:\/\/[^\s"'`:@]+:(?!\$|<|\*|\{)[^\s"'`@]{4,}@(?!127\.0\.0\.1|localhost)/];
    for (const f of code) {
      const text = readFileSync(f, "utf8");
      for (const p of patterns) if (p.test(text)) hits.push(`${rel(f)} matches ${p}`);
    }
    expect(hits).toEqual([]);
  });

  it("never builds HTML from user text without sanitising it, and uses no eval", () => {
    const hits: string[] = [];
    for (const f of code) {
      const text = readFileSync(f, "utf8");
      if (/\beval\(|new Function\(/.test(text)) hits.push(`${rel(f)}: eval`);
      // The storefront's pixel snippets (Meta, Google, TikTok) put a store's tracking id into vendor code. That is safe only because each id is
      // checked against a strict pattern first, so the rule for that one file is: every id is pattern-checked in the same file.
      if (rel(f) === "apps/storefront/src/components/tracker.tsx") {
        for (const check of ["/^\\d{8,20}$/.test(tracking.pixelId", "/^G-[A-Za-z0-9]+$/i.test(tracking.googleAnalyticsId", "/^GTM-[A-Za-z0-9]+$/i.test(tracking.googleTagManagerId", "/^[A-Za-z0-9_-]{10,40}$/.test(tracking.tiktokPixelId"]) {
          if (!text.includes(check)) hits.push(`${rel(f)}: a tracking id is put into a script without a strict pattern check (${check})`);
        }
        continue;
      }
      for (const m of text.matchAll(/dangerouslySetInnerHTML=\{\{\s*__html:\s*([^}]+)\}\}/g)) {
        const expr = m[1]!.trim();
        // Allowed: JSON-LD (serialised by us), CSS built from validated tokens, and HTML cleaned when it was saved (product descriptions, pages, blog posts).
        if (!/JSON\.stringify|css\b|jsonLd|sanitis|safeHtml|descriptionHtml|contentHtml/i.test(expr)) hits.push(`${rel(f)}: dangerouslySetInnerHTML ${expr}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("does not log customer phone numbers, tokens or passwords", () => {
    const hits: string[] = [];
    for (const f of code) {
      const text = readFileSync(f, "utf8");
      for (const m of text.matchAll(/console\.(log|error|warn|info)\(([^;]*)\)/g)) {
        if (/\b(phone|password|token|secret|otp|trxId)\b/i.test(m[2]!) && !/name\b|\.code\b/.test(m[2]!.slice(0, 0))) hits.push(`${rel(f)}: ${m[0].slice(0, 90)}`);
      }
    }
    expect(hits).toEqual([]);
  });
});

describe("the platform credit on every storefront", () => {
  it("is part of every public store footer, links BizTrackBD and The Digital Dude, and no setting can switch it off", () => {
    const credit = readFileSync(join(ROOT, "apps/storefront/src/components/platform-credit.tsx"), "utf8");
    expect(credit).toMatch(/digitaldude\.co\.uk/);
    expect(credit).toMatch(/NEXT_PUBLIC_MARKETING_URL/);
    expect(credit).toMatch(/The Digital Dude/);
    // The store footer draws it outside any header-and-footer setting; the landing page footer draws it too.
    const footer = readFileSync(join(ROOT, "apps/storefront/src/components/footer.tsx"), "utf8");
    expect(footer).toMatch(/<PlatformCredit t=\{t\} \/>/);
    expect(footer.slice(footer.indexOf("export function Footer"))).not.toMatch(/chrome[^;]*PlatformCredit|PlatformCredit[^;]*chrome/);
    expect(readFileSync(join(ROOT, "apps/storefront/src/app/l/[slug]/page.tsx"), "utf8")).toMatch(/<PlatformCredit t=\{t\} \/>/);
    // The footer record the merchant edits has no field for it.
    const chrome = readFileSync(join(ROOT, "packages/core/src/builder/chrome.ts"), "utf8");
    expect(chrome).not.toMatch(/credit|poweredBy|powered/i);
  });
});
