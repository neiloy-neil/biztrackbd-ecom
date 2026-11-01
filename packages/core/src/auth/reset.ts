import { createHmac, timingSafeEqual } from "node:crypto";
import { getBasePrisma, getPlatformPrisma } from "@biztrackbd/db";
import { AuthFailure, issueEmailCode, type TokenSet } from "./supabase";
import { normalizeBdPhone } from "../phone";
import { currentSmsSender } from "../customers/auth";
import { sendSignInCode } from "../mail/send";

export interface StaffAccountOption {
  email: string;
  maskedEmail: string;
  phone: string | null;
  maskedPhone: string | null;
  storeNames: string[];
}

export interface StaffResetTarget {
  email: string;
  phone: string | null;
  maskedEmail: string;
  maskedPhone: string | null;
  availableChannels: ("email" | "sms")[];
  storeNames?: string[];
  multipleAccounts?: StaffAccountOption[];
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

interface StaffResetLookupRow {
  account_email: string;
  account_phone: string | null;
  store_name: string;
  tenant_status: string;
  subdomain: string;
  user_name: string;
  role: string;
  is_active: boolean;
}

/**
 * Searches for a staff member or store owner by email or phone.
 * Uses a SECURITY DEFINER Postgres RPC (staff_reset_lookup) to safely bypass
 * Row Level Security before a tenant session has been established.
 * Supports multi-account disambiguation when a single phone number links to multiple merchant accounts.
 * Returns canonical email, registered phone, available delivery channels, and associated store names.
 */
export async function findStaffResetTarget(identifier: string): Promise<StaffResetTarget | null> {
  const raw = identifier.trim();
  if (!raw) return null;

  try {
    const rows = await getBasePrisma().$queryRaw<StaffResetLookupRow[]>`SELECT * FROM staff_reset_lookup(${raw})`;
    if (rows && rows.length > 0) {
      const accountMap = new Map<string, { email: string; phone: string | null; storeNames: Set<string> }>();

      for (const r of rows) {
        if (!r.account_email) continue;
        const emailKey = r.account_email.trim().toLowerCase();
        if (!accountMap.has(emailKey)) {
          accountMap.set(emailKey, {
            email: emailKey,
            phone: null,
            storeNames: new Set<string>(),
          });
        }
        const acc = accountMap.get(emailKey)!;
        if (r.store_name) {
          acc.storeNames.add(r.store_name);
        }
        if (!acc.phone && r.account_phone) {
          try {
            acc.phone = normalizeBdPhone(r.account_phone);
          } catch {
            // ignore unparseable phone
          }
        }
      }

      if (accountMap.size > 0) {
        const accounts: StaffAccountOption[] = Array.from(accountMap.values()).map((acc) => ({
          email: acc.email,
          maskedEmail: maskEmail(acc.email),
          phone: acc.phone,
          maskedPhone: acc.phone ? maskPhone(acc.phone) : null,
          storeNames: Array.from(acc.storeNames),
        }));

        // Disambiguate if multiple accounts share this phone number (and query wasn't an email)
        if (accounts.length > 1 && !raw.includes("@")) {
          return {
            email: accounts[0]!.email,
            phone: accounts[0]!.phone,
            maskedEmail: accounts[0]!.maskedEmail,
            maskedPhone: accounts[0]!.maskedPhone,
            availableChannels: ["sms", "email"],
            storeNames: accounts[0]!.storeNames,
            multipleAccounts: accounts,
          };
        }

        const target = accounts[0]!;
        const availableChannels: ("email" | "sms")[] = ["email"];
        if (target.phone) {
          availableChannels.push("sms");
        }

        return {
          email: target.email,
          phone: target.phone,
          maskedEmail: target.maskedEmail,
          maskedPhone: target.maskedPhone,
          availableChannels,
          storeNames: target.storeNames,
        };
      }
    }
  } catch (err) {
    console.error("staff_reset_lookup RPC failed, attempting platform fallback", err);
  }

  // Fallback for isolated unit tests or non-RPC connections
  const db = getPlatformPrisma();

  // 1. Try resolving as Bangladeshi phone number
  let normalizedPhone: string | null = null;
  try {
    normalizedPhone = normalizeBdPhone(raw);
  } catch {
    normalizedPhone = null;
  }

  if (normalizedPhone) {
    const phoneVariants = [normalizedPhone, `+88${normalizedPhone}`, `88${normalizedPhone}`];

    const [staffUsers, ownedTenants] = await Promise.all([
      db.tenantUser.findMany({
        where: {
          phone: { in: phoneVariants },
          isActive: true,
        },
        select: {
          email: true,
          phone: true,
          tenant: { select: { id: true, name: true, status: true } },
        },
      }),
      db.tenant.findMany({
        where: {
          ownerPhone: { in: phoneVariants },
          status: { not: "CANCELLED" },
        },
        select: {
          id: true,
          name: true,
          ownerEmail: true,
          ownerPhone: true,
        },
      }),
    ]);

    const accountMap = new Map<string, { email: string; phone: string | null; storeNames: Set<string> }>();

    for (const u of staffUsers) {
      if (!u.email) continue;
      const emailKey = u.email.trim().toLowerCase();
      if (!accountMap.has(emailKey)) {
        accountMap.set(emailKey, {
          email: emailKey,
          phone: normalizedPhone,
          storeNames: new Set<string>(),
        });
      }
      if (u.tenant?.name && u.tenant.status !== "CANCELLED") {
        accountMap.get(emailKey)!.storeNames.add(u.tenant.name);
      }
    }

    for (const t of ownedTenants) {
      if (!t.ownerEmail) continue;
      const emailKey = t.ownerEmail.trim().toLowerCase();
      if (!accountMap.has(emailKey)) {
        accountMap.set(emailKey, {
          email: emailKey,
          phone: normalizedPhone,
          storeNames: new Set<string>(),
        });
      }
      if (t.name) {
        accountMap.get(emailKey)!.storeNames.add(t.name);
      }
    }

    if (accountMap.size === 0) return null;

    const accounts: StaffAccountOption[] = Array.from(accountMap.values()).map((acc) => ({
      email: acc.email,
      maskedEmail: maskEmail(acc.email),
      phone: normalizedPhone,
      maskedPhone: maskPhone(normalizedPhone!),
      storeNames: Array.from(acc.storeNames),
    }));

    if (accounts.length === 1) {
      const single = accounts[0]!;
      return {
        email: single.email,
        phone: normalizedPhone,
        maskedEmail: single.maskedEmail,
        maskedPhone: single.maskedPhone,
        availableChannels: ["sms", "email"],
        storeNames: single.storeNames,
      };
    }

    return {
      email: accounts[0]!.email,
      phone: normalizedPhone,
      maskedEmail: accounts[0]!.maskedEmail,
      maskedPhone: accounts[0]!.maskedPhone,
      availableChannels: ["sms", "email"],
      storeNames: accounts[0]!.storeNames,
      multipleAccounts: accounts,
    };
  }

  // 2. Lookup by email
  if (raw.includes("@")) {
    const emailCandidate = raw.trim().toLowerCase();

    const [staffUsers, ownedTenants] = await Promise.all([
      db.tenantUser.findMany({
        where: {
          email: { equals: emailCandidate, mode: "insensitive" },
          isActive: true,
        },
        select: {
          email: true,
          phone: true,
          tenant: { select: { id: true, name: true, status: true } },
        },
      }),
      db.tenant.findMany({
        where: {
          ownerEmail: { equals: emailCandidate, mode: "insensitive" },
          status: { not: "CANCELLED" },
        },
        select: {
          id: true,
          name: true,
          ownerEmail: true,
          ownerPhone: true,
        },
      }),
    ]);

    if (staffUsers.length === 0 && ownedTenants.length === 0) return null;

    let foundPhone: string | null = null;
    const storeNames = new Set<string>();

    for (const u of staffUsers) {
      if (u.tenant?.name && u.tenant.status !== "CANCELLED") {
        storeNames.add(u.tenant.name);
      }
      if (!foundPhone && u.phone) {
        try {
          foundPhone = normalizeBdPhone(u.phone);
        } catch {
          // ignore invalid phone
        }
      }
    }

    for (const t of ownedTenants) {
      if (t.name) {
        storeNames.add(t.name);
      }
      if (!foundPhone && t.ownerPhone) {
        try {
          foundPhone = normalizeBdPhone(t.ownerPhone);
        } catch {
          // ignore invalid phone
        }
      }
    }

    const availableChannels: ("email" | "sms")[] = ["email"];
    if (foundPhone) {
      availableChannels.push("sms");
    }

    return {
      email: emailCandidate,
      phone: foundPhone,
      maskedEmail: maskEmail(emailCandidate),
      maskedPhone: foundPhone ? maskPhone(foundPhone) : null,
      availableChannels,
      storeNames: Array.from(storeNames),
    };
  }

  return null;
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
