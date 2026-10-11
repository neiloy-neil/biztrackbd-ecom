import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, createTenantFixture, resetDatabase, seedPlans, testUrls } from "@biztrackbd/db/testing";
import { DomainError, bodyToHtml, deleteContent, getContent, getPublishedPage, getPublishedPost, listContent, listFooterPages, listPublishedPosts, saveContent, type StaffActor } from "../src";

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;

async function store(name: string) {
  const f = await createTenantFixture(owner, { name, subdomain: `${name}${++seq}`, stock: 5 });
  const mk = (role: StaffActor["role"]): StaffActor => ({ userId: `u-${role}-${seq}`, email: `${role}${seq}@example.test`, name: role, role });
  return { f, owner: mk("STORE_OWNER"), editor: mk("CONTENT_EDITOR"), packer: mk("ORDER_PACKER") };
}
const fails = async (p: Promise<unknown>, msg: RegExp, field?: string) => {
  const e = await p.then(() => null, (x) => x);
  expect(e).toBeInstanceOf(DomainError);
  expect((e as DomainError).message).toMatch(msg);
  if (field) expect((e as DomainError).details?.field).toBe(field);
};

beforeAll(async () => {
  const urls = testUrls();
  await resetDatabase(urls.direct);
  owner = createOwnerClient(urls.direct);
  app = createBaseClient(urls.app, 5);
  setBasePrisma(app);
  await seedPlans(owner);
});
afterAll(async () => {
  await app.$disconnect();
  await owner.$disconnect();
});

describe("writing text", () => {
  it("turns plain text into paragraphs and escapes it", () => {
    expect(bodyToHtml("First line\nsecond line\n\n5 < 6 & 7 > 3")).toBe("<p>First line<br>second line</p>\n<p>5 &lt; 6 &amp; 7 &gt; 3</p>");
  });
  it("cleans anything written with tags: no scripts, handlers, iframes, styles or javascript links", () => {
    const html = bodyToHtml('<h2>Hi</h2><script>alert(1)</script><p onclick="x()" style="color:red">a <a href="javascript:alert(1)">bad</a> <a href="https://ok.example">good</a></p><iframe src="https://e.example"></iframe><img src="http://insecure.example/a.png">');
    expect(html).not.toMatch(/script|onclick|style=|javascript:|iframe|insecure/);
    expect(html).toContain('<h2>Hi</h2>');
    expect(html).toContain('href="https://ok.example"');
    expect(html).toContain("noopener");
  });
});

describe("pages", () => {
  it("are created, found by address, and shown to visitors only when published", async () => {
    const S = await store("pg1");
    const { id } = await saveContent(S.f.tenantId, S.owner, "page", null, { title: "Delivery policy", body: "We deliver in 1 to 2 days.", isPublished: false });
    expect(await getPublishedPage(S.f.tenantId, "delivery-policy")).toBeNull();
    await saveContent(S.f.tenantId, S.owner, "page", id, { title: "Delivery policy", body: "We deliver in 1 to 2 days.", isPublished: true });
    expect(await getPublishedPage(S.f.tenantId, "delivery-policy")).toMatchObject({ title: "Delivery policy", contentHtml: "<p>We deliver in 1 to 2 days.</p>" });
    expect((await listFooterPages(S.f.tenantId)).map((p) => p.slug)).toEqual(["delivery-policy"]);
    await deleteContent(S.f.tenantId, S.owner, "page", id);
    expect(await getPublishedPage(S.f.tenantId, "delivery-policy")).toBeNull();
  });

  it("refuse bad addresses, duplicates, empty and over-long text", async () => {
    const S = await store("pg2");
    await saveContent(S.f.tenantId, S.owner, "page", null, { title: "About us", body: "Hello", isPublished: true });
    await fails(saveContent(S.f.tenantId, S.owner, "page", null, { title: "About us again", slug: "about-us", body: "Hello", isPublished: true }), /already have one/, "slug");
    await fails(saveContent(S.f.tenantId, S.owner, "page", null, { title: "Bad", slug: "Has Spaces", body: "x", isPublished: true }), /small letters/, "slug");
    await fails(saveContent(S.f.tenantId, S.owner, "page", null, { title: "x", body: "x", isPublished: true }), /title/, "title");
    await fails(saveContent(S.f.tenantId, S.owner, "page", null, { title: "Empty", body: "   ", isPublished: true }), /Write something/, "body");
    await fails(saveContent(S.f.tenantId, S.owner, "page", null, { title: "Long", body: "x".repeat(60_001), isPublished: true }), /too long/, "body");
  });

  it("can be edited by a content editor but not by fulfilment staff", async () => {
    const S = await store("pg3");
    await saveContent(S.f.tenantId, S.editor, "page", null, { title: "Size guide", body: "S M L", isPublished: true });
    await fails(saveContent(S.f.tenantId, S.packer, "page", null, { title: "Nope", body: "x", isPublished: true }), /access/);
    await fails(listContent(S.f.tenantId, S.packer, "page"), /access/);
  });

  it("are private to the store that wrote them", async () => {
    const A = await store("pgA");
    const B = await store("pgB");
    const { id } = await saveContent(A.f.tenantId, A.owner, "page", null, { title: "Secret terms", body: "x", isPublished: true });
    expect(await getPublishedPage(B.f.tenantId, "secret-terms")).toBeNull();
    await fails(getContent(B.f.tenantId, B.owner, "page", id), /not found/i);
    await fails(deleteContent(B.f.tenantId, B.owner, "page", id), /not found/i);
    await fails(saveContent(B.f.tenantId, B.owner, "page", id, { title: "Hijack", body: "x", isPublished: true }), /not found/i);
    expect(await getPublishedPage(A.f.tenantId, "secret-terms")).not.toBeNull();
  });
});

describe("blog posts", () => {
  it("carry a summary, author, tags and cover picture, newest first, published only", async () => {
    const S = await store("bl1");
    await saveContent(S.f.tenantId, S.owner, "post", null, { title: "Eid styling guide", body: "Pick a panjabi.\n\nThen shoes.", isPublished: true, summary: "How to dress", authorName: "Nusrat", tags: "Eid, Style Guide, eid", coverImage: "/media/t1/cover.webp" });
    await saveContent(S.f.tenantId, S.owner, "post", null, { title: "Draft idea", body: "Later", isPublished: false });
    await saveContent(S.f.tenantId, S.owner, "post", null, { title: "Care tips", body: "Wash cold", isPublished: true });
    const list = await listPublishedPosts(S.f.tenantId);
    expect(list.total).toBe(2);
    expect(list.items.map((p) => p.slug)).toEqual(["care-tips", "eid-styling-guide"]);
    expect(await getPublishedPost(S.f.tenantId, "eid-styling-guide")).toMatchObject({ summary: "How to dress", authorName: "Nusrat", tags: ["eid", "style-guide"], coverImage: "/media/t1/cover.webp" });
    expect(await getPublishedPost(S.f.tenantId, "draft-idea")).toBeNull();
    expect((await listContent(S.f.tenantId, S.owner, "post")).map((p) => p.slug).sort()).toEqual(["care-tips", "draft-idea", "eid-styling-guide"]);
  });

  it("refuse a cover picture that is not an upload or an https address", async () => {
    const S = await store("bl2");
    await fails(saveContent(S.f.tenantId, S.owner, "post", null, { title: "Bad cover", body: "x", isPublished: true, coverImage: "javascript:alert(1)" }), /cover picture/, "coverImage");
    await fails(saveContent(S.f.tenantId, S.owner, "post", null, { title: "Bad cover 2", body: "x", isPublished: true, coverImage: "http://insecure.example/a.jpg" }), /cover picture/, "coverImage");
  });

  it("are paged, and one store never sees another's posts", async () => {
    const A = await store("blA");
    const B = await store("blB");
    for (let i = 0; i < 14; i++) await saveContent(A.f.tenantId, A.owner, "post", null, { title: `Post number ${i}`, body: "x", isPublished: true });
    expect((await listPublishedPosts(A.f.tenantId, { pageSize: 12 })).items).toHaveLength(12);
    expect((await listPublishedPosts(A.f.tenantId, { pageSize: 12, page: 2 })).items).toHaveLength(2);
    expect((await listPublishedPosts(B.f.tenantId)).total).toBe(0);
  });
});
