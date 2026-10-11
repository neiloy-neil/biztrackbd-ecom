import type { StaffRole } from "@biztrackbd/db";
import { ForbiddenError } from "./errors";

/**
 * Who can do what. Areas and levels match the permission grid on the AdmStaff canvas (docs/07 section 20).
 *   billing = payments, domains, billing, and the integration keys (owner only, so a manager never sees secrets)
 *   team    = staff accounts, invites and the audit log
 */
export const AREAS = ["orders", "products", "customers", "marketing", "reports", "design", "billing", "team"] as const;
export type Area = (typeof AREAS)[number];

export type Level = "none" | "view" | "edit";
const RANK: Record<Level, number> = { none: 0, view: 1, edit: 2 };

const N = "none", V = "view", E = "edit";

/**
 * Canvas column to role: Manager = STORE_MANAGER, Staff = ORDER_PACKER, Support = TELEMARKETER.
 * CONTENT_EDITOR is not on the canvas yet: catalog and store design only.
 */
export const PERMISSIONS: Record<StaffRole, Record<Area, Level>> = {
  STORE_OWNER:    { orders: E, products: E, customers: E, marketing: E, reports: E, design: E, billing: E, team: E },
  STORE_MANAGER:  { orders: E, products: E, customers: E, marketing: E, reports: V, design: E, billing: N, team: N },
  ORDER_PACKER:   { orders: E, products: E, customers: V, marketing: N, reports: N, design: N, billing: N, team: N },
  TELEMARKETER:   { orders: V, products: V, customers: E, marketing: N, reports: N, design: N, billing: N, team: N },
  CONTENT_EDITOR: { orders: N, products: E, customers: N, marketing: N, reports: N, design: E, billing: N, team: N },
};

export const ROLE_LABELS: Record<StaffRole, string> = {
  STORE_OWNER: "Owner",
  STORE_MANAGER: "Manager",
  ORDER_PACKER: "Fulfilment staff",
  TELEMARKETER: "Support",
  CONTENT_EDITOR: "Content editor",
};

/** Roles an owner can hand out. There is exactly one owner per store. */
export const ASSIGNABLE_ROLES: StaffRole[] = ["STORE_MANAGER", "ORDER_PACKER", "TELEMARKETER", "CONTENT_EDITOR"];

export function levelOf(role: StaffRole, area: Area): Level {
  return PERMISSIONS[role]?.[area] ?? "none";
}

export function can(role: StaffRole, area: Area, level: Exclude<Level, "none"> = "view"): boolean {
  return RANK[levelOf(role, area)] >= RANK[level];
}

export interface StaffActor {
  userId: string;
  email: string;
  /** Display name for timelines. Falls back to the email. */
  name?: string;
  role: StaffRole;
  /** Request IP, recorded in the audit log when known. */
  ip?: string;
  /** When acting under Platform Super Admin impersonation (docs/12 section 3). */
  isImpersonator?: boolean;
  impersonatedBy?: string;
}

/** Throws unless the actor's role allows this. Call at the top of every admin action. */
export function assertCan(actor: StaffActor, area: Area, level: Exclude<Level, "none"> = "view"): void {
  if (!can(actor.role, area, level)) throw new ForbiddenError();
}
