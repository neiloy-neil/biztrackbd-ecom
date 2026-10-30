import type { Metadata } from "next";
import Link from "next/link";
import { can, draftLink, listDraftOrders, type DraftStatus } from "@biztrackbd/core";
import { PageHeader } from "@biztrackbd/ui";
import { SubmitButton } from "@/components/ui";
import { friendlyDate, prettyPhone } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { CopyButton } from "../[id]/forms";
import { cancelDraftAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Draft orders" };

const TONE: Record<DraftStatus, string> = { OPEN: "info", CONVERTED: "ok", EXPIRED: "grey", CANCELLED: "grey" };
const LABEL: Record<DraftStatus, string> = { OPEN: "Waiting for the customer", CONVERTED: "Placed", EXPIRED: "Expired", CANCELLED: "Cancelled" };

export default async function Drafts({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("orders");
  const rows = await listDraftOrders(s.tenantId, s.actor);
  const links = new Map(await Promise.all(rows.filter((r) => r.status === "OPEN").map(async (r) => [r.id, await draftLink(s.tenantId, r.code)] as const)));
  const canEdit = can(s.user.role, "orders", "edit");
  const err = one(sp.err);
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Orders", href: "/orders" }, { label: "Draft orders" }]}
        title="Draft orders"
        sub="Set up an order on the quick desk, save it as a draft and send the customer the link. They check it and place it themselves."
        actions={canEdit ? <Link href="/orders/new" className="btn btn-primary" prefetch={false}>New order</Link> : undefined}
      />
      {err && <div className="notice bad" role="alert" style={{ marginBottom: 12 }}>{err}</div>}
      {rows.length === 0 ? (
        <div className="card empty" data-testid="drafts-empty">No drafts yet. On the quick desk, choose &quot;Save as a draft and get a link&quot;.</div>
      ) : (
        <div className="stack" data-testid="drafts-list">
          {rows.map((r) => (
            <div key={r.id} className="card" data-testid="draft-row">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div><b>{r.customerName}</b> <span className="muted num">{prettyPhone(r.customerPhone)}</span></div>
                <span className={`pill ${TONE[r.status]}`}>{LABEL[r.status]}</span>
              </div>
              <div className="muted" style={{ fontSize: 13 }}>{r.district} · {r.itemCount} {r.itemCount === 1 ? "item" : "items"} · made by {r.createdBy} {friendlyDate(r.createdAt)} · opened {r.opened} {r.opened === 1 ? "time" : "times"}</div>
              {r.status === "CONVERTED" && r.orderId && <div style={{ marginTop: 8 }}><Link href={`/orders/${r.orderId}`} className="link" prefetch={false}>Open the order</Link></div>}
              {r.status === "OPEN" && (
                <div className="row" style={{ marginTop: 10 }}>
                  <CopyButton text={links.get(r.id) ?? ""} label="Copy link" />
                  <a className="btn btn-secondary btn-sm" target="_blank" rel="noopener noreferrer" href={`https://wa.me/88${r.customerPhone}?text=${encodeURIComponent(`Please check and confirm your order: ${links.get(r.id) ?? ""}`)}`}>WhatsApp</a>
                  {canEdit && <form action={cancelDraftAction.bind(null, r.id)}><SubmitButton className="btn btn-secondary btn-sm" pending="…">Cancel it</SubmitButton></form>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
