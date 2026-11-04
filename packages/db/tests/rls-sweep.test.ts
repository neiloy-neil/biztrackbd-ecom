import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auditRls, failures, type RlsReport } from "../src/rls-audit";
import { createOwnerClient, createTenantFixture, resetDatabase, seedPlans, testUrls } from "../src/testing";

let report: RlsReport;
// Read by every store on purpose: the plan catalogue, platform announcements, and the Tenant row (which has its own policy: a store sees only itself).
// Template: the published store templates (the signup, the gallery and the editor read them); a row-level policy hides drafts.
// PlatformConfig: migration 060 lets the marketing site read ONLY the public keys (contact details, SEO text) through a row policy; every
// secret row stays hidden (the core test "reads only the public settings, never a secret" proves it with real rows).
// PublicToolUsage: the free courier fraud checker's per-visitor counter, written and read by the marketing site.
// ModulePrice: the add-on module price list, read by stores to show what a module costs, written by the platform role.
// Theme: the theme catalogue, readable by stores (the catalogue code hides draft and archived themes), written by the platform role.
// ThemeDiscount, ThemeBundle: theme discount codes and bundles (migration 078). Stores read ACTIVE rows only (row policy) to price a checkout; a code is
// used only through the theme_discount_redeem function, and only the platform role writes.
// SitePlan: the Business-website plan catalogue, read by every store like Plan (migration 075 grants SELECT only; changes go through the platform role).
// PlatformBlogPost: guides written in Platform Admin; the marketing site reads only published, due rows (row-level security hides drafts).
// RateLimitBucket: shared rate limit counters (migration 078), written by the public routes as the app role; the key is a salted hash, never a raw IP.
// PlatformVisitorSession, PlatformVisitorEvent, PlatformClientError: the marketing site records visits and browser errors as the app role (migration 064),
// so the app role has an open policy on them. This is the platform's own analytics, not store data; tighten it if a store ever gets a query path to them.
const PLATFORM_READABLE = ["Plan", "SitePlan", "Theme", "ThemeDiscount", "ThemeBundle", "ModulePrice", "Announcement", "Template", "Tenant", "PlatformConfig", "PublicToolUsage", "PlatformBlogPost", "PlatformVisitorSession", "PlatformVisitorEvent", "PlatformClientError", "RateLimitBucket"];
const urls = testUrls();

beforeAll(async () => {
  await resetDatabase(urls.direct);
  const owner = createOwnerClient(urls.direct);
  await seedPlans(owner);
  // Three stores with products, orders and customers, so there are rows of other tenants to try to reach.
  for (const n of ["sweep-a", "sweep-b", "sweep-c"]) await createTenantFixture(owner, { name: n, subdomain: n });
  await owner.$disconnect();
  report = await auditRls({ direct: urls.direct, app: urls.app });
}, 120_000);
afterAll(() => undefined);

describe("row-level security sweep over every table with a tenantId", () => {
  it("covers the whole schema, not a short list", () => {
    expect(report.tables.length).toBeGreaterThanOrEqual(60);
    expect(report.tables.map((t) => t.table)).toEqual(expect.arrayContaining(["Order", "Customer", "Product", "ThemeVersion", "LandingPage", "Domain", "AbandonedCheckout", "TrackingEvent", "PaymentProof"]));
  });

  it("finds nothing wrong anywhere", () => {
    expect(failures(report, { platformTablesAllowed: PLATFORM_READABLE })).toEqual([]);
  });

  it("actually tried to cross tenants on the tables that hold data", () => {
    const withData = report.tables.filter((t) => t.rows > 0);
    // The base fixture is small; scripts/rls-audit.ts runs the same sweep on a fully populated database (see docs/16 Phase 8).
    expect(withData.length).toBeGreaterThanOrEqual(4);
    // Where another tenant had a row, the copy was refused rather than skipped.
    const tried = withData.filter((t) => t.crossTenantInsert !== "none to try");
    expect(tried.length).toBeGreaterThanOrEqual(3);
    expect(tried.every((t) => t.crossTenantInsert === "blocked")).toBe(true);
  });

  it("lists the platform-only tables the app role cannot touch at all", () => {
    const sealed = report.tables.filter((t) => !t.appCanRead).map((t) => t.table);
    expect(sealed).toEqual(expect.arrayContaining(["PlatformAuditLog"]));
  });

  it("only the plan catalogue is readable among tables without a tenantId", () => {
    expect(report.readablePlatformTables).toEqual(PLATFORM_READABLE.sort());
  });
});
