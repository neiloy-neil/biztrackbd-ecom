import { CourierError } from "../errors";

/** Transactional email. The platform sends no email of its own yet (sign-in emails come from Supabase Auth); this is the sender for owner notices and later messages. */
export interface EmailSender {
  send(to: string, subject: string, html: string, text?: string): Promise<void>;
}

/** Brevo's transactional API: POST /v3/smtp/email with an `api-key` header; 201 and a messageId on success. */
export function createBrevoSender(apiKey: string, from: { email: string; name: string }, fetchImpl: typeof fetch = fetch): EmailSender {
  return {
    async send(to, subject, html, text) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new CourierError("That email address is not valid", "EMAIL");
      let res: Response;
      try {
        res = await fetchImpl("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ sender: from, to: [{ email: to }], subject, htmlContent: html, ...(text ? { textContent: text } : {}) }),
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        throw new CourierError("The email provider could not be reached", "EMAIL", true);
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new CourierError(`The email provider refused the message: ${j?.message ?? res.status}`, "EMAIL", res.status >= 500);
      }
    },
  };
}

/** The platform's email sender from the environment (BREVO_API_KEY, EMAIL_FROM, EMAIL_FROM_NAME), or null when not configured. */
export function emailSenderFromEnv(env: NodeJS.ProcessEnv = process.env, fetchImpl: typeof fetch = fetch): EmailSender | null {
  if (!env.BREVO_API_KEY || !env.EMAIL_FROM) return null;
  return createBrevoSender(env.BREVO_API_KEY, { email: env.EMAIL_FROM, name: env.EMAIL_FROM_NAME || "BizTrackBD" }, fetchImpl);
}
