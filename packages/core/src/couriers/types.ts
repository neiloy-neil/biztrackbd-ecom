/** One word per stage, the same for every courier. Each adapter maps its own status names onto these. */
export type CourierStatus = "BOOKED" | "PICKED_UP" | "IN_TRANSIT" | "HOLD" | "DELIVERED" | "RETURNED" | "REFUSED" | "UNKNOWN";

export const COURIER_STATUS_LABELS: Record<CourierStatus, string> = {
  BOOKED: "Booked, waiting for pickup", PICKED_UP: "Picked up", IN_TRANSIT: "On the way", HOLD: "On hold, needs attention",
  DELIVERED: "Delivered", RETURNED: "Returned to you", REFUSED: "Refused at the door", UNKNOWN: "Status unknown",
};

export type CourierProviderKey = "STEADFAST" | "PATHAO" | "REDX";
export const COURIER_PROVIDERS: CourierProviderKey[] = ["STEADFAST", "PATHAO", "REDX"];

export interface BookingParcel {
  orderNumber: string;
  recipientName: string;
  /** 01XXXXXXXXX */
  recipientPhone: string;
  address: string;
  district: string;
  area: string;
  /** Cash the courier must collect. 0 when the order is already paid. */
  codAmount: number;
  weightGrams: number;
  itemCount: number;
  note?: string;
}

export interface BookingResult {
  consignmentId: string;
  trackingCode: string;
  trackingUrl?: string;
  /** What the courier says it will charge, when it tells us at booking time. */
  fee?: number;
  status: CourierStatus;
}

export interface ParcelRef {
  consignmentId: string;
  trackingCode?: string | null;
  invoice?: string;
}

export interface CourierUpdate {
  consignmentId?: string;
  invoice?: string;
  status: CourierStatus;
  rawStatus: string;
  occurredAt?: Date;
}

export interface CourierAdapter {
  provider: CourierProviderKey;
  /** Cheapest call that proves the keys work. Throws CourierError with a message the owner can act on. */
  verify(): Promise<void>;
  book(parcel: BookingParcel): Promise<BookingResult>;
  status(ref: ParcelRef): Promise<{ status: CourierStatus; rawStatus: string }>;
  /** Reads a callback. Returns null for messages that carry no status change. Throws WebhookAuthError on a bad signature. */
  parseWebhook(headers: Record<string, string>, body: unknown, rawBody: string): CourierUpdate | null;
}

export interface AdapterContext {
  secrets: Record<string, string>;
  config: Record<string, string>;
  mode: "TEST" | "LIVE";
  fetch: typeof fetch;
}
