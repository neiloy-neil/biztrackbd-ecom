import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolveAuth } from "@/lib/session";
import { logoutAction } from "../login/actions";
import { EnrollPanel } from "./enroll-panel";
import { SubmitButton } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Set up two-factor" };

export default async function Enroll() {
  const a = await resolveAuth();
  if (a.state === "anon" || a.state === "no-access") redirect("/login");
  if (a.state === "mfa") redirect("/login/mfa");
  if (a.state === "ok") redirect("/");
  return (
    <div className="card" style={{ margin: "64px auto", maxWidth: 460 }}>
      <h1 style={{ marginTop: 0 }}>Set up two-factor sign-in</h1>
      <p className="muted">Signed in as {a.user.email}. You cannot use the platform until this is done.</p>
      <EnrollPanel />
      <form action={logoutAction} style={{ marginTop: 14 }}><SubmitButton className="link" style={{ background: "none", border: 0, cursor: "pointer", minHeight: 40 }} pending={false}>Sign out</SubmitButton></form>
    </div>
  );
}
