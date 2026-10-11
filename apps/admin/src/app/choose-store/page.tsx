import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ROLE_LABELS } from "@biztrackbd/core";
import { safeNext } from "@/lib/auth";
import { one } from "@/lib/query";
import { resolveAuth } from "@/lib/session";
import { chooseStoreAction, logoutAction } from "../login/actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Choose a store" };

export default async function ChooseStore({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = safeNext(one((await searchParams).next));
  const a = await resolveAuth();
  if (a.state === "anon") redirect("/login");
  if (a.state === "mfa") redirect("/login/mfa");
  if (a.state === "no-store") redirect("/login?err=no-store");
  const stores = a.stores;
  return (
    <div className="card" style={{ margin: "64px auto", maxWidth: 460 }}>
      <h1 style={{ marginTop: 0 }}>Which store?</h1>
      <p className="muted">You work in more than one store. Signed in as {a.user.email}.</p>
      <div className="stack" data-testid="store-choices">
        {stores.map((s) => (
          <form key={s.tenantId} action={chooseStoreAction}>
            <input type="hidden" name="tenantId" value={s.tenantId} />
            <input type="hidden" name="next" value={next} />
            <button type="submit" className="btn btn-secondary btn-block" style={{ justifyContent: "space-between" }}><b>{s.storeName}</b><span className="muted">{ROLE_LABELS[s.role]}</span></button>
          </form>
        ))}
      </div>
      <form action={logoutAction} style={{ marginTop: 14 }}><button type="submit" className="link" style={{ background: "none", border: 0, cursor: "pointer", minHeight: 40 }}>Sign out</button></form>
    </div>
  );
}
