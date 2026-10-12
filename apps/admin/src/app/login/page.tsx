import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { loadDemoTenant, verifyDemoCookie } from "@biztrackbd/core";
import { DEMO_PREV, safeNext } from "@/lib/auth";
import { trialHref } from "@/lib/demo";
import { authMode } from "@/lib/auth";
import { resolveAuth } from "@/lib/session";
import { one } from "@/lib/query";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in" };

const NOTES: Record<string, string> = {
  "no-store": "That account is not on any store's team. Ask the store owner to invite you.",
  session: "Your session could not be started. Please sign in again.",
  relogin: "Two-factor sign-in was turned off. Please sign in again.",
};

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = safeNext(one(sp.next));
  if (authMode() === "dev") redirect(next);
  const a = await resolveAuth();
  if (a.state === "ok") redirect(next);
  if (a.state === "mfa") redirect(`/login/mfa?next=${encodeURIComponent(next)}`);
  if (a.state === "choose") redirect(`/choose-store?next=${encodeURIComponent(next)}`);
  const note = NOTES[one(sp.err) ?? ""];
  // Someone who was just in a demo (opening this page ended it) may have no store yet: offer to keep the demo store they were trying.
  const prev = verifyDemoCookie((await cookies()).get(DEMO_PREV)?.value);
  const demo = prev ? await loadDemoTenant(prev.tenantId).catch(() => null) : null;
  const keepHref = demo?.keepCode ? trialHref(demo.keepCode) : null;
  const signupHref = trialHref();
  return (
    <div className="card" style={{ margin: "64px auto", maxWidth: 420 }}>
      <h1 style={{ marginTop: 0 }}>Sign in</h1>
      <p className="muted">to your BizTrackBD store</p>
      {note && <div className="notice" role="note" style={{ marginBottom: 12 }}>{note}</div>}
      <LoginForm next={next} />
      <p className="muted" style={{ fontSize: 14, marginTop: 14 }} data-testid="login-new">New here? <a className="link" href={signupHref} data-testid="login-signup">Open a free store</a></p>
      {keepHref && (
        <div className="notice good" role="note" data-testid="login-keep" style={{ marginTop: 12 }}>
          You were trying a demo store. <a className="link" href={keepHref}>Keep it and open your free store</a>: your products and design come with you.
        </div>
      )}
    </div>
  );
}
