import { randomBytes } from "node:crypto";
import type { BookingParcel, BookingResult, CourierAdapter, CourierProviderKey, CourierStatus } from "./types";

/**
 * The courier a visitor's demo copy uses (docs/41). It talks to nobody: booking returns a made-up tracking code, and the status moves
 * along by itself with time, so a parcel can be followed from booked to delivered during a demo.
 */

const TRACK = "https://example.com/demo-tracking/";

function stage(consignmentId: string, now = Date.now()): { status: CourierStatus; rawStatus: string } {
  const at = parseInt(consignmentId.split("-")[1] ?? "", 36);
  const minutes = Number.isFinite(at) ? (now - at) / 60_000 : 99;
  if (minutes < 1) return { status: "BOOKED", rawStatus: "demo_booked" };
  if (minutes < 3) return { status: "PICKED_UP", rawStatus: "demo_picked_up" };
  if (minutes < 6) return { status: "IN_TRANSIT", rawStatus: "demo_in_transit" };
  return { status: "DELIVERED", rawStatus: "demo_delivered" };
}

export function createDemoCourier(provider: CourierProviderKey): CourierAdapter {
  return {
    provider,
    async verify() { /* always fine: there are no keys to check */ },
    async book(p: BookingParcel): Promise<BookingResult> {
      const id = `DM-${Date.now().toString(36)}-${randomBytes(2).toString("hex").toUpperCase()}`;
      return { consignmentId: id, trackingCode: id, trackingUrl: `${TRACK}${id}`, fee: p.codAmount > 0 ? 70 : 60, status: "BOOKED" };
    },
    async status(ref) { return stage(ref.consignmentId); },
    parseWebhook() { return null; },
  };
}
