import { assertNotInDemo } from "../demo/guard";
import { createHash, randomBytes } from "node:crypto";
import { Prisma, getBasePrisma, withTenant, type StaffRole, type TenantTx } from "@biztrackbd/db";
import { z } from "zod";
import { audit } from "../audit/service";
import { AuthFailure, adminCreateUser, adminDeleteUser, signInWithPassword } from "../auth/supabase";
import { NotFoundError, PlanLimitError, ValidationError } from "../errors";
import { getPlanLimits } from "../limits/plan";
import { ASSIGNABLE_ROLES, assertCan, type StaffActor } from "../permissions";

const INVITE_TTL_MS = 7 * 24 * 3_600_000;
/** Sign-in credentials come from Supabase Auth in the next step. Until then accepted staff have no usable password. */
const EXTERNAL_AUTH = "EXTERNAL_AUTH";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const INVALID_INVITE = "This invite is not valid any more. Ask the store owner to send a new one.";

const InviteInput = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  role: z.enum(ASSIGNABLE_ROLES as [StaffRole, ...StaffRole[]]),
});

/** Serialises staff changes for one store, so two invites cannot both take the last seat. */
async function lockTenant(tx: TenantTx, tenantId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Tenant" WHERE "id" = ${tenantId} FOR UPDATE`;
}

/** Seats in use: active accounts plus invites that are still open. */
async function seatsUsed(tx: TenantTx): Promise<number> {
  const users = await tx.tenantUser.count({ where: { isActive: true } });
  const invites = await tx.staffInvite.count({ where: { acceptedAt: null, expiresAt: { gt: new Date() } } });
  return users + invites;
}

async function assertSeatFree(tx: TenantTx) {
  const { staff: limit } = await getPlanLimits(tx);
  if (limit == null) return;
  const used = await seatsUsed(tx);
  if (used >= limit) throw new PlanLimitError("staff", limit, used);
}

export interface InviteResult {
  inviteId: string;
  /** Shown once. Only its hash is stored, so it cannot be recovered later. Send it in the invite link. */
  token: string;
  expiresAt: Date;
}

export async function inviteStaff(tenantId: string, actor: StaffActor, rawInput: { email: string; role: string }): Promise<InviteResult> {
  await assertNotInDemo(tenantId, "Managing the team");
  assertCan(actor, "team", "edit");
  const parsed = InviteInput.safeParse(rawInput);
  if (!parsed.success) throw new ValidationError("Enter a valid email and choose a role", { issues: parsed.error.issues });
  const { email, role } = parsed.data;

  return withTenant(tenantId, async (tx) => {
    await lockTenant(tx, tenantId);
    const existing = await tx.tenantUser.findFirst({ where: { email } });
    if (existing) {
      throw new ValidationError(existing.isActive ? "That person is already on your team" : "That person has an inactive account. Reactivate it instead.");
    }
    // A new invite replaces any open one for the same email.
    await tx.staffInvite.deleteMany({ where: { email, acceptedAt: null } });
    await assertSeatFree(tx);

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    const invite = await tx.staffInvite.create({
      data: { tenantId, email, role, tokenHash: sha256(token), invitedBy: actor.userId, expiresAt },
    });
    await audit(tx, tenantId, actor, "staff.invited", { email, role });
    return { inviteId: invite.id, token, expiresAt };
  });
}

export async function revokeInvite(tenantId: string, actor: StaffActor, inviteId: string): Promise<void> {
  await assertNotInDemo(tenantId, "Managing the team");
  assertCan(actor, "team", "edit");
  await withTenant(tenantId, async (tx) => {
    const inv = await tx.staffInvite.findFirst({ where: { id: inviteId, acceptedAt: null } });
    if (!inv) throw new NotFoundError("Invite");
    await tx.staffInvite.delete({ where: { id: inviteId } });
    await audit(tx, tenantId, actor, "staff.invite_revoked", { email: inv.email, role: inv.role });
  });
}

/** Read-only look at an invite for the accept page. Returns null for unknown, used or expired links. */
export async function previewInvite(token: string): Promise<{ email: string; role: StaffRole; storeName: string } | null> {
  const row = await lookupInvite(token);
  return row ? { email: row.email, role: row.role, storeName: row.storeName } : null;
}

async function lookupInvite(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const rows = await getBasePrisma().$queryRaw<
    { id: string; tenantId: string; email: string; role: StaffRole; expiresAt: Date; acceptedAt: Date | null; storeName: string }[]
  >`SELECT * FROM resolve_invite_by_token_hash(${sha256(token)})`;
  const r = rows[0];
  if (!r || r.acceptedAt || r.expiresAt.getTime() < Date.now()) return null;
  return r;
}

/**
 * Turns an invite into a staff account. One-time: the claim is a single conditional UPDATE, so two people (or two
 * clicks) opening the same link cannot both get in.
 */
export async function acceptInvite(token: string, input: { name: string; phone?: string; password?: string }) {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 120) throw new ValidationError("Enter your name");
  const invite = await lookupInvite(token);
  if (!invite) throw new ValidationError(INVALID_INVITE);

  // With a password, the person gets a real sign-in. The invite link itself proves they control the email (the owner sent it
  // there), so the account is made confirmed. If the address already has an account (they work for another store too), they
  // must give that account's password: an invite never lets anyone take over an existing account.
  let authUserId: string | null = null;
  let createdAuth = false;
  if (input.password !== undefined) {
    try {
      authUserId = (await adminCreateUser(invite.email, input.password, { confirmed: true })).id;
      createdAuth = true;
    } catch (e) {
      if (!(e instanceof AuthFailure)) throw e;
      if (e.code === "WEAK_PASSWORD") throw new ValidationError(e.message, { field: "password" });
      if (e.code !== "EXISTS") throw new ValidationError("We could not set up your sign-in. Please try the link again in a minute.");
      try {
        authUserId = (await signInWithPassword(invite.email, input.password)).userId;
      } catch {
        throw new ValidationError(`There is already an account for ${invite.email}. Enter that account's password to join this store.`, { field: "password" });
      }
    }
  }

  try {
    return await withTenant(invite.tenantId, async (tx) => {
      await lockTenant(tx, invite.tenantId);
      const claimed = await tx.staffInvite.updateMany({
        where: { id: invite.id, acceptedAt: null, expiresAt: { gt: new Date() } },
        data: { acceptedAt: new Date() },
      });
      if (claimed.count === 0) throw new ValidationError(INVALID_INVITE);
      const user = await tx.tenantUser.create({
        data: { tenantId: invite.tenantId, email: invite.email, name, phone: input.phone, role: invite.role, passwordHash: EXTERNAL_AUTH, authUserId },
      });
      await audit(tx, invite.tenantId, { userId: user.id, email: user.email }, "staff.joined", { role: invite.role });
      return { userId: user.id, tenantId: invite.tenantId, role: invite.role };
    });
  } catch (e) {
    // Another click won the invite: do not leave an account we just made behind.
    if (createdAuth && authUserId) await adminDeleteUser(authUserId).catch(() => undefined);
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ValidationError(INVALID_INVITE);
    throw e;
  }
}

async function targetUser(tx: TenantTx, actor: StaffActor, userId: string) {
  const user = await tx.tenantUser.findFirst({ where: { id: userId } });
  if (!user) throw new NotFoundError("Team member");
  if (user.role === "STORE_OWNER") throw new ValidationError("The store owner cannot be changed");
  if (user.id === actor.userId) throw new ValidationError("You cannot change your own access");
  return user;
}

export async function changeStaffRole(tenantId: string, actor: StaffActor, userId: string, newRole: string): Promise<void> {
  await assertNotInDemo(tenantId, "Managing the team");
  assertCan(actor, "team", "edit");
  const parsed = InviteInput.shape.role.safeParse(newRole);
  if (!parsed.success) throw new ValidationError("Choose a valid role");
  await withTenant(tenantId, async (tx) => {
    const user = await targetUser(tx, actor, userId);
    if (user.role === parsed.data) return;
    await tx.tenantUser.update({ where: { id: userId }, data: { role: parsed.data } });
    await audit(tx, tenantId, actor, "staff.role_changed", { email: user.email, from: user.role, to: parsed.data });
  });
}

export async function setStaffActive(tenantId: string, actor: StaffActor, userId: string, active: boolean): Promise<void> {
  await assertNotInDemo(tenantId, "Managing the team");
  assertCan(actor, "team", "edit");
  await withTenant(tenantId, async (tx) => {
    await lockTenant(tx, tenantId);
    const user = await targetUser(tx, actor, userId);
    if (user.isActive === active) return;
    if (active) await assertSeatFree(tx);
    await tx.tenantUser.update({ where: { id: userId }, data: { isActive: active } });
    await audit(tx, tenantId, actor, active ? "staff.reactivated" : "staff.deactivated", { email: user.email, role: user.role });
  });
}

export interface TeamView {
  members: { id: string; name: string; email: string; role: StaffRole; isActive: boolean; lastLoginAt: Date | null }[];
  invites: { id: string; email: string; role: StaffRole; expiresAt: Date; expired: boolean }[];
  seats: { used: number; limit: number | null };
}

export async function listTeam(tenantId: string, actor: StaffActor): Promise<TeamView> {
  assertCan(actor, "team", "view");
  return withTenant(tenantId, async (tx) => {
    const members = await tx.tenantUser.findMany({ orderBy: [{ role: "asc" }, { createdAt: "asc" }], select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true } });
    const invites = await tx.staffInvite.findMany({ where: { acceptedAt: null }, orderBy: { createdAt: "desc" } });
    const plan = await getPlanLimits(tx);
    const used = await seatsUsed(tx);
    const now = Date.now();
    return {
      members,
      invites: invites.map((i) => ({ id: i.id, email: i.email, role: i.role, expiresAt: i.expiresAt, expired: i.expiresAt.getTime() < now })),
      seats: { used, limit: plan.staff },
    };
  });
}
