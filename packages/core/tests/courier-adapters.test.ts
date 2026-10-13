import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  CourierError, WebhookAuthError, clearPathaoTokens, createPathao, createRedx, createSteadfast, mapPathaoStatus, mapRedxStatus, mapSteadfastStatus,
  checkSteadfastFraud, getSteadfastPoliceStations, getSteadfastBalance,
  listPathaoStores, getPathaoCities, calculatePathaoPrice,
  listRedxPickupStores, calculateRedxCharge,
  type AdapterContext, type BookingParcel,
} from "../src";

const parcel: BookingParcel = {
  orderNumber: "BT-10482", recipientName: "Rahat Rahman", recipientPhone: "01711223344", address: "House 12, Road 5", district: "Dhaka", area: "Dhanmondi",
  codAmount: 2420, weightGrams: 500, itemCount: 2,
};

interface Call { url: string; method: string; headers: Record<string, string>; body: any }

/** A fake courier: records each call and answers from a queue of canned replies. */
function fakeFetch(replies: (Response | ((c: Call) => Response))[]) {
  const calls: Call[] = [];
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    const call: Call = { url: String(url), method: init?.method ?? "GET", headers: Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>)), body: init?.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(call);
    const next = replies.shift();
    if (!next) throw new Error("unexpected call");
    return typeof next === "function" ? next(call) : next;
  }) as typeof fetch;
  return { f, calls };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const ctx = (f: typeof fetch, over: Partial<AdapterContext> = {}): AdapterContext => ({ secrets: {}, config: {}, mode: "LIVE", fetch: f, ...over });

describe("status mapping", () => {
  it("maps Steadfast words", () => {
    expect(mapSteadfastStatus("in_review")).toBe("BOOKED");
    expect(mapSteadfastStatus("delivered")).toBe("DELIVERED");
    expect(mapSteadfastStatus("delivered_approval_pending")).toBe("DELIVERED");
    expect(mapSteadfastStatus("cancelled")).toBe("RETURNED");
    expect(mapSteadfastStatus("hold")).toBe("HOLD");
    expect(mapSteadfastStatus("something_new")).toBe("UNKNOWN");
  });

  it("maps Pathao words whatever the spelling", () => {
    expect(mapPathaoStatus("Pickup Requested")).toBe("BOOKED");
    expect(mapPathaoStatus("order.pickup-requested")).toBe("BOOKED");
    expect(mapPathaoStatus("Picked Up")).toBe("PICKED_UP");
    expect(mapPathaoStatus("At the Sorting HUB")).toBe("IN_TRANSIT");
    expect(mapPathaoStatus("order.delivered")).toBe("DELIVERED");
    expect(mapPathaoStatus("Return")).toBe("RETURNED");
    expect(mapPathaoStatus("Delivery Failed")).toBe("HOLD");
    expect(mapPathaoStatus("???")).toBe("UNKNOWN");
  });

  it("maps RedX words", () => {
    expect(mapRedxStatus("pickup-pending")).toBe("BOOKED");
    expect(mapRedxStatus("delivery-in-progress")).toBe("IN_TRANSIT");
    expect(mapRedxStatus("delivered")).toBe("DELIVERED");
    expect(mapRedxStatus("returned")).toBe("RETURNED");
    expect(mapRedxStatus("agent-hold")).toBe("HOLD");
  });
});

describe("Steadfast", () => {
  const secrets = { apiKey: "KEY-abc123", secretKey: "SECRET-xyz789" };

  it("books a parcel with the right payload and headers", async () => {
    const { f, calls } = fakeFetch([json({ status: 200, consignment: { consignment_id: 1424107, invoice: "BT-10482", tracking_code: "15BAEB8A", status: "in_review" } })]);
    const r = await createSteadfast(ctx(f, { secrets })).book(parcel);
    expect(r).toMatchObject({ consignmentId: "1424107", trackingCode: "15BAEB8A", status: "BOOKED" });
    const c = calls[0]!;
    expect(c.url).toBe("https://portal.steadfast.com.bd/api/v1/create_order");
    expect(c.method).toBe("POST");
    expect(c.headers["Api-Key"]).toBe("KEY-abc123");
    expect(c.headers["Secret-Key"]).toBe("SECRET-xyz789");
    expect(c.body).toMatchObject({ invoice: "BT-10482", recipient_phone: "01711223344", cod_amount: 2420 });
    expect(c.body.recipient_address).toContain("Dhanmondi");
  });

  it("fails clearly when no consignment comes back", async () => {
    const { f } = fakeFetch([json({ status: 400, message: "Invalid recipient phone" })]);
    await expect(createSteadfast(ctx(f, { secrets })).book(parcel)).rejects.toThrow(/did not book the parcel: Invalid recipient phone/);
  });

  it("reads a status and a webhook", async () => {
    const { f } = fakeFetch([json({ status: 200, delivery_status: "delivered" })]);
    const a = createSteadfast(ctx(f, { secrets }));
    expect(await a.status({ consignmentId: "1424107" })).toEqual({ status: "DELIVERED", rawStatus: "delivered" });
    expect(a.parseWebhook({}, { notification_type: "delivery_status", consignment_id: 1424107, invoice: "BT-10482", status: "delivered", updated_at: "2026-10-10 12:00:00" }, "")).toMatchObject({
      consignmentId: "1424107", invoice: "BT-10482", status: "DELIVERED",
    });
    // Progress notes carry no status.
    expect(a.parseWebhook({}, { notification_type: "tracking_update", tracking_message: "Arrived at hub" }, "")).toBeNull();
  });

  it("turns courier errors into safe messages that never contain the keys", async () => {
    const { f } = fakeFetch([json({ message: "Unauthorized" }, 401), json({ message: "boom" }, 500)]);
    const a = createSteadfast(ctx(f, { secrets }));
    const e1 = await a.verify().then(() => null, (e) => e);
    expect(e1).toBeInstanceOf(CourierError);
    expect(e1.message).toMatch(/did not accept the keys/);
    const e2 = await a.verify().then(() => null, (e) => e);
    expect(e2.ambiguous).toBe(true);
    for (const e of [e1, e2]) expect(JSON.stringify([e.message, e.details])).not.toMatch(/KEY-abc123|SECRET-xyz789/);
  });

  it("treats a dropped connection as ambiguous", async () => {
    const f = (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
    const e = await createSteadfast(ctx(f, { secrets })).book(parcel).then(() => null, (x) => x);
    expect(e).toBeInstanceOf(CourierError);
    expect(e.ambiguous).toBe(true);
  });

  it("checks delivery fraud scores and reports history", async () => {
    const { f, calls } = fakeFetch([
      json({ status: 200, total_parcels: 20, delivered_parcels: 18, cancelled_parcels: 2 }),
    ]);
    const score = await checkSteadfastFraud(ctx(f, { secrets }), "01711223344");
    expect(score).toEqual({
      phone: "01711223344",
      totalParcels: 20,
      deliveredParcels: 18,
      cancelledParcels: 2,
      successRate: 90,
    });
    expect(calls[0]!.url).toContain("/fraud_check/score/01711223344");
  });

  it("fetches police stations and balance", async () => {
    const { f } = fakeFetch([
      json({ status: 200, data: [{ id: 1, name: "Dhanmondi", district: "Dhaka" }] }),
      json({ status: 200, current_balance: 14500 }),
    ]);
    const stations = await getSteadfastPoliceStations(ctx(f, { secrets }));
    expect(stations).toEqual([{ id: 1, name: "Dhanmondi", district: "Dhaka" }]);
    const bal = await getSteadfastBalance(ctx(f, { secrets }));
    expect(bal.currentBalance).toBe(14500);
  });
});

describe("Pathao", () => {
  const secrets = { clientId: "cid", clientSecret: "csecret", username: "me@shop.test", password: "pw-123456" };
  beforeEach(() => clearPathaoTokens());

  it("logs in once, reuses the token, and books with the store id", async () => {
    const { f, calls } = fakeFetch([
      json({ access_token: "tok-1", expires_in: 432000 }),
      json({ code: 200, data: { consignment_id: "DL121224VS8TTJ", delivery_fee: 83 } }),
      json({ data: { order_status: "Pending", order_status_slug: "Pickup_Requested" } }),
    ]);
    const a = createPathao(ctx(f, { secrets, config: { storeId: "12345" } }));
    const r = await a.book(parcel);
    expect(r).toMatchObject({ consignmentId: "DL121224VS8TTJ", fee: 83, status: "BOOKED" });
    expect(calls[0]!.url).toContain("/aladdin/api/v1/issue-token");
    expect(calls[0]!.body).toMatchObject({ grant_type: "password", username: "me@shop.test" });
    expect(calls[1]!.headers.Authorization).toBe("Bearer tok-1");
    expect(calls[1]!.body).toMatchObject({ store_id: 12345, merchant_order_id: "BT-10482", amount_to_collect: 2420, delivery_type: 48 });
    expect(await a.status({ consignmentId: "DL121224VS8TTJ" })).toEqual({ status: "BOOKED", rawStatus: "Pickup_Requested" });
    expect(calls.filter((c) => c.url.includes("issue-token"))).toHaveLength(1);
  });

  it("needs the store id before booking", async () => {
    const { f } = fakeFetch([]);
    await expect(createPathao(ctx(f, { secrets })).book(parcel)).rejects.toThrow(/store ID/);
  });

  it("uses the sandbox host in test mode", async () => {
    const { f, calls } = fakeFetch([json({ access_token: "t", expires_in: 100 })]);
    await createPathao(ctx(f, { secrets, mode: "TEST" })).verify();
    expect(calls[0]!.url).toMatch(/^https:\/\/courier-api-sandbox\.pathao\.com\//);
  });

  it("checks the webhook signature when one is sent", () => {
    const a = createPathao(ctx(fakeFetch([]).f, { secrets }));
    const raw = JSON.stringify({ event: "order.delivered", consignment_id: "DL1", merchant_order_id: "BT-1" });
    const good = createHmac("sha256", "csecret").update(raw).digest("hex");
    expect(a.parseWebhook({ "x-pathao-signature": good }, JSON.parse(raw), raw)).toMatchObject({ status: "DELIVERED", consignmentId: "DL1", invoice: "BT-1" });
    expect(() => a.parseWebhook({ "x-pathao-signature": "0".repeat(64) }, JSON.parse(raw), raw)).toThrow(WebhookAuthError);
    expect(() => a.parseWebhook({ "x-pathao-signature": "short" }, JSON.parse(raw), raw)).toThrow(WebhookAuthError);
    // No signature header: the unguessable URL token is what identified the store.
    expect(a.parseWebhook({}, JSON.parse(raw), raw)).toMatchObject({ status: "DELIVERED" });
    expect(a.parseWebhook({}, { event: "webhook_integration" }, "")).toBeNull();
  });

  it("fetches Pathao stores, cities, and price calculations", async () => {
    const { f } = fakeFetch([
      json({ access_token: "t1", expires_in: 3600 }),
      json({ code: 200, data: [{ store_id: 101, store_name: "Dhaka Hub", store_address: "Uttara", is_active: 1 }] }),
      json({ access_token: "t2", expires_in: 3600 }),
      json({ code: 200, data: [{ city_id: 1, city_name: "Dhaka" }] }),
      json({ access_token: "t3", expires_in: 3600 }),
      json({ code: 200, data: { price: 80, final_price: 80, cod_percentage: 0.01 } }),
    ]);
    const stores = await listPathaoStores(ctx(f, { secrets }));
    expect(stores).toEqual([{ storeId: 101, storeName: "Dhaka Hub", storeAddress: "Uttara", isActive: true, isDefaultStore: false }]);
    const cities = await getPathaoCities(ctx(f, { secrets }));
    expect(cities).toEqual([{ cityId: 1, cityName: "Dhaka" }]);
    const price = await calculatePathaoPrice(ctx(f, { secrets }), {
      storeId: 101, recipientCity: 1, recipientZone: 298, itemWeightKg: 0.5,
    });
    expect(price).toEqual({ price: 80, finalPrice: 80, codPercentage: 0.01 });
  });
});

describe("RedX", () => {
  const secrets = { accessToken: "redx-token-1" };

  it("finds the delivery area, then books", async () => {
    const { f, calls } = fakeFetch([
      json({ areas: [{ id: 1, name: "Mirpur" }, { id: 7, name: "Dhanmondi" }] }),
      json({ tracking_id: "21A427TU4N3N" }),
      json({ parcel: { tracking_id: "21A427TU4N3N", status: "delivery-in-progress" } }),
    ]);
    const a = createRedx(ctx(f, { secrets, config: { pickupStoreId: "99" } }));
    const r = await a.book(parcel);
    expect(r).toMatchObject({ consignmentId: "21A427TU4N3N", status: "BOOKED" });
    expect(calls[0]!.url).toContain("/areas?district_name=Dhaka");
    expect(calls[1]!.body).toMatchObject({ delivery_area_id: 7, delivery_area: "Dhanmondi", merchant_invoice_id: "BT-10482", cash_collection_amount: "2420", pickup_store_id: 99 });
    expect(calls[1]!.headers.Authorization).toBe("Bearer redx-token-1");
    expect(await a.status({ consignmentId: "21A427TU4N3N" })).toEqual({ status: "IN_TRANSIT", rawStatus: "delivery-in-progress" });
  });

  it("uses the sandbox host in test mode and has no webhook", async () => {
    const { f, calls } = fakeFetch([json({ areas: [] })]);
    const a = createRedx(ctx(f, { secrets, mode: "TEST" }));
    await a.verify();
    expect(calls[0]!.url).toContain("v1.0.0-sandbox");
    expect(a.parseWebhook({}, {}, "")).toBeNull();
  });

  it("refuses when RedX has no area for the address", async () => {
    const { f } = fakeFetch([json({ areas: [] })]);
    await expect(createRedx(ctx(f, { secrets })).book(parcel)).rejects.toThrow(/no delivery area/);
  });

  it("parses incoming RedX webhooks with real event payload", () => {
    const a = createRedx(ctx(fakeFetch([]).f, { secrets }));
    const payload = {
      tracking_number: "21A427TU4N3N",
      timestamp: "2026-10-13T12:00:00.000Z",
      status: "delivered",
      message_en: "Parcels delivered by rider",
      invoice_number: "BT-10482",
      delivery_type: "regular",
    };
    const update = a.parseWebhook({}, payload, JSON.stringify(payload));
    expect(update).toMatchObject({
      consignmentId: "21A427TU4N3N",
      invoice: "BT-10482",
      status: "DELIVERED",
      rawStatus: "delivered",
    });
  });

  it("fetches RedX pickup stores and calculates delivery charge", async () => {
    const { f, calls } = fakeFetch([
      json({ pickup_stores: [{ id: 1, name: "Test Pickup", address: "Dhanmondi", area_name: "Dhanmondi", area_id: 2, phone: "01711111111" }] }),
      json({ deliveryCharge: 60, codCharge: 0 }),
    ]);
    const stores = await listRedxPickupStores(ctx(f, { secrets }));
    expect(stores).toEqual([{ id: 1, name: "Test Pickup", address: "Dhanmondi", areaName: "Dhanmondi", areaId: 2, phone: "01711111111" }]);
    const charge = await calculateRedxCharge(ctx(f, { secrets }), {
      deliveryAreaId: 12, pickupAreaId: 1, cashCollectionAmount: 1000, weightGrams: 500,
    });
    expect(charge).toEqual({ deliveryCharge: 60, codCharge: 0 });
    expect(calls[1]!.url).toContain("/charge/charge_calculator?");
  });
});
