import type { Metadata } from "next";
import { AuthBrand } from "@/components/auth-brand";
import { safeNext } from "@/lib/auth";
import { one } from "@/lib/query";
import { PasswordResetWizard } from "../reset-wizard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reset your password" };

export default async function Start({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = safeNext(one((await searchParams).next));
  return (
    <div role="main" className="card" style={{ margin: "64px auto", maxWidth: 440 }}>
      <AuthBrand />
      <h1 style={{ marginTop: 0 }}>Reset your password</h1>
      <p className="muted" style={{ marginBottom: 20 }}>For a new store account, or if you forgot your password.</p>
      <PasswordResetWizard next={next} />
    </div>
  );
}
