import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auditRls, failures, type RlsReport } from "../src/rls-audit";
import { createOwnerClient, createTenantFixture, resetDatabase, seedPlans, testUrls } from "../src/testing";

let report: RlsReport;
// Read by every store on purpose: the plan catalogue, platform announcements, and the Tenant row (which has its own policy: a store sees only itself).
// Template: the published store templates (the signup, the gallery and the editor read them); a row-level policy hides drafts.
const PLATFORM_READABLE = ["Plan", "Announcement", "Template", "Tenant"];
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
