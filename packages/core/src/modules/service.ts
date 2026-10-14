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
  { key: "pos_barcode", label: "POS & Barcode Studio", description: "Omnichannel retail counter cashier terminal, barcode scanning, and thermal roll printing.", built: true },
  { key: "ai_suite", label: "Gemini AI Assistant Suite", description: "AI copywriter, product description generator, chat address parser, and storefront chatbot.", built: true },
  { key: "marketing_campaigns", label: "Marketing Command Center", description: "Broadcast SMS & Email campaigns, urgent storefront flash banners, and auto notifications.", built: true },
  { key: "fraud_shield", label: "Unified Courier Fraud Defense", description: "Cross-courier delivery record screening, fraud score calculation, and developer API.", built: true },
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
  if (v === "all") return Infinity;
  if (typeof v === "number") return v;
  return t.planTier === "PRO" || t.planTier === "BUSINESS" ? Infinity : 0;
}

/** Is this module on for the store? Built modules are on by default when the plan includes modules, until the owner switches them off. */
export async function isModuleOn(tx: TenantTx, key: string): Promise<boolean> {
  const modKey = key === "loyalty_vip" ? "loyalty" : key;
  const d = def(modKey);
  if (!d?.built) return false;
  const row = await tx.tenantModule.findFirst({ where: { moduleKey: modKey } });
  if (row?.isEnabled === true) return true;
  if ((await allowance(tx)) <= 0) return false;
  return row ? row.isEnabled : true;
}

export async function isModuleActive(tenantId: string, key: string): Promise<boolean> {
  return withTenant(tenantId, async (tx) => isModuleOn(tx, key));
}

export async function getModuleStatus(tenantId: string, key: string): Promise<{
  active: boolean;
  isPlanLocked: boolean;
  planTier: string;
}> {
  return withTenant(tenantId, async (tx) => {
    const t = await tx.tenant.findFirstOrThrow({ select: { planTier: true } });
    const cap = await allowance(tx);
    const isPlanLocked = cap <= 0;
    const active = await isModuleOn(tx, key);
    return {
      active,
      isPlanLocked,
      planTier: t.planTier,
    };
  });
}

export async function getTenantActiveModules(tenantId: string): Promise<Record<string, boolean>> {
  return withTenant(tenantId, async (tx) => {
    const cap = await allowance(tx);
    const rows = await tx.tenantModule.findMany();
    const explicit = new Map(rows.map((r) => [r.moduleKey, r.isEnabled]));
    return {
      loyalty: explicit.get("loyalty") ?? (cap > 0),
      pos_barcode: explicit.get("pos_barcode") ?? (cap > 0),
      ai_suite: explicit.get("ai_suite") ?? (cap > 0),
      marketing_campaigns: explicit.get("marketing_campaigns") ?? (cap > 0),
      fraud_shield: explicit.get("fraud_shield") ?? (cap > 0),
    };
  });
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

export * from "./catalog";
import { APP_CATALOG, type AppCatalogItem } from "./catalog";

export interface AppStoreItemView extends AppCatalogItem {
  status: "ACTIVE" | "NEEDS_SETUP" | "AVAILABLE" | "LOCKED" | "COMING_SOON";
  statusLabel: string;
  enabled: boolean;
  configured: boolean;
  blockedReason: string | null;
}

export interface AppStoreOverview {
  apps: AppStoreItemView[];
  planTier: string;
  allowance: number | null;
  usedAddons: number;
  totalActive: number;
}

export async function listAppStoreCatalog(tenantId: string, actor: StaffActor): Promise<AppStoreOverview> {
  assertCan(actor, "billing", "view");
  return withTenant(tenantId, async (tx) => {
    const t = await tx.tenant.findFirstOrThrow({ select: { planTier: true } });
    const cap = await allowance(tx);
    const [integrations, modules, storeSettings] = await Promise.all([
      tx.tenantIntegration.findMany(),
      tx.tenantModule.findMany(),
      tx.storeSettings.findFirst(),
    ]);

    const activeIntegrations = new Set(integrations.map((i: { provider: string }) => i.provider));
    const moduleOn = new Map(modules.map((m: { moduleKey: string; isEnabled: boolean }) => [m.moduleKey, m.isEnabled]));

    let usedAddons = 0;
    let totalActive = 0;

    const apps: AppStoreItemView[] = APP_CATALOG.map((item) => {
      if (!item.built) {
        return {
          ...item,
          status: "COMING_SOON",
          statusLabel: "Coming Soon",
          enabled: false,
          configured: false,
          blockedReason: "In development for upcoming platform release",
        };
      }

      // 1. Couriers & Logistics
      if (item.category === "COURIERS") {
        const prov = item.key === "steadfast_courier" ? "STEADFAST" : item.key === "pathao_courier" ? "PATHAO" : "REDX";
        const hasKeys = activeIntegrations.has(prov);
        if (hasKeys) totalActive++;
        return {
          ...item,
          status: hasKeys ? "ACTIVE" : "NEEDS_SETUP",
          statusLabel: hasKeys ? "Connected" : "Setup Required",
          enabled: true,
          configured: hasKeys,
          blockedReason: null,
        };
      }

      // 2. Marketing Pixels & Feeds
      if (item.category === "MARKETING") {
        let configured = false;
        if (item.key === "meta_pixel_capi") configured = Boolean(storeSettings?.metaPixelId || activeIntegrations.has("META_CAPI"));
        else if (item.key === "google_analytics") configured = Boolean(storeSettings?.googleAnalyticsId || storeSettings?.googleTagManagerId || activeIntegrations.has("GA4"));
        else if (item.key === "tiktok_pixel") configured = Boolean(storeSettings?.tiktokPixelId);
        else if (item.key === "facebook_catalog") configured = true; // Catalog feed is always ready at /api/catalog/facebook

        if (configured) totalActive++;
        return {
          ...item,
          status: configured ? "ACTIVE" : "AVAILABLE",
          statusLabel: configured ? "Active" : "Available",
          enabled: true,
          configured,
          blockedReason: null,
        };
      }

      // 3. Customer Growth & Retention (WhatsApp Widget, Loyalty, Abandoned Cart, Reviews)
      if (item.category === "GROWTH") {
        if (item.key === "whatsapp_widget") {
          const isConfigured = Boolean(storeSettings?.whatsappNumber);
          if (isConfigured) totalActive++;
          return {
            ...item,
            status: isConfigured ? "ACTIVE" : "AVAILABLE",
            statusLabel: isConfigured ? "Active" : "Available",
            enabled: true,
            configured: isConfigured,
            blockedReason: null,
          };
        }
        if (item.key === "loyalty_vip") {
          const isConfigured = Boolean(storeSettings?.loyaltyEnabled);
          if (isConfigured) totalActive++;
          return {
            ...item,
            status: isConfigured ? "ACTIVE" : "AVAILABLE",
            statusLabel: isConfigured ? "Active" : "Available",
            enabled: true,
            configured: isConfigured,
            blockedReason: null,
          };
        }
        totalActive++;
        return {
          ...item,
          status: "ACTIVE",
          statusLabel: "Active",
          enabled: true,
          configured: true,
          blockedReason: null,
        };
      }

      // 4. Automation & Protection (Fraud Shield, SMS Alerts)
      if (item.category === "AUTOMATION") {
        if (item.key === "sms_alerts") {
          const hasKeys = activeIntegrations.has("SMS_BYO");
          if (hasKeys) totalActive++;
          return {
            ...item,
            status: hasKeys ? "ACTIVE" : "NEEDS_SETUP",
            statusLabel: hasKeys ? "Connected" : "Setup Required",
            enabled: true,
            configured: hasKeys,
            blockedReason: null,
          };
        }
        totalActive++;
        return {
          ...item,
          status: "ACTIVE",
          statusLabel: "Active",
          enabled: true,
          configured: true,
          blockedReason: null,
        };
      }

      // 5. Commerce & Payments (SSLCOMMERZ, UddoktaPay, or Addons)
      if (item.category === "COMMERCE") {
        if (item.key === "sslcommerz_pay") {
          const hasKeys = activeIntegrations.has("SSLCOMMERZ");
          if (hasKeys) totalActive++;
          return {
            ...item,
            status: hasKeys ? "ACTIVE" : "NEEDS_SETUP",
            statusLabel: hasKeys ? "Connected" : "Setup Required",
            enabled: true,
            configured: hasKeys,
            blockedReason: null,
          };
        }
        if (item.key === "uddoktapay_pay") {
          const hasKeys = activeIntegrations.has("UDDOKTAPAY");
          if (hasKeys) totalActive++;
          return {
            ...item,
            status: hasKeys ? "ACTIVE" : "NEEDS_SETUP",
            statusLabel: hasKeys ? "Connected" : "Setup Required",
            enabled: true,
            configured: hasKeys,
            blockedReason: null,
          };
        }
      }

      // 6. Generic Plan Addon Modules (Wholesale, Drops, Bespoke)
      if (item.tier === "ADDON") {
        const isPlanLocked = cap <= 0;
        const modKey = item.key === "loyalty_vip" ? "loyalty" : item.key;
        const explicitOn = moduleOn.get(modKey);
        const enabled = cap > 0 && (explicitOn !== undefined ? explicitOn : true);

        if (enabled) {
          usedAddons++;
          totalActive++;
        }

        const isOverLimit = cap !== Infinity && usedAddons > cap;
        const status = isPlanLocked || isOverLimit ? "LOCKED" : enabled ? "ACTIVE" : "AVAILABLE";
        const statusLabel = isPlanLocked ? "Upgrade Required" : enabled ? "Active" : "Available";

        return {
          ...item,
          status,
          statusLabel,
          enabled: Boolean(enabled && !isPlanLocked),
          configured: true,
          blockedReason: isPlanLocked ? "Upgrade to Pro or Business to activate this app" : isOverLimit ? "Plan addon limit reached" : null,
        };
      }

      totalActive++;
      return {
        ...item,
        status: "ACTIVE",
        statusLabel: "Active",
        enabled: true,
        configured: true,
        blockedReason: null,
      };
    });

    return {
      apps,
      planTier: t.planTier,
      allowance: cap === Infinity ? null : cap,
      usedAddons,
      totalActive,
    };
  });
}

export async function setModule(tenantId: string, actor: StaffActor, key: string, enabled: boolean): Promise<void> {
  assertCan(actor, "billing", "edit");
  const modKey = key === "loyalty_vip" ? "loyalty" : key;
  const d = def(modKey);
  if (!d) throw new ValidationError("Unknown module");
  if (!d.built) throw new ValidationError(`${d.label} is not available yet`);
  await withTenant(tenantId, async (tx) => {
    const cap = await allowance(tx);
    if (enabled && cap <= 0) throw new ValidationError("Modules are not included in your plan. Upgrade to switch this on.");
    if (enabled && cap !== Infinity) {
      const rows = await tx.tenantModule.findMany();
      const on = new Set(rows.filter((r) => r.isEnabled).map((r) => r.moduleKey));
      for (const m of MODULES) if (m.built && !rows.some((r) => r.moduleKey === m.key)) on.add(m.key);
      on.add(modKey);
      if (on.size > cap) throw new ValidationError(`Your plan includes ${cap} module${cap === 1 ? "" : "s"}. Switch another one off first.`);
    }
    await tx.tenantModule.upsert({ where: { tenantId_moduleKey: { tenantId, moduleKey: modKey } }, create: { tenantId, moduleKey: modKey, isEnabled: enabled }, update: { isEnabled: enabled } });
    await audit(tx, tenantId, actor, enabled ? "module.enabled" : "module.disabled", { module: modKey });
  });
}


