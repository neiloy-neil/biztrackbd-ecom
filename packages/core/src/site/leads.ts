import { withTenant, type PrismaClient, type SiteLeadStatus, type SiteLeadType } from "@biztrackbd/db";
import { NotFoundError, ValidationError } from "../errors";
import { assertCan, type StaffActor } from "../permissions";
import { audit } from "../audit/service";

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

  // 2. Validate input fields
  const name = sanitize(input.name, 80);
  if (!name || name.length < 2) {
    throw new ValidationError("Please provide a name of at least 2 characters", { field: "name" });
  }

  const phone = sanitize(input.phone, 30);
  const email = sanitize(input.email, 120);

  if (!phone && !email) {
    throw new ValidationError("Please provide either a phone number or an email address to reach you", { field: "phone" });
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError("Please enter a valid email address", { field: "email" });
  }

  const message = sanitize(input.message, 1500);
  const type: SiteLeadType = input.type ?? "CONTACT";

  return withTenant(tenantId, async (tx) => {
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
        metadata: input.metadata ? (input.metadata as object) : undefined,
        consentGivenAt: new Date(),
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
}

export interface ListLeadsFilters {
  status?: SiteLeadStatus;
  type?: SiteLeadType;
  take?: number;
  skip?: number;
}

/** Lists leads for merchant admin */
export async function listSiteLeads(tenantId: string, actor: StaffActor, filters?: ListLeadsFilters) {
  assertCan(actor, "customers", "view");

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
        include: { bookingRequest: true },
      }),
      tx.siteLead.count({ where }),
      tx.siteLead.count({ where: { tenantId, status: "NEW" } }),
    ]);

    return { items, total, unreadCount };
  });
}

/** Updates a lead status (e.g. NEW -> CONTACTED -> QUALIFIED -> CLOSED) */
export async function updateSiteLeadStatus(
  tenantId: string,
  actor: StaffActor,
  leadId: string,
  status: SiteLeadStatus,
  privateNotes?: string | null,
) {
  assertCan(actor, "customers", "edit");

  return withTenant(tenantId, async (tx) => {
    const lead = await tx.siteLead.findFirst({ where: { id: leadId, tenantId } });
    if (!lead) throw new NotFoundError("Lead");

    const updated = await tx.siteLead.update({
      where: { id: leadId },
      data: {
        status,
        ...(privateNotes !== undefined ? { privateNotes: sanitize(privateNotes, 1000) } : {}),
      },
    });

    await audit(tx, tenantId, actor, "lead.status_updated", {
      leadId,
      oldStatus: lead.status,
      newStatus: status,
    });

    return updated;
  });
}
