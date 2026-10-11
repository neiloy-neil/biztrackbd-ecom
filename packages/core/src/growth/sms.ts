import { CourierError } from "../errors";

/** The platform's SMS aggregator (docs/10 section 4, Greenweb). One shared account, billed to stores through their plan's SMS credits. */
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
const SMS_NET_BD_ERRORS: Record<number, string> = {
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

/** The platform's SMS sender from the environment, or null when none is configured or SMS_PROVIDER is log, off or none. SMS_PROVIDER picks one when both tokens exist. */
export function smsSenderFromEnv(env: NodeJS.ProcessEnv = process.env, fetchImpl: typeof fetch = fetch): SmsSenderLike | null {
  const want = (env.SMS_PROVIDER ?? "").toLowerCase();
  if (want === "log" || want === "off" || want === "none") return null; // messages go to the log (development), whatever keys are present
  if ((want === "smsnetbd" || !want) && env.SMS_NET_BD_API_KEY) return createSmsNetBdSender(env.SMS_NET_BD_API_KEY, { senderId: env.SMS_SENDER_ID || undefined, fetchImpl });
  if ((want === "greenweb" || !want) && env.GREENWEB_SMS_TOKEN) return createGreenwebSender(env.GREENWEB_SMS_TOKEN, fetchImpl);
  return null;
}
