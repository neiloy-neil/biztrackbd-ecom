"use server";

import { DomainError, acceptInvite } from "@biztrackbd/core";
import { authMode } from "@/lib/auth";

export interface JoinState {
  done?: boolean;
  error?: string;
}

export async function joinAction(token: string, _prev: JoinState, form: FormData): Promise<JoinState> {
  try {
    const real = authMode() === "supabase";
    const password = String(form.get("password") ?? "");
    if (real && password !== String(form.get("again") ?? "")) return { error: "The two passwords are not the same." };
    await acceptInvite(token, { name: String(form.get("name") ?? ""), ...(real ? { password } : {}) });
    return { done: true };
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    console.error("acceptInvite failed", e instanceof Error ? e.name : "unknown");
    return { error: "Something went wrong. Please try the link again." };
  }
}
