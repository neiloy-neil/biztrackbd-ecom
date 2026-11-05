import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, setPlatformPrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, resetDatabase, seedPlans, testUrls } from "@biztrackbd/db/testing";
import {
  addFollowUp, addTenantNote, applySegmentFilter, assignTenant, cancelFollowUp, completeFollowUp, deleteSegment, getStoreTimeline, listCrmTeam, listFollowUps, listSegments,
  listStoreFollowUps, runSegment, saveSegment, setEventPublisher, signupStore, type PlatformActor, type StoreHealthRow,
} from "../src";

const day = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-05T06:00:00Z"); // 12:00 in Dhaka

const row = (over: Partial<StoreHealthRow>): StoreHealthRow => ({
  health: "HEALTHY", reasons: [], paying: false, daysLeft: 10, daysSinceLogin: 1, tenantId: "t", name: "Shop", subdomain: "shop", planTier: "STARTER", status: "TRIAL",
  createdAt: NOW, lastLoginAt: NOW, lastOrderAt: null, orders30d: 5, productCount: 10, staff: 1, smsUsed: 0, smsLimit: 100, hasPayment: true, hasCourier: false, leadStage: "NEW", assigneeId: null, productLimit: 300, ...over,
});

describe("segment filters (no database)", () => {
  const rows = [
    row({ tenantId: "a", name: "Alpha", subdomain: "alpha", health: "AT_RISK", daysLeft: 2, orders30d: 0 }),
    row({ tenantId: "b", name: "Bravo", subdomain: "bravo", health: "HEALTHY", paying: true, planTier: "PRO", status: "ACTIVE", daysLeft: 20, leadStage: "CONVERTED", assigneeId: "u1" }),
    row({ tenantId: "c", name: "Charlie", subdomain: "charlie", health: "CHURNING", daysSinceLogin: 40, smsUsed: 100, leadStage: "LOST", assigneeId: "u2" }),
    row({ tenantId: "d", name: "Delta", subdomain: "delta", daysSinceLogin: null, daysLeft: 12 }),
  ];
  const ids = (f: Parameters<typeof applySegmentFilter>[1]) => applySegmentFilter(rows, f).map((r) => r.tenantId);

  it("matches every store when the filter is empty", () => expect(ids({})).toEqual(["a", "b", "c", "d"]));
  it("filters by health, plan, billing and stage", () => {
    expect(ids({ health: ["AT_RISK", "CHURNING"] })).toEqual(["a", "c"]);
    expect(ids({ plans: ["PRO"] })).toEqual(["b"]);
    expect(ids({ billing: "paying" })).toEqual(["b"]);
    expect(ids({ billing: "trial" })).toEqual(["a", "c", "d"]);
    expect(ids({ stages: ["CONVERTED", "LOST"] })).toEqual(["b", "c"]);
  });
  it("finds trials ending soon, not paying stores or trials with more time", () => {
    expect(ids({ trialEndsInDays: 3 })).toEqual(["a"]);
    expect(ids({ trialEndsInDays: 12 })).toEqual(["a", "c", "d"]);
  });
  it("finds stores with no orders, no recent login, or out of SMS", () => {
    expect(ids({ noOrders30d: true })).toEqual(["a"]);
    expect(ids({ noLoginDays: 30 })).toEqual(["c", "d"]); // never logged in counts
    expect(ids({ smsOut: true })).toEqual(["c"]);
  });
  it("filters by owner, including nobody", () => {
    expect(ids({ assignee: "u1" })).toEqual(["b"]);
    expect(ids({ assignee: "none" })).toEqual(["a", "d"]);
  });
  it("combines filters and searches by name", () => {
    expect(ids({ health: ["AT_RISK"], noOrders30d: true, billing: "trial" })).toEqual(["a"]);
    expect(ids({ q: "BRAV" })).toEqual(["b"]);
    expect(ids({ health: ["HEALTHY"], assignee: "none", q: "zzz" })).toEqual([]);
  });
});

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;
const boss: PlatformActor = { id: "pu-boss", email: "boss@biztrackbd.test", role: "OWNER" };
const rep: PlatformActor = { id: "pu-rep", email: "rep@biztrackbd.test", role: "SUPPORT" };
const failure = (p: Promise<unknown>) => p.then(() => null, (x) => x as Error);

async function store(label = "Crm") {
  const n = ++seq;
  const s = await signupStore({ ownerName: "Nusrat Jahan", email: `crm${n}@example.test`, phone: `0192${String(7000000 + n).slice(-7)}`, storeName: `${label} ${n}`, subdomain: `crm${n}shop`, plan: "STARTER", category: "FASHION" } as never);
  return s.tenantId;
}

describe("merchant CRM in the database", () => {
  beforeAll(async () => {
    process.env.PHONE_TRUST_SALT = "test-salt-test-salt-test-salt-0001";
    const urls = testUrls();
    await resetDatabase(urls.direct);
    owner = createOwnerClient(urls.direct);
    app = createBaseClient(urls.app, 10);
    setBasePrisma(app);
    setPlatformPrisma(owner);
    await seedPlans(owner);
    setEventPublisher(async () => {});
    await owner.platformUser.create({ data: { id: boss.id, email: boss.email, name: "Boss", role: "OWNER" } });
    await owner.platformUser.create({ data: { id: rep.id, email: rep.email, name: "Rep", role: "SUPPORT" } });
    await owner.platformUser.create({ data: { id: "pu-gone", email: "gone@biztrackbd.test", name: "Gone", role: "SUPPORT", isActive: false } });
  }, 120_000);
  afterAll(async () => { await app.$disconnect(); await owner.$disconnect(); });

  it("lists the active team for the owner picker", async () => {
    expect((await listCrmTeam(boss, owner)).map((u) => u.name)).toEqual(expect.arrayContaining(["Boss", "Rep"]));
    expect((await listCrmTeam(boss, owner)).map((u) => u.name)).not.toContain("Gone");
  });

  it("assigns a store, writes it to the timeline, and only lets people with edit access do it", async () => {
    const t = await store();
    await assignTenant(boss, t, rep.id, owner, NOW);
    expect((await owner.tenant.findUniqueOrThrow({ where: { id: t } })).leadAssignedToId).toBe(rep.id);
    expect((await getStoreTimeline(boss, t, 50, owner)).some((e) => e.title === "Owner changed" && e.detail === "Assigned to Rep")).toBe(true);
    expect(await failure(assignTenant(rep, t, boss.id, owner))).toBeTruthy();
    expect((await failure(assignTenant(boss, t, "pu-gone", owner)))!.message).toMatch(/active/);
    await assignTenant(boss, t, null, owner, NOW);
    expect((await owner.tenant.findUniqueOrThrow({ where: { id: t } })).leadAssignedToId).toBeNull();
    // Same owner twice writes nothing new.
    const before = await owner.tenantCrmActivity.count({ where: { tenantId: t } });
    await assignTenant(boss, t, null, owner, NOW);
    expect(await owner.tenantCrmActivity.count({ where: { tenantId: t } })).toBe(before);
  });

  it("adds follow-ups to the person who adds them unless another is named, and checks the form", async () => {
    const t = await store();
    const due = new Date(NOW.getTime() + 2 * day);
    const a = await addFollowUp(rep, t, { dueAt: due, note: "Call about trial" }, owner, NOW);
    expect((await owner.tenantFollowUp.findUniqueOrThrow({ where: { id: a.id } })).assigneeId).toBe(rep.id);
    const b = await addFollowUp(rep, t, { dueAt: due, note: "Hand to the boss", assigneeId: boss.id }, owner, NOW);
    expect((await owner.tenantFollowUp.findUniqueOrThrow({ where: { id: b.id } })).assigneeId).toBe(boss.id);
    expect((await failure(addFollowUp(rep, t, { dueAt: due, note: "" }, owner, NOW)))!.message).toMatch(/what the follow-up is for/);
    expect((await failure(addFollowUp(rep, t, { dueAt: "not a date", note: "x y" }, owner, NOW)))!.message).toBeTruthy();
    expect((await failure(addFollowUp(rep, t, { dueAt: new Date(NOW.getTime() + 400 * day), note: "Far away" }, owner, NOW)))!.message).toMatch(/more than a year/);
    expect((await failure(addFollowUp(rep, t, { dueAt: due, note: "To a former member", assigneeId: "pu-gone" }, owner, NOW)))!.message).toMatch(/active/);
    expect((await failure(addFollowUp(rep, "missing", { dueAt: due, note: "Nobody home" }, owner, NOW)))!.message).toMatch(/not found/i);
    // The store's own next-follow-up date follows the earliest open one.
    expect((await owner.tenant.findUniqueOrThrow({ where: { id: t } })).leadNextFollowUpAt?.getTime()).toBe(due.getTime());
    expect((await listStoreFollowUps(rep, t, owner, NOW)).map((f) => f.note)).toEqual(["Call about trial", "Hand to the boss"]);
  });

  it("sorts follow-ups into overdue, today, upcoming and done, for one person or everyone", async () => {
    // Two people of their own, so follow-ups from the other tests do not count here.
    const q1: PlatformActor = { id: "pu-q1", email: "q1@biztrackbd.test", role: "SUPPORT" };
    const q2: PlatformActor = { id: "pu-q2", email: "q2@biztrackbd.test", role: "SUPPORT" };
    await owner.platformUser.create({ data: { id: q1.id, email: q1.email, name: "Quinn", role: "SUPPORT" } });
    await owner.platformUser.create({ data: { id: q2.id, email: q2.email, name: "Quincy", role: "SUPPORT" } });
    const t = await store("Queue");
    const at = (h: number) => new Date(NOW.getTime() + h * 3600_000);
    await addFollowUp(q1, t, { dueAt: new Date(NOW.getTime() - 3 * day), note: "Late one" }, owner, NOW);
    await addFollowUp(q1, t, { dueAt: at(2), note: "Today one" }, owner, NOW);
    await addFollowUp(q1, t, { dueAt: new Date(NOW.getTime() + 3 * day), note: "Later one" }, owner, NOW);
    await addFollowUp(q1, t, { dueAt: at(3), note: "Quincy today", assigneeId: q2.id }, owner, NOW);

    const mine = await listFollowUps(q1, { assignee: "me" }, owner, NOW);
    expect(mine.counts).toEqual({ overdue: 1, today: 1, upcoming: 1, done: 0 });
    expect(mine.bucket).toBe("overdue");
    expect(mine.items.map((i) => i.note)).toEqual(["Late one"]);
    expect(mine.items[0]).toMatchObject({ assigneeName: "Quinn", daysLate: 3 });

    const today = await listFollowUps(q1, { assignee: "me", bucket: "today" }, owner, NOW);
    expect(today.items.map((i) => i.note)).toEqual(["Today one"]);
    const theirs = await listFollowUps(q2, { assignee: "me" }, owner, NOW);
    expect(theirs.bucket).toBe("today");
    expect(theirs.items.map((i) => i.note)).toEqual(["Quincy today"]);
    const all = await listFollowUps(q1, { assignee: "all", bucket: "today" }, owner, NOW);
    expect(all.items.map((i) => i.note)).toEqual(expect.arrayContaining(["Today one", "Quincy today"]));
    const byId = await listFollowUps(q1, { assignee: q2.id, bucket: "today" }, owner, NOW);
    expect(byId.items.map((i) => i.note)).toEqual(["Quincy today"]);
  });

  it("completes a follow-up once, records it as contact, and moves the store's next date on", async () => {
    const t = await store();
    const first = await addFollowUp(rep, t, { dueAt: new Date(NOW.getTime() + day), note: "First" }, owner, NOW);
    await addFollowUp(rep, t, { dueAt: new Date(NOW.getTime() + 5 * day), note: "Second" }, owner, NOW);
    await completeFollowUp(rep, first.id, "Said they will pay Friday", owner, NOW);
    await completeFollowUp(rep, first.id, "again", owner, NOW);
    const done = await owner.tenantFollowUp.findUniqueOrThrow({ where: { id: first.id } });
    expect(done).toMatchObject({ status: "DONE", doneById: rep.id });
    const store1 = await owner.tenant.findUniqueOrThrow({ where: { id: t } });
    expect(store1.leadLastContactedAt?.getTime()).toBe(NOW.getTime());
    expect(store1.leadNextFollowUpAt?.getTime()).toBe(NOW.getTime() + 5 * day);
    const timeline = await getStoreTimeline(rep, t, 50, owner);
    expect(timeline.filter((e) => e.title === "Follow-up done")).toHaveLength(1);
    expect(timeline.find((e) => e.title === "Follow-up done")!.detail).toBe("First — Said they will pay Friday");
    expect((await listFollowUps(rep, { assignee: "me", bucket: "done" }, owner, NOW)).items.map((i) => i.note)).toContain("First");
  });

  it("cancels a follow-up and clears the store's date when none are left", async () => {
    const t = await store();
    const f = await addFollowUp(rep, t, { dueAt: new Date(NOW.getTime() + day), note: "Oops" }, owner, NOW);
    await cancelFollowUp(rep, f.id, owner);
    await cancelFollowUp(rep, f.id, owner);
    expect((await owner.tenant.findUniqueOrThrow({ where: { id: t } })).leadNextFollowUpAt).toBeNull();
  });

  it("saves, lists with live counts, runs and deletes a segment", async () => {
    const t = await store("Segment");
    await owner.tenant.update({ where: { id: t }, data: { leadStage: "HOT_LEAD" } });
    const saved = await saveSegment(boss, "Hot leads", { stages: ["HOT_LEAD"] }, owner);
    const list = await listSegments(rep, owner, NOW);
    expect(list.find((s) => s.id === saved.id)).toMatchObject({ name: "Hot leads", filter: { stages: ["HOT_LEAD"] }, count: 1 });
    const run = await runSegment(rep, { id: saved.id }, owner, NOW);
    expect(run).toMatchObject({ name: "Hot leads", total: 1 });
    expect(run.rows[0]!.tenantId).toBe(t);
    expect((await runSegment(rep, { filter: { billing: "trial" } }, owner, NOW)).total).toBeGreaterThanOrEqual(1);
    await deleteSegment(boss, saved.id, owner);
    expect((await listSegments(rep, owner, NOW)).some((s) => s.id === saved.id)).toBe(false);
    expect((await failure(runSegment(rep, { id: saved.id }, owner, NOW)))!.message).toMatch(/not found/i);
  });

  it("checks segments: a name, a real filter, no duplicates, no unknown fields, edit access to save", async () => {
    expect((await failure(saveSegment(boss, "x", { stages: ["NEW"] }, owner)))!.message).toMatch(/name/);
    expect((await failure(saveSegment(boss, "Everything", {}, owner)))!.message).toMatch(/at least one filter/);
    expect((await failure(saveSegment(boss, "Odd", { sql: "drop table" }, owner)))!.message).toBeTruthy();
    expect((await failure(saveSegment(boss, "Bad plan", { plans: ["GOLD"] }, owner)))!.message).toBeTruthy();
    await saveSegment(boss, "Trials ending", { trialEndsInDays: 3 }, owner);
    expect((await failure(saveSegment(boss, "trials ENDING", { trialEndsInDays: 5 }, owner)))!.message).toMatch(/already exists/);
    expect(await failure(saveSegment(rep, "Support made", { billing: "trial" }, owner))).toBeTruthy();
    expect(await failure(deleteSegment(rep, "whatever", owner))).toBeTruthy();
  });

  it("puts notes, calls, follow-ups, purchases and plan changes in one timeline, newest first", async () => {
    const t = await store("Timeline");
    await addTenantNote(boss, t, "Owner prefers WhatsApp", { db: owner } as never);
    await addFollowUp(rep, t, { dueAt: new Date(NOW.getTime() + day), note: "Check in" }, owner, NOW);
    await owner.themePurchase.create({ data: { tenantId: t, themeId: "maison", amount: 49, mfsProvider: "BKASH", senderNumber: "01712345678", trxId: `TL${++seq}XXXXXXX`, status: "APPROVED", approvedAt: NOW } });
    await owner.smsPurchase.create({ data: { tenantId: t, quantity: 200, amount: 100, mfsProvider: "NAGAD", senderNumber: "01712345678", trxId: `TS${++seq}XXXXXXX`, status: "PENDING" } });
    await owner.platformAuditLog.create({ data: { actorId: boss.id, action: "PLAN_CHANGED", tenantId: t, details: {} } });
    await owner.platformMessage.create({ data: { tenantId: t, kind: "TRIAL_ENDING", channel: "EMAIL", dedupeKey: "k1", status: "SENT" } });
    await owner.supportTicket.create({ data: { tenantId: t, code: "T-9001", subject: "Cannot add products", openedBy: "someone" } });

    const events = await getStoreTimeline(boss, t, 100, owner);
    const titles = events.map((e) => e.title);
    expect(titles).toEqual(expect.arrayContaining(["Note", "Plan changed", "Support ticket T-9001", "Text sent: trial ending".replace("Text", "Email")]));
    expect(titles.some((x) => x.startsWith("Follow-up set for"))).toBe(true);
    expect(titles.some((x) => x.startsWith("Theme maison") && x.endsWith("approved"))).toBe(true);
    expect(titles.some((x) => x.startsWith("200 SMS") && x.endsWith("waiting"))).toBe(true);
    const times = events.map((e) => e.at.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it("never mixes up stores in a timeline", async () => {
    const a = await store("Mine");
    const b = await store("Theirs");
    await owner.platformAuditLog.create({ data: { actorId: boss.id, action: "TRIAL_EXTENDED", tenantId: b, details: {} } });
    expect((await getStoreTimeline(boss, a, 100, owner)).some((e) => e.title === "Trial extended")).toBe(false);
    expect((await getStoreTimeline(boss, b, 100, owner)).some((e) => e.title === "Trial extended")).toBe(true);
  });
});
