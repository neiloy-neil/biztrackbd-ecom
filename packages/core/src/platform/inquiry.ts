import { createHash } from "node:crypto";
import { getPlatformPrisma } from "@biztrackbd/db";
import { assertPlatformCan, type PlatformActor } from "./admin";
import { ValidationError } from "../errors";
import { trackPlatformInquiryCapi } from "./tracking";

/** The same sender and message inside this window counts as one inquiry. */
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

export type InquiryStatus = "NEW" | "CONTACTED" | "CONVERTED" | "ARCHIVED";

export interface InquiryInput {
  name: string;
  phone: string;
  email: string;
  topic: string;
  message: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  eventId?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  referrer?: string | null;
  consentGiven?: boolean | null;
  consentTextVersion?: string | null;
}

export interface InquiryView {
  id: string;
  name: string;
  phone: string;
  email: string;
  topic: string;
  message: string;
  status: InquiryStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Public submission endpoint from the marketing contact form. */
export async function submitPlatformInquiry(input: InquiryInput): Promise<InquiryView> {
  const name = input.name?.trim();
  if (!name || name.length < 2) {
    throw new ValidationError("Enter your name", { field: "name" });
  }

  const phone = input.phone?.trim();
  if (!phone || phone.length < 6) {
    throw new ValidationError("Enter a valid phone number", { field: "phone" });
  }

  const email = input.email?.trim().toLowerCase();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    throw new ValidationError("Enter a valid email address", { field: "email" });
  }

  const message = input.message?.trim();
  if (!message || message.length < 5) {
    throw new ValidationError("Enter a message of at least 5 characters", { field: "message" });
  }

  const topic = input.topic?.trim() || "setup";

  const attrParts: string[] = [];
  if (input.utmSource) attrParts.push(`source: ${input.utmSource}`);
  if (input.utmMedium) attrParts.push(`medium: ${input.utmMedium}`);
  if (input.utmCampaign) attrParts.push(`campaign: ${input.utmCampaign}`);
  if (input.referrer) attrParts.push(`ref: ${input.referrer}`);
  const attributionNote = attrParts.length > 0 ? `[Attribution: ${attrParts.join(", ")}]` : null;

  const db = getPlatformPrisma();

  // The public site's database role may add an inquiry but not read one, so this is a single INSERT that returns nothing. The id comes
  // from the sender and message plus a 10-minute window: a double click, a retry after a slow response or Enter pressed twice lands on
  // the same id, and ON CONFLICT DO NOTHING (skipDuplicates) turns the repeat into no new lead.
  const bucket = Math.floor(Date.now() / DUPLICATE_WINDOW_MS);
  const id = `inq_${createHash("sha256").update([phone, email.toLowerCase(), message, bucket].join("|")).digest("hex").slice(0, 24)}`;
  const createdAt = new Date();
  const { count } = await db.platformInquiry.createMany({
    data: [{ id, name, phone, email, topic, message, status: "NEW", notes: attributionNote, ipAddress: input.ipAddress ?? null, createdAt, updatedAt: createdAt }],
    skipDuplicates: true,
  });
  const created = { id, name, phone, email, topic, message, status: "NEW" as const, notes: attributionNote, createdAt, updatedAt: createdAt };
  if (count === 0) return created;

  // Dispatch Meta CAPI for platform inquiry if consent given. Awaited so a serverless host cannot freeze the function before it finishes.
  if (input.consentGiven !== false) {
    await trackPlatformInquiryCapi({
      inquiryId: created.id,
      eventId: input.eventId || undefined,
      name,
      phone,
      email,
      topic,
      consentGiven: input.consentGiven,
      user: {
        ip: input.ipAddress,
        userAgent: input.userAgent,
        fbp: input.fbp,
        fbc: input.fbc,
      },
    }).catch((err) => {
      console.warn("[inquiry] Platform CAPI dispatch warning:", err instanceof Error ? err.message : err);
    });
  }

  return {
    id: created.id,
    name: created.name,
    phone: created.phone,
    email: created.email,
    topic: created.topic,
    message: created.message,
    status: created.status as InquiryStatus,
    notes: created.notes,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
  };
}

/** List platform inquiries for Super Admins. */
export async function listPlatformInquiries(
  actor: PlatformActor,
  filter?: { status?: InquiryStatus; topic?: string }
): Promise<InquiryView[]> {
  assertPlatformCan(actor, "tickets");

  const db = getPlatformPrisma();
  const where: Record<string, unknown> = {};

  if (filter?.status) {
    where.status = filter.status;
  }
  if (filter?.topic && filter.topic !== "all") {
    where.topic = filter.topic;
  }

  const items = await db.platformInquiry.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return items.map((i) => ({
    id: i.id,
    name: i.name,
    phone: i.phone,
    email: i.email,
    topic: i.topic,
    message: i.message,
    status: i.status as InquiryStatus,
    notes: i.notes,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  }));
}

/** Update inquiry status or append notes from the Super Admin desk. */
export async function updateInquiryStatus(
  actor: PlatformActor,
  id: string,
  status: InquiryStatus,
  notes?: string
): Promise<void> {
  assertPlatformCan(actor, "tickets");

  const db = getPlatformPrisma();
  await db.platformInquiry.update({
    where: { id },
    data: {
      status,
      notes: notes !== undefined ? notes : undefined,
    },
  });
}
