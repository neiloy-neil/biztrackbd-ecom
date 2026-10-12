import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createBaseClient, setBasePrisma, setPlatformPrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, resetDatabase, seedPlans, testUrls } from "@biztrackbd/db/testing";
import {
  AUTH_MAILS_FOR_TESTS, MAIL_KIND_LIST, URGENT_KINDS, approveSubscriptionPayment, buildMail, createTenantTicket, emailStaffInvite, escapeMailText, notifyOwner, rejectSubscriptionPayment,
  replyPlatformTicket, runBillingLifecycle, setEventPublisher, setMailSender, setSmsSender, signupStore, submitPaymentProof, type MailKind, type PlatformActor, type StaffActor,
} from "../src";

let owner: PrismaClient;
let app: PrismaClient;
let seq = 0;
let lastSub = "";
const mails: { to: string; subject: string; html: string; text?: string }[] = [];
const texts: { to: string; text: string }[] = [];
const fin: PlatformActor = { id: "pu-FIN", email: "fin@biztrackbd.test", role: "FINANCE" };
const lead: PlatformActor = { id: "pu-LEAD", email: "lead@biztrackbd.test", role: "SUPPORT_LEAD" };
const DAY = 86_400_000;

const sample = {
  storeName: "Rongdhonu", ownerName: "Rina Akter", storeUrl: "https://rongdhonu.biztrack.bd", adminUrl: "https://admin.biztrack.bd", billingUrl: "https://admin.biztrack.bd/billing",
  trialEnds: "26 October 2026", inviterName: "Rina", roleLabel: "Store manager", link: "https://admin.biztrack.bd/join/abc", expires: "19 October 2026", daysLeft: 3, plan: "Pro",
  paidUntil: "12 November 2026", reason: "TrxID not found", ticketCode: "TK-1", excerpt: "We switched it on.", ticketUrl: "https://admin.biztrack.bd/support/x",
};

async function newStore(over: { locale?: string } = {}) {
  const n = ++seq;
  const s = await signupStore({ ownerName: "Nusrat Jahan", email: `own${n}@example.test`, phone: `0191${String(2000000 + n).slice(-7)}`, storeName: `Mail Shop ${n}`, subdomain: `mailshop${n}x`, plan: "STARTER", theme: "kapor", demoData: false });
  await owner.tenant.update({ where: { id: s.tenantId }, data: { locale: over.locale ?? "en" } });
  lastSub = `mailshop${n}x`;
  return s;
}

beforeAll(async () => {
  process.env.PHONE_TRUST_SALT = "test-salt-test-salt-test-salt-0001";
  process.env.PLATFORM_BKASH_NUMBER = "01800000000";
  process.env.ADMIN_ORIGIN = "https://admin.example.test";
  process.env.NEXT_PUBLIC_ROOT_DOMAIN = "biztrack.test";
  const urls = testUrls();
  await resetDatabase(urls.direct);
  owner = createOwnerClient(urls.direct);
  app = createBaseClient(urls.app, 10);
  setBasePrisma(app);
  setPlatformPrisma(owner);
  await seedPlans(owner);
});
beforeEach(() => {
  mails.length = 0;
  texts.length = 0;
  setEventPublisher(async () => {});
  setMailSender({ async send(to, subject, html, text) { mails.push({ to, subject, html, text }); } });
  setSmsSender({ async send(_t, to, text) { texts.push({ to, text }); } });
});
afterAll(async () => {
  setMailSender(undefined);
  await app.$disconnect();
  await owner.$disconnect();
});

describe("the email templates", () => {
  it("every email exists in English and Bangla, with a subject, a plain-text part, and the links it needs", () => {
    for (const kind of MAIL_KIND_LIST) {
      for (const lang of ["en", "bn"] as const) {
        const m = buildMail(kind, lang, sample, sample.storeName);
        expect(m.subject.length, `${kind} ${lang} subject`).toBeGreaterThan(5);
        expect(m.html).toContain(`<html lang="${lang}"`);
        expect(m.text.length).toBeGreaterThan(20);
        expect(m.html).not.toContain("undefined");
        expect(m.text).not.toContain("undefined");
        if (lang === "bn") expect(m.subject + m.text).toMatch(/[ঀ-৿]/);
        const links = { WELCOME: sample.adminUrl, PAYMENT_APPROVED: sample.adminUrl, STAFF_INVITE: sample.link, TICKET_REPLY: sample.ticketUrl } as Partial<Record<MailKind, string>>;
        expect(m.html, `${kind} link`).toContain(links[kind] ?? sample.billingUrl);
      }
    }
  });

  it("only the urgent ones carry a text message, and it is short", () => {
    for (const kind of MAIL_KIND_LIST) {
      const m = buildMail(kind, "en", { ...sample, daysLeft: 1 });
      if (URGENT_KINDS.includes(kind)) { expect(m.sms, kind).toBeTruthy(); expect(m.sms!.length).toBeLessThan(160); } else expect(m.sms, kind).toBeUndefined();
    }
    expect(buildMail("TRIAL_ENDING", "en", { ...sample, daysLeft: 3 }).sms).toBeUndefined(); // 3 days out is an email; tomorrow is also a text
  });

  it("everything a person typed is escaped, so a store name cannot add markup to an email", () => {
    const m = buildMail("PAYMENT_REJECTED", "en", { ...sample, storeName: `<script>alert(1)</script> & Co`, reason: `"><img src=x onerror=alert(1)>` });
    expect(m.html).not.toContain("<script>");
    expect(m.html).not.toContain("<img src=x");
    expect(m.html).toContain("&lt;script&gt;");
    expect(escapeMailText("a<b>&\"'")).toBe("a&lt;b&gt;&amp;&quot;&#39;");
  });

  it("the Supabase sign-in templates keep Supabase's placeholders and are in both languages", () => {
    for (const [name, m] of Object.entries(AUTH_MAILS_FOR_TESTS())) {
      expect(m.html + m.subject, name).toMatch(/\{\{ \.(Token|ConfirmationURL) \}\}/);
      expect(m.html, name).toMatch(/[ঀ-৿]/);
    }
  });
});

describe("telling a store's owner", () => {
  it("emails the owner in the store's language, with the store's name, and once only for the same moment", async () => {
    const s = await newStore({ locale: "bn" });
    mails.length = 0; // the welcome email is tested below
    const r1 = await notifyOwner(s.tenantId, "TRIAL_ENDING", { daysLeft: 3 }, { dedupeKey: "t:1" });
    const r2 = await notifyOwner(s.tenantId, "TRIAL_ENDING", { daysLeft: 3 }, { dedupeKey: "t:1" });
    expect([r1.email, r2.email]).toEqual(["sent", "duplicate"]);
    expect(mails).toHaveLength(1);
    expect(mails[0]!.to).toMatch(/^own\d+@example\.test$/);
    expect(mails[0]!.subject).toMatch(/[ঀ-৿]/);
    expect(mails[0]!.html).toContain("Mail Shop");
    expect(mails[0]!.html).toContain("https://admin.example.test/billing");
    expect((await notifyOwner(s.tenantId, "TRIAL_ENDING", { daysLeft: 3 }, { dedupeKey: "t:2" })).email).toBe("sent"); // a different moment
  });

  it("the urgent ones also text the owner once; the others do not", async () => {
    const s = await newStore();
    await notifyOwner(s.tenantId, "PAYMENT_OVERDUE", {}, { dedupeKey: "o:1" });
    await notifyOwner(s.tenantId, "PAYMENT_OVERDUE", {}, { dedupeKey: "o:1" });
    expect(texts).toHaveLength(1);
    expect(texts[0]!.text).toContain("https://admin.example.test/billing");
    await notifyOwner(s.tenantId, "PAYMENT_APPROVED", { plan: "Pro" }, { dedupeKey: "a:1" });
    expect(texts).toHaveLength(1);
  });

  it("a failed send is not recorded as sent, so a retry goes out; a provider that is not set up never breaks anything", async () => {
    const s = await newStore();
    setMailSender({ async send() { throw new Error("provider down"); } });
    expect((await notifyOwner(s.tenantId, "LOCKED", {}, { dedupeKey: "l:1" })).email).toBe("failed");
    setMailSender({ async send(to, subject, html) { mails.push({ to, subject, html }); } });
    expect((await notifyOwner(s.tenantId, "LOCKED", {}, { dedupeKey: "l:1" })).email).toBe("sent");
    setMailSender(null);
    expect((await notifyOwner(s.tenantId, "LOCKED", {}, { dedupeKey: "l:2" })).email).toBe("skipped");
  });

  it("never emails or texts a demo store", async () => {
    const s = await newStore();
    await owner.tenant.update({ where: { id: s.tenantId }, data: { isDemo: true } });
    mails.length = 0;
    texts.length = 0;
    expect(await notifyOwner(s.tenantId, "PAYMENT_OVERDUE", {}, { dedupeKey: "d:1" })).toEqual({ email: "skipped", sms: "skipped" });
    expect(mails).toHaveLength(0);
    expect(texts).toHaveLength(0);
  });

  it("one store's messages are recorded under that store only", async () => {
    const a = await newStore();
    const b = await newStore();
    await notifyOwner(a.tenantId, "LOCKED", {}, { dedupeKey: "same" });
    expect((await notifyOwner(b.tenantId, "LOCKED", {}, { dedupeKey: "same" })).email).toBe("sent");
    expect(await owner.platformMessage.count({ where: { tenantId: a.tenantId } })).toBeGreaterThan(0);
  });
});

describe("where the emails are sent from", () => {
  it("a new store gets a welcome email with its address", async () => {
    const s = await newStore();
    const m = mails.find((x) => x.html.includes(`${lastSub}.biztrack.test`));
    expect(m, "welcome").toBeTruthy();
    expect(m!.html).toContain("https://admin.example.test");
    expect(s.tenantId).toBeTruthy();
  });

  it("approving a plan payment emails the owner the plan and the date; rejecting says why; deciding twice does not email twice", async () => {
    const s = await newStore();
    const actor = { userId: "u1", email: "o@example.test", name: "O", role: "STORE_OWNER" } as StaffActor;
    const p1 = await submitPaymentProof(s.tenantId, actor, { plan: "PRO", interval: "MONTHLY", provider: "BKASH", senderNumber: "01712345678", trxId: `MA${Date.now().toString(36).toUpperCase()}1`.slice(0, 11).padEnd(9, "Z") });
    mails.length = 0;
    await approveSubscriptionPayment(fin, p1.id);
    expect(mails).toHaveLength(1);
    expect(mails[0]!.subject).toContain("payment confirmed");
    expect(mails[0]!.html).toContain("Pro");
    await approveSubscriptionPayment(fin, p1.id).catch(() => undefined);
    expect(mails).toHaveLength(1);

    const p2 = await submitPaymentProof(s.tenantId, actor, { plan: "PRO", interval: "MONTHLY", provider: "BKASH", senderNumber: "01712345678", trxId: `MB${Date.now().toString(36).toUpperCase()}2`.slice(0, 11).padEnd(9, "Z") });
    mails.length = 0;
    await rejectSubscriptionPayment(fin, p2.id, "Not in our bKash history");
    expect(mails).toHaveLength(1);
    expect(mails[0]!.html).toContain("Not in our bKash history");
  });

  it("the daily billing sweep tells the owner at the milestone (and texts when it is the last day), and running it twice tells them once", async () => {
    const s = await newStore();
    const soon = new Date(Date.now() + 12 * 3_600_000);
    await owner.tenant.update({ where: { id: s.tenantId }, data: { trialEndsAt: soon } });
    await owner.subscription.update({ where: { tenantId: s.tenantId }, data: { currentPeriodEnd: soon } });
    mails.length = 0;
    texts.length = 0;
    await runBillingLifecycle();
    await runBillingLifecycle();
    const mine = mails.filter((m) => m.html.includes(`Mail Shop ${seq}`));
    expect(mine).toHaveLength(1);
    expect(mine[0]!.subject).toContain("trial");
    expect(texts.filter((t) => t.text.includes("Mail Shop"))).toHaveLength(1);
  });

  it("a platform reply to a support ticket is emailed to the owner; an internal note is not", async () => {
    const s = await newStore();
    const actor = { userId: "u1", email: "o@example.test", name: "O", role: "STORE_OWNER" } as StaffActor;
    const t = await createTenantTicket(s.tenantId, actor, { subject: "My domain", message: "How do I connect it?" });
    mails.length = 0;
    await replyPlatformTicket(lead, { ticketId: t.id, body: "We switched it on.", isInternal: false });
    expect(mails).toHaveLength(1);
    expect(mails[0]!.html).toContain("We switched it on.");
    await replyPlatformTicket(lead, { ticketId: t.id, body: "Internal: check DNS", isInternal: true });
    expect(mails).toHaveLength(1);
  });

  it("a staff invite is emailed with the link, in the store's language", async () => {
    const s = await newStore({ locale: "bn" });
    const r = await emailStaffInvite(s.tenantId, { to: "New.Person@Example.test", roleLabel: "Store manager", inviterName: "Rina", token: "tok123", expiresAt: new Date(Date.now() + 7 * DAY) });
    expect(r).toBe("sent");
    expect(mails.at(-1)!.to).toBe("New.Person@Example.test");
    expect(mails.at(-1)!.html).toContain("https://admin.example.test/join/tok123");
    expect(mails.at(-1)!.subject).toMatch(/[ঀ-৿]/);
  });
});
