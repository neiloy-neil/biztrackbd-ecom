import { withTenant, type TenantTx } from "@biztrackbd/db";
import { audit } from "../audit/service";
import { ValidationError } from "../errors";
import { assertCan, type StaffActor } from "../permissions";

/**
 * Optional modules a store can switch on (docs/06, AdmApps). The plan decides how many a store may use (`features.modules`:
 * 0, a number, or "all"). Only modules that are actually built can be switched on; the rest are listed so the owner can see
 * what is coming, and cannot be enabled.
 */
export interface ModuleDef {
  key: string;
  label: string;
  description: string;
  built: boolean;
}

export const MODULES: ModuleDef[] = [
  { key: "loyalty", label: "Loyalty, VIP levels and referrals", description: "Reward points, Silver, Gold and Platinum levels, birthday vouchers and refer-a-friend.", built: true },
  { key: "bespoke", label: "Made to order", description: "Tailoring and custom sizes with measurements and a quote.", built: false },
  { key: "drops", label: "Limited drops", description: "Timed releases with a countdown and a waiting list.", built: false },
  { key: "baby_profiles", label: "Baby profiles", description: "Saved baby sizes and birthdays for a children's store.", built: false },
  { key: "booking", label: "Bookings", description: "Appointments and slots.", built: false },
  { key: "wholesale", label: "Wholesale", description: "Trade prices and minimum quantities for resellers.", built: false },
];

const def = (key: string) => MODULES.find((m) => m.key === key);

/** How many modules the plan allows: a number, or Infinity for "all". */
async function allowance(tx: TenantTx): Promise<number> {
  const t = await tx.tenant.findFirstOrThrow({ select: { planTier: true } });
  const plan = await tx.plan.findUnique({ where: { tier: t.planTier } });
  const v = (plan?.features as Record<string, unknown> | null)?.modules;
  return v === "all" ? Infinity : typeof v === "number" ? v : 0;
}

/** Is this module on for the store? Built modules are on by default when the plan includes modules, until the owner switches them off. */
export async function isModuleOn(tx: TenantTx, key: string): Promise<boolean> {
  const d = def(key);
  if (!d?.built) return false;
  if ((await allowance(tx)) <= 0) return false;
  const row = await tx.tenantModule.findFirst({ where: { moduleKey: key } });
  return row ? row.isEnabled : true;
}

export interface ModuleView extends ModuleDef {
  enabled: boolean;
  /** Why it cannot be switched on, in words; null when it can. */
  blocked: string | null;
}

export async function listModules(tenantId: string, actor: StaffActor): Promise<{ modules: ModuleView[]; allowance: number | null; used: number }> {
  assertCan(actor, "billing", "view");
  return withTenant(tenantId, async (tx) => {
    const cap = await allowance(tx);
    const rows = await tx.tenantModule.findMany();
    const on = new Map(rows.map((r) => [r.moduleKey, r.isEnabled]));
    let used = 0;
    const modules = MODULES.map((m) => {
      const enabled = m.built && cap > 0 && (on.get(m.key) ?? true);
      if (enabled) used++;
      const blocked = !m.built ? "Not available yet" : cap <= 0 ? "Not included in your plan" : null;
      return { ...m, enabled, blocked };
    });
    return { modules, allowance: cap === Infinity ? null : cap, used };
  });
}

export async function setModule(tenantId: string, actor: StaffActor, key: string, enabled: boolean): Promise<void> {
  assertCan(actor, "billing", "edit");
  const d = def(key);
  if (!d) throw new ValidationError("Unknown module");
  if (!d.built) throw new ValidationError(`${d.label} is not available yet`);
  await withTenant(tenantId, async (tx) => {
    const cap = await allowance(tx);
    if (enabled && cap <= 0) throw new ValidationError("Modules are not included in your plan. Upgrade to switch this on.");
    if (enabled && cap !== Infinity) {
      const rows = await tx.tenantModule.findMany();
      const on = new Set(rows.filter((r) => r.isEnabled).map((r) => r.moduleKey));
      for (const m of MODULES) if (m.built && !rows.some((r) => r.moduleKey === m.key)) on.add(m.key);
      on.add(key);
      if (on.size > cap) throw new ValidationError(`Your plan includes ${cap} module${cap === 1 ? "" : "s"}. Switch another one off first.`);
    }
    await tx.tenantModule.upsert({ where: { tenantId_moduleKey: { tenantId, moduleKey: key } }, create: { tenantId, moduleKey: key, isEnabled: enabled }, update: { isEnabled: enabled } });
    await audit(tx, tenantId, actor, enabled ? "module.enabled" : "module.disabled", { module: key });
  });
}
