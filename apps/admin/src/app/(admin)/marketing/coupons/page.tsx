import type { Metadata } from "next";
import Link from "next/link";
import { can, listCoupons, type CouponStatus } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { dateOnly, isoDay, taka } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { deleteCouponAction, toggleCouponAction } from "./actions";
import { CouponForm } from "./coupon-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Discounts" };

const STATUS: Record<CouponStatus, [string, string]> = { active: ["Active", "ok"], scheduled: ["Scheduled", "info"], expired: ["Expired", "grey"], used_up: ["Used up", "grey"], off: ["Off", "grey"] };

export default async function Coupons({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("marketing");
  const canEdit = can(s.user.role, "marketing", "edit");
  const list = await listCoupons(s.tenantId, s.actor);
  const editId = one(sp.edit);
  const creating = one(sp.new) !== undefined;
  const editing = list.find((c) => c.id === editId);
  const describe = (c: (typeof list)[number]) => (c.type === "PERCENTAGE" ? `${c.value}% off` : c.type === "FIXED_AMOUNT" ? `${taka(c.value)} off` : "Free delivery");

  return (
    <>
      <div className="page-head"><h1>Discounts and coupons</h1><div className="actions">{canEdit && <Link href="/marketing/coupons?new=1" className="btn btn-primary" prefetch={false} data-testid="new-coupon">Create discount</Link>}</div></div>
      {one(sp.saved) && <div className="notice good" role="status" style={{ marginBottom: 12 }}>Coupon saved.</div>}
      {one(sp.deleted) && <div className="notice good" role="status" style={{ marginBottom: 12 }}>Coupon deleted.</div>}
      {one(sp.disabled) && <div className="notice info" role="status" style={{ marginBottom: 12 }}>That coupon has been used, so it was switched off instead of deleted. Past orders keep their reference.</div>}

      <div className="split">
        <div className="col">
          {list.length === 0 ? <div className="card empty">No coupons yet.</div> : (
            <>
              <div className="only-mobile">
                {list.map((c) => (
                  <div key={c.id} className="list-card" data-testid="coupon-row">
                    <div className="top"><b>{c.code}</b><span className={`pill ${STATUS[c.status][1]}`}>{STATUS[c.status][0]}</span></div>
                    <div>{describe(c)}{c.minOrderValue ? ` · orders over ${taka(c.minOrderValue)}` : ""}</div>
                    <div className="muted" style={{ fontSize: 13 }}>Used {c.usageCount}{c.usageLimit ? ` of ${c.usageLimit}` : ""} · {c.expiresAt ? `until ${dateOnly(c.expiresAt)}` : "no end date"}</div>
                    {canEdit && <div className="row" style={{ marginTop: 8 }}><Link href={`/marketing/coupons?edit=${c.id}`} className="btn btn-secondary btn-sm" prefetch={false}>Edit</Link></div>}
                  </div>
                ))}
              </div>
              <table className="table only-desktop" data-testid="coupons-table">
                <thead><tr><th>Code</th><th>Discount</th><th className="r">Used</th><th>Status</th>{canEdit && <th></th>}</tr></thead>
                <tbody>
                  {list.map((c) => (
                    <tr key={c.id} data-testid="coupon-row">
                      <td><b>{c.code}</b><div className="muted" style={{ fontSize: 12.5 }}>{c.expiresAt ? `Until ${dateOnly(c.expiresAt)}` : "No end date"}</div></td>
                      <td>{describe(c)}<div className="muted" style={{ fontSize: 12.5 }}>{c.minOrderValue ? `Orders over ${taka(c.minOrderValue)}` : "Any order"}</div></td>
                      <td className="r num">{c.usageCount}{c.usageLimit ? ` / ${c.usageLimit}` : ""}</td>
                      <td><span className={`pill ${STATUS[c.status][1]}`}>{STATUS[c.status][0]}</span></td>
                      {canEdit && (
                        <td>
                          <div className="row" style={{ flexWrap: "nowrap" }}>
                            <Link href={`/marketing/coupons?edit=${c.id}`} className="link" prefetch={false}>Edit</Link>
                            <form action={toggleCouponAction.bind(null, c.id, !c.isActive)}><SubmitButton className="link" pending="…" style={{ border: 0, background: "none", cursor: "pointer", padding: 0 }}>{c.isActive ? "Turn off" : "Turn on"}</SubmitButton></form>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        <div className="col stack">
          {canEdit && (creating || editing) && (
            <>
              <CouponForm
                key={editing?.id ?? "new"} id={editing?.id ?? null}
                initial={editing ? { code: editing.code, type: editing.type, value: editing.value, minOrderValue: editing.minOrderValue, usageLimit: editing.usageLimit, perCustomerLimit: editing.perCustomerLimit, startsAt: isoDay(editing.startsAt), expiresAt: isoDay(editing.expiresAt) } : { code: "", type: "PERCENTAGE", value: 0, minOrderValue: null, usageLimit: null, perCustomerLimit: 1, startsAt: isoDay(new Date()), expiresAt: "" }}
              />
              {editing && (
                <form action={deleteCouponAction.bind(null, editing.id)} className="card">
                  <p className="muted" style={{ marginBottom: 10 }}>{editing.usageCount > 0 ? "This coupon has been used, so it will be switched off, not deleted." : "This coupon has not been used and will be deleted."}</p>
                  <SubmitButton className="btn btn-danger" pending="…">{editing.usageCount > 0 ? "Switch off" : "Delete coupon"}</SubmitButton>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
