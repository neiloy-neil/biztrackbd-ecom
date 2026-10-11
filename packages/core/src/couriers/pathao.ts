import { createHmac, timingSafeEqual } from "node:crypto";
import { CourierError, WebhookAuthError } from "../errors";
import { courierJson, num, rec, str } from "./http";
import type { AdapterContext, CourierAdapter, CourierStatus, CourierUpdate } from "./types";

/** Pathao status names arrive in several spellings ("Pickup Requested", "order.pickup-requested"); reduce them to one form first. */
const key = (raw: string) => raw.trim().toLowerCase().replace(/^order[.\s_-]+/, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

export function mapPathaoStatus(raw: string): CourierStatus {
  switch (key(raw)) {
    case "created": case "pending": case "updated": case "pickup_requested": case "pickup_assigned": case "pickup": return "BOOKED";
    case "picked_up": case "pickedup": return "PICKED_UP";
    case "at_the_sorting_hub": case "in_transit": case "received_at_last_mile_hub": case "last_mile_hub": case "assigned_for_delivery": return "IN_TRANSIT";
    case "delivered": return "DELIVERED";
    case "return": case "returned": case "paid_return": case "exchange": return "RETURNED";
    case "on_hold": case "hold": case "delivery_failed": case "partial_delivery": case "pickup_failed": case "pickup_cancelled": return "HOLD";
    default: return "UNKNOWN";
  }
}

interface CachedToken { token: string; expiresAt: number }
/** Per process. Phase 7 moves this to shared storage (docs/10 says 7-day KV); until then each process logs in once and refreshes on expiry. */
const tokens = new Map<string, CachedToken>();
export function clearPathaoTokens(): void {
  tokens.clear();
}

export function createPathao(ctx: AdapterContext, baseUrl = ctx.mode === "LIVE" ? "https://api-hermes.pathao.com" : "https://courier-api-sandbox.pathao.com"): CourierAdapter {
  const cacheKey = `${baseUrl}|${ctx.secrets.clientId}|${ctx.secrets.username}`;

  async function token(): Promise<string> {
    const hit = tokens.get(cacheKey);
    if (hit && hit.expiresAt > Date.now() + 60_000) return hit.token;
    const r = rec(await courierJson(ctx.fetch, "Pathao", `${baseUrl}/aladdin/api/v1/issue-token`, {
      method: "POST",
      body: { client_id: ctx.secrets.clientId, client_secret: ctx.secrets.clientSecret, username: ctx.secrets.username, password: ctx.secrets.password, grant_type: "password" },
    }));
    const t = str(r.access_token);
    if (!t) throw new CourierError("Pathao did not accept the login details. Check them in Settings, Integrations.", "Pathao");
    tokens.set(cacheKey, { token: t, expiresAt: Date.now() + (num(r.expires_in) ?? 3600) * 1000 });
    return t;
  }
  const auth = async () => ({ Authorization: `Bearer ${await token()}` });

  return {
    provider: "PATHAO",
    async verify() {
      tokens.delete(cacheKey);
      await token();
    },
    async book(p) {
      const storeId = num(ctx.config.storeId);
      if (!storeId) throw new CourierError("Enter your Pathao store ID in Settings, Integrations first.", "Pathao");
      const r = rec(await courierJson(ctx.fetch, "Pathao", `${baseUrl}/aladdin/api/v1/orders`, {
        method: "POST", headers: await auth(),
        body: {
          store_id: storeId, merchant_order_id: p.orderNumber, recipient_name: p.recipientName, recipient_phone: p.recipientPhone,
          // Pathao reads city, zone and area out of the address text when ids are not sent.
          recipient_address: `${p.address}, ${p.area}, ${p.district}`.slice(0, 220),
          delivery_type: 48, item_type: 2, special_instruction: p.note?.slice(0, 200), item_quantity: Math.max(1, p.itemCount),
          item_weight: Math.max(0.5, p.weightGrams / 1000), amount_to_collect: Math.round(p.codAmount),
        },
      }));
      const d = rec(r.data);
      const id = str(d.consignment_id);
      if (!id) throw new CourierError(`Pathao did not book the parcel: ${str(r.message).slice(0, 200) || "no consignment returned"}`, "Pathao");
      return { consignmentId: id, trackingCode: id, trackingUrl: `https://merchant.pathao.com/tracking?consignment_id=${encodeURIComponent(id)}&phone=${encodeURIComponent(p.recipientPhone)}`, fee: num(d.delivery_fee), status: "BOOKED" };
    },
    async status(ref) {
      const r = rec(await courierJson(ctx.fetch, "Pathao", `${baseUrl}/aladdin/api/v1/orders/${encodeURIComponent(ref.consignmentId)}/info`, { headers: await auth() }));
      const d = rec(r.data);
      const raw = str(d.order_status_slug) || str(d.order_status);
      return { status: mapPathaoStatus(raw), rawStatus: raw };
    },
    parseWebhook(headers, body, rawBody): CourierUpdate | null {
      // The unguessable URL already identifies the store. If Pathao also signs the body, a wrong signature is refused.
      const sig = headers["x-pathao-signature"];
      if (sig) {
        const expected = createHmac("sha256", ctx.secrets.clientSecret ?? "").update(rawBody).digest("hex");
        const a = Buffer.from(sig.toLowerCase()), b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) throw new WebhookAuthError();
      }
      const b = rec(body);
      const raw = str(b.event) || str(b.order_status);
      if (!raw || key(raw) === "webhook_integration") return null;
      return { consignmentId: str(b.consignment_id) || undefined, invoice: str(b.merchant_order_id) || undefined, status: mapPathaoStatus(raw), rawStatus: raw, occurredAt: b.updated_at ? new Date(str(b.updated_at)) : undefined };
    },
  };
}
