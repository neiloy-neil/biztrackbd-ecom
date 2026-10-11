import type { Metadata } from "next";
import Link from "next/link";
import { safeNext } from "@/lib/auth";
import { one } from "@/lib/query";
import { SetupForm } from "../login-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Set up your password" };

export default async function Start({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = safeNext(one((await searchParams).next));
  return (
    <div className="card" style={{ margin: "64px auto", maxWidth: 420 }}>
      <h1 style={{ marginTop: 0 }}>Set up your password</h1>
      <p className="muted">For a new account, or if you forgot your password.</p>
      <SetupForm next={next} />
      <p style={{ marginTop: 16, fontSize: 14 }}><Link className="link" href="/login">Back to sign in</Link></p>
    </div>
  );
}
