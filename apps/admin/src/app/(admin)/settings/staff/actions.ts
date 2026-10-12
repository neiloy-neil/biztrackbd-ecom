"use server";

import { revalidatePath } from "next/cache";
import { DomainError, ROLE_LABELS, changeStaffRole, emailStaffInvite, inviteStaff, revokeInvite, setStaffActive } from "@biztrackbd/core";
import { requireAction } from "@/lib/session";

export interface InviteState {
  error?: string;
  /** Shown once after sending. Only a hash is stored, so the link cannot be shown again. */
  link?: string;
  /** The invite was also sent to the person's email. */
  emailed?: boolean;
  email?: string;
}

export async function inviteAction(_prev: InviteState, form: FormData): Promise<InviteState> {
  const s = await requireAction("team", "edit");
  try {
    const email = String(form.get("email") ?? "");
    const r = await inviteStaff(s.tenantId, s.actor, { email, role: String(form.get("role") ?? "") });
    revalidatePath("/settings/staff");
    // The invite is emailed, and the link is still shown once so the owner can send it another way (for example on WhatsApp).
    const role = String(form.get("role") ?? "");
    const sent = await emailStaffInvite(s.tenantId, { to: email.trim().toLowerCase(), roleLabel: ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role, inviterName: s.user.name, token: r.token, expiresAt: r.expiresAt });
    const origin = process.env.ADMIN_ORIGIN ?? "http://localhost:3001";
    return { link: `${origin}/join/${r.token}`, email, emailed: sent === "sent" };
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    console.error("inviteStaff failed", e instanceof Error ? e.name : "unknown");
    return { error: "Could not send the invite." };
  }
}

export async function changeRoleAction(userId: string, form: FormData): Promise<void> {
  const s = await requireAction("team", "edit");
  await changeStaffRole(s.tenantId, s.actor, userId, String(form.get("role") ?? ""));
  revalidatePath("/settings/staff");
}

export async function setActiveAction(userId: string, active: boolean): Promise<void> {
  const s = await requireAction("team", "edit");
  await setStaffActive(s.tenantId, s.actor, userId, active);
  revalidatePath("/settings/staff");
}

export async function revokeAction(inviteId: string): Promise<void> {
  const s = await requireAction("team", "edit");
  await revokeInvite(s.tenantId, s.actor, inviteId);
  revalidatePath("/settings/staff");
}
