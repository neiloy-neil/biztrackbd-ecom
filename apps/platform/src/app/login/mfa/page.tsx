import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth";
import { one } from "@/lib/query";
import { resolveAuth } from "@/lib/session";
import { logoutAction } from "../actions";
import { MfaForm } from "../login-form";
import { SubmitButton } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Two-factor sign-in" };

export default async function Mfa({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = safeNext(one((await searchParams).next));
  const a = await resolveAuth();
  if (a.state === "anon") redirect("/login");
  if (a.state === "enroll") redirect("/enroll");
  if (a.state !== "mfa") redirect(next);
  return (
    <div className="card" style={{ margin: "64px auto", maxWidth: 420 }}>
      <h1 style={{ marginTop: 0 }}>Enter your code</h1>
      <p className="muted">Open your authenticator app and type the 6-digit code for BizTrackBD.</p>
      <MfaForm next={next} />
      <form action={logoutAction} style={{ marginTop: 14 }}><SubmitButton className="link" style={{ background: "none", border: 0, cursor: "pointer", minHeight: 40 }} pending={false}>Use a different account</SubmitButton></form>
    </div>
  );
}
