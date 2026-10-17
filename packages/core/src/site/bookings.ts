import { withTenant, type BookingRequestStatus, type SiteLeadType } from "@biztrackbd/db";
import { NotFoundError, ValidationError } from "../errors";
import { assertCan, type StaffActor } from "../permissions";
import { audit } from "../audit/service";
import { trackServerBooking } from "../growth/tracking";
import { enqueueNotificationJob } from "../messaging/queue";
import { normalizeBdPhone } from "../phone";
import {
  checkPublicSubmissionRateLimit,
  recordPublicSubmission,
  getCachedIdempotentResult,
  setCachedIdempotentResult,
  validateLeadMetadata,
} from "./abuse-protection";

export interface CreateBookingInput {
  name: string;
  phone: string;
  email?: string | null;
  serviceName?: string | null;
  providerName?: string | null;
  requestedDate?: string | null;
  requestedTime?: string | null;
  partySize?: number | null;
  message?: string | null;
  type?: "APPOINTMENT" | "RESERVATION";
  sourcePage?: string | null;
  locale?: string;
  /** Unique client-generated eventId for Meta Pixel / CAPI deduplication */
  eventId?: string | null;
  /** Unique submission idempotency key to prevent double clicks */
  idempotencyKey?: string | null;
  /** Client IP, user agent, and cookies for Meta CAPI attribution */
  ip?: string | null;
  userAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  /** Explicit affirmative consent given by the visitor */
  consentGiven?: boolean | null;
  consentTextVersion?: string | null;
  /** Invisible bot shield */
  hp?: string | null;
  elapsedMs?: number | null;
}

export interface SiteBookingResult {
  bookingId: string;
  leadId: string;
  status: BookingRequestStatus;
  whatsAppFollowUpUrl: string | null;
}

const sanitize = (val: string | null | undefined, max: number): string | null => {
  if (!val) return null;
  const clean = val.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/<[^>]*>/g, "").trim();
  return clean.slice(0, max) || null;
};

export async function createPublicBooking(tenantId: string, input: CreateBookingInput): Promise<SiteBookingResult> {
  // 0. Idempotency Check — Return cached result if already processed in last 60s
  if (input.idempotencyKey) {
    const cached = getCachedIdempotentResult<SiteBookingResult>(tenantId, input.idempotencyKey);
    if (cached) return cached;
  }

  // 1. Bot Shield
  if (input.hp && input.hp.trim().length > 0) {
    return {
      bookingId: "bk_shielded",
      leadId: "lead_shielded",
      status: "REQUESTED",
      whatsAppFollowUpUrl: null,
    };
  }

  if (typeof input.elapsedMs === "number" && input.elapsedMs > 0 && input.elapsedMs < 1500) {
    return {
      bookingId: "bk_speed_shielded",
      leadId: "lead_speed_shielded",
      status: "REQUESTED",
      whatsAppFollowUpUrl: null,
    };
  }

  // 2. Sliding Window Rate Limiting (5/hr per IP, 3/hr per phone)
  checkPublicSubmissionRateLimit({
    tenantId,
    ip: input.ip,
    phone: input.phone,
  });

  // 3. Validate essentials & normalize phone
  const name = sanitize(input.name, 80);
  if (!name || name.length < 2) {
    throw new ValidationError("Please provide a name of at least 2 characters", { field: "name" });
  }

  let phone: string;
  try {
    phone = normalizeBdPhone(input.phone);
  } catch {
    throw new ValidationError("Please provide a valid 11-digit Bangladeshi mobile number for booking confirmation", { field: "phone" });
  }

  const email = sanitize(input.email, 120);
  const serviceName = sanitize(input.serviceName, 100);
  const providerName = sanitize(input.providerName, 100);
  const requestedTime = sanitize(input.requestedTime, 60);
  const message = sanitize(input.message, 1000);
  const partySize = typeof input.partySize === "number" && input.partySize > 0 ? Math.min(input.partySize, 100) : null;

  let requestedDate: Date | null = null;
  if (input.requestedDate) {
    const d = new Date(input.requestedDate);
    if (!isNaN(d.getTime())) requestedDate = d;
  }

  const leadType: SiteLeadType = input.type === "RESERVATION" ? "RESERVATION" : "APPOINTMENT";

  const rawMetadata = {
    serviceName,
    providerName,
    requestedDate: input.requestedDate,
    requestedTime,
    partySize,
    ...(input.consentTextVersion ? { consentTextVersion: input.consentTextVersion } : {}),
  };
  const validatedMeta = validateLeadMetadata(rawMetadata);

  const result = await withTenant(tenantId, async (tx) => {
    // 1. Create SiteLead row
    const lead = await tx.siteLead.create({
      data: {
        tenantId,
        type: leadType,
        status: "NEW",
        name,
        phone,
        email,
        message,
        sourcePage: sanitize(input.sourcePage, 200),
        locale: input.locale === "bn" ? "bn" : "en",
        consentGivenAt: input.consentGiven === true ? new Date() : null,
        metadata: validatedMeta || rawMetadata,
      },
    });

    // 2. Create linked BookingRequest row
    const booking = await tx.bookingRequest.create({
      data: {
        tenantId,
        leadId: lead.id,
        serviceName,
        providerName,
        requestedDate,
        requestedTime,
        partySize,
        status: "REQUESTED",
      },
    });

    // 3. Construct 1-click WhatsApp follow up link
    const storeSettings = await tx.storeSettings.findFirst({ select: { whatsappNumber: true, contactPhone: true, storeName: true } });
    const waNumber = storeSettings?.whatsappNumber || storeSettings?.contactPhone;

    let whatsAppFollowUpUrl: string | null = null;
    if (waNumber) {
      const cleanWa = waNumber.replace(/[^0-9]/g, "");
      const formattedWa = cleanWa.startsWith("88") ? cleanWa : cleanWa.startsWith("0") ? `88${cleanWa}` : `880${cleanWa}`;

      const dateStr = requestedDate ? requestedDate.toISOString().split("T")[0] : "";
      const isBn = input.locale === "bn";

      let details = "";
      if (serviceName) details += isBn ? `\nসেবা/বিষয়ঃ ${serviceName}` : `\nService: ${serviceName}`;
      if (providerName) details += isBn ? `\nচেম্বার/শাখাঃ ${providerName}` : `\nLocation/Chamber: ${providerName}`;
      if (dateStr) details += isBn ? `\nতারিখঃ ${dateStr}` : `\nDate: ${dateStr}`;
      if (requestedTime) details += isBn ? `\nসময়ঃ ${requestedTime}` : `\nTime: ${requestedTime}`;
      if (partySize) details += isBn ? `\nব্যক্তি সংখ্যাঃ ${partySize} জন` : `\nGuests: ${partySize}`;

      const text = isBn
        ? `আসসালামু আলাইকুম ${storeSettings?.storeName || ""}, আমি ওয়েবসাইটে একটি বুকিং রিকোয়েস্ট পাঠিয়েছি।\nবুকিং আইডি: #${booking.id.slice(-6)}\nনাম: ${name}\nফোন: ${phone}${details}\n\nদয়া করে আমার বুকিং কনফার্মেশন জানাবেন। ধন্যবাদ!`
        : `Hello ${storeSettings?.storeName || ""}, I just requested a booking on your website.\nBooking Ref: #${booking.id.slice(-6)}\nName: ${name}\nPhone: ${phone}${details}\n\nPlease confirm availability. Thank you!`;

      whatsAppFollowUpUrl = `https://wa.me/${formattedWa}?text=${encodeURIComponent(text)}`;
    }

    return {
      bookingId: booking.id,
      leadId: lead.id,
      status: booking.status,
      whatsAppFollowUpUrl,
    };
  });

  // 4. Record successful submission for rate limiting & cache idempotency
  recordPublicSubmission({
    tenantId,
    ip: input.ip,
    phone,
  });

  if (input.idempotencyKey) {
    setCachedIdempotentResult(tenantId, input.idempotencyKey, result);
  }

  // Dispatch Meta CAPI server-side event via durable outbox if consent given
  if (input.consentGiven !== false) {
    enqueueNotificationJob({
      tenantId,
      recipient: "META_CAPI",
      channel: "META_CAPI",
      event: "Schedule",
      body: JSON.stringify({
        booking: {
          id: result.bookingId,
          eventId: input.eventId || undefined,
          name: name!,
          phone: phone!,
          email: input.email,
          serviceName: input.serviceName,
          requestedDate: input.requestedDate,
          partySize: input.partySize,
          url: input.sourcePage,
        },
        user: {
          ip: input.ip,
          userAgent: input.userAgent,
          fbp: input.fbp,
          fbc: input.fbc,
        },
        options: { consentGiven: input.consentGiven },
      }),
      metadata: { bookingId: result.bookingId, eventId: input.eventId },
      immediateDispatch: true,
    }).catch((err) => {
      console.warn("[bookings] Outbox CAPI enqueue warning:", err instanceof Error ? err.message : err);
    });
  }

  return result;
}

export interface ListBookingsFilters {
  status?: BookingRequestStatus;
  take?: number;
  skip?: number;
}

export async function listBookingRequests(tenantId: string, actor: StaffActor, filters?: ListBookingsFilters) {
  assertCan(actor, "bookings", "view");

  return withTenant(tenantId, async (tx) => {
    const where = {
      tenantId,
      ...(filters?.status ? { status: filters.status } : {}),
    };

    const [items, total, pendingCount] = await Promise.all([
      tx.bookingRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: filters?.take ?? 50,
        skip: filters?.skip ?? 0,
        include: { lead: true },
      }),
      tx.bookingRequest.count({ where }),
      tx.bookingRequest.count({ where: { tenantId, status: "REQUESTED" } }),
    ]);

    return { items, total, pendingCount };
  });
}

export async function updateBookingRequestStatus(
  tenantId: string,
  actor: StaffActor,
  bookingId: string,
  status: BookingRequestStatus,
  privateNotes?: string | null,
) {
  assertCan(actor, "bookings", "edit");

  return withTenant(tenantId, async (tx) => {
    const booking = await tx.bookingRequest.findFirst({ where: { id: bookingId, tenantId }, include: { lead: true } });
    if (!booking) throw new NotFoundError("Booking request");

    const updated = await tx.bookingRequest.update({
      where: { id: bookingId },
      data: {
        status,
        ...(privateNotes !== undefined ? { privateNotes: sanitize(privateNotes, 1000) } : {}),
      },
    });

    // Also synchronize lead status if applicable
    if (booking.leadId) {
      const leadStatus =
        status === "CONFIRMED" || status === "COMPLETED" ? "WON"
        : status === "CONTACTED" ? "CONTACTED"
        : status === "DECLINED" || status === "CANCELLED" ? "CLOSED"
        : "NEW";

      await tx.siteLead.update({
        where: { id: booking.leadId },
        data: { status: leadStatus },
      });

      await tx.siteLeadActivity.create({
        data: {
          tenantId,
          leadId: booking.leadId,
          actorId: actor.userId,
          actorName: actor.name || actor.email,
          activityType: "STATUS_CHANGED",
          note: `Booking request marked as ${status}. Lead moved to ${leadStatus}.`,
          beforeStatus: booking.lead?.status ?? "NEW",
          afterStatus: leadStatus,
        },
      });
    }

    await audit(tx, tenantId, actor, "booking.status_updated", {
      bookingId,
      oldStatus: booking.status,
      newStatus: status,
    });

    return updated;
  });
}
