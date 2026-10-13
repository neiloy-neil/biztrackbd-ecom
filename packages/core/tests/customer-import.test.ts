import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, createTenantFixture, resetDatabase, seedPlans, testUrls } from "@biztrackbd/db/testing";
import { CUSTOMER_IMPORT_MAX_ROWS, CUSTOMER_IMPORT_TEMPLATE, DomainError, customersCsv, importCustomersCsv, type StaffActor } from "../src";

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;

async function store(name: string) {
  const f = await createTenantFixture(owner, { name, subdomain: `${name}${++seq}`, stock: 5 });
  const mk = (role: StaffActor["role"], n: string): StaffActor => ({ userId: `u-${n}-${seq}`, email: `${n}${seq}@example.test`, name: n, role });
  return { f, owner: mk("STORE_OWNER", "Nusrat"), packer: mk("ORDER_PACKER", "Rubel") };
}
const fails = async (p: Promise<unknown>, code: string, text?: RegExp) => {
  const e = await p.then(() => null, (x) => x);
  expect(e, `expected ${code}`).toBeInstanceOf(DomainError);
  expect((e as DomainError).code).toBe(code);
  if (text) expect((e as DomainError).message).toMatch(text);
};
const all = (id: string) => owner.customer.findMany({ where: { tenantId: id }, orderBy: { phone: "asc" } });

beforeAll(async () => {
  const urls = testUrls();
  await resetDatabase(urls.direct);
  owner = createOwnerClient(urls.direct);
  app = createBaseClient(urls.app, 10);
  setBasePrisma(app);
  await seedPlans(owner);
});
afterAll(async () => {
  await owner?.$disconnect();
  await app?.$disconnect();
});

describe("importing customers", () => {
  it("reads the template, normalises numbers and tags, and gives no consent to message them", async () => {
    const S = await store("imp");
    const r = await importCustomersCsv(S.f.tenantId, S.owner, CUSTOMER_IMPORT_TEMPLATE);
    expect(r).toMatchObject({ format: "standard", created: 1, existing: 0, duplicates: 0, failed: [] });
    const [c] = await all(S.f.tenantId);
    expect(c).toMatchObject({ name: "Tania Akter", phone: "01712345678", email: "tania@example.com", tags: ["eid buyer", "vip"], notes: "Prefers a call before delivery", totalOrders: 0, smsConsent: false, emailConsent: false });
  });

  it("accepts +880 and Bangla digit numbers, a Shopify customer export, and reports bad rows by line", async () => {
    const S = await store("impshop");
    const csv = [
      "First Name,Last Name,Email,Phone,Tags,Note",
      "Tania,Akter,TANIA@Example.com,+8801712345678,\"vip, eid\",gift",
      "Rafiq,,rafiq@example.com,০১৮১২৩৪৫৬৭৮,,",
      "Bad,Number,bad@example.com,12345,,",
      ",,x@example.com,01912345678,,",
      "Mail,Bad,not-an-email,01512345678,,",
    ].join("\r\n");
    const r = await importCustomersCsv(S.f.tenantId, S.owner, csv);
    expect(r.format).toBe("shopify");
    expect(r.created).toBe(2);
    expect(r.failed.map((f) => [f.line, f.reason])).toEqual([[4, "Not a Bangladeshi mobile number"], [5, "No name"], [6, "The email address does not look right"]]);
    const rows = await all(S.f.tenantId);
    expect(rows.map((c) => c.phone)).toEqual(["01712345678", "01812345678"]);
    expect(rows[0]).toMatchObject({ name: "Tania Akter", email: "tania@example.com", tags: ["vip", "eid"] });
  });

  it("leaves an existing customer as they are, only filling what was empty, and never twice for the same number", async () => {
    const S = await store("impdup");
    await owner.customer.create({ data: { tenantId: S.f.tenantId, name: "Old Name", phone: "01712345678", tags: ["vip"], totalOrders: 7, totalSpent: 5000, isBlacklisted: true, blacklistReason: "refused 3" } });
    const csv = "Name,Phone,Email,Tags,Notes\r\nNew Name,01712345678,a@b.co,\"eid\",hello\r\nOther,01812345678,,,\r\nOther Again,01812345678,,,\r\n";
    const r = await importCustomersCsv(S.f.tenantId, S.owner, csv);
    expect(r).toMatchObject({ created: 1, existing: 1, duplicates: 1 });
    const c = (await all(S.f.tenantId)).find((x) => x.phone === "01712345678")!;
    expect(c).toMatchObject({ name: "Old Name", email: "a@b.co", notes: "hello", tags: ["vip", "eid"], totalOrders: 7, isBlacklisted: true, blacklistReason: "refused 3" });
    // importing the same file again changes nothing
    const again = await importCustomersCsv(S.f.tenantId, S.owner, csv);
    expect(again).toMatchObject({ created: 0, existing: 2 });
    expect((await all(S.f.tenantId)).length).toBe(2);
  });

  it("refuses an empty file, a missing column, too many rows, and people who cannot edit customers", async () => {
    const S = await store("impbad");
    await fails(importCustomersCsv(S.f.tenantId, S.owner, "Name,Phone\r\n"), "VALIDATION_ERROR", /no customers/);
    await fails(importCustomersCsv(S.f.tenantId, S.owner, "Name,Email\r\nA B,a@b.co\r\n"), "VALIDATION_ERROR", /Phone column/);
    await fails(importCustomersCsv(S.f.tenantId, S.owner, "Phone,Email\r\n01712345678,a@b.co\r\n"), "VALIDATION_ERROR", /Name column/);
    const big = ["Name,Phone", ...Array.from({ length: CUSTOMER_IMPORT_MAX_ROWS + 1 }, (_, i) => `N ${i},0171${String(1000000 + i).slice(-7)}`)].join("\r\n");
    await fails(importCustomersCsv(S.f.tenantId, S.owner, big), "VALIDATION_ERROR", /up to 2000/);
    await fails(importCustomersCsv(S.f.tenantId, S.packer, CUSTOMER_IMPORT_TEMPLATE), "FORBIDDEN");
    expect(await all(S.f.tenantId)).toEqual([]);
  });

  it("imports into one store only, and what comes out of the export can be imported back", async () => {
    const A = await store("impa");
    const B = await store("impb");
    await importCustomersCsv(A.f.tenantId, A.owner, CUSTOMER_IMPORT_TEMPLATE);
    expect(await all(B.f.tenantId)).toEqual([]);
    const exported = await customersCsv(A.f.tenantId, A.owner);
    const r = await importCustomersCsv(B.f.tenantId, B.owner, exported);
    expect(r.created).toBe(1);
    expect((await all(B.f.tenantId))[0]).toMatchObject({ name: "Tania Akter", phone: "01712345678" });
  });
});
