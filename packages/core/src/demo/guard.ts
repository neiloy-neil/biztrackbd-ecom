import { withTenant, type TenantTx } from "@biztrackbd/db";
import { DemoLockedError, DemoStoreError } from "../errors";

/** True for a template demo store (docs/38). Reads the current tenant, so call it inside withTenant. */
export async function isDemoStore(tx: TenantTx): Promise<boolean> {
  return (await tx.tenant.findFirst({ select: { isDemo: true } }))?.isDemo === true;
}

/** A public template demo store (docs/38), not a visitor's private copy (docs/41). Call inside withTenant. */
export async function isTemplateDemo(tx: TenantTx): Promise<boolean> {
  return (await tx.tenant.findFirst({ select: { demoKind: true, isDemo: true } }).then((t) => t?.demoKind === "TEMPLATE" || (t?.isDemo === true && t.demoKind == null))) === true;
}

/** A visitor's private demo copy: a real, working admin whose messages, couriers and account settings are simulated or locked. Call inside withTenant. */
export async function isDemoSession(tx: TenantTx): Promise<boolean> {
  return (await tx.tenant.findFirst({ select: { demoKind: true } }))?.demoKind === "SESSION";
}

const demoCache = new Map<string, { at: number; demo: boolean }>();

/** Whether a store is any kind of demo, looked up by id (for senders that only know the store). Remembered for a minute. */
export async function isDemoTenantId(tenantId: string): Promise<boolean> {
  const hit = demoCache.get(tenantId);
  if (hit && Date.now() - hit.at < 60_000) return hit.demo;
  const demo = await withTenant(tenantId, (tx) => isDemoStore(tx)).catch(() => false);
  if (demoCache.size > 500) demoCache.clear();
  demoCache.set(tenantId, { at: Date.now(), demo });
  return demo;
}

/** Whether a store is a visitor's private demo copy, by id. Remembered for a minute. */
const sessionCache = new Map<string, { at: number; demo: boolean }>();
export async function isDemoSessionId(tenantId: string): Promise<boolean> {
  const hit = sessionCache.get(tenantId);
  if (hit && Date.now() - hit.at < 60_000) return hit.demo;
  const demo = await withTenant(tenantId, (tx) => isDemoSession(tx)).catch(() => false);
  if (sessionCache.size > 500) sessionCache.clear();
  sessionCache.set(tenantId, { at: Date.now(), demo });
  return demo;
}

/** Stops a write that a public demo store must refuse: a real order from a stranger. A visitor's private copy takes orders, so they can practise. */
export async function assertTakesOrders(tx: TenantTx): Promise<void> {
  if (await isTemplateDemo(tx)) throw new DemoStoreError();
}

/** Stops a write that must never happen in a demo: a real order, a text message to a customer, a review. */
export async function assertNotDemo(tx: TenantTx): Promise<void> {
  if (await isDemoStore(tx)) throw new DemoStoreError();
}

/** Refuses a change that a visitor's demo copy must not make (account, plan, domains, team, integration keys, imports). */
export async function assertNotInDemo(tenantId: string, what?: string): Promise<void> {
  if (await isDemoSessionId(tenantId)) throw new DemoLockedError(what);
}
