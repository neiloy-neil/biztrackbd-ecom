import { describe, expect, it } from "vitest";
import { CourierError, createBrevoSender, createSmsNetBdSender, emailSenderFromEnv, smsSenderFromEnv } from "../src";

type Call = { url: string; init: RequestInit };
const fake = (reply: () => Response | Promise<Response>) => {
  const calls: Call[] = [];
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return reply();
  }) as typeof fetch;
  return { f, calls };
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const refused = async (p: Promise<unknown>) => {
  const e = await p.then(() => null, (x) => x);
  expect(e).toBeInstanceOf(CourierError);
  return e as CourierError;
};

describe("sms.net.bd sender", () => {
  it("posts the key, the message and the number in the provider's format", async () => {
    const { f, calls } = fake(() => json({ error: 0, msg: "Request successfully submitted", data: { request_id: 1 } }));
    await createSmsNetBdSender("KEY123", { senderId: "BizTrack", fetchImpl: f }).send("t1", "01712345678", "Your code is 123456");
    expect(calls[0]!.url).toBe("https://api.sms.net.bd/sendsms");
    const body = new URLSearchParams(String(calls[0]!.init.body));
    expect(Object.fromEntries(body)).toEqual({ api_key: "KEY123", msg: "Your code is 123456", to: "8801712345678", sender_id: "BizTrack" });
  });

  it("accepts +880 and 880 numbers and sends no sender id when none is set", async () => {
    const { f, calls } = fake(() => json({ error: 0 }));
    const s = createSmsNetBdSender("K", { fetchImpl: f });
    await s.send("t", "+880 1712-345678", "x");
    await s.send("t", "8801712345678", "x");
    const bodies = calls.map((c) => Object.fromEntries(new URLSearchParams(String(c.init.body))));
    expect(bodies.map((b) => b.to)).toEqual(["8801712345678", "8801712345678"]);
    expect(bodies[0]).not.toHaveProperty("sender_id");
  });

  it("turns the provider's error codes into plain reasons, and never calls them ambiguous", async () => {
    for (const [code, words] of [[417, "recharge"], [421, "registered number"], [413, "sender ID"], [405, "API key"], [416, "phone number"]] as const) {
      const e = await refused(createSmsNetBdSender("K", { fetchImpl: fake(() => json({ error: code, msg: "x" })).f }).send("t", "01712345678", "x"));
      expect(e.message).toContain(words);
      expect(e.ambiguous).toBe(false);
    }
  });

  it("treats the provider's unknown error and an unreachable network as outcomes it cannot be sure about", async () => {
    expect((await refused(createSmsNetBdSender("K", { fetchImpl: fake(() => json({ error: 409 })).f }).send("t", "01712345678", "x"))).ambiguous).toBe(true);
    const down = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    expect((await refused(createSmsNetBdSender("K", { fetchImpl: down }).send("t", "01712345678", "x"))).ambiguous).toBe(true);
    expect((await refused(createSmsNetBdSender("K", { fetchImpl: fake(() => new Response("bad gateway", { status: 502 })).f }).send("t", "01712345678", "x"))).ambiguous).toBe(true);
  });
});

describe("choosing the SMS provider from the environment", () => {
  it("returns nothing when nothing is configured, or when the provider is set to log, even with keys present", () => {
    expect(smsSenderFromEnv({} as NodeJS.ProcessEnv)).toBeNull();
    for (const mode of ["log", "off", "none"]) expect(smsSenderFromEnv({ SMS_PROVIDER: mode, SMS_NET_BD_API_KEY: "K", GREENWEB_SMS_TOKEN: "T" } as NodeJS.ProcessEnv)).toBeNull();
  });
  it("uses sms.net.bd when its key is set, Greenweb when only that token is, and honours SMS_PROVIDER when both are", async () => {
    const { f, calls } = fake(() => json({ error: 0 }));
    await smsSenderFromEnv({ SMS_NET_BD_API_KEY: "K" } as NodeJS.ProcessEnv, f)!.send("t", "01712345678", "x");
    expect(calls[0]!.url).toContain("sms.net.bd");
    const g = fake(() => new Response("Ok: sent"));
    await smsSenderFromEnv({ GREENWEB_SMS_TOKEN: "T" } as NodeJS.ProcessEnv, g.f)!.send("t", "01712345678", "x");
    expect(g.calls[0]!.url).toContain("greenweb");
    const both = fake(() => new Response("Ok: sent"));
    await smsSenderFromEnv({ SMS_NET_BD_API_KEY: "K", GREENWEB_SMS_TOKEN: "T", SMS_PROVIDER: "greenweb" } as NodeJS.ProcessEnv, both.f)!.send("t", "01712345678", "x");
    expect(both.calls[0]!.url).toContain("greenweb");
  });
});

describe("Brevo email sender", () => {
  const from = { email: "no-reply@biztrack.bd", name: "BizTrackBD" };
  it("posts the message with the api-key header", async () => {
    const { f, calls } = fake(() => json({ messageId: "<1@x>" }, 201));
    await createBrevoSender("BKEY", from, f).send("owner@example.com", "Welcome", "<p>Hi</p>", "Hi");
    expect(calls[0]!.url).toBe("https://api.brevo.com/v3/smtp/email");
    expect((calls[0]!.init.headers as Record<string, string>)["api-key"]).toBe("BKEY");
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ sender: from, to: [{ email: "owner@example.com" }], subject: "Welcome", htmlContent: "<p>Hi</p>", textContent: "Hi" });
  });
  it("refuses a bad address before calling out, and reports the provider's reason", async () => {
    const { f, calls } = fake(() => json({ code: "unauthorized", message: "Key not found" }, 401));
    const s = createBrevoSender("BAD", from, f);
    expect((await refused(s.send("not-an-email", "x", "y"))).message).toContain("not valid");
    expect(calls).toHaveLength(0);
    const e = await refused(s.send("a@b.co", "x", "y"));
    expect(e.message).toContain("Key not found");
    expect(e.ambiguous).toBe(false);
  });
  it("is configured only when the key and the from address are both set", () => {
    expect(emailSenderFromEnv({ BREVO_API_KEY: "k" } as NodeJS.ProcessEnv)).toBeNull();
    expect(emailSenderFromEnv({ BREVO_API_KEY: "k", EMAIL_FROM: "a@b.co" } as NodeJS.ProcessEnv)).not.toBeNull();
  });
});
