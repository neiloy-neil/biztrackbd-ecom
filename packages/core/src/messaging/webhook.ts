import { createHmac } from "node:crypto";

export interface WebhookDispatchInput {
  url: string;
  payload: string | Record<string, unknown>;
  secret?: string;
  timeoutMs?: number;
}

export interface WebhookDispatchResult {
  ok: boolean;
  httpStatus: number | null;
  error?: string;
}

/**
 * Generates an HMAC-SHA256 signature for outbound webhooks:
 * Signature = hmac_sha256(`${timestamp}.${payloadString}`, secret)
 */
export function generateWebhookSignature(
  payloadString: string,
  secret: string,
  timestamp: number = Date.now()
): { signature: string; timestamp: number } {
  const hmac = createHmac("sha256", secret);
  hmac.update(`${timestamp}.${payloadString}`);
  const signature = `t=${timestamp},v1=${hmac.digest("hex")}`;
  return { signature, timestamp };
}

/**
 * Dispatches an HTTP POST request to a third-party webhook URL with timeout resilience and signature headers.
 */
export async function dispatchOutboundWebhook(
  input: WebhookDispatchInput
): Promise<WebhookDispatchResult> {
  const payloadString =
    typeof input.payload === "string" ? input.payload : JSON.stringify(input.payload);
  const timeoutMs = input.timeoutMs ?? 8000;
  const timestamp = Date.now();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "BizTrackBD-Webhook-Worker/1.0",
    "X-BizTrack-Timestamp": String(timestamp),
  };

  if (input.secret) {
    const { signature } = generateWebhookSignature(payloadString, input.secret, timestamp);
    headers["X-BizTrack-Signature"] = signature;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input.url, {
      method: "POST",
      headers,
      body: payloadString,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      return { ok: true, httpStatus: response.status };
    }

    const bodyText = await response.text().catch(() => "");
    const errorMsg = `Endpoint returned HTTP ${response.status}: ${bodyText.slice(0, 200)}`;
    return { ok: false, httpStatus: response.status, error: errorMsg };
  } catch (err) {
    clearTimeout(timeout);
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { ok: false, httpStatus: null, error: errorMsg };
  }
}
