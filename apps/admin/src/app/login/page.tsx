import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth";
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
  return (
    <div className="card" style={{ margin: "64px auto", maxWidth: 420 }}>
      <h1 style={{ marginTop: 0 }}>Sign in</h1>
      <p className="muted">to your BizTrackBD store</p>
      {note && <div className="notice" role="note" style={{ marginBottom: 12 }}>{note}</div>}
      <LoginForm next={next} />
    </div>
  );
}
