import { describe, it, expect } from "vitest";
import {
  createBulkSmsBdSender,
  getBulkSmsBdBalance,
  smsSenderFromEnv,
  CourierError,
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("BulkSMSBD SMS Gateway", () => {
  it("formats phone numbers with 880 prefix and posts URL-encoded payload to bulksmsbd.net", async () => {
    const { f, calls } = fake((call) => {
      const body = String(call?.init.body ?? "");
      const params = new URLSearchParams(body);
      expect(params.get("api_key")).toBe("BULK_KEY_123");
      expect(params.get("type")).toBe("text");
      expect(params.get("number")).toBe("8801712345678");
      expect(params.get("senderid")).toBe("8809612345678");
      expect(params.get("message")).toBe("Your Store OTP is 482910");
      return json({
        response_code: 202,
        success_message: "SMS Submitted Successfully",
        message_id: 998877,
      });
    });

    const sender = createBulkSmsBdSender("BULK_KEY_123", {
      senderId: "8809612345678",
      fetchImpl: f,
    });

    await sender.send("test-tenant", "01712345678", "Your Store OTP is 482910");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://bulksmsbd.net/api/smsapi");
    expect((calls[0]!.init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );
  });

  it("handles numbers already with 880 prefix or without leading 0", async () => {
    const { f, calls } = fake((call) => {
      const body = String(call?.init.body ?? "");
      const params = new URLSearchParams(body);
      expect(params.get("number")).toBe("8801811223344");
      return json({ response_code: 202 });
    });

    const sender = createBulkSmsBdSender("KEY", { fetchImpl: f });
    await sender.send("test-tenant", "8801811223344", "Hello");
    expect(calls).toHaveLength(1);
  });

  it("maps error code 1007 to Balance Insufficient", async () => {
    const { f } = fake(() =>
      json({
        response_code: 1007,
        error_message: "Balance Insufficient",
      }),
    );

    const sender = createBulkSmsBdSender("KEY", { fetchImpl: f });
    await expect(sender.send("t", "01712345678", "x")).rejects.toThrow(
      "BulkSMSBD refused message: Balance Insufficient",
    );
  });

  it("maps error code 1001 to Invalid Number", async () => {
    const { f } = fake(() =>
      json({
        response_code: 1001,
        error_message: "Invalid Number",
      }),
    );

    const sender = createBulkSmsBdSender("KEY", { fetchImpl: f });
    await expect(sender.send("t", "01712345678", "x")).rejects.toThrow(
      "BulkSMSBD refused message: Invalid Number",
    );
  });

  it("maps error code 1002 to Sender ID issue", async () => {
    const { f } = fake(() =>
      json({
        response_code: 1002,
        error_message: "sender id not correct/sender id is disabled",
      }),
    );

    const sender = createBulkSmsBdSender("KEY", { fetchImpl: f });
    await expect(sender.send("t", "01712345678", "x")).rejects.toThrow(
      "BulkSMSBD refused message: Sender ID not correct or disabled",
    );
  });

  it("marks code 1005 (Internal Error) as transient/retryable", async () => {
    const { f } = fake(() =>
      json({
        response_code: 1005,
        error_message: "Internal Error",
      }),
    );

    const sender = createBulkSmsBdSender("KEY", { fetchImpl: f });
    try {
      await sender.send("t", "01712345678", "x");
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(CourierError);
      expect((err as CourierError).ambiguous).toBe(true);
    }
  });

  it("fetches credit balance via getBalanceApi", async () => {
    const { f, calls } = fake(() =>
      json({
        response_code: 202,
        balance: "1250.75",
      }),
    );

    const result = await getBulkSmsBdBalance("BULK_KEY_999", f);
    expect(calls[0]!.url).toBe("https://bulksmsbd.net/api/getBalanceApi?api_key=BULK_KEY_999");
    expect(result.balance).toBe(1250.75);
  });

  it("handles balance check failure with error code", async () => {
    const { f } = fake(() =>
      json({
        response_code: 1011,
        error_message: "User Id not found",
      }),
    );

    await expect(getBulkSmsBdBalance("INVALID_KEY", f)).rejects.toThrow(
      "BulkSMSBD balance check failed: User ID not found",
    );
  });

  it("selects BulkSMSBD from environment when BULKSMSBD_API_KEY is present", async () => {
    const { f, calls } = fake(() => json({ response_code: 202 }));
    const sender = smsSenderFromEnv(
      {
        SMS_PROVIDER: "bulksmsbd",
        BULKSMSBD_API_KEY: "MY_BULK_KEY",
        BULKSMSBD_SENDER_ID: "MYSENDER",
      } as NodeJS.ProcessEnv,
      f,
    );

    expect(sender).not.toBeNull();
    await sender!.send("tenant1", "01712345678", "Test Bulk SMS");
    expect(calls[0]!.url).toBe("https://bulksmsbd.net/api/smsapi");
  });
});
