import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, createTenantFixture, resetDatabase, seedPlans, testUrls } from "@biztrackbd/db/testing";
import { DomainError, assignMissingBarcodes, calculateCheckDigit, type StaffActor } from "../src";

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;

async function store(name: string) {
  const f = await createTenantFixture(owner, { name, subdomain: `${name}${++seq}`, stock: 5 });
  const mk = (role: StaffActor["role"], n: string): StaffActor => ({ userId: `u-${n}-${seq}`, email: `${n}${seq}@example.test`, name: n, role });
  return { f, owner: mk("STORE_OWNER", "Nusrat"), support: mk("TELEMARKETER", "Sumaiya") };
}
const manyVariants = async (tenantId: string, productId: string, n: number) => {
  await owner.productVariant.createMany({
    data: Array.from({ length: n }, (_, i) => ({ tenantId, productId, title: `Size ${i}`, sku: `B${tenantId.slice(-4)}-${i}`, price: 100, stockQuantity: 1, options: {} })),
  });
};
const valid = (b: string) => /^\d{12}$/.test(b) && Number(b[11]) === calculateCheckDigit(b.slice(0, 11));

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

describe("barcodes for every variant at once", () => {
  it("gives hundreds of variants a valid, unique barcode in one go and leaves existing ones alone", async () => {
    const S = await store("bcbulk");
    await manyVariants(S.f.tenantId, S.f.products[0]!.id, 850);
    const keep = S.f.products[1]!.variants[0]!.id;
    await owner.productVariant.update({ where: { id: keep }, data: { barcode: "880123400019" } });
    const started = Date.now();
    const r = await assignMissingBarcodes(S.f.tenantId, S.owner);
    expect(Date.now() - started).toBeLessThan(8000);
    const all = await owner.productVariant.findMany({ where: { tenantId: S.f.tenantId } });
    expect(r.updatedCount).toBe(all.length - 1);
    expect(all.every((v) => v.barcode)).toBe(true);
    expect(new Set(all.map((v) => v.barcode)).size).toBe(all.length);
    expect(all.find((v) => v.id === keep)!.barcode).toBe("880123400019");
    expect(all.filter((v) => v.id !== keep).every((v) => valid(v.barcode!))).toBe(true);
  });

  it("running it again changes nothing, and it never reuses a number already taken", async () => {
    const S = await store("bcagain");
    await manyVariants(S.f.tenantId, S.f.products[0]!.id, 20);
    await assignMissingBarcodes(S.f.tenantId, S.owner);
    const before = (await owner.productVariant.findMany({ where: { tenantId: S.f.tenantId }, orderBy: { id: "asc" } })).map((v) => v.barcode);
    expect((await assignMissingBarcodes(S.f.tenantId, S.owner)).updatedCount).toBe(0);
    await manyVariants(S.f.tenantId, S.f.products[1]!.id, 5);
    expect((await assignMissingBarcodes(S.f.tenantId, S.owner)).updatedCount).toBe(5);
    const after = await owner.productVariant.findMany({ where: { tenantId: S.f.tenantId }, orderBy: { id: "asc" } });
    expect(new Set(after.map((v) => v.barcode)).size).toBe(after.length);
    for (const b of before) expect(after.map((v) => v.barcode)).toContain(b);
  });

  it("touches only its own store, and needs the right to edit products", async () => {
    const A = await store("bcsa");
    const B = await store("bcsb");
    await assignMissingBarcodes(A.f.tenantId, A.owner);
    expect(await owner.productVariant.count({ where: { tenantId: B.f.tenantId, barcode: { not: null } } })).toBe(0);
    const e = await assignMissingBarcodes(A.f.tenantId, A.support).then(() => null, (x) => x);
    expect(e).toBeInstanceOf(DomainError);
    expect((e as DomainError).code).toBe("FORBIDDEN");
  });
});
