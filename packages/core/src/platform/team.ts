import { getPlatformPrisma, type PrismaClient } from "@biztrackbd/db";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors";
import type { PlatformActor, PlatformRole } from "./admin";

export interface PlatformUserView {
  id: string;
  email: string;
  name: string;
  role: PlatformRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  authUserId: string | null;
  createdAt: Date;
}

export interface Deps {
  db?: PrismaClient;
}

const dbOf = (d?: Deps) => d?.db ?? getPlatformPrisma();

function assertPlatformOwner(actor: PlatformActor): void {
  if (actor.role !== "OWNER") {
    throw new ForbiddenError();
  }
}

/**
 * List all platform team members.
 */
export async function listPlatformUsers(actor: PlatformActor, deps?: Deps): Promise<PlatformUserView[]> {
  const db = dbOf(deps);
  const rows = await db.platformUser.findMany({
    orderBy: { createdAt: "asc" },
  });

  return rows.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as PlatformRole,
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt,
    authUserId: u.authUserId,
    createdAt: u.createdAt,
  }));
}

/**
 * Invite / create a new platform staff member.
 */
export async function invitePlatformUser(
  actor: PlatformActor,
  input: { email: string; name: string; role: PlatformRole },
  deps?: Deps,
): Promise<PlatformUserView> {
  assertPlatformOwner(actor);
  const db = dbOf(deps);

  const cleanEmail = input.email.trim().toLowerCase();
  const cleanName = input.name.trim();

  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new ValidationError("Valid email address required.");
  }
  if (!cleanName || cleanName.length < 2) {
    throw new ValidationError("Full name is required.");
  }

  const existing = await db.platformUser.findUnique({ where: { email: cleanEmail } });
  if (existing) {
    throw new ValidationError(`Staff user with email "${cleanEmail}" already exists.`);
  }

  const user = await db.platformUser.create({
    data: {
      email: cleanEmail,
      name: cleanName,
      role: input.role,
      isActive: true,
    },
  });

  await db.platformAuditLog.create({
    data: {
      actorId: actor.id,
      action: "PLATFORM_USER_INVITED",
      details: { email: cleanEmail, name: cleanName, role: input.role },
      ipAddress: actor.ip ?? null,
    },
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as PlatformRole,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    authUserId: user.authUserId,
    createdAt: user.createdAt,
  };
}

/**
 * Update staff role.
 */
export async function updatePlatformUserRole(
  actor: PlatformActor,
  userId: string,
  newRole: PlatformRole,
  deps?: Deps,
): Promise<{ ok: true }> {
  assertPlatformOwner(actor);
  const db = dbOf(deps);

  const user = await db.platformUser.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError("Staff user not found.");

  // Guard: if user is current OWNER and changing role, make sure another active OWNER exists
  if (user.role === "OWNER" && newRole !== "OWNER") {
    const ownerCount = await db.platformUser.count({ where: { role: "OWNER", isActive: true } });
    if (ownerCount <= 1) {
      throw new ValidationError("Cannot demote the sole active platform Owner.");
    }
  }

  await db.platformUser.update({
    where: { id: userId },
    data: { role: newRole },
  });

  await db.platformAuditLog.create({
    data: {
      actorId: actor.id,
      action: "PLATFORM_USER_ROLE_CHANGED",
      details: { targetUserId: userId, oldRole: user.role, newRole },
      ipAddress: actor.ip ?? null,
    },
  });

  return { ok: true };
}

/**
 * Toggle staff active status.
 */
export async function togglePlatformUserActive(
  actor: PlatformActor,
  userId: string,
  deps?: Deps,
): Promise<{ ok: true; isActive: boolean }> {
  assertPlatformOwner(actor);
  const db = dbOf(deps);

  const user = await db.platformUser.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError("Staff user not found.");

  // Guard: cannot deactivate oneself or the sole active owner
  if (user.id === actor.id) {
    throw new ValidationError("You cannot deactivate your own platform administrator account.");
  }

  if (user.role === "OWNER" && user.isActive) {
    const ownerCount = await db.platformUser.count({ where: { role: "OWNER", isActive: true } });
    if (ownerCount <= 1) {
      throw new ValidationError("Cannot deactivate the sole active platform Owner.");
    }
  }

  const nextState = !user.isActive;

  await db.platformUser.update({
    where: { id: userId },
    data: { isActive: nextState },
  });

  await db.platformAuditLog.create({
    data: {
      actorId: actor.id,
      action: nextState ? "PLATFORM_USER_ACTIVATED" : "PLATFORM_USER_DEACTIVATED",
      details: { targetUserId: userId, email: user.email },
      ipAddress: actor.ip ?? null,
    },
  });

  return { ok: true, isActive: nextState };
}
