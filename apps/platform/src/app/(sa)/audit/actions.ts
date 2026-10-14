"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  DomainError,
  invitePlatformUser,
  updatePlatformUserRole,
  togglePlatformUserActive,
  type PlatformRole,
} from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

const back = (params: Record<string, string>): never => redirect(`/audit?${new URLSearchParams(params)}`);

export async function inviteStaffAction(form: FormData): Promise<void> {
  const s = await requireAction("audit", "edit");
  const email = String(form.get("email") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  const role = String(form.get("role") ?? "SUPPORT") as PlatformRole;

  try {
    await invitePlatformUser(s.actor, { email, name, role });
  } catch (err) {
    if (err instanceof DomainError) back({ tab: "team", err: err.message });
    throw err;
  }
  revalidatePath("/audit");
  back({ tab: "team", done: `Invited ${name} (${email}) as ${role}.` });
}

export async function updateStaffRoleAction(userId: string, role: string): Promise<void> {
  const s = await requireAction("audit", "edit");
  try {
    await updatePlatformUserRole(s.actor, userId, role as PlatformRole);
  } catch (err) {
    if (err instanceof DomainError) back({ tab: "team", err: err.message });
    throw err;
  }
  revalidatePath("/audit");
  back({ tab: "team", done: "Staff member role updated." });
}

export async function toggleStaffActiveAction(userId: string): Promise<void> {
  const s = await requireAction("audit", "edit");
  try {
    const res = await togglePlatformUserActive(s.actor, userId);
    revalidatePath("/audit");
    back({ tab: "team", done: res.isActive ? "Staff account activated." : "Staff account deactivated." });
  } catch (err) {
    if (err instanceof DomainError) back({ tab: "team", err: err.message });
    throw err;
  }
}
