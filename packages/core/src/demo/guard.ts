import type { TenantTx } from "@biztrackbd/db";
import { DemoStoreError } from "../errors";

/** True for a template demo store (docs/38). Reads the current tenant, so call it inside withTenant. */
export async function isDemoStore(tx: TenantTx): Promise<boolean> {
  return (await tx.tenant.findFirst({ select: { isDemo: true } }))?.isDemo === true;
}

/** Stops a write that must never happen in a demo: a real order, a text message to a customer, a review. */
export async function assertNotDemo(tx: TenantTx): Promise<void> {
  if (await isDemoStore(tx)) throw new DemoStoreError();
}
