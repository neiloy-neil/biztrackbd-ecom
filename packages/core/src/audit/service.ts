import { withTenant, type TenantTx } from "@biztrackbd/db";
import { assertCan, type StaffActor } from "../permissions";

/** Values under keys like these are never written to the log, even if a caller passes them by mistake. */
const SENSITIVE_KEY = /(secret|password|passwd|token|api_?key|cipher|authorization)/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, SENSITIVE_KEY.test(k) ? "[redacted]" : redact(v, depth + 1)]),
    );
  }
  if (typeof value === "string" && value.length > 500) return `${value.slice(0, 500)}…`;
  return value;
}

/**
 * Writes one audit entry. Pass the transaction of the change itself, so the change and its record commit together:
 * there is never a change without a log line, and a rolled-back change leaves no line.
 * Action names are "area.verb", for example "staff.invited" or "integration.saved".
 */
export async function audit(tx: TenantTx, tenantId: string, actor: Pick<StaffActor, "userId" | "email" | "ip">, action: string, details: Record<string, unknown> = {}): Promise<void> {
  await tx.auditLog.create({
    data: { tenantId, action, actorId: actor.userId, actorEmail: actor.email, details: redact(details) as object, ipAddress: actor.ip },
  });
}

export interface AuditQuery {
  /** Exact action or a prefix ending in ".", for example "staff." */
  action?: string;
  actorId?: string;
  limit?: number;
  /** Cursor: only entries older than this. */
  before?: Date;
}

export async function listAudit(tenantId: string, actor: StaffActor, q: AuditQuery = {}) {
  assertCan(actor, "team", "view");
  const take = Math.min(Math.max(q.limit ?? 50, 1), 200);
  return withTenant(tenantId, (tx) =>
    tx.auditLog.findMany({
      where: {
        ...(q.action ? (q.action.endsWith(".") ? { action: { startsWith: q.action } } : { action: q.action }) : {}),
        ...(q.actorId ? { actorId: q.actorId } : {}),
        ...(q.before ? { createdAt: { lt: q.before } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
    }),
  );
}
