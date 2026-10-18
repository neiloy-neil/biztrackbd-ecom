"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createAdditionalBusiness,
  getDevBusinesses,
  getUserFromToken,
  recordStaffLogin,
  staffMemberships,
  type BusinessVertical,
  type SiteMode,
} from "@biztrackbd/core";
import { getPlatformPrisma } from "@biztrackbd/db";
import { AT, TENANT, authMode, cookieOptions } from "@/lib/auth";
import { DEV_TENANT_COOKIE, getSession } from "@/lib/session";

export async function switchBusinessAction(form: FormData): Promise<void> {
  const targetTenantId = String(form.get("tenantId") ?? "").trim();
  const targetSubdomain = String(form.get("subdomain") ?? "").trim();
  if (!targetTenantId && !targetSubdomain) return;

  const isDev = authMode() === "dev";
  const jar = await cookies();

  if (isDev) {
    const s = await getSession().catch(() => null);
    if (!s) redirect("/login");

    const allowed = await getDevBusinesses(s.tenantSubdomain, s.user.email);
    const match = allowed.find(
      (b) => (targetTenantId && b.tenantId === targetTenantId) || (targetSubdomain && b.subdomain === targetSubdomain)
    );
    if (!match) {
      console.warn(`[Security] Unauthorized switch attempt from ${s.tenantSubdomain} to ${targetSubdomain || targetTenantId}`);
      return;
    }

    const t = await getPlatformPrisma().tenant.findFirst({
      where: targetTenantId ? { id: targetTenantId } : { subdomain: targetSubdomain },
      select: { id: true, subdomain: true },
    });
    if (!t) return;
    jar.set(DEV_TENANT_COOKIE, t.subdomain, { httpOnly: true, sameSite: "lax", path: "/" });
    jar.set(TENANT, t.id, cookieOptions(30 * 86400));
    revalidatePath("/", "layout");
    redirect("/");
  }

  const token = jar.get(AT)?.value;
  const user = token ? await getUserFromToken(token) : null;
  if (!user) redirect("/login");

  const memberships = await staffMemberships(user);
  const m = memberships.find(
    (x) => (x.tenantId === targetTenantId || x.subdomain === targetSubdomain) && x.isActive
  );
  if (!m) {
    redirect("/choose-store");
  }

  jar.set(TENANT, m.tenantId, cookieOptions(30 * 86400));
  await recordStaffLogin(m.tenantId, m.userId);
  revalidatePath("/", "layout");
  redirect("/");
}

export interface CreateBusinessState {
  error?: string;
  success?: boolean;
}

export async function createBusinessAction(
  _prev: CreateBusinessState,
  form: FormData
): Promise<CreateBusinessState> {
  const name = String(form.get("name") ?? "").trim();
  const subdomain = String(form.get("subdomain") ?? "").trim().toLowerCase();
  const siteMode = String(form.get("siteMode") ?? "ECOMMERCE").toUpperCase() as SiteMode;
  const vertical = (form.get("businessVertical")
    ? String(form.get("businessVertical"))
    : null) as BusinessVertical | null;

  if (!name || name.length < 2) {
    return { error: "Please enter a valid business name (at least 2 characters)." };
  }
  if (!subdomain || subdomain.length < 3) {
    return { error: "Please enter a valid subdomain (at least 3 characters)." };
  }

  const isDev = authMode() === "dev";
  const jar = await cookies();

  try {
    let ownerUserId = "dev_user";
    let ownerEmail = "owner@biztrackbd.example";
    let ownerName = name;

    if (!isDev) {
      const token = jar.get(AT)?.value;
      const user = token ? await getUserFromToken(token) : null;
      if (!user) {
        return { error: "You must be signed in to create a business." };
      }
      ownerUserId = user.id;
      ownerEmail = user.email;
      ownerName = user.email.split("@")[0] || name;
    } else {
      const s = await getSession().catch(() => null);
      if (s) {
        ownerUserId = s.user.id;
        ownerEmail = s.user.email;
        ownerName = s.user.name;
      }
    }

    const created = await createAdditionalBusiness({
      name,
      subdomain,
      siteMode,
      businessVertical: vertical,
      ownerUserId,
      ownerEmail,
      ownerName,
    });

    if (isDev) {
      jar.set(DEV_TENANT_COOKIE, created.subdomain, { httpOnly: true, sameSite: "lax", path: "/" });
    }
    jar.set(TENANT, created.tenantId, cookieOptions(30 * 86400));
    revalidatePath("/", "layout");
  } catch (err: any) {
    return { error: err.message || "Failed to create business. Please try again." };
  }

  redirect("/");
}
