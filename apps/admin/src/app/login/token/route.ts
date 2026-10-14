import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { verifyAutoLoginToken, createAutoLoginSessionCookie, AUTO_LOGIN_COOKIE, recordStaffLogin } from "@biztrackbd/core";
import { withTenant } from "@biztrackbd/db";
import { TENANT, cookieOptions, safeNext } from "@/lib/auth";
import { DEV_TENANT_COOKIE, DEV_USER_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const next = safeNext(url.searchParams.get("next") ?? "/?welcome=1");

  if (!token) {
    redirect("/login?err=token-missing");
  }

  const payload = verifyAutoLoginToken(token);
  if (!payload) {
    redirect("/login?err=token-invalid");
  }

  // Verify the tenant and user exist
  const info = await withTenant(payload.tenantId, async (tx) => {
    const t = await tx.tenant.findUnique({ where: { id: payload.tenantId }, select: { id: true, subdomain: true, status: true } });
    if (!t) return null;
    const u = await tx.tenantUser.findFirst({ where: { id: payload.userId, isActive: true }, select: { id: true, email: true, role: true } });
    if (!u) return null;
    return { tenant: t, user: u };
  });

  if (!info) {
    notFound();
  }

  const jar = await cookies();

  // In development, set dev cookies so devSession picks up the newly created store owner
  if (process.env.DEV_AUTH === "1" && process.env.NODE_ENV !== "production") {
    jar.set(DEV_TENANT_COOKIE, info.tenant.subdomain, cookieOptions(30 * 86400));
    jar.set(DEV_USER_COOKIE, info.user.email, cookieOptions(30 * 86400));
  }

  // Set the store owner auto-login session cookie (14-day validity)
  jar.set(AUTO_LOGIN_COOKIE, createAutoLoginSessionCookie({
    tenantId: info.tenant.id,
    userId: info.user.id,
    email: info.user.email,
  }), cookieOptions(14 * 86400));

  // In all modes, set the active tenant cookie
  jar.set(TENANT, info.tenant.id, cookieOptions(30 * 86400));

  await recordStaffLogin(info.tenant.id, info.user.id);

  redirect(next);
}
