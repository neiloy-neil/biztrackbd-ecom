import { CourierError } from "../errors";
import { courierJson, rec, str } from "./http";
import type { AdapterContext, CourierAdapter, CourierStatus, CourierUpdate } from "./types";

/** Steadfast's delivery_status words (docs/10 section 2A and the portal's API guide). */
export function mapSteadfastStatus(raw: string): CourierStatus {
  switch (raw.trim().toLowerCase()) {
    case "in_review": case "pending": return "BOOKED";
    case "delivered": case "delivered_approval_pending": return "DELIVERED";
    // Steadfast has a single "cancelled" for parcels that came back, whether refused or unreachable, so it counts as a return.
    case "cancelled": case "cancelled_approval_pending": return "RETURNED";
    case "hold": case "partial_delivered": case "partial_delivered_approval_pending": case "unknown_approval_pending": return "HOLD";
    default: return "UNKNOWN";
  }
}

export function createSteadfast(
  ctx: AdapterContext,
  baseUrl = ctx.config.baseUrl || "https://portal.steadfast.com.bd/api/v1",
): CourierAdapter {
  const headers = () => ({ "Api-Key": ctx.secrets.apiKey ?? "", "Secret-Key": ctx.secrets.secretKey ?? "" });
  return {
    provider: "STEADFAST",
    async verify() {
      await courierJson(ctx.fetch, "Steadfast", `${baseUrl}/get_balance`, { headers: headers() });
    },
    async book(p) {
      const r = rec(await courierJson(ctx.fetch, "Steadfast", `${baseUrl}/create_order`, {
        method: "POST", headers: headers(),
        body: {
          invoice: p.orderNumber, recipient_name: p.recipientName, recipient_phone: p.recipientPhone,
          recipient_address: `${p.address}, ${p.area}, ${p.district}`.slice(0, 250), cod_amount: p.codAmount, note: p.note?.slice(0, 200),
        },
      }));
      const c = rec(r.consignment);
      const id = str(c.consignment_id);
      if (!id) throw new CourierError(`Steadfast did not book the parcel: ${str(r.message).slice(0, 200) || "no consignment returned"}`, "Steadfast");
      const code = str(c.tracking_code);
      return { consignmentId: id, trackingCode: code || id, trackingUrl: code ? `https://steadfast.com.bd/t/${code}` : undefined, status: mapSteadfastStatus(str(c.status) || "in_review") };
    },
    async status(ref) {
      const r = rec(await courierJson(ctx.fetch, "Steadfast", `${baseUrl}/status_by_cid/${encodeURIComponent(ref.consignmentId)}`, { headers: headers() }));
      const raw = str(r.delivery_status);
      return { status: mapSteadfastStatus(raw), rawStatus: raw };
    },
    parseWebhook(_headers, body): CourierUpdate | null {
      const b = rec(body);
      // "tracking_update" messages are free-text progress notes with no status; only "delivery_status" changes the order.
      if (str(b.notification_type) !== "delivery_status") return null;
      const raw = str(b.status);
      return {
        consignmentId: str(b.consignment_id) || undefined, invoice: str(b.invoice) || undefined, status: mapSteadfastStatus(raw), rawStatus: raw,
        occurredAt: b.updated_at ? new Date(str(b.updated_at)) : undefined,
      };
    },
  };
}

export interface SteadfastFraudReport {
  phone: string;
  totalParcels: number;
  deliveredParcels: number;
  cancelledParcels: number;
  successRate: number;
}

/** Queries customer delivery and cancellation history across merchants from Steadfast fraud check API. */
export async function checkSteadfastFraud(
  ctx: AdapterContext,
  phone: string,
  baseUrl = ctx.config.baseUrl || "https://portal.packzy.com/api/v1",
): Promise<SteadfastFraudReport | null> {
  const headers = () => ({ "Api-Key": ctx.secrets.apiKey ?? "", "Secret-Key": ctx.secrets.secretKey ?? "" });
  try {
    const raw = await courierJson(ctx.fetch, "Steadfast", `${baseUrl}/fraud_check/score/${encodeURIComponent(phone)}`, {
      headers: headers(),
    });
    const r = rec(raw);
    const total = Number(r.total_parcels ?? r.total ?? 0);
    const delivered = Number(r.delivered_parcels ?? r.delivered ?? 0);
    const cancelled = Number(r.cancelled_parcels ?? r.cancelled ?? 0);
    const successRate = total > 0 ? Math.round((delivered / total) * 100) : 100;
    return {
      phone,
      totalParcels: total,
      deliveredParcels: delivered,
      cancelledParcels: cancelled,
      successRate,
    };
  } catch {
    return null;
  }
}

/** Fetches delivery thanas and districts supported by Steadfast. */
export async function getSteadfastPoliceStations(
  ctx: AdapterContext,
  baseUrl = ctx.config.baseUrl || "https://portal.packzy.com/api/v1",
): Promise<{ id: number; name: string; district: string }[]> {
  const headers = () => ({ "Api-Key": ctx.secrets.apiKey ?? "", "Secret-Key": ctx.secrets.secretKey ?? "" });
  const raw = await courierJson(ctx.fetch, "Steadfast", `${baseUrl}/police_stations`, { headers: headers() });
  const r = rec(raw);
  const data = Array.isArray(r.data) ? r.data : Array.isArray(raw) ? (raw as unknown[]) : [];
  return data.map((item: any) => ({
    id: Number(item?.id ?? 0),
    name: String(item?.name ?? item?.thana ?? ""),
    district: String(item?.district ?? ""),
  }));
}

/** Fetches current unpaid COD balance with Steadfast. */
export async function getSteadfastBalance(
  ctx: AdapterContext,
  baseUrl = ctx.config.baseUrl || "https://portal.packzy.com/api/v1",
): Promise<{ currentBalance: number }> {
  const headers = () => ({ "Api-Key": ctx.secrets.apiKey ?? "", "Secret-Key": ctx.secrets.secretKey ?? "" });
  const raw = rec(await courierJson(ctx.fetch, "Steadfast", `${baseUrl}/get_balance`, { headers: headers() }));
  return { currentBalance: Number(raw.current_balance ?? raw.balance ?? 0) };
}
