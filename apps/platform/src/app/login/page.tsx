import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { authMode, safeNext } from "@/lib/auth";
import { one } from "@/lib/query";
import { resolveAuth } from "@/lib/session";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Platform sign in" };

const NOTES: Record<string, string> = {
  "no-access": "That account is not on the platform team.",
  session: "Your session could not be started. Please sign in again.",
};

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = safeNext(one(sp.next));
  if (authMode() === "dev") redirect(next);
  const a = await resolveAuth();
  if (a.state === "ok") redirect(next);
  if (a.state === "mfa") redirect(`/login/mfa?next=${encodeURIComponent(next)}`);
  if (a.state === "enroll") redirect("/enroll");
  const note = NOTES[one(sp.err) ?? ""];
  return (
    <div className="card" style={{ margin: "64px auto", maxWidth: 420 }}>
      <h1 style={{ marginTop: 0 }}>Platform sign in</h1>
      <p className="muted">BizTrackBD team only. Two-factor sign-in is required.</p>
      {note && <div className="notice" role="note" style={{ marginBottom: 12 }}>{note}</div>}
      <LoginForm next={next} />
    </div>
  );
}
