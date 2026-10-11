import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getUserFromToken } from "@biztrackbd/core";
import { AT, authMode } from "@/lib/auth";
import { requireAccess } from "@/lib/session";
import { PasswordPanel, TotpPanel } from "./totp";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign-in and security" };

export default async function Security() {
  const s = await requireAccess("orders");
  const dev = authMode() === "dev";
  const token = (await cookies()).get(AT)?.value;
  const user = !dev && token ? await getUserFromToken(token) : null;
  const factor = user?.factors.find((f) => f.status === "verified") ?? null;
  return (
    <>
      <div className="page-head"><h1>Sign-in and security</h1></div>
      <p className="page-sub">Signed in as {s.user.email}.</p>
      {dev ? (
        <div className="notice" role="note">Development sign-in is on, so there is nothing to set up here. Turn off DEV_AUTH to use real sign-in.</div>
      ) : (
        <div className="stack">
          <section className="card"><h2>Two-factor sign-in</h2><TotpPanel enabledFactorId={factor?.id ?? null} /></section>
          <section className="card"><h2>Change your password</h2><PasswordPanel /></section>
        </div>
      )}
    </>
  );
}
