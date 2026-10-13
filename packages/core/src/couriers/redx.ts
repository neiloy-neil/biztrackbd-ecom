import { CourierError } from "../errors";
import { courierJson, num, rec, str } from "./http";
import type { AdapterContext, CourierAdapter, CourierStatus, CourierUpdate } from "./types";

export function mapRedxStatus(raw: string): CourierStatus {
  switch (raw.trim().toLowerCase().replace(/[\s_]+/g, "-")) {
    case "pickup-pending": return "BOOKED";
    case "ready-for-delivery": case "delivery-in-progress": return "IN_TRANSIT";
    case "delivered": case "paid": return "DELIVERED";
    case "returned": return "RETURNED";
    case "agent-hold": case "agent-returning": case "agent-area-change": return "HOLD";
    default: return "UNKNOWN";
  }
}

export function createRedx(
  ctx: AdapterContext,
  baseUrl = ctx.config.baseUrl || (ctx.mode === "LIVE" ? "https://openapi.redx.com.bd/v1.0.0-beta" : "https://sandbox.redx.com.bd/v1.0.0-sandbox"),
): CourierAdapter {
  // RedX's guide shows the token in API-ACCESS-TOKEN; docs/10 shows Authorization. Both carry the same value.
  const headers = () => ({ "API-ACCESS-TOKEN": `Bearer ${ctx.secrets.accessToken ?? ""}`, Authorization: `Bearer ${ctx.secrets.accessToken ?? ""}` });

  async function areaFor(p: { district: string; area: string }): Promise<{ id: number; name: string }> {
    const r = rec(await courierJson(ctx.fetch, "RedX", `${baseUrl}/areas?district_name=${encodeURIComponent(p.district)}`, { headers: headers() }));
    const areas = (Array.isArray(r.areas) ? r.areas : []).map(rec);
    const want = p.area.trim().toLowerCase();
    const hit = areas.find((a) => str(a.name).toLowerCase() === want) ?? areas.find((a) => want && str(a.name).toLowerCase().includes(want)) ?? areas[0];
    const id = num(hit?.id);
    if (!hit || id === undefined) throw new CourierError(`RedX has no delivery area for ${p.area}, ${p.district}.`, "RedX");
    return { id, name: str(hit.name) };
  }

  return {
    provider: "REDX",
    async verify() {
      await courierJson(ctx.fetch, "RedX", `${baseUrl}/areas?district_name=Dhaka`, { headers: headers() });
    },
    async book(p) {
      const area = await areaFor(p);
      const pickup = num(ctx.config.pickupStoreId);
      const r = rec(await courierJson(ctx.fetch, "RedX", `${baseUrl}/parcel`, {
        method: "POST", headers: headers(),
        body: {
          customer_name: p.recipientName, customer_phone: p.recipientPhone, delivery_area: area.name, delivery_area_id: area.id,
          customer_address: p.address.slice(0, 250), merchant_invoice_id: p.orderNumber, cash_collection_amount: String(Math.round(p.codAmount)),
          parcel_weight: Math.max(100, p.weightGrams), instruction: p.note?.slice(0, 200), value: Math.max(1, Math.round(p.codAmount)),
          ...(pickup ? { pickup_store_id: pickup } : {}),
        },
      }));
      const id = str(r.tracking_id);
      if (!id) throw new CourierError(`RedX did not book the parcel: ${str(r.message).slice(0, 200) || "no tracking id returned"}`, "RedX");
      return { consignmentId: id, trackingCode: id, trackingUrl: `https://redx.com.bd/track-global-parcel/?trackingId=${encodeURIComponent(id)}`, status: "BOOKED" };
    },
    async status(ref) {
      const r = rec(await courierJson(ctx.fetch, "RedX", `${baseUrl}/parcel/info/${encodeURIComponent(ref.consignmentId)}`, { headers: headers() }));
      const raw = str(rec(r.parcel).status);
      return { status: mapRedxStatus(raw), rawStatus: raw };
    },
    parseWebhook(_headers, body): CourierUpdate | null {
      const b = rec(body);
      const tracking = str(b.tracking_number);
      const raw = str(b.status);
      if (!raw) return null;
      return {
        consignmentId: tracking || undefined,
        invoice: str(b.invoice_number) || undefined,
        status: mapRedxStatus(raw),
        rawStatus: raw,
        occurredAt: b.timestamp ? new Date(str(b.timestamp)) : undefined,
      };
    },
  };
}

export interface RedxPickupStoreInfo {
  id: number;
  name: string;
  address: string;
  areaName: string;
  areaId: number;
  phone: string;
}

/** Fetches available pickup stores from RedX merchant panel. */
export async function listRedxPickupStores(
  ctx: AdapterContext,
  baseUrl = ctx.config.baseUrl || (ctx.mode === "LIVE" ? "https://openapi.redx.com.bd/v1.0.0-beta" : "https://sandbox.redx.com.bd/v1.0.0-sandbox"),
): Promise<RedxPickupStoreInfo[]> {
  const headers = () => ({ "API-ACCESS-TOKEN": `Bearer ${ctx.secrets.accessToken ?? ""}`, Authorization: `Bearer ${ctx.secrets.accessToken ?? ""}` });
  const r = rec(await courierJson(ctx.fetch, "RedX", `${baseUrl}/pickup/stores`, { headers: headers() }));
  const list = Array.isArray(r.pickup_stores) ? r.pickup_stores : [];
  return list.map((item: any) => ({
    id: Number(item?.id ?? 0),
    name: String(item?.name ?? ""),
    address: String(item?.address ?? ""),
    areaName: String(item?.area_name ?? ""),
    areaId: Number(item?.area_id ?? 0),
    phone: String(item?.phone ?? ""),
  }));
}

/** Calculates delivery charges using RedX charge calculator. */
export async function calculateRedxCharge(
  ctx: AdapterContext,
  params: {
    deliveryAreaId: number;
    pickupAreaId: number;
    cashCollectionAmount: number;
    weightGrams: number;
  },
  baseUrl = ctx.config.baseUrl || (ctx.mode === "LIVE" ? "https://openapi.redx.com.bd/v1.0.0-beta" : "https://sandbox.redx.com.bd/v1.0.0-sandbox"),
): Promise<{ deliveryCharge: number; codCharge: number }> {
  const headers = () => ({ "API-ACCESS-TOKEN": `Bearer ${ctx.secrets.accessToken ?? ""}`, Authorization: `Bearer ${ctx.secrets.accessToken ?? ""}` });
  const query = new URLSearchParams({
    delivery_area_id: String(params.deliveryAreaId),
    pickup_area_id: String(params.pickupAreaId),
    cash_collection_amount: String(params.cashCollectionAmount),
    weight: String(params.weightGrams),
  });
  const r = rec(await courierJson(ctx.fetch, "RedX", `${baseUrl}/charge/charge_calculator?${query.toString()}`, { headers: headers() }));
  return {
    deliveryCharge: Number(r.deliveryCharge ?? 0),
    codCharge: Number(r.codCharge ?? 0),
  };
}
