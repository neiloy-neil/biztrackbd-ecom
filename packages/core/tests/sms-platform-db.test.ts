import { describe, it, expect } from "vitest";
import {
  createCustomSmsSender,
  resolvePlatformSmsApiKey,
} from "../src";

type Call = { url: string; init: RequestInit };
const fake = (reply: (call?: Call) => Response | Promise<Response>) => {
  const calls: Call[] = [];
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(url), init: init ?? {} };
    calls.push(call);
    return reply(call);
  }) as typeof fetch;
  return { f, calls };
};

describe("Database-driven SMS Gateway & Multi-Provider Architecture", () => {
  it("isolates provider keys and does not leak cross-provider environment credentials", () => {
    const mockEnv = {
      SMS_NET_BD_API_KEY: "SMS_NET_KEY",
      GREENWEB_SMS_TOKEN: "GREENWEB_TOKEN",
    };

    // BulkSMSBD must not inherit sms.net.bd key
    expect(resolvePlatformSmsApiKey("bulksmsbd", null, mockEnv)).toBeNull();

    // When BulkSMSBD has its own key
    expect(
      resolvePlatformSmsApiKey("bulksmsbd", null, {
        ...mockEnv,
        BULKSMSBD_API_KEY: "BULK_123",
      }),
    ).toBe("BULK_123");

    // Database value takes highest priority
    expect(
      resolvePlatformSmsApiKey("bulksmsbd", "DB_BULK_KEY", mockEnv),
    ).toBe("DB_BULK_KEY");

    // Alpha SMS resolves its own key
    expect(resolvePlatformSmsApiKey("smsnetbd", null, mockEnv)).toBe("SMS_NET_KEY");

    // Greenweb resolves its own token
    expect(resolvePlatformSmsApiKey("greenweb", null, mockEnv)).toBe("GREENWEB_TOKEN");
  });

  it("sends SMS via Custom Gateway with POST JSON format", async () => {
    const { f, calls } = fake(() => new Response(JSON.stringify({ success: true }), { status: 200 }));

    const sender = createCustomSmsSender({
      endpoint: "https://api.custom-sms.com/v1/send",
      apiKey: "CUSTOM_SECRET_BEARER",
      senderId: "MY_BRAND",
      method: "POST",
      fetchImpl: f,
    });

    await sender.send("tenant1", "01812345678", "Your verification code is 987654");

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://api.custom-sms.com/v1/send");
    expect(calls[0]!.init.method).toBe("POST");
    expect((calls[0]!.init.headers as Record<string, string>)["Authorization"]).toBe("Bearer CUSTOM_SECRET_BEARER");

    const payload = JSON.parse(String(calls[0]!.init.body));
    expect(payload.to).toBe("8801812345678");
    expect(payload.message).toBe("Your verification code is 987654");
    expect(payload.sender_id).toBe("MY_BRAND");
  });

  it("sends SMS via Custom Gateway with GET format using placeholders", async () => {
    const { f, calls } = fake(() => new Response("OK", { status: 200 }));

    const sender = createCustomSmsSender({
      endpoint: "https://gateway.bd/api.php?to={to}&msg={message}&sender={sender_id}",
      senderId: "BRAND_SMS",
      method: "GET",
      fetchImpl: f,
    });

    await sender.send("tenant1", "01711223344", "Welcome to BizTrackBD");

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain("to=8801711223344");
    expect(calls[0]!.url).toContain("msg=Welcome%20to%20BizTrackBD");
    expect(calls[0]!.url).toContain("sender=BRAND_SMS");
  });
});
