import type { Metadata } from "next";
import Link from "next/link";
import { can, listAppStoreCatalog } from "@biztrackbd/core";
import { DemoLocked } from "@/components/demo-locked";
import { trialHref } from "@/lib/demo";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { AppStoreClient } from "./app-store-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Apps & Integrations" };

export default async function Apps({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const s = await requireAccess("billing");
  if (s.demo) return <DemoLocked what="Apps" keepHref={trialHref(s.demo.keep)} />;

  const canEdit = can(s.user.role, "billing", "edit");
  const overview = await listAppStoreCatalog(s.tenantId, s.actor);
  const err = one(sp.err);

  return (
    <>
      <div className="page-head">
        <h1>Apps & Integrations</h1>
      </div>
      <p className="page-sub">
        Browse, activate, and manage native apps and services for your store. What you can use depends on your plan.
      </p>

      {err && (
        <div className="notice bad" role="alert" style={{ marginBottom: 16 }} data-testid="apps-error">
          {err}
        </div>
      )}
      {one(sp.done) && (
        <div className="notice good" role="status" style={{ marginBottom: 16 }}>
          Saved.
        </div>
      )}

      {overview.allowance === 0 && (
        <div className="notice info" style={{ marginBottom: 16 }}>
          Your current plan tier does not include premium addon apps.{" "}
          <Link href="/billing" className="link" prefetch={false}>
            See plans
          </Link>
        </div>
      )}

      <AppStoreClient overview={overview} canEdit={canEdit} />
    </>
  );
}
