import { createHmac, timingSafeEqual } from "node:crypto";
import { getBasePrisma } from "@biztrackbd/db";
import { AuthFailure, issueEmailCode, type TokenSet } from "./supabase";
import { normalizeBdPhone } from "../phone";
import { currentSmsSender } from "../customers/auth";
import { sendSignInCode } from "../mail/send";

export interface StaffResetTarget {
  email: string;
  phone: string | null;
  maskedEmail: string;
  maskedPhone: string | null;
  availableChannels: ("email" | "sms")[];
}

export function maskEmail(email: string): string {
  const clean = email.trim().toLowerCase();
  const [local, domain] = clean.split("@");
  if (!local || !domain) return clean;
  if (local.length <= 2) {
    return `${local[0]}*@${domain}`;
  }
  const first = local[0];
  const last = local[local.length - 1];
  const middle = "*".repeat(Math.min(local.length - 2, 4));
  return `${first}${middle}${last}@${domain}`;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 11) {
    const p = digits.slice(-11);
    return `${p.slice(0, 3)}****${p.slice(-4)}`;
  }
  if (digits.length >= 7) {
    return `${digits.slice(0, 3)}***${digits.slice(-2)}`;
  }
  return digits;
}

/**
 * Searches for a staff member or store owner by email or phone.
 * Returns their canonical email, registered phone, and available delivery channels.
 */
export async function findStaffResetTarget(identifier: string): Promise<StaffResetTarget | null> {
  const raw = identifier.trim();
  if (!raw) return null;

  const db = getBasePrisma();
  let foundEmail: string | null = null;
  let foundPhone: string | null = null;

  // 1. Try resolving as Bangladeshi phone number first
  let normalizedPhone: string | null = null;
  try {
    normalizedPhone = normalizeBdPhone(raw);
  } catch {
    normalizedPhone = null;
  }

  if (normalizedPhone) {
    const phoneVariants = [normalizedPhone, `+88${normalizedPhone}`, `88${normalizedPhone}`];
    // Check TenantUser
    const staffUser = await db.tenantUser.findFirst({
      where: {
        phone: { in: phoneVariants },
        isActive: true,
      },
      select: { email: true, phone: true },
    });

    if (staffUser?.email) {
      foundEmail = staffUser.email.trim().toLowerCase();
      foundPhone = normalizedPhone;
    } else {
      // Check Tenant owner phone
      const tenant = await db.tenant.findFirst({
        where: {
          ownerPhone: { in: phoneVariants },
          status: { not: "CANCELLED" },
        },
        select: { ownerEmail: true, ownerPhone: true },
      });
      if (tenant?.ownerEmail) {
        foundEmail = tenant.ownerEmail.trim().toLowerCase();
        foundPhone = normalizedPhone;
      }
    }
  }

  // 2. If not found by phone, check by email
  if (!foundEmail && raw.includes("@")) {
    const emailCandidate = raw.toLowerCase();
    const staffUser = await db.tenantUser.findFirst({
      where: {
        email: { equals: emailCandidate, mode: "insensitive" },
        isActive: true,
      },
      select: { email: true, phone: true },
    });

    if (staffUser) {
      foundEmail = staffUser.email.trim().toLowerCase();
      if (staffUser.phone) {
        try {
          foundPhone = normalizeBdPhone(staffUser.phone);
        } catch {
          foundPhone = null;
        }
      }
    } else {
      const tenant = await db.tenant.findFirst({
        where: {
          ownerEmail: { equals: emailCandidate, mode: "insensitive" },
          status: { not: "CANCELLED" },
        },
        select: { ownerEmail: true, ownerPhone: true },
      });
      if (tenant) {
        foundEmail = tenant.ownerEmail?.trim().toLowerCase() ?? null;
        if (tenant.ownerPhone) {
          try {
            foundPhone = normalizeBdPhone(tenant.ownerPhone);
          } catch {
            foundPhone = null;
          }
        }
      }
    }

    // If staff user was found by email but had no phone in TenantUser, check if they own a tenant with ownerPhone
    if (foundEmail && !foundPhone) {
      const tenant = await db.tenant.findFirst({
        where: {
          ownerEmail: { equals: foundEmail, mode: "insensitive" },
          status: { not: "CANCELLED" },
        },
        select: { ownerPhone: true },
      });
      if (tenant?.ownerPhone) {
        try {
          foundPhone = normalizeBdPhone(tenant.ownerPhone);
        } catch {
          foundPhone = null;
        }
      }
    }
  }

  if (!foundEmail) return null;

  const availableChannels: ("email" | "sms")[] = ["email"];
  if (foundPhone) {
    availableChannels.push("sms");
  }

  return {
    email: foundEmail,
    phone: foundPhone,
    maskedEmail: maskEmail(foundEmail),
    maskedPhone: foundPhone ? maskPhone(foundPhone) : null,
    availableChannels,
  };
}

/**
 * Dispatches a password reset OTP code via the chosen channel (Email or SMS).
 */
export async function sendStaffResetOtp(
  target: { email: string; phone?: string | null },
  channel: "email" | "sms"
): Promise<{ success: boolean; channel: "email" | "sms"; maskedDestination: string }> {
  const email = target.email.trim().toLowerCase();

  if (channel === "sms") {
    let phone = target.phone?.trim();
    if (!phone) {
      // Re-lookup target phone if not passed directly
      const resolved = await findStaffResetTarget(email);
      phone = resolved?.phone ?? undefined;
    }
    if (!phone) {
      throw new AuthFailure("NOT_CONFIGURED", "No mobile phone number is registered on this account.");
    }
    const normalized = normalizeBdPhone(phone);

    // Issue OTP code from Supabase
    const code = await issueEmailCode(email);
    if (!code) {
      throw new AuthFailure("UNAVAILABLE", "Could not generate OTP code. Please try again.");
    }

    const message = `Your BizTrackBD password reset code is: ${code}. Valid for 5 minutes. Do not share this OTP.`;
    await currentSmsSender().send("platform", normalized, message);

    return {
      success: true,
      channel: "sms",
      maskedDestination: maskPhone(normalized),
    };
  }

  // Email channel
  await sendSignInCode(email, "en");
  return {
    success: true,
    channel: "email",
    maskedDestination: maskEmail(email),
  };
}

const TICKET_SECRET = (): string => {
  const s = process.env.CUSTOMER_AUTH_SECRET || process.env.SIGNUP_SECRET || process.env.COOKIE_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV !== "production") return "dev-reset-ticket-secret-minimum-32-chars-long";
  throw new Error("CUSTOMER_AUTH_SECRET or SIGNUP_SECRET must be set to at least 32 characters in production.");
};

const signPayload = (body: string) => createHmac("sha256", TICKET_SECRET()).update(body).digest("base64url");

/**
 * Creates a signed, tamper-proof reset ticket holding the verified access token.
 * Valid for 10 minutes, allowing the merchant to enter & confirm their new password without re-asking for OTP.
 */
export function createPasswordResetTicket(tokens: TokenSet, email: string): string {
  const payload = {
    e: email.trim().toLowerCase(),
    at: tokens.accessToken,
    rt: tokens.refreshToken,
    expAt: tokens.expiresAt,
    uid: tokens.userId,
    aal: tokens.aal,
    exp: Date.now() + 10 * 60_000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${signPayload(body)}`;
}

/**
 * Validates the reset ticket and returns the verified session tokens.
 */
export function verifyPasswordResetTicket(ticket: string): TokenSet | null {
  try {
    const [body, sig] = ticket.split(".");
    if (!body || !sig) return null;
    const want = Buffer.from(signPayload(body));
    const got = Buffer.from(sig);
    if (want.length !== got.length || !timingSafeEqual(want, got)) return null;

    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf-8")) as {
      e: string;
      at: string;
      rt: string;
      expAt: number;
      uid: string;
      aal?: "aal1" | "aal2";
      exp: number;
    };

    if (Date.now() > data.exp || !data.at || !data.e) return null;
    return {
      accessToken: data.at,
      refreshToken: data.rt,
      expiresAt: data.expAt || Math.floor((Date.now() + 3600_000) / 1000),
      userId: data.uid,
      email: data.e,
      aal: data.aal || "aal1",
    };
  } catch {
    return null;
  }
}
