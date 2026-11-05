import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, setPlatformPrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, resetDatabase, seedPlans, testUrls } from "@biztrackbd/db/testing";
import {
  SMS_CAMPAIGN_DAILY_CAP, createMerchantCampaign, deleteMerchantCampaign, editMerchantCampaign, getMerchantCampaign, getMarketingOptOut, listAutomations, listMerchantCampaigns, nudgeMatches, runNudges, saveSegment, sendMerchantCampaign,
  sendMerchantCampaignTest, setAutomation, setEventPublisher, setMarketingOptOut, signupStore, signUnsubscribe, unsubscribeByToken, verifyUnsubscribe, type PlatformActor, type StaffActor, type StoreHealthRow,
} from "../src";
import { campaignHash, fillPlaceholders, nudgeEmail, renderCampaignEmail } from "../src/platform/merchant-messages";

const day = 24 * 60 * 60 * 1000;
const KEY = "k".repeat(40);

describe("unsubscribe links and wording (no database)", () => {
  it("signs a link for one store and rejects forgeries", () => {
    const t = signUnsubscribe("tenant1", KEY);
    expect(verifyUnsubscribe(t, KEY)).toBe("tenant1");
    expect(verifyUnsubscribe(t.replace("tenant1", "tenant2"), KEY)).toBeNull();
    expect(verifyUnsubscribe(`${t}x`, KEY)).toBeNull();
    expect(verifyUnsubscribe(t, "j".repeat(40))).toBeNull();
    expect(verifyUnsubscribe("nodot", KEY)).toBeNull();
    expect(verifyUnsubscribe("", KEY)).toBeNull();
    expect(verifyUnsubscribe(null, KEY)).toBeNull();
    expect(verifyUnsubscribe("a".repeat(500), KEY)).toBeNull();
  });

  it("fills in each store's own details", () => {
    const v = { ownerName: "Nusrat Jahan", storeName: "Nusrat Fashion", storeUrl: "https://n.biztrack.bd", adminUrl: "https://admin.biztrack.bd" };
    expect(fillPlaceholders("Hi {owner_name}, {store_name}: {store_url} {admin_url}", v)).toBe("Hi Nusrat, Nusrat Fashion: https://n.biztrack.bd https://admin.biztrack.bd");
    expect(fillPlaceholders("Hi {owner_name}", { ...v, ownerName: "" })).toBe("Hi Nusrat Fashion");
  });

  it("puts the unsubscribe link in every email and escapes what was typed", () => {
    const v = { ownerName: "A", storeName: "Shop <b>", storeUrl: "u", adminUrl: "a" };
    const m = renderCampaignEmail({ subject: "Hello {store_name}", body: "Line one\n\n<script>alert(1)</script>" }, v, "en", "https://biztrack.bd/unsubscribe?t=abc");
    expect(m.html).toContain("https://biztrack.bd/unsubscribe?t=abc");
    expect(m.text).toContain("https://biztrack.bd/unsubscribe?t=abc");
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;");
    expect(m.subject).toBe("Hello Shop <b>");
  });

  it("fingerprints the exact words", () => {
    const a = campaignHash({ channel: "EMAIL", subject: "Hi", body: "Body" });
    expect(campaignHash({ channel: "EMAIL", subject: "Hi", body: "Body" })).toBe(a);
    expect(campaignHash({ channel: "EMAIL", subject: "Hi", body: "Body!" })).not.toBe(a);
    expect(campaignHash({ channel: "SMS", subject: "Hi", body: "Body" })).not.toBe(a);
  });

  it("writes every nudge in both languages with a button and the unsubscribe link", () => {
    const v = { ownerName: "Rina", storeName: "Rina Shop", storeUrl: "s", adminUrl: "https://admin.biztrack.bd", what: "product limit" };
    for (const lang of ["en", "bn"] as const) for (const k of ["no_product", "no_order", "win_back", "near_limit"] as const) {
      const m = nudgeEmail(k, lang, v, "https://biztrack.bd/unsubscribe?t=z");
      expect(m.subject.length).toBeGreaterThan(5);
      expect(m.html).toContain("https://admin.biztrack.bd");
      expect(m.html).toContain("unsubscribe?t=z");
    }
  });
});

const NOW = new Date("2026-11-05T06:00:00Z");
const ago = (d: number) => new Date(NOW.getTime() - d * day);
const row = (over: Partial<StoreHealthRow>): StoreHealthRow => ({
  health: "HEALTHY", reasons: [], paying: false, daysLeft: 10, daysSinceLogin: 1, tenantId: "t", name: "Shop", subdomain: "shop", planTier: "STARTER", status: "TRIAL",
  createdAt: ago(10), lastLoginAt: ago(1), lastOrderAt: null, orders30d: 5, productCount: 20, staff: 1, smsUsed: 0, smsLimit: 100, hasPayment: true, hasCourier: false, leadStage: "NEW", assigneeId: null, productLimit: 300, ...over,
});
const matches = (k: Parameters<typeof nudgeMatches>[0], r: StoreHealthRow) => nudgeMatches(k, [r], NOW).length === 1;

describe("who each nudge applies to (no database)", () => {
  it("no products: 3 to 29 days old with only the sample products", () => {
    expect(matches("no_product", row({ createdAt: ago(5), productCount: 3 }))).toBe(true);
    expect(matches("no_product", row({ createdAt: ago(2), productCount: 3 }))).toBe(false);
    expect(matches("no_product", row({ createdAt: ago(40), productCount: 3 }))).toBe(false);
    expect(matches("no_product", row({ createdAt: ago(5), productCount: 10 }))).toBe(false);
  });
  it("no order: 14 to 59 days old, has products, no orders in 30 days", () => {
    expect(matches("no_order", row({ createdAt: ago(20), productCount: 10, orders30d: 0 }))).toBe(true);
    expect(matches("no_order", row({ createdAt: ago(20), productCount: 10, orders30d: 2 }))).toBe(false);
    expect(matches("no_order", row({ createdAt: ago(10), productCount: 10, orders30d: 0 }))).toBe(false);
    expect(matches("no_order", row({ createdAt: ago(20), productCount: 3, orders30d: 0 }))).toBe(false);
  });
  it("win-back: no login for 21 to 89 days", () => {
    expect(matches("win_back", row({ daysSinceLogin: 25 }))).toBe(true);
    expect(matches("win_back", row({ daysSinceLogin: 10 }))).toBe(false);
    expect(matches("win_back", row({ daysSinceLogin: 120 }))).toBe(false);
    expect(matches("win_back", row({ daysSinceLogin: null }))).toBe(false);
  });
  it("near a limit: 80 percent of products or free SMS, with the reason and a monthly key", () => {
    const p = nudgeMatches("near_limit", [row({ productCount: 250, productLimit: 300 })], NOW)[0]!;
    expect(p).toMatchObject({ what: "product limit", period: "2026-11" });
    expect(nudgeMatches("near_limit", [row({ smsUsed: 85, smsLimit: 100 })], NOW)[0]!.what).toBe("free SMS for this month");
    expect(matches("near_limit", row({ productCount: 100, smsUsed: 10 }))).toBe(false);
    expect(matches("near_limit", row({ productLimit: null, smsLimit: null, productCount: 9999 }))).toBe(false);
  });
  it("leaves out stores that are not open", () => {
    expect(matches("win_back", row({ daysSinceLogin: 30, status: "SUSPENDED" }))).toBe(false);
    expect(matches("win_back", row({ daysSinceLogin: 30, status: "ACTIVE" }))).toBe(true);
  });
});

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;
const boss: PlatformActor = { id: "pu-camp-boss", email: "boss@biztrackbd.test", role: "OWNER" };
const rep: PlatformActor = { id: "pu-camp-rep", email: "rep@biztrackbd.test", role: "SUPPORT" };
const failure = (p: Promise<unknown>) => p.then(() => null, (x) => x as Error);

async function store(group: string) {
  const n = ++seq;
  const email = `camp${n}@example.test`;
  const s = await signupStore({ ownerName: "Nusrat Jahan", email, phone: `0191${String(8000000 + n).slice(-7)}`, storeName: `${group} ${n}`, subdomain: `${group.toLowerCase()}${n}shop`, plan: "STARTER", category: "FASHION" } as never);
  const u = await owner.tenantUser.findFirstOrThrow({ where: { tenantId: s.tenantId } });
  return { tenantId: s.tenantId, email, actor: { userId: u.id, email: u.email, name: u.name, role: "STORE_OWNER" } as StaffActor };
}

function fakes() {
  const emails: { to: string; subject: string; html: string }[] = [];
  const texts: { to: string; text: string }[] = [];
  return {
    emails, texts,
    deps: {
      db: undefined as PrismaClient | undefined,
      now: new Date(),
      sendEmail: async (to: string, subject: string, html: string) => { emails.push({ to, subject, html }); return "sent" as const; },
      sendSms: async (to: string, text: string) => { texts.push({ to, text }); },
    },
  };
}

describe("campaigns, opt-out and nudges in the database", () => {
  beforeAll(async () => {
    process.env.PHONE_TRUST_SALT = "test-salt-test-salt-test-salt-0001";
    process.env.UNSUBSCRIBE_SECRET = KEY;
    const urls = testUrls();
    await resetDatabase(urls.direct);
    owner = createOwnerClient(urls.direct);
    app = createBaseClient(urls.app, 10);
    setBasePrisma(app);
    setPlatformPrisma(owner);
    await seedPlans(owner);
    setEventPublisher(async () => {});
    await owner.platformUser.create({ data: { id: boss.id, email: boss.email, name: "Boss", role: "OWNER" } });
  }, 120_000);
  afterAll(async () => { await app.$disconnect(); await owner.$disconnect(); });

  async function group(name: string, stores: number) {
    const made = [];
    for (let i = 0; i < stores; i++) made.push(await store(name));
    const seg = await saveSegment(boss, `${name} group`, { q: name.toLowerCase() }, owner);
    return { made, segmentId: seg.id };
  }
  const draft = (segmentId: string, over: Record<string, unknown> = {}) => createMerchantCampaign(boss, { name: "Hello", channel: "EMAIL", segmentId, subject: "News for {store_name}", body: "Hi {owner_name}, we added something new.", ...over }, { db: owner });

  it("checks a draft: a chosen group, a subject for email, a short text, and edit access", async () => {
    const g = await group("Checkgrp", 1);
    const bad = async (over: Record<string, unknown>) => (await failure(draft(g.segmentId, over)))!.message;
    expect(await bad({ segmentId: undefined, filter: {} })).toMatch(/saved segment/);
    expect(await bad({ segmentId: "nope" })).toMatch(/not found/i);
    expect(await bad({ subject: "" })).toMatch(/needs a subject/);
    expect(await bad({ channel: "SMS", body: "x".repeat(400) })).toMatch(/320/);
    expect(await bad({ name: "x" })).toMatch(/Name the campaign/);
    expect(await bad({ body: "hi" })).toMatch(/Write the message/);
    expect(await failure(createMerchantCampaign(rep, { name: "Nope", channel: "EMAIL", segmentId: g.segmentId, subject: "Hello", body: "Hello there" }, { db: owner }))).toBeTruthy();
    const ok = await draft(g.segmentId);
    expect((await listMerchantCampaigns(boss, { db: owner })).some((c) => c.id === ok.id)).toBe(true);
  });

  it("will not send until the exact words were tested, and a change needs a new test", async () => {
    const g = await group("Testgrp", 2);
    const { id } = await draft(g.segmentId);
    const f = fakes();
    expect((await failure(sendMerchantCampaign(boss, id, { confirmCount: 2 }, { ...f.deps, db: owner })))!.message).toMatch(/test of this exact message/);
    await sendMerchantCampaignTest(boss, id, "me@example.test", { ...f.deps, db: owner });
    expect(f.emails).toHaveLength(1);
    expect(f.emails[0]).toMatchObject({ to: "me@example.test" });
    expect(f.emails[0]!.subject).toMatch(/^\[Test\]/);
    expect((await getMerchantCampaign(boss, id, { db: owner })).campaign.tested).toBe(true);
    await editMerchantCampaign(boss, id, { subject: "Changed", body: "New words for you" }, { db: owner });
    expect((await getMerchantCampaign(boss, id, { db: owner })).campaign.tested).toBe(false);
    expect((await failure(sendMerchantCampaign(boss, id, { confirmCount: 2 }, { ...f.deps, db: owner })))!.message).toMatch(/test of this exact message/);
    expect(f.emails).toHaveLength(1);
  });

  it("makes the sender type the number of stores, then sends once to each and never twice", async () => {
    const g = await group("Sendgrp", 3);
    const { id } = await draft(g.segmentId);
    const f = fakes();
    await sendMerchantCampaignTest(boss, id, "me@example.test", { ...f.deps, db: owner });
    f.emails.length = 0;
    const { preview } = await getMerchantCampaign(boss, id, { db: owner });
    expect(preview).toMatchObject({ total: 3, willSend: 3 });
    expect((await failure(sendMerchantCampaign(boss, id, { confirmCount: 2 }, { ...f.deps, db: owner })))!.message).toMatch(/Type 3 to confirm/);
    expect((await failure(sendMerchantCampaign(boss, id, {}, { ...f.deps, db: owner })))!.message).toMatch(/Type 3 to confirm/);
    const done = await sendMerchantCampaign(boss, id, { confirmCount: 3 }, { ...f.deps, db: owner });
    expect(done).toMatchObject({ sent: 3, failed: 0, skipped: 0 });
    expect(f.emails.map((e) => e.to).sort()).toEqual(g.made.map((m) => m.email).sort());
    // Each email carries that store's own details and its own unsubscribe link.
    const mine = f.emails.find((e) => e.to === g.made[0]!.email)!;
    expect(mine.subject).toBe(`News for ${(await owner.storeSettings.findFirstOrThrow({ where: { tenantId: g.made[0]!.tenantId } })).storeName}`);
    expect(mine.html).toContain(encodeURIComponent(signUnsubscribe(g.made[0]!.tenantId, KEY)));
    expect((await failure(sendMerchantCampaign(boss, id, { confirmCount: 3 }, { ...f.deps, db: owner })))!.message).toMatch(/already been sent/);
    expect(f.emails).toHaveLength(3);
    expect((await getMerchantCampaign(boss, id, { db: owner })).campaign).toMatchObject({ status: "SENT", sentCount: 3 });
    expect((await failure(editMerchantCampaign(boss, id, { subject: "x y z", body: "abcdef" }, { db: owner })))!.message).toMatch(/started sending/);
    expect((await failure(deleteMerchantCampaign(boss, id, { db: owner })))!.message).toMatch(/Only a draft/);
  });

  it("skips owners who opted out or have no email, and says so", async () => {
    const g = await group("Skipgrp", 3);
    await setMarketingOptOut(g.made[0]!.tenantId, g.made[0]!.actor, true);
    await owner.tenant.update({ where: { id: g.made[1]!.tenantId }, data: { ownerEmail: null } });
    const { id } = await draft(g.segmentId);
    const f = fakes();
    await sendMerchantCampaignTest(boss, id, "me@example.test", { ...f.deps, db: owner });
    f.emails.length = 0;
    expect((await getMerchantCampaign(boss, id, { db: owner })).preview).toMatchObject({ total: 3, willSend: 1, optedOut: 1, noContact: 1 });
    const done = await sendMerchantCampaign(boss, id, { confirmCount: 1 }, { ...f.deps, db: owner });
    expect(done).toMatchObject({ sent: 1, skipped: 2 });
    expect(f.emails.map((e) => e.to)).toEqual([g.made[2]!.email]);
    const sends = await owner.merchantCampaignSend.findMany({ where: { campaignId: id } });
    expect(sends.map((s) => s.status).sort()).toEqual(["SENT", "SKIPPED_NO_CONTACT", "SKIPPED_OPTOUT"]);
  });

  it("counts a failed delivery and does not message that store again on a retry", async () => {
    const g = await group("Failgrp", 2);
    const { id } = await draft(g.segmentId);
    const f = fakes();
    await sendMerchantCampaignTest(boss, id, "me@example.test", { ...f.deps, db: owner });
    const flaky = { ...f.deps, db: owner, sendEmail: async (to: string) => (to === g.made[0]!.email ? ("failed" as const) : ("sent" as const)) };
    expect(await sendMerchantCampaign(boss, id, { confirmCount: 2 }, flaky)).toMatchObject({ sent: 1, failed: 1 });
    const c = (await getMerchantCampaign(boss, id, { db: owner })).campaign;
    expect(c).toMatchObject({ status: "SENT", sentCount: 1, failedCount: 1 });
  });

  it("finishes a campaign that stopped part way, without repeating the stores already done", async () => {
    const g = await group("Resumegrp", 3);
    const { id } = await draft(g.segmentId);
    const f = fakes();
    await sendMerchantCampaignTest(boss, id, "me@example.test", { ...f.deps, db: owner });
    f.emails.length = 0;
    // The first store was already messaged before the process stopped.
    await owner.merchantCampaign.update({ where: { id }, data: { status: "SENDING", sentAt: new Date(), recipients: 3 } });
    await owner.merchantCampaignSend.create({ data: { campaignId: id, tenantId: g.made[0]!.tenantId, status: "SENT" } });
    const done = await sendMerchantCampaign(boss, id, {}, { ...f.deps, db: owner });
    expect(f.emails.map((e) => e.to).sort()).toEqual([g.made[1]!.email, g.made[2]!.email].sort());
    expect(done.sent).toBe(3);
    expect((await getMerchantCampaign(boss, id, { db: owner })).campaign.status).toBe("SENT");
  });

  it("refuses a second campaign to the same group within a day", async () => {
    const g = await group("Daygrp", 1);
    const a = await draft(g.segmentId, { name: "First" });
    const b = await draft(g.segmentId, { name: "Second" });
    const f = fakes();
    for (const c of [a, b]) await sendMerchantCampaignTest(boss, c.id, "me@example.test", { ...f.deps, db: owner });
    await sendMerchantCampaign(boss, a.id, { confirmCount: 1 }, { ...f.deps, db: owner });
    expect((await failure(sendMerchantCampaign(boss, b.id, { confirmCount: 1 }, { ...f.deps, db: owner })))!.message).toMatch(/already went to this group/);
  });

  it("caps text campaigns per day", async () => {
    const g = await group("Smsgrp", 2);
    await owner.merchantCampaign.create({ data: { name: "Earlier texts", channel: "SMS", filter: { q: "earlier" }, filterKey: "earlier", body: "Earlier", status: "SENT", sentCount: SMS_CAMPAIGN_DAILY_CAP - 1, sentAt: new Date(), createdById: boss.id } });
    const { id } = await draft(g.segmentId, { channel: "SMS", subject: null, body: "Short text for {store_name}" });
    const f = fakes();
    await sendMerchantCampaignTest(boss, id, "01712345678", { ...f.deps, db: owner });
    expect(f.texts[0]!.text).toMatch(/^\[Test\] Short text for Sample Store/);
    expect((await failure(sendMerchantCampaign(boss, id, { confirmCount: 2 }, { ...f.deps, db: owner })))!.message).toMatch(/capped at 500/);
    expect((await failure(sendMerchantCampaignTest(boss, id, "123", { ...f.deps, db: owner })))!.message).toMatch(/mobile number/);
  });

  it("sends texts to normalised numbers when under the cap", async () => {
    const g = await group("Texts", 1);
    const { id } = await draft(g.segmentId, { channel: "SMS", subject: null, body: "Hello {owner_name}" });
    const f = fakes();
    await sendMerchantCampaignTest(boss, id, "01712345678", { ...f.deps, db: owner });
    f.texts.length = 0;
    // Earlier tests used up part of the day's cap; clear it so this send is judged on its own.
    await owner.merchantCampaign.updateMany({ where: { channel: "SMS", status: "SENT" }, data: { sentCount: 0 } });
    expect(await sendMerchantCampaign(boss, id, { confirmCount: 1 }, { ...f.deps, db: owner })).toMatchObject({ sent: 1 });
    expect(f.texts).toHaveLength(1);
    expect(f.texts[0]!.text).toBe("Hello Nusrat");
    expect(f.texts[0]!.to).toMatch(/^01\d{9}$/);
  });

  it("lets an owner switch marketing off and on, and an unsubscribe link switch it off", async () => {
    const s = await store("Optgrp");
    expect(await getMarketingOptOut(s.tenantId, s.actor)).toBe(false);
    await setMarketingOptOut(s.tenantId, s.actor, true);
    expect(await getMarketingOptOut(s.tenantId, s.actor)).toBe(true);
    await setMarketingOptOut(s.tenantId, s.actor, false);
    expect(await getMarketingOptOut(s.tenantId, s.actor)).toBe(false);
    const res = await unsubscribeByToken(signUnsubscribe(s.tenantId, KEY), owner);
    expect(res?.storeName).toMatch(/^Optgrp/);
    expect(await getMarketingOptOut(s.tenantId, s.actor)).toBe(true);
    expect(await unsubscribeByToken("garbage.token", owner)).toBeNull();
    expect(await unsubscribeByToken(`${s.tenantId}.forged`, owner)).toBeNull();
    expect(await failure(setMarketingOptOut(s.tenantId, { ...s.actor, role: "ORDER_PACKER" } as StaffActor, true))).toBeTruthy();
  });

  it("lists nudges off until they are switched on, by someone with edit access", async () => {
    const before = await listAutomations(boss, { db: owner });
    expect(before.map((a) => a.key)).toEqual(["no_product", "no_order", "win_back", "near_limit"]);
    expect(before.every((a) => !a.enabled)).toBe(true);
    expect(await failure(setAutomation(rep, "win_back", true, { db: owner }))).toBeTruthy();
    expect((await failure(setAutomation(boss, "bogus", true, { db: owner })))!.message).toMatch(/not found/i);
    await setAutomation(boss, "win_back", true, { db: owner });
    expect((await listAutomations(boss, { db: owner })).find((a) => a.key === "win_back")!.enabled).toBe(true);
    await setAutomation(boss, "win_back", false, { db: owner });
    expect(await runNudges({ db: owner, sendEmail: async () => "sent" })).toEqual([]);
  });

  it("sends a nudge once to a store that needs it, skips opted-out owners, and retries after a failed send", async () => {
    const needs = await store("Nudgea");
    const optedOut = await store("Nudgeb");
    for (const s of [needs, optedOut]) await owner.tenant.update({ where: { id: s.tenantId }, data: { createdAt: new Date(Date.now() - 5 * day), productCount: 3 } });
    await setMarketingOptOut(optedOut.tenantId, optedOut.actor, true);
    await setAutomation(boss, "no_product", true, { db: owner });

    const sent: string[] = [];
    const deps = { db: owner, sendEmail: async (to: string) => { sent.push(to); return "sent" as const; } };
    const first = (await runNudges(deps)).find((x) => x.key === "no_product")!;
    expect(first.sent).toBeGreaterThanOrEqual(1);
    expect(sent).toContain(needs.email);
    expect(sent).not.toContain(optedOut.email);
    const second = (await runNudges(deps)).find((x) => x.key === "no_product")!;
    expect(second.sent).toBe(0);
    expect(sent.filter((x) => x === needs.email)).toHaveLength(1);
    expect((await listAutomations(boss, { db: owner })).find((a) => a.key === "no_product")!.sentLast30Days).toBeGreaterThanOrEqual(1);

    // A store whose first attempt did not go out is tried again next time.
    const retry = await store("Nudgec");
    await owner.tenant.update({ where: { id: retry.tenantId }, data: { createdAt: new Date(Date.now() - 5 * day), productCount: 3 } });
    await runNudges({ db: owner, sendEmail: async () => "failed" });
    expect(await owner.platformMessage.count({ where: { tenantId: retry.tenantId, kind: "NUDGE_NO_PRODUCT" } })).toBe(0);
    const later: string[] = [];
    await runNudges({ db: owner, sendEmail: async (to) => { later.push(to); return "sent"; } });
    expect(later).toContain(retry.email);
  });

  it("limits how many nudges one run sends", async () => {
    await setAutomation(boss, "no_product", true, { db: owner });
    for (let i = 0; i < 3; i++) { const s = await store("Capgrp"); await owner.tenant.update({ where: { id: s.tenantId }, data: { createdAt: new Date(Date.now() - 6 * day), productCount: 3 } }); }
    const r = (await runNudges({ db: owner, sendEmail: async () => "sent", cap: 2 })).find((x) => x.key === "no_product")!;
    expect(r.sent).toBe(2);
  });
});
