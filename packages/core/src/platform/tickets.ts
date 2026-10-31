import { notifyOwner } from "../mail/send";
import { getPlatformPrisma, withTenant, type PrismaClient } from "@biztrackbd/db";
import { assertPlatformCan, type PlatformActor } from "./admin";
import { assertCan, type StaffActor } from "../permissions";
import { NotFoundError, ValidationError, ForbiddenError } from "../errors";
import { notifyPlatform } from "./notify";
import { notifyStoreTicketReply, notifyPlatformTicketActivity } from "../notifications/push-service";

export type TicketStatusType = "OPEN" | "WAITING_ON_TENANT" | "SOLVED";
export type TicketPriority = "LOW" | "NORMAL" | "HIGH";

export interface TicketSummaryView {
  id: string;
  code: string;
  subject: string;
  status: TicketStatusType;
  priority: TicketPriority;
  storeName: string;
  tenantId: string;
  planTier: string;
  ownerName: string | null;
  assigneeName: string | null;
  assigneeId: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastMessageSnippet: string | null;
  lastMessageAt: Date;
}

export interface TicketMessageView {
  id: string;
  authorType: "TENANT" | "PLATFORM" | "SYSTEM";
  authorId: string | null;
  authorName: string;
  body: string;
  isInternal: boolean;
  createdAt: Date;
}

export interface TicketDetailView {
  id: string;
  code: string;
  subject: string;
  status: TicketStatusType;
  priority: TicketPriority;
  storeName: string;
  tenantId: string;
  planTier: string;
  subdomain: string;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  createdAt: Date;
  updatedAt: Date;
  messages: TicketMessageView[];
}

export interface Deps {
  db?: PrismaClient;
  now?: Date;
}

const dbOf = (d?: Deps) => d?.db ?? getPlatformPrisma();
const nowOf = (d?: Deps) => d?.now ?? new Date();

// ==========================================
// 1. Platform Super Admin Operations
// ==========================================

export async function listPlatformTickets(
  actor: PlatformActor,
  filter?: { status?: TicketStatusType | "MINE"; search?: string },
  deps?: Deps
): Promise<TicketSummaryView[]> {
  assertPlatformCan(actor, "tickets", "view");
  const db = dbOf(deps);

  const where: Record<string, unknown> = {};
  if (filter?.status === "MINE") {
    where.assigneeId = actor.id;
  } else if (filter?.status) {
    where.status = filter.status;
  }

  const rows = await db.supportTicket.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          planTier: true,
          users: { where: { role: "STORE_OWNER" }, select: { name: true }, take: 1 },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, createdAt: true },
      },
    },
    take: 100,
  });

  const assigneeIds = [...new Set(rows.map((r) => r.assigneeId).filter(Boolean))] as string[];
  const assignees = assigneeIds.length > 0
    ? await db.platformUser.findMany({ where: { id: { in: assigneeIds } }, select: { id: true, name: true } })
    : [];
  const assigneeMap = new Map(assignees.map((a) => [a.id, a.name]));

  return rows.map((r) => {
    const ownerName = r.tenant.users[0]?.name ?? null;
    const lastMsg = r.messages[0];
    return {
      id: r.id,
      code: r.code,
      subject: r.subject,
      status: r.status as TicketStatusType,
      priority: r.priority as TicketPriority,
      storeName: r.tenant.name,
      tenantId: r.tenant.id,
      planTier: r.tenant.planTier,
      ownerName,
      assigneeId: r.assigneeId,
      assigneeName: r.assigneeId ? assigneeMap.get(r.assigneeId) ?? null : null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      lastMessageSnippet: lastMsg ? lastMsg.body.slice(0, 120) : null,
      lastMessageAt: lastMsg ? lastMsg.createdAt : r.createdAt,
    };
  });
}

export async function getPlatformTicketDetail(
  actor: PlatformActor,
  ticketId: string,
  deps?: Deps
): Promise<TicketDetailView> {
  assertPlatformCan(actor, "tickets", "view");
  const db = dbOf(deps);

  const ticket = await db.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          subdomain: true,
          planTier: true,
          users: { where: { role: "STORE_OWNER" }, select: { id: true, name: true, email: true, phone: true }, take: 1 },
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!ticket) throw new NotFoundError("Support ticket not found");

  const assignee = ticket.assigneeId
    ? await db.platformUser.findUnique({ where: { id: ticket.assigneeId }, select: { name: true } })
    : null;

  const owner = ticket.tenant.users[0] ?? null;

  // Resolve author names for messages
  const platformAuthorIds = [...new Set(ticket.messages.filter((m) => m.authorType === "PLATFORM" && m.authorId).map((m) => m.authorId!))];
  const platformAuthors = platformAuthorIds.length > 0
    ? await db.platformUser.findMany({ where: { id: { in: platformAuthorIds } }, select: { id: true, name: true } })
    : [];
  const platformAuthorMap = new Map(platformAuthors.map((a) => [a.id, a.name]));

  const messages: TicketMessageView[] = ticket.messages.map((m) => {
    let authorName = "System";
    if (m.authorType === "TENANT") {
      authorName = owner?.name ?? "Merchant";
    } else if (m.authorType === "PLATFORM") {
      authorName = m.authorId ? platformAuthorMap.get(m.authorId) ?? "Platform Support" : "Platform Support";
    }

    return {
      id: m.id,
      authorType: m.authorType as "TENANT" | "PLATFORM" | "SYSTEM",
      authorId: m.authorId,
      authorName,
      body: m.body,
      isInternal: m.isInternal,
      createdAt: m.createdAt,
    };
  });

  return {
    id: ticket.id,
    code: ticket.code,
    subject: ticket.subject,
    status: ticket.status as TicketStatusType,
    priority: ticket.priority as TicketPriority,
    storeName: ticket.tenant.name,
    tenantId: ticket.tenant.id,
    planTier: ticket.tenant.planTier,
    subdomain: ticket.tenant.subdomain,
    ownerName: owner?.name ?? null,
    ownerEmail: owner?.email ?? null,
    ownerPhone: owner?.phone ?? null,
    assigneeId: ticket.assigneeId,
    assigneeName: assignee?.name ?? null,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    messages,
  };
}

export async function replyPlatformTicket(
  actor: PlatformActor,
  input: {
    ticketId: string;
    body: string;
    isInternal?: boolean;
    newStatus?: TicketStatusType;
  },
  deps?: Deps
): Promise<TicketMessageView> {
  assertPlatformCan(actor, "tickets", "edit");
  const body = input.body?.trim();
  if (!body) throw new ValidationError("Message body is required");

  const db = dbOf(deps);
  const isInternal = Boolean(input.isInternal);
  const newStatus = input.newStatus ?? (isInternal ? undefined : "WAITING_ON_TENANT");

  const box: { replied?: { id: string; tenantId: string; code: string | null }; repeat?: boolean } = {};
  const [message] = await db.$transaction(async (tx) => {
    const ticket = await tx.supportTicket.findUnique({ where: { id: input.ticketId }, select: { id: true, tenantId: true, code: true } });
    if (!ticket) throw new NotFoundError("Ticket not found");
    const again = await tx.ticketMessage.findFirst({
      where: { ticketId: ticket.id, authorType: "PLATFORM", authorId: actor.id, body, isInternal, createdAt: { gte: new Date(Date.now() - 120_000) } },
    });
    if (again) {
      box.repeat = true;
      return [again];
    }
    box.replied = { id: ticket.id, tenantId: ticket.tenantId, code: ticket.code };

    const created = await tx.ticketMessage.create({
      data: {
        tenantId: ticket.tenantId,
        ticketId: ticket.id,
        authorType: "PLATFORM",
        authorId: actor.id,
        body,
        isInternal,
      },
    });

    if (newStatus) {
      await tx.supportTicket.update({
        where: { id: ticket.id },
        data: { status: newStatus as never, updatedAt: new Date() },
      });
    }

    await tx.platformAuditLog.create({
      data: {
        actorId: actor.id,
        action: isInternal ? "ticket.internal_note" : "ticket.replied",
        tenantId: ticket.tenantId,
        details: { ticketId: ticket.id, isInternal, newStatus },
        ipAddress: actor.ip ?? null,
      },
    });

    return [created];
  });

  // A reply the store should see (not an internal note) is also emailed to the owner, so they do not have to keep checking.
  const replied = box.replied;
  if (replied && !isInternal) {
    const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
    const admin = (
      process.env.ADMIN_ORIGIN ||
      process.env.NEXT_PUBLIC_ADMIN_URL ||
      (root && !root.startsWith("localhost")
        ? `https://admin.${root}`
        : process.env.NODE_ENV === "production"
        ? "https://admin.biztrack.bd"
        : "http://localhost:3001")
    ).replace(/\/$/, "");
    await notifyOwner(replied.tenantId, "TICKET_REPLY", { ticketCode: replied.code ?? undefined, excerpt: body.length > 400 ? `${body.slice(0, 400)}...` : body, ticketUrl: `${admin}/support/${replied.id}` }, { dedupeKey: message.id });
    notifyStoreTicketReply(replied.tenantId, {
      ticketId: replied.id,
      ticketCode: replied.code ?? "Support",
      subject: "Support Ticket",
      replySnippet: body,
      status: newStatus,
    }).catch(() => {});
  }

  return {
    id: message.id,
    authorType: "PLATFORM",
    authorId: actor.id,
    authorName: actor.email,
    body: message.body,
    isInternal: message.isInternal,
    createdAt: message.createdAt,
  };
}

export async function updateTicketStatus(
  actor: PlatformActor,
  ticketId: string,
  status: TicketStatusType,
  deps?: Deps
): Promise<void> {
  assertPlatformCan(actor, "tickets", "edit");
  const db = dbOf(deps);

  const ticket = await db.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new NotFoundError("Ticket not found");

  await db.$transaction(async (tx) => {
    await tx.supportTicket.update({
      where: { id: ticketId },
      data: { status: status as never },
    });

    await tx.platformAuditLog.create({
      data: {
        actorId: actor.id,
        action: "ticket.status_changed",
        tenantId: ticket.tenantId,
        details: { ticketId, from: ticket.status, to: status },
        ipAddress: actor.ip ?? null,
      },
    });
  });
  if (status === "SOLVED" || status === "WAITING_ON_TENANT") {
    notifyStoreTicketReply(ticket.tenantId, {
      ticketId: ticket.id,
      ticketCode: ticket.code,
      subject: ticket.subject,
      replySnippet: status === "SOLVED" ? "আপনার টিকিট সমাধান হিসেবে চিহ্নিত করা হয়েছে।" : "টিকিটে আপনার উত্তর প্রয়োজন।",
      status,
    }).catch(() => {});
  }
}

// ==========================================
// 2. Merchant Store Admin Operations
// ==========================================

export async function listTenantTickets(
  tenantId: string,
  actor: StaffActor,
  deps?: Deps
): Promise<{ id: string; code: string; subject: string; status: TicketStatusType; priority: string; updatedAt: Date }[]> {
  if (!actor?.userId) throw new ForbiddenError();

  return withTenant(tenantId, async (tx) => {
    const rows = await tx.supportTicket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        code: true,
        subject: true,
        status: true,
        priority: true,
        updatedAt: true,
      },
    });

    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      subject: r.subject,
      status: r.status as TicketStatusType,
      priority: r.priority,
      updatedAt: r.updatedAt,
    }));
  });
}

export async function createTenantTicket(
  tenantId: string,
  actor: StaffActor,
  input: { subject: string; message: string; priority?: TicketPriority },
  deps?: Deps
): Promise<{ id: string; code: string }> {
  if (!actor?.userId) throw new ForbiddenError();
  const subject = input.subject?.trim();
  const message = input.message?.trim();
  if (!subject) throw new ValidationError("Subject is required");
  if (!message) throw new ValidationError("Message is required");

  const priority = input.priority ?? "NORMAL";
  const code = `T-${Math.floor(1000 + Math.random() * 9000)}`;

  let fresh = false;
  let storeName: string | null = null;
  let storePlan: string | null = null;
  const created = await withTenant(tenantId, async (tx) => {
    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { planTier: true, customDomain: true, name: true },
    });
    storeName = tenant?.name ?? null;
    storePlan = tenant?.planTier ?? null;

    // The same person opening the same subject again within two minutes is a double submit, not a second ticket.
    const recent = await tx.supportTicket.findFirst({
      where: { openedBy: actor.userId, subject, createdAt: { gte: new Date(Date.now() - 120_000) } },
      orderBy: { createdAt: "desc" },
      select: { id: true, code: true },
    });
    if (recent) return { id: recent.id, code: recent.code };

    const ticket = await tx.supportTicket.create({
      data: {
        tenantId,
        code,
        subject,
        priority,
        status: "OPEN",
        openedBy: actor.userId,
      },
    });

    await tx.ticketMessage.create({
      data: {
        tenantId,
        ticketId: ticket.id,
        authorType: "TENANT",
        authorId: actor.userId,
        body: message,
        isInternal: false,
      },
    });

    // Automated system diagnostics note for platform staff
    if (tenant) {
      await tx.ticketMessage.create({
        data: {
          tenantId,
          ticketId: ticket.id,
          authorType: "SYSTEM",
          authorId: null,
          body: `Store Context: Plan is ${tenant.planTier}. Custom domain: ${tenant.customDomain ?? "none"}.`,
          isInternal: false,
        },
      });
    }

    fresh = true;
    return { id: ticket.id, code: ticket.code };
  });

  if (fresh) {
    await notifyPlatform({
      kind: "TICKET",
      title: `Support ticket ${created.code}: ${subject}`,
      lines: [
        ["Store", storeName],
        ["Plan", storePlan],
        ["Priority", priority],
        ["Subject", subject],
        ["Message", message.slice(0, 400)],
      ],
    });
  }
  return created;
}

export async function replyTenantTicket(
  tenantId: string,
  actor: StaffActor,
  input: { ticketId: string; message: string },
  deps?: Deps
): Promise<void> {
  const message = input.message?.trim();
  if (!message) throw new ValidationError("Message is required");

  let ticketCode = "Support";
  let ticketSubject = "Ticket Reply";
  let storeName = "Merchant Store";

  await withTenant(tenantId, async (tx) => {
    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });
    if (tenant?.name) storeName = tenant.name;

    const ticket = await tx.supportTicket.findUnique({
      where: { id: input.ticketId },
    });
    if (!ticket) throw new NotFoundError("Ticket not found");
    ticketCode = ticket.code;
    ticketSubject = ticket.subject;

    const sameReply = await tx.ticketMessage.findFirst({
      where: { ticketId: ticket.id, authorType: "TENANT", authorId: actor.userId, body: message, createdAt: { gte: new Date(Date.now() - 120_000) } },
      select: { id: true },
    });
    if (sameReply) return;

    await tx.ticketMessage.create({
      data: {
        tenantId,
        ticketId: ticket.id,
        authorType: "TENANT",
        authorId: actor.userId,
        body: message,
        isInternal: false,
      },
    });

    // Reopen if waiting or solved
    await tx.supportTicket.update({
      where: { id: ticket.id },
      data: { status: "OPEN", updatedAt: new Date() },
    });
  });

  await notifyPlatformTicketActivity({
    ticketId: input.ticketId,
    ticketCode,
    storeName,
    subject: ticketSubject,
    replySnippet: message,
    isNew: false,
  }).catch(() => {});
}

export async function getTenantTicketDetail(
  tenantId: string,
  actor: StaffActor,
  ticketId: string,
  deps?: Deps
): Promise<{
  id: string;
  code: string;
  subject: string;
  status: TicketStatusType;
  priority: string;
  createdAt: Date;
  messages: { id: string; authorType: string; body: string; createdAt: Date }[];
}> {
  if (!actor?.userId) throw new ForbiddenError();

  return withTenant(tenantId, async (tx) => {
    const ticket = await tx.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        messages: {
          where: { isInternal: false }, // Crucial: merchants NEVER see internal notes
          orderBy: { createdAt: "asc" },
          select: { id: true, authorType: true, body: true, createdAt: true },
        },
      },
    });

    if (!ticket) throw new NotFoundError("Ticket not found");

    return {
      id: ticket.id,
      code: ticket.code,
      subject: ticket.subject,
      status: ticket.status as TicketStatusType,
      priority: ticket.priority,
      createdAt: ticket.createdAt,
      messages: ticket.messages,
    };
  });
}
