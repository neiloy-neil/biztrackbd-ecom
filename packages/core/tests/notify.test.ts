import { describe, expect, it } from "vitest";
import { notifyPlatform, saveNotifyRecipient, sendNotifyTest } from "../src/platform/notify";

type Sent = { to: string; subject: string; html: string; text?: string };

function fakeDb(recipients: string[] = ["owner@example.com", "not-an-email", "staff@example.com"]) {
  const calls: { sql: string; vals: unknown[] }[] = [];
  const db = {
    $queryRaw: async (strings: TemplateStringsArray, ...vals: unknown[]) => {
      const sql = strings.join("?");
      calls.push({ sql, vals });
      return sql.includes("platform_notify_recipients") ? [{ r: recipients }] : [{ platform_notify_record: "ntf_1" }];
    },
  };
  return { db: db as never, calls };
}

function fakeSender(fail = false) {
  const sent: Sent[] = [];
  return {
    sent,
    sender: {
      send: async (to: string, subject: string, html: string, text?: string) => {
        if (fail) throw new Error("provider down");
        sent.push({ to, subject, html, text });
      },
    },
  };
}

describe("notifyPlatform", () => {
  it("records the event and emails each valid recipient", async () => {
    const { db, calls } = fakeDb();
    const { sender, sent } = fakeSender();
    await notifyPlatform({ kind: "SIGNUP", title: "New signup: Rahim Fashion", lines: [["Name", "Rahim"], ["Phone", "01712345678"], ["Campaign", null]] }, { db, sender });
    expect(calls[0]!.sql).toContain("platform_notify_record");
    expect(calls[0]!.vals[0]).toBe("SIGNUP");
    expect(sent.map((s) => s.to)).toEqual(["owner@example.com", "staff@example.com"]);
    expect(sent[0]!.subject).toBe("[BizTrackBD] New signup: Rahim Fashion");
    expect(sent[0]!.text).toContain("Name: Rahim");
    expect(sent[0]!.text).not.toContain("Campaign");
  });

  it("escapes what visitors typed so it cannot inject HTML into the email", async () => {
    const { db } = fakeDb(["owner@example.com"]);
    const { sender, sent } = fakeSender();
    await notifyPlatform({ kind: "INQUIRY", title: "Inquiry", lines: [["Message", '<script>alert("x")</script>']] }, { db, sender });
    expect(sent[0]!.html).not.toContain("<script>");
    expect(sent[0]!.html).toContain("&lt;script&gt;");
  });

  it("still saves the feed entry when no email provider is set up", async () => {
    const { db, calls } = fakeDb();
    await notifyPlatform({ kind: "TICKET", title: "Ticket", lines: [] }, { db, sender: null });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.sql).toContain("platform_notify_record");
  });

  it("never throws, even when the provider or the database fails", async () => {
    const { db } = fakeDb();
    await expect(notifyPlatform({ kind: "SIGNUP", title: "x", lines: [] }, { db, sender: fakeSender(true).sender })).resolves.toBeUndefined();
    const broken = { $queryRaw: async () => { throw new Error("db down"); } } as never;
    await expect(notifyPlatform({ kind: "SIGNUP", title: "x", lines: [] }, { db: broken, sender: fakeSender().sender })).resolves.toBeUndefined();
  });
});

describe("recipient rules", () => {
  const owner = { id: "u1", email: "owner@x.com", role: "OWNER" } as never;
  const finance = { id: "u2", email: "fin@x.com", role: "FINANCE" } as never;

  it("only people who can edit settings may change the list", async () => {
    await expect(saveNotifyRecipient(finance, { email: "a@b.co", events: ["SIGNUP"], active: true })).rejects.toThrow();
    await expect(sendNotifyTest(finance, "a@b.co", { sender: null })).rejects.toThrow();
  });

  it("rejects a bad address and a recipient with no events", async () => {
    await expect(saveNotifyRecipient(owner, { email: "nope", events: ["SIGNUP"], active: true })).rejects.toThrow(/valid email/);
    await expect(saveNotifyRecipient(owner, { email: "a@b.co", events: ["BOGUS"], active: true })).rejects.toThrow(/at least one/);
  });

  it("reports when there is no email provider instead of pretending to send", async () => {
    await expect(sendNotifyTest(owner, "a@b.co", { sender: null })).resolves.toBe("no_provider");
  });
});
