import { headers } from "next/headers";
import {
  getUserFromToken,
  platformMemberFor,
  type AuthUser,
  type PlatformActor,
  type PlatformMember,
  type PlatformRole,
} from "@biztrackbd/core";
import { getPlatformPrisma } from "@biztrackbd/db";
import { authMode } from "@/lib/auth";

export interface PlatformMobileSession {
  user: {
    id: string;
    name: string;
    email: string;
    role: PlatformRole;
  };
  member: PlatformMember;
  actor: PlatformActor;
}

export interface PlatformMobileAuthResult {
  session: PlatformMobileSession | null;
  error?: string;
  status: number;
}

/**
 * Resolves authentication for native mobile requests to platform.biztrack.bd.
 * Expects `Authorization: Bearer <token>`.
 */
export async function getPlatformMobileSession(req?: Request): Promise<PlatformMobileAuthResult> {
  const reqHeaders = req ? req.headers : await headers();
  const authHeader = reqHeaders.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const clientIp = reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();

  // 1. Dev auth bypass when DEV_AUTH=1 or dev-token supplied
  if (authMode() === "dev" || token === "dev-token" || token.startsWith("dev-")) {
    try {
      const db = getPlatformPrisma();
      const devEmail = reqHeaders.get("x-dev-user");
      const user =
        (devEmail ? await db.platformUser.findFirst({ where: { email: devEmail, isActive: true } }) : null) ??
        (await db.platformUser.findFirst({ where: { role: "OWNER", isActive: true } })) ??
        (await db.platformUser.findFirst({ where: { isActive: true } }));

      if (!user) {
        return { session: null, error: "No active platform user found for demo mode.", status: 404 };
      }

      const role = user.role as PlatformRole;
      return {
        session: {
          user: { id: user.id, name: user.name, email: user.email, role },
          member: { id: user.id, email: user.email, name: user.name, role, isActive: user.isActive },
          actor: { id: user.id, email: user.email, role, ip: clientIp },
        },
        status: 200,
      };
    } catch (err: any) {
      return { session: null, error: err?.message || "Dev session resolution error", status: 500 };
    }
  }

  // 2. Production token validation
  if (!token) {
    return { session: null, error: "Missing authorization token.", status: 401 };
  }

  try {
    const user = await getUserFromToken(token);
    if (!user || !user.emailConfirmed) {
      return { session: null, error: "Invalid or expired session token.", status: 401 };
    }

    const member = await platformMemberFor(user);
    if (!member || !member.isActive) {
      return { session: null, error: "Access denied: Account is not an active platform admin.", status: 403 };
    }

    return {
      session: {
        user: { id: member.id, name: member.name, email: member.email, role: member.role },
        member,
        actor: { id: member.id, email: member.email, role: member.role, ip: clientIp },
      },
      status: 200,
    };
  } catch (err: any) {
    return { session: null, error: err?.message || "Authentication verification failed.", status: 401 };
  }
}
