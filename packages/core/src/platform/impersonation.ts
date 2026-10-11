import { createHmac, timingSafeEqual } from "crypto";
import { getPlatformPrisma, type PrismaClient } from "@biztrackbd/db";
import { ValidationError } from "../errors";
import { assertPlatformCan, type PlatformActor } from "./admin";

const SECRET = process.env.IMPERSONATION_SECRET || process.env.COOKIE_SECRET || "biztrack_super_admin_impersonate_secret_key_2026";
const TICKET_TTL_MS = 60_000; // 60 seconds
const SESSION_TTL_MS = 15 * 60_000; // 15 minutes

export interface ImpersonationTicketPayload {
  tenantId: string;
  actorId: string;
  actorEmail: string;
  timestamp: number;
}

export interface ImpersonationSessionPayload {
  tenantId: string;
  actorId: string;
  actorEmail: string;
  expiresAt: number;
}

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

function verify(payload: string, signature: string): boolean {
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function createImpersonationTicket(actor: PlatformActor, tenantId: string, db?: PrismaClient): Promise<string> {
  assertPlatformCan(actor, "tenants", "edit");
  const prisma = db ?? getPlatformPrisma();
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new ValidationError("Store not found");

  const payload: ImpersonationTicketPayload = {
    tenantId,
    actorId: actor.id,
    actorEmail: actor.email,
    timestamp: Date.now(),
  };

  const json = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = sign(json);
  const ticket = `${json}.${sig}`;

  // Log in platform audit log
  await prisma.platformAuditLog.create({
    data: {
      actorId: actor.id,
      action: "IMPERSONATION_TICKET_CREATED",
      tenantId,
      details: { actorEmail: actor.email, tenantName: tenant.name },
      ipAddress: actor.ip,
    },
  });

  return ticket;
}

export function verifyImpersonationTicket(ticket: string): ImpersonationTicketPayload | null {
  try {
    const [json, sig] = ticket.split(".");
    if (!json || !sig) return null;
    if (!verify(json, sig)) return null;

    const payload: ImpersonationTicketPayload = JSON.parse(Buffer.from(json, "base64url").toString("utf-8"));
    if (Date.now() - payload.timestamp > TICKET_TTL_MS) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createImpersonationSessionCookie(payload: { tenantId: string; actorId: string; actorEmail: string }): string {
  const data: ImpersonationSessionPayload = {
    ...payload,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  const json = Buffer.from(JSON.stringify(data)).toString("base64url");
  const sig = sign(json);
  return `${json}.${sig}`;
}

export function verifyImpersonationSessionCookie(cookieValue: string): ImpersonationSessionPayload | null {
  try {
    const [json, sig] = cookieValue.split(".");
    if (!json || !sig) return null;
    if (!verify(json, sig)) return null;

    const payload: ImpersonationSessionPayload = JSON.parse(Buffer.from(json, "base64url").toString("utf-8"));
    if (Date.now() > payload.expiresAt) return null;
    return payload;
  } catch {
    return null;
  }
}
