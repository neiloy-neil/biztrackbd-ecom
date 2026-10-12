import { getPlatformPrisma } from "@biztrackbd/db";
import { assertPlatformCan, type PlatformActor } from "./admin";
import { ValidationError } from "../errors";

export type InquiryStatus = "NEW" | "CONTACTED" | "CONVERTED" | "ARCHIVED";

export interface InquiryInput {
  name: string;
  phone: string;
  email: string;
  topic: string;
  message: string;
  ipAddress?: string | null;
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

  const db = getPlatformPrisma();
  const created = await db.platformInquiry.create({
    data: {
      name,
      phone,
      email,
      topic,
      message,
      status: "NEW",
      ipAddress: input.ipAddress ?? null,
    },
  });

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
