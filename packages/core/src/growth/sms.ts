import { CourierError } from "../errors";

/** The platform's SMS aggregator. One shared account, billed to stores through their plan's SMS credits. */
export interface SmsSenderLike {
  send(tenantId: string, to: string, text: string): Promise<void>;
}

export function createGreenwebSender(token: string, fetchImpl: typeof fetch = fetch): SmsSenderLike {
  return {
    async send(_tenantId, to, text) {
      const clean = to.replace(/[^0-9]/g, "").replace(/^880/, "0");
      let res: Response;
      try {
        res = await fetchImpl("https://api.greenweb.com.bd/api.php", {
          method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token, to: clean, message: text }), signal: AbortSignal.timeout(10_000),
        });
      } catch {
        throw new CourierError("The SMS provider could not be reached", "SMS", true);
      }
      const body = (await res.text().catch(() => "")).trim();
      // The provider answers 200 with "Ok: ..." on success and "Error: ..." text on failure.
      if (!res.ok || !/^ok/i.test(body)) throw new CourierError(`The SMS provider refused the message: ${body.slice(0, 120) || res.status}`, "SMS");
    },
  };
}

/**
 * sms.net.bd (Alpha SMS): POST https://api.sms.net.bd/sendsms with api_key, msg and to; the answer is JSON with `error: 0` on success.
 * Until the account's first recharge it can only send to the account owner's registered number (error 421).
 */
export const SMS_NET_BD_ERRORS: Record<number, string> = {
  400: "a missing or invalid field", 403: "no permission for this account", 405: "the API key was not accepted", 410: "the account has expired",
  411: "the reseller account is expired or suspended", 412: "an invalid schedule", 413: "an invalid sender ID", 414: "an empty message",
  415: "a message that is too long", 416: "no valid phone number", 417: "not enough balance: recharge the SMS account",
  420: "blocked content", 421: "sending is limited to the registered number until the first recharge",
};

export function createSmsNetBdSender(apiKey: string, o: { senderId?: string; fetchImpl?: typeof fetch } = {}): SmsSenderLike {
  const fetchImpl = o.fetchImpl ?? fetch;
  return {
    async send(_tenantId, to, text) {
      const digits = to.replace(/[^0-9]/g, "");
      const number = digits.startsWith("880") ? digits : digits.startsWith("0") ? `88${digits}` : digits;
      const form = new URLSearchParams({ api_key: apiKey, msg: text, to: number });
      if (o.senderId) form.set("sender_id", o.senderId);
      let res: Response;
      try {
        res = await fetchImpl("https://api.sms.net.bd/sendsms", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form, signal: AbortSignal.timeout(10_000) });
      } catch {
        throw new CourierError("The SMS provider could not be reached", "SMS", true);
      }
      const j = (await res.json().catch(() => null)) as { error?: number; msg?: string } | null;
      if (!res.ok && !j) throw new CourierError(`The SMS provider answered ${res.status}`, "SMS", res.status >= 500);
      if (!j || j.error !== 0) {
        const code = j?.error ?? res.status;
        // 409 is the provider's own "unknown error"; everything else is a refusal that retrying will not fix.
        throw new CourierError(`The SMS provider refused the message: ${SMS_NET_BD_ERRORS[code] ?? j?.msg ?? code}`, "SMS", code === 409);
      }
    },
  };
}

/**
 * BulkSMSBD: POST https://bulksmsbd.net/api/smsapi
 * Parameter Name: api_key, type=text, number (8801...), senderid, message
 * Success: response_code 202
 */
export const BULKSMSBD_ERRORS: Record<number, string> = {
  1001: "Invalid Number",
  1002: "Sender ID not correct or disabled",
  1003: "Please provide all required fields",
  1005: "Internal Error",
  1006: "Balance Validity Not Available",
  1007: "Balance Insufficient: Please recharge BulkSMSBD account",
  1011: "User ID not found (Invalid API Key)",
  1012: "Masking SMS must be sent in Bengali",
  1013: "Sender ID has not found Gateway by API key",
  1014: "Sender Type Name not found using this sender by API key",
  1015: "Sender ID has not found any valid Gateway by API key",
  1016: "Sender Type Name Active Price Info not found by this sender ID",
  1017: "Sender Type Name Price Info not found by this sender ID",
  1018: "The Owner of this Account is disabled",
  1019: "The Price of this Account is disabled",
  1020: "The parent of this account is not found",
  1021: "The parent active price of this account is not found",
  1031: "Your Account Not Verified, Please Contact Administrator",
  1032: "IP Not whitelisted",
};

export interface BulkSmsBdSenderOptions {
  senderId?: string;
  fetchImpl?: typeof fetch;
}

export function createBulkSmsBdSender(
  apiKey: string,
  o: BulkSmsBdSenderOptions = {},
): SmsSenderLike {
  const fetchImpl = o.fetchImpl ?? fetch;
  return {
    async send(_tenantId, to, text) {
      const digits = to.replace(/[^0-9]/g, "");
      const number = digits.startsWith("880")
        ? digits
        : digits.startsWith("0")
        ? `88${digits}`
        : digits.startsWith("88")
        ? digits
        : `880${digits}`;

      const form = new URLSearchParams({
        api_key: apiKey,
        type: "text",
        number,
        senderid: o.senderId || "",
        message: text,
      });

      let res: Response;
      try {
        res = await fetchImpl("https://bulksmsbd.net/api/smsapi", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: form,
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        throw new CourierError("BulkSMSBD could not be reached", "SMS", true);
      }

      const j = (await res.json().catch(() => null)) as {
        response_code?: number | string;
        success_message?: string;
        error_message?: string;
        message_id?: number | string;
      } | null;

      if (!res.ok && !j) {
        throw new CourierError(`BulkSMSBD answered ${res.status}`, "SMS", res.status >= 500);
      }

      const code = j?.response_code !== undefined ? Number(j.response_code) : res.status;
      if (code !== 202) {
        const errorDesc = BULKSMSBD_ERRORS[code] || j?.error_message || `Error code ${code}`;
        throw new CourierError(`BulkSMSBD refused message: ${errorDesc}`, "SMS", code === 1005);
      }
    },
  };
}

/**
 * Checks remaining balance on BulkSMSBD via Credit Balance API.
 * URL: https://bulksmsbd.net/api/getBalanceApi?api_key=...
 */
export async function getBulkSmsBdBalance(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ balance: number; raw: Record<string, unknown> }> {
  let res: Response;
  try {
    res = await fetchImpl(`https://bulksmsbd.net/api/getBalanceApi?api_key=${encodeURIComponent(apiKey)}`, {
      method: "GET",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    throw new CourierError(`BulkSMSBD could not be reached: ${e instanceof Error ? e.message : "Network error"}`, "SMS", true);
  }

  const j = (await res.json().catch(() => null)) as {
    response_code?: number | string;
    balance?: number | string;
    error_message?: string;
  } | null;

  if (!j) {
    throw new CourierError("Failed to parse balance response from BulkSMSBD", "SMS");
  }

  const code = j.response_code !== undefined ? Number(j.response_code) : 202;
  if (code !== 202 && j.error_message) {
    const errorDesc = BULKSMSBD_ERRORS[code] || j.error_message;
    throw new CourierError(`BulkSMSBD balance check failed: ${errorDesc}`, "SMS");
  }

  const bal = Number(j.balance) || 0;
  return { balance: bal, raw: j as Record<string, unknown> };
}

/** The platform's SMS sender from the environment, or null when none is configured or SMS_PROVIDER is log, off or none. */
export function smsSenderFromEnv(env: NodeJS.ProcessEnv = process.env, fetchImpl: typeof fetch = fetch): SmsSenderLike | null {
  const want = (env.SMS_PROVIDER ?? "").toLowerCase();
  if (want === "log" || want === "off" || want === "none") return null;
  if ((want === "bulksmsbd" || !want) && (env.BULKSMSBD_API_KEY || (want === "bulksmsbd" && env.SMS_API_KEY))) {
    return createBulkSmsBdSender(env.BULKSMSBD_API_KEY || env.SMS_API_KEY!, {
      senderId: env.BULKSMSBD_SENDER_ID || env.SMS_SENDER_ID,
      fetchImpl,
    });
  }
  if ((want === "smsnetbd" || !want) && env.SMS_NET_BD_API_KEY) return createSmsNetBdSender(env.SMS_NET_BD_API_KEY, { senderId: env.SMS_SENDER_ID || undefined, fetchImpl });
  if ((want === "greenweb" || !want) && env.GREENWEB_SMS_TOKEN) return createGreenwebSender(env.GREENWEB_SMS_TOKEN, fetchImpl);
  return null;
}
