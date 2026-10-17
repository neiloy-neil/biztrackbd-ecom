import { createHash } from "node:crypto";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  setPixelFetchForTests,
  normalizeMetaPhone,
  hashPhone,
  hashEmail,
  capiBody,
  type ServerEvent,
  trackPlatformInquiryCapi,
  trackPlatformRegistrationCapi,
} from "../src";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

describe("Meta Conversions API (CAPI) Server-Side Events (DATA-002)", () => {
  let interceptedCalls: { url: string; headers: any; body: any }[] = [];

  beforeEach(() => {
    interceptedCalls = [];
    setPixelFetchForTests(async (input, init) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      const body = init?.body ? JSON.parse(init.body as string) : {};
      interceptedCalls.push({ url, headers: init?.headers ?? {}, body });
      return new Response(JSON.stringify({ events_received: 1 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
  });

  afterEach(() => {
    setPixelFetchForTests(undefined);
  });

  it("normalizes Bangladeshi phone numbers with +880 country code and hashes correctly", () => {
    expect(normalizeMetaPhone("01712345678")).toBe("8801712345678");
    expect(normalizeMetaPhone("+8801712345678")).toBe("8801712345678");
    expect(normalizeMetaPhone("8801712345678")).toBe("8801712345678");
    expect(normalizeMetaPhone("018-1234-5678")).toBe("8801812345678");

    const expectedHash = sha("8801712345678");
    expect(hashPhone("01712345678")).toBe(expectedHash);
    expect(hashPhone("+8801712345678")).toBe(expectedHash);
  });

  it("hashes emails in lowercase without leading/trailing whitespace", () => {
    const raw = "  Tanvir.Ahmed@Example.Com  ";
    const expected = sha("tanvir.ahmed@example.com");
    expect(hashEmail(raw)).toBe(expected);
  });

  it("formats CAPI payload with correct action_source, SHA-256 user_data, and custom_data", () => {
    const event: ServerEvent = {
      name: "Lead",
      eventId: "inq_test_12345",
      time: new Date("2026-10-17T12:00:00Z"),
      url: "https://biztrackbd.com/contact",
      user: {
        phoneLocal: "01712345678",
        email: "merchant@test.com",
        ip: "103.150.12.34",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        fbp: "fb.1.1700000000.123456",
        fbc: "fb.1.1700000000.IwARtest",
      },
      customData: {
        topic: "setup",
      },
    };

    const payload = capiBody(event, "TEST9999");
    expect(payload.test_event_code).toBe("TEST9999");
    expect(payload.data).toHaveLength(1);

    const d = payload.data[0]!;
    expect(d.event_name).toBe("Lead");
    expect(d.event_id).toBe("inq_test_12345");
    expect(d.action_source).toBe("website");
    expect(d.event_source_url).toBe("https://biztrackbd.com/contact");
    expect(d.user_data.ph).toEqual([sha("8801712345678")]);
    expect(d.user_data.em).toEqual([sha("merchant@test.com")]);
    expect(d.user_data.client_ip_address).toBe("103.150.12.34");
    expect(d.user_data.fbp).toBe("fb.1.1700000000.123456");
    expect(d.user_data.fbc).toBe("fb.1.1700000000.IwARtest");
    expect(d.custom_data.topic).toBe("setup");
  });

  it("dispatches platform inquiry CAPI event when affirmative consent is present", async () => {
    process.env.PLATFORM_META_PIXEL_ID = "987654321098765";
    process.env.PLATFORM_META_CAPI_TOKEN = "EAABtest_token_secret";

    const res = await trackPlatformInquiryCapi({
      inquiryId: "inq_123",
      eventId: "inq_ev_999",
      name: "Rafiqul Islam",
      phone: "01812345678",
      email: "rafiq@biztrackbd.com",
      topic: "courier",
      consentGiven: true,
      user: {
        ip: "103.100.10.20",
        userAgent: "TestBrowser/1.0",
        fbp: "fb.1.12345",
      },
    });

    expect(res.ok).toBe(true);
    expect(interceptedCalls).toHaveLength(1);

    const call = interceptedCalls[0]!;
    expect(call.url).toBe("https://graph.facebook.com/v21.0/987654321098765/events");
    expect(call.body.data[0].event_name).toBe("Lead");
    expect(call.body.data[0].event_id).toBe("inq_ev_999");
    expect(call.body.data[0].user_data.ph).toEqual([sha("8801812345678")]);
  });

  it("suppresses CAPI server event when consentGiven is explicitly false", async () => {
    process.env.PLATFORM_META_PIXEL_ID = "987654321098765";
    process.env.PLATFORM_META_CAPI_TOKEN = "EAABtest_token_secret";

    const res = await trackPlatformInquiryCapi({
      inquiryId: "inq_denied",
      name: "Deny User",
      phone: "01700000000",
      email: "deny@test.com",
      consentGiven: false,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.detail).toContain("Consent not given");
    }
    expect(interceptedCalls).toHaveLength(0);
  });

  it("dispatches platform CompleteRegistration CAPI event for new merchant signups", async () => {
    process.env.PLATFORM_META_PIXEL_ID = "987654321098765";
    process.env.PLATFORM_META_CAPI_TOKEN = "EAABtest_token_secret";

    const res = await trackPlatformRegistrationCapi({
      tenantId: "t_fashion_123",
      eventId: "reg_ev_abc",
      ownerName: "Tania Akter",
      phone: "01912345678",
      email: "tania@fashion.bd",
      storeName: "Tania Silk House",
      plan: "BUSINESS",
      consentGiven: true,
      user: {
        ip: "103.20.30.40",
      },
    });

    expect(res.ok).toBe(true);
    expect(interceptedCalls).toHaveLength(1);

    const call = interceptedCalls[0]!;
    expect(call.body.data[0].event_name).toBe("CompleteRegistration");
    expect(call.body.data[0].event_id).toBe("reg_ev_abc");
    expect(call.body.data[0].custom_data.store_name).toBe("Tania Silk House");
    expect(call.body.data[0].custom_data.plan).toBe("BUSINESS");
  });
});
