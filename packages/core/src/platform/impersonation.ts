import { createHmac, timingSafeEqual } from "crypto";
import { getPlatformPrisma, type PrismaClient } from "@biztrackbd/db";
import { ValidationError } from "../errors";
import { assertPlatformCan, type PlatformActor } from "./admin";

// Dev/test only: never used when NODE_ENV is "production".
const DEV_SECRET = "dev-only-impersonation-secret-not-for-production";
const MIN_SECRET_LENGTH = 32;
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

// Resolved lazily so importing this module never throws; signing and verifying do.
function getSecret(): string {
  const secret = process.env.IMPERSONATION_SECRET || process.env.COOKIE_SECRET;
  if (process.env.NODE_ENV !== "production") return secret || DEV_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `IMPERSONATION_SECRET (or COOKIE_SECRET) must be set to at least ${MIN_SECRET_LENGTH} characters in production. It must be the same value in the admin and platform projects.`,
    );
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
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
  getSecret(); // misconfiguration must throw, not read as "invalid ticket"
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
  getSecret(); // misconfiguration must throw, not read as "invalid cookie"
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

export interface OnboardingPassPayload {
  tenantId: string;
  subdomain: string;
  ownerEmail: string;
  ownerName: string;
  timestamp: number;
}

const ONBOARDING_PASS_TTL_MS = 15 * 60_000; // 15 minutes

/** Generates a secure, signed 1-time onboarding pass ticket for a newly created store. */
export function createOnboardingPassTicket(payload: { tenantId: string; subdomain: string; ownerEmail: string; ownerName: string }): string {
  getSecret();
  const data: OnboardingPassPayload = {
    ...payload,
    timestamp: Date.now(),
  };
  const json = Buffer.from(JSON.stringify(data)).toString("base64url");
  const sig = sign(json);
  return `${json}.${sig}`;
}

/** Verifies a 1-time onboarding pass ticket. Returns null if invalid or expired. */
export function verifyOnboardingPassTicket(ticket: string): OnboardingPassPayload | null {
  getSecret();
  try {
    const [json, sig] = ticket.split(".");
    if (!json || !sig) return null;
    if (!verify(json, sig)) return null;

    const payload: OnboardingPassPayload = JSON.parse(Buffer.from(json, "base64url").toString("utf-8"));
    if (Date.now() - payload.timestamp > ONBOARDING_PASS_TTL_MS) return null;
    return payload;
  } catch {
    return null;
  }
}
