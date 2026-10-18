import { withTenant, type PrismaClient, type SiteLeadStatus, type SiteLeadType, type LeadActivityType } from "@biztrackbd/db";
import { NotFoundError, ValidationError } from "../errors";
import { assertCan, type StaffActor } from "../permissions";
import { audit } from "../audit/service";
import { trackServerLead } from "../growth/tracking";
import { enqueueNotificationJob } from "../messaging/queue";
import { emitMerchantWebhookEvent } from "../messaging/webhook";
import { normalizeBdPhone } from "../phone";
import {
  checkPublicSubmissionRateLimit,
  recordPublicSubmission,
  getCachedIdempotentResult,
  setCachedIdempotentResult,
  validateLeadMetadata,
} from "./abuse-protection";

export interface CreateLeadInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  message?: string | null;
  type?: SiteLeadType;
  sourcePage?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  referrer?: string | null;
  locale?: string;
  metadata?: Record<string, unknown> | null;
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
  /** Invisible honeypot field — bots fill this, humans do not */
  hp?: string | null;
  /** Milliseconds since the form mounted — bots submit in <1500ms */
  elapsedMs?: number | null;
}

export interface LeadResult {
  id: string;
  type: SiteLeadType;
  status: SiteLeadStatus;
  whatsAppFollowUpUrl: string | null;
}

/** Sanitizes and validates plain text fields */
const sanitize = (val: string | null | undefined, max: number): string | null => {
  if (!val) return null;
  const clean = val.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/<[^>]*>/g, "").trim();
  return clean.slice(0, max) || null;
};

/** Validates and captures a public lead from storefront contact/inquiry forms */
export async function createPublicLead(tenantId: string, input: CreateLeadInput): Promise<LeadResult> {
  // 0. Idempotency Check — Return cached result if already processed in last 60s
  if (input.idempotencyKey) {
    const cached = getCachedIdempotentResult<LeadResult>(tenantId, input.idempotencyKey);
    if (cached) return cached;
  }

  // 1. Invisible Bot Shield — Honeypot & Minimum Completion Duration
  if (input.hp && input.hp.trim().length > 0) {
    // Silently drop bot submissions without throwing loud error
    return {
      id: "lead_bot_shielded",
      type: input.type ?? "CONTACT",
      status: "SPAM",
      whatsAppFollowUpUrl: null,
    };
  }

  if (typeof input.elapsedMs === "number" && input.elapsedMs > 0 && input.elapsedMs < 1500) {
    return {
      id: "lead_bot_speed_shielded",
      type: input.type ?? "CONTACT",
      status: "SPAM",
      whatsAppFollowUpUrl: null,
    };
  }

  // 2. Sliding Window Rate Limiting (5/hr per IP, 3/hr per phone)
  checkPublicSubmissionRateLimit({
    tenantId,
    ip: input.ip,
    phone: input.phone,
  });

  // 3. Validate & sanitize input fields
  const name = sanitize(input.name, 80);
  if (!name || name.length < 2) {
    throw new ValidationError("Please provide a name of at least 2 characters", { field: "name" });
  }

  let phone: string | null = null;
  if (input.phone) {
    try {
      phone = normalizeBdPhone(input.phone);
    } catch {
      throw new ValidationError("Please enter a valid 11-digit Bangladeshi mobile number", { field: "phone" });
    }
  }

  const email = sanitize(input.email, 120);

  if (!phone && !email) {
    throw new ValidationError("Please provide either a phone number or an email address to reach you", { field: "phone" });
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError("Please enter a valid email address", { field: "email" });
  }

  const message = sanitize(input.message, 1500);
  const type: SiteLeadType = input.type ?? "CONTACT";
  const validatedMeta = validateLeadMetadata(input.metadata);

  const result = await withTenant(tenantId, async (tx) => {
    const lead = await tx.siteLead.create({
      data: {
        tenantId,
        type,
        status: "NEW",
        name,
        phone,
        email,
        message,
        sourcePage: sanitize(input.sourcePage, 200),
        utmSource: sanitize(input.utmSource, 100),
        utmMedium: sanitize(input.utmMedium, 100),
        utmCampaign: sanitize(input.utmCampaign, 100),
        referrer: sanitize(input.referrer, 300),
        locale: input.locale === "bn" ? "bn" : "en",
        metadata: {
          ...(validatedMeta || {}),
          ...(input.consentTextVersion ? { consentTextVersion: input.consentTextVersion } : {}),
        },
        consentGivenAt: input.consentGiven === true ? new Date() : null,
      },
    });

    // Check if store has a public WhatsApp number configured
    const storeSettings = await tx.storeSettings.findFirst({ select: { whatsappNumber: true, contactPhone: true, storeName: true } });
    const waNumber = storeSettings?.whatsappNumber || storeSettings?.contactPhone;

    let whatsAppFollowUpUrl: string | null = null;
    if (waNumber) {
      const cleanWa = waNumber.replace(/[^0-9]/g, "");
      const formattedWa = cleanWa.startsWith("88") ? cleanWa : cleanWa.startsWith("0") ? `88${cleanWa}` : `880${cleanWa}`;
      const greeting = input.locale === "bn"
        ? `আসসালামু আলাইকুম ${storeSettings?.storeName || ""}, আমি আপনার ওয়েবসাইটে একটি ইনকোয়ারি জমা দিয়েছি (রেফারেন্স: #${lead.id.slice(-6)}। নাম: ${name})।`
        : `Hello ${storeSettings?.storeName || ""}, I just submitted an inquiry on your website (Ref: #${lead.id.slice(-6)}, Name: ${name}).`;
      whatsAppFollowUpUrl = `https://wa.me/${formattedWa}?text=${encodeURIComponent(greeting)}`;
    }

    return {
      id: lead.id,
      type: lead.type,
      status: lead.status,
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
      event: "Lead",
      body: JSON.stringify({
        lead: {
          id: result.id,
          eventId: input.eventId || undefined,
          name: name || undefined,
          phone,
          email,
          type,
          sourcePage: input.sourcePage,
        },
        user: {
          ip: input.ip,
          userAgent: input.userAgent,
          fbp: input.fbp,
          fbc: input.fbc,
        },
        options: { consentGiven: input.consentGiven },
      }),
      metadata: { leadId: result.id, eventId: input.eventId },
      immediateDispatch: true,
    }).catch((err) => {
      console.warn("[leads] Outbox CAPI enqueue warning:", err instanceof Error ? err.message : err);
    });
  }

  // Outbound Merchant Webhook Event: lead.created (non-blocking)
  emitMerchantWebhookEvent(tenantId, "lead.created", {
    leadId: result.id,
    type: result.type,
    name: name || undefined,
    phone: phone || undefined,
    email: email || undefined,
    message: input.message || undefined,
    sourceUrl: input.sourcePage || undefined,
  }).catch((err) => {
    console.warn("[webhook] lead.created emit warning:", err instanceof Error ? err.message : err);
  });

  return result;
}

export interface ListLeadsFilters {
  status?: SiteLeadStatus;
  type?: SiteLeadType;
  take?: number;
  skip?: number;
}

/** Lists leads for merchant admin */
export async function listSiteLeads(tenantId: string, actor: StaffActor, filters?: ListLeadsFilters) {
  assertCan(actor, "leads", "view");

  return withTenant(tenantId, async (tx) => {
    const where = {
      tenantId,
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.type ? { type: filters.type } : {}),
    };

    const [items, total, unreadCount] = await Promise.all([
      tx.siteLead.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: filters?.take ?? 50,
        skip: filters?.skip ?? 0,
        include: {
          bookingRequest: true,
          activities: {
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
      }),
      tx.siteLead.count({ where }),
      tx.siteLead.count({ where: { tenantId, status: "NEW" } }),
    ]);

    return { items, total, unreadCount };
  });
}

/** Updates a lead status (e.g. NEW -> CONTACTED -> QUALIFIED -> CLOSED) and writes an immutable activity row */
export async function updateSiteLeadStatus(
  tenantId: string,
  actor: StaffActor,
  leadId: string,
  status: SiteLeadStatus,
  privateNotes?: string | null,
) {
  assertCan(actor, "leads", "edit");

  return withTenant(tenantId, async (tx) => {
    const lead = await tx.siteLead.findFirst({ where: { id: leadId, tenantId } });
    if (!lead) throw new NotFoundError("Lead");

    const cleanNote = privateNotes !== undefined ? sanitize(privateNotes, 1000) : undefined;

    const updated = await tx.siteLead.update({
      where: { id: leadId },
      data: {
        status,
        ...(cleanNote !== undefined ? { privateNotes: cleanNote } : {}),
      },
    });

    if (lead.status !== status || cleanNote) {
      await tx.siteLeadActivity.create({
        data: {
          tenantId,
          leadId,
          actorId: actor.userId,
          actorName: actor.name || actor.email,
          activityType: "STATUS_CHANGED",
          note: cleanNote || `Status updated from ${lead.status} to ${status}`,
          beforeStatus: lead.status,
          afterStatus: status,
        },
      });
    }

    await audit(tx, tenantId, actor, "lead.status_updated", {
      leadId,
      oldStatus: lead.status,
      newStatus: status,
    });

    return updated;
  });
}

/** Assigns a lead to a staff member with an immutable activity log */
export async function assignSiteLead(
  tenantId: string,
  actor: StaffActor,
  leadId: string,
  assignedToUserId: string | null,
  assignedToUserName?: string | null
) {
  assertCan(actor, "leads", "edit");

  return withTenant(tenantId, async (tx) => {
    const lead = await tx.siteLead.findFirst({ where: { id: leadId, tenantId } });
    if (!lead) throw new NotFoundError("Lead");

    const updated = await tx.siteLead.update({
      where: { id: leadId },
      data: { assignedToUserId },
    });

    await tx.siteLeadActivity.create({
      data: {
        tenantId,
        leadId,
        actorId: actor.userId,
        actorName: actor.name || actor.email,
        activityType: "ASSIGNED",
        note: assignedToUserId ? `Assigned to ${assignedToUserName || assignedToUserId}` : "Unassigned lead",
        metadata: { assignedToUserId, assignedToUserName },
      },
    });

    await audit(tx, tenantId, actor, "lead.assigned", {
      leadId,
      assignedToUserId,
    });

    return updated;
  });
}

/** Appends an internal note or communication attempt to a lead's activity timeline */
export async function addSiteLeadActivityNote(
  tenantId: string,
  actor: StaffActor,
  leadId: string,
  noteText: string,
  activityType: LeadActivityType = "NOTE_ADDED"
) {
  assertCan(actor, "leads", "edit");
  const cleanNote = sanitize(noteText, 2000);
  if (!cleanNote) throw new ValidationError("Note cannot be empty", { field: "note" });

  return withTenant(tenantId, async (tx) => {
    const lead = await tx.siteLead.findFirst({ where: { id: leadId, tenantId } });
    if (!lead) throw new NotFoundError("Lead");

    const activity = await tx.siteLeadActivity.create({
      data: {
        tenantId,
        leadId,
        actorId: actor.userId,
        actorName: actor.name || actor.email,
        activityType,
        note: cleanNote,
      },
    });

    await tx.siteLead.update({
      where: { id: leadId },
      data: { privateNotes: cleanNote },
    });

    await audit(tx, tenantId, actor, "lead.note_added", {
      leadId,
      activityId: activity.id,
    });

    return activity;
  });
}

/** Lists the complete chronological activity timeline for a lead */
export async function listSiteLeadActivities(
  tenantId: string,
  actor: StaffActor,
  leadId: string
) {
  assertCan(actor, "leads", "view");

  return withTenant(tenantId, async (tx) => {
    return tx.siteLeadActivity.findMany({
      where: { tenantId, leadId },
      orderBy: { createdAt: "asc" },
    });
  });
}

/** Lists active staff members who can be assigned to leads */
export async function listAssignableStaff(tenantId: string, actor: StaffActor) {
  assertCan(actor, "leads", "view");

  return withTenant(tenantId, async (tx) => {
    return tx.tenantUser.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: { name: "asc" },
    });
  });
}

