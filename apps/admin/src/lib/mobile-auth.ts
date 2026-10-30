import { headers } from "next/headers";
import {
  getUserFromToken,
  getMerchantBusinesses,
  getStoreAccess,
  type AuthUser,
  type BusinessAccountSummary,
  type StaffActor,
  type Access,
} from "@biztrackbd/core";
import { withTenant, type StaffRole } from "@biztrackbd/db";
import { authMode } from "@/lib/auth";

export interface MobileSession {
  tenantId: string;
  tenantSubdomain: string;
  storeName: string;
  user: {
    id: string;
    authUserId: string;
    name: string;
    email: string;
    role: StaffRole;
  };
  actor: StaffActor;
  access: Access;
  stores: BusinessAccountSummary[];
}

export interface MobileAuthResult {
  session: MobileSession | null;
  error?: string;
  status: number;
}

/**
 * Resolves authentication for native mobile requests.
 * Expects `Authorization: Bearer <supabase_jwt>` and optional `X-Tenant-Id: <tenant_id>`.
 */
export async function getMobileSession(req?: Request): Promise<MobileAuthResult> {
  const reqHeaders = req ? req.headers : await headers();
  const authHeader = reqHeaders.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const requestedTenantId = reqHeaders.get("x-tenant-id")?.trim();
  const clientIp = reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();

  // 1. Development mode bypass when DEV_AUTH=1 or dev-token supplied
  if (authMode() === "dev" || token === "dev-token" || token.startsWith("dev-")) {
    try {
      const devUserEmail = reqHeaders.get("x-dev-user") || "owner@example.com";
      const devSub = reqHeaders.get("x-dev-tenant") || process.env.DEV_TENANT_SUBDOMAIN || "rongdhonu";

      // Find tenant
      const t = await withTenant("system", async (tx) => {
        return tx.tenant.findFirst({
          where: requestedTenantId ? { id: requestedTenantId } : { subdomain: devSub },
          select: { id: true, name: true, subdomain: true, status: true, siteMode: true, businessVertical: true, customDomain: true },
        });
      });

      if (!t) {
        return { session: null, error: "Store not found for development session.", status: 404 };
      }

      // Find user in this tenant
      const user = await withTenant(t.id, async (tx) => {
        return (
          (await tx.tenantUser.findFirst({ where: { email: devUserEmail, isActive: true } })) ??
          (await tx.tenantUser.findFirst({ where: { role: "STORE_OWNER", isActive: true } })) ??
          (await tx.tenantUser.findFirst({ where: { isActive: true } }))
        );
      });

      if (!user) {
        return { session: null, error: "No active staff member in this store.", status: 403 };
      }

      const access = await getStoreAccess(t.id);
      const mockBusiness: BusinessAccountSummary = {
        userId: user.id,
        tenantId: t.id,
        subdomain: t.subdomain,
        storeName: t.name,
        role: user.role,
        name: user.name,
        isActive: true,
        tenantStatus: t.status,
        siteMode: t.siteMode,
        businessVertical: t.businessVertical,
        customDomain: t.customDomain,
        isCurrent: true,
      };

      return {
        session: {
          tenantId: t.id,
          tenantSubdomain: t.subdomain,
          storeName: t.name,
          user: {
            id: user.id,
            authUserId: user.authUserId ?? "dev-auth-id",
            name: user.name,
            email: user.email,
            role: user.role,
          },
          actor: {
            userId: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            ip: clientIp,
          },
          access,
          stores: [mockBusiness],
        },
        status: 200,
      };
    } catch (err) {
      console.error("[MobileAuth Dev] Error creating dev mobile session:", err);
      return { session: null, error: "Failed to create dev mobile session.", status: 500 };
    }
  }

  // 2. Production Supabase JWT Authentication
  if (!token) {
    return { session: null, error: "Missing authorization token.", status: 401 };
  }

  let authUser: AuthUser | null = null;
  try {
    authUser = await getUserFromToken(token);
  } catch (err) {
    return { session: null, error: "Invalid or expired session token.", status: 401 };
  }

  if (!authUser || !authUser.emailConfirmed) {
    return { session: null, error: "Please confirm your email address or sign in again.", status: 401 };
  }

  // Retrieve all businesses accessible to this merchant
  const stores = await getMerchantBusinesses(authUser, requestedTenantId);
  const activeStores = stores.filter((s) => s.isActive);

  if (activeStores.length === 0) {
    return { session: null, error: "No active stores associated with this account.", status: 403 };
  }

  // Resolve target tenant: either the explicitly requested tenant or the first available store
  let activeStore = requestedTenantId
    ? activeStores.find((s) => s.tenantId === requestedTenantId)
    : activeStores[0];

  if (!activeStore) {
    return {
      session: null,
      error: `You do not have access to store ID ${requestedTenantId}.`,
      status: 403,
    };
  }

  // Query TenantUser row to get latest internal user ID and name
  const tenantUser = await withTenant(activeStore.tenantId, (tx) =>
    tx.tenantUser.findFirst({
      where: {
        OR: [{ id: activeStore!.userId }, { email: authUser!.email }],
        isActive: true,
      },
    })
  );

  if (!tenantUser) {
    return { session: null, error: "Staff account not found or has been deactivated.", status: 403 };
  }

  const access = await getStoreAccess(activeStore.tenantId);

  return {
    session: {
      tenantId: activeStore.tenantId,
      tenantSubdomain: activeStore.subdomain,
      storeName: activeStore.storeName,
      user: {
        id: tenantUser.id,
        authUserId: authUser.id,
        name: tenantUser.name,
        email: authUser.email,
        role: activeStore.role,
      },
      actor: {
        userId: tenantUser.id,
        email: authUser.email,
        name: tenantUser.name,
        role: activeStore.role,
        ip: clientIp,
      },
      access,
      stores,
    },
    status: 200,
  };
}
