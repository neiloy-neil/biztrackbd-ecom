import type { Metadata } from "next";
import Link from "next/link";
import { can } from "@biztrackbd/core";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Store locked" };

/** Where every admin screen sends a locked store (docs/12 section 4): unpaid past day 14, cancelled, or switched off by the platform. */
export default async function Locked() {
  const s = await getSession();
  const a = s.access;
  return (
    <div style={{ maxWidth: 520, margin: "40px auto" }}>
      <div className="card stack" data-testid="locked">
        <h1 style={{ margin: 0 }}>{a.suspendedByPlatform ? "Your store is switched off" : "Your store is locked"}</h1>
        {a.suspendedByPlatform ? (
          <p>BizTrackBD has switched this store off. Please contact support and we will help.</p>
        ) : (
          <p>Your plan ran out {a.overdueDays ? `${a.overdueDays} days ago` : ""} and was not renewed, so your store is offline and the admin is locked. Your products, orders and customers are safe. Pay for a plan and everything comes back.</p>
        )}
        {can(s.user.role, "billing") ? (
          <Link href="/billing" className="btn btn-primary btn-lg" prefetch={false}>See plans and pay</Link>
        ) : (
          <p className="muted">Ask the store owner to renew the plan.</p>
        )}
      </div>
    </div>
  );
}
