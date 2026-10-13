import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, createTenantFixture, resetDatabase, seedPlans, testUrls } from "@biztrackbd/db/testing";
import { DomainError, deleteCategory, listCategoriesAdmin, listProducts, saveCategory, type StaffActor } from "../src";

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;

async function store(name: string) {
  const f = await createTenantFixture(owner, { name, subdomain: `${name}${++seq}`, stock: 10 });
  const mk = (role: StaffActor["role"], n: string): StaffActor => ({ userId: `u-${n}-${seq}`, email: `${n}${seq}@example.test`, name: n, role });
  return { f, owner: mk("STORE_OWNER", "Nusrat"), content: mk("CONTENT_EDITOR", "Tamim"), support: mk("TELEMARKETER", "Sumaiya") };
}
const fails = async (p: Promise<unknown>, code: string, text?: RegExp) => {
  const e = await p.then(() => null, (x) => x);
  expect(e, `expected ${code}`).toBeInstanceOf(DomainError);
  expect((e as DomainError).code).toBe(code);
  if (text) expect((e as DomainError).message).toMatch(text);
};

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

describe("categories", () => {
  it("keeps a description, a cover picture and an order, and lists sub-categories right after their parent", async () => {
    const S = await store("cat");
    const men = await saveCategory(S.f.tenantId, S.owner, { name: "Gents Wear", description: "  Panjabi and shirts ", sortOrder: 2 });
    const women = await saveCategory(S.f.tenantId, S.owner, { name: "Ladies Wear", sortOrder: 1 });
    const kids = await saveCategory(S.f.tenantId, S.owner, { name: "Eid Panjabi", parentId: men.id });
    const list = await listCategoriesAdmin(S.f.tenantId, S.owner);
    const names = list.map((c) => c.name).filter((n) => ["Gents Wear", "Ladies Wear", "Eid Panjabi"].includes(n));
    expect(names).toEqual(["Ladies Wear", "Gents Wear", "Eid Panjabi"]);
    expect(list.find((c) => c.id === men.id)).toMatchObject({ description: "Panjabi and shirts", sortOrder: 2, parentId: null });
    expect(list.find((c) => c.id === kids.id)).toMatchObject({ parentId: men.id });
    expect(women.id).toBeTruthy();
  });

  it("allows one level of sub-categories only, and never a loop", async () => {
    const S = await store("catlvl");
    const a = await saveCategory(S.f.tenantId, S.owner, { name: "Alpha" });
    const b = await saveCategory(S.f.tenantId, S.owner, { name: "Bravo", parentId: a.id });
    await fails(saveCategory(S.f.tenantId, S.owner, { name: "Charlie", parentId: b.id }), "VALIDATION_ERROR", /one level/);
    await fails(saveCategory(S.f.tenantId, S.owner, { name: "Alpha", parentId: a.id }, a.id), "VALIDATION_ERROR", /inside itself/);
    await fails(saveCategory(S.f.tenantId, S.owner, { name: "Alpha", parentId: b.id }, a.id), "VALIDATION_ERROR", /one level|sub-categories of its own/);
    await fails(saveCategory(S.f.tenantId, S.owner, { name: "Delta", parentId: "nope" }), "VALIDATION_ERROR", /parent/);
    // a category that has children cannot be moved inside another
    const c = await saveCategory(S.f.tenantId, S.owner, { name: "Echo" });
    await fails(saveCategory(S.f.tenantId, S.owner, { name: "Alpha", parentId: c.id }, a.id), "VALIDATION_ERROR", /sub-categories of its own/);
    // moving a sub-category out makes it top-level
    await saveCategory(S.f.tenantId, S.owner, { name: "Bravo", parentId: null }, b.id);
    expect((await listCategoriesAdmin(S.f.tenantId, S.owner)).find((x) => x.id === b.id)!.parentId).toBeNull();
  });

  it("only takes a cover picture that was uploaded here, and renaming keeps the web address", async () => {
    const S = await store("catimg");
    await fails(saveCategory(S.f.tenantId, S.owner, { name: "Eid", imageUrl: "https://evil.example/x.png" }), "VALIDATION_ERROR");
    await fails(saveCategory(S.f.tenantId, S.owner, { name: "Eid", imageUrl: "/media/../../etc/passwd" }), "VALIDATION_ERROR");
    const ok = await saveCategory(S.f.tenantId, S.owner, { name: "Eid", imageUrl: "/media/tenantabc/0123456789abcdef.webp" }).catch((e) => e);
    // the id part must be a full uuid; a short one is refused too
    expect(ok).toBeInstanceOf(DomainError);
    const good = await saveCategory(S.f.tenantId, S.owner, { name: "Eid", imageUrl: "/media/tenantabc/01234567-89ab-cdef-0123-456789abcdef.webp" });
    const before = (await listCategoriesAdmin(S.f.tenantId, S.owner)).find((c) => c.id === good.id)!;
    await saveCategory(S.f.tenantId, S.owner, { name: "Eid Special" }, good.id);
    const after = (await listCategoriesAdmin(S.f.tenantId, S.owner)).find((c) => c.id === good.id)!;
    expect(after.slug).toBe(before.slug);
    expect(after.imageUrl).toBe(before.imageUrl);
    // leaving the picture field out keeps it; sending null removes it
    await saveCategory(S.f.tenantId, S.owner, { name: "Eid Special", imageUrl: null }, good.id);
    expect((await listCategoriesAdmin(S.f.tenantId, S.owner)).find((c) => c.id === good.id)!.imageUrl).toBeNull();
  });

  it("a top-level category's shop page also shows its sub-categories' products", async () => {
    const S = await store("catshop");
    const parent = await saveCategory(S.f.tenantId, S.owner, { name: "Clothing" });
    const child = await saveCategory(S.f.tenantId, S.owner, { name: "Shirts", parentId: parent.id });
    const other = await saveCategory(S.f.tenantId, S.owner, { name: "Shoes" });
    const [p0, p1, p2] = S.f.products;
    await owner.product.update({ where: { id: p0!.id }, data: { categoryId: parent.id } });
    await owner.product.update({ where: { id: p1!.id }, data: { categoryId: child.id } });
    await owner.product.update({ where: { id: p2!.id }, data: { categoryId: other.id } });
    const slug = (id: string) => owner.category.findUniqueOrThrow({ where: { id } }).then((c) => c.slug);
    const top = await listProducts(S.f.tenantId, { categorySlug: await slug(parent.id) });
    expect(top.items.map((i) => i.id).sort()).toEqual([p0!.id, p1!.id].sort());
    const sub = await listProducts(S.f.tenantId, { categorySlug: await slug(child.id) });
    expect(sub.items.map((i) => i.id)).toEqual([p1!.id]);
  });

  it("deleting a parent keeps its sub-categories and products; rights and store walls hold", async () => {
    const S = await store("catdel");
    const T = await store("catdel2");
    const parent = await saveCategory(S.f.tenantId, S.owner, { name: "Parent" });
    const child = await saveCategory(S.f.tenantId, S.owner, { name: "Child", parentId: parent.id });
    await fails(saveCategory(S.f.tenantId, S.support, { name: "Nope" }), "FORBIDDEN");
    await fails(deleteCategory(T.f.tenantId, T.owner, parent.id), "NOT_FOUND");
    await deleteCategory(S.f.tenantId, S.owner, parent.id);
    const list = await listCategoriesAdmin(S.f.tenantId, S.owner);
    expect(list.find((c) => c.id === parent.id)).toBeUndefined();
    expect(list.find((c) => c.id === child.id)).toMatchObject({ parentId: null });
  });
});
