import type { Metadata } from "next";
import Link from "next/link";
import { can, listReviews, reviewTabCounts, reviewsAutoPublish, type ReviewTab } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { dateOnly, prettyPhone } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { autoPublishAction, hideAction, publishAction, replyAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reviews" };

const TABS: { key: ReviewTab; label: string; alert?: boolean }[] = [{ key: "pending", label: "Waiting for you", alert: true }, { key: "published", label: "Published" }, { key: "hidden", label: "Hidden" }, { key: "all", label: "All" }];

export default async function Reviews({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("marketing");
  const tab = (TABS.find((t) => t.key === one(sp.tab))?.key ?? "pending") as ReviewTab;
  const canEdit = can(s.user.role, "marketing", "edit");
  const [rows, counts, auto] = await Promise.all([listReviews(s.tenantId, s.actor, tab), reviewTabCounts(s.tenantId, s.actor), reviewsAutoPublish(s.tenantId)]);
  const err = one(sp.err);
  const done = one(sp.done);
  const DONE: Record<string, string> = { published: "Review published.", hidden: "Review hidden.", replied: "Reply saved.", saved: "Setting saved." };

  return (
    <>
      <div className="page-head"><h1>Reviews</h1></div>
      <p className="page-sub">Only customers whose order was delivered can review a product. Read each one, then publish or hide it.</p>
      <nav className="tabs" aria-label="Status">
        {TABS.map((t) => <Link key={t.key} href={`/reviews?tab=${t.key}`} aria-current={t.key === tab ? "page" : undefined} prefetch={false}>{t.label}<span className={`n${t.alert && counts[t.key] > 0 ? " alert" : ""}`}>{counts[t.key]}</span></Link>)}
      </nav>
      {err && <div className="notice bad" role="alert" style={{ marginBottom: 12 }}>{err}</div>}
      {done && DONE[done] && <div className="notice good" role="status" style={{ marginBottom: 12 }}>{DONE[done]}</div>}

      {rows.length === 0 ? <div className="card empty" data-testid="reviews-empty">{tab === "pending" ? "No reviews waiting." : "Nothing here."}</div> : (
        <div className="stack">
          {rows.map((r) => (
            <section key={r.id} className="card" data-testid="review-card">
              <div className="card-head">
                <h2><span aria-label={`${r.rating} stars`} style={{ color: "var(--warning)" }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span> {r.title ?? ""}</h2>
                <span className={`pill ${r.isPublished ? "ok" : r.everDecided ? "grey" : "warn"}`}>{r.isPublished ? "Published" : r.everDecided ? "Hidden" : "Waiting"}</span>
              </div>
              <p style={{ overflowWrap: "anywhere" }} data-testid="review-body">{r.body}</p>
              <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>{r.customerName} · <span className="num">{prettyPhone(r.customerPhone)}</span> · {r.productTitle} · {dateOnly(r.createdAt)}</p>
              {r.reply && <p style={{ marginTop: 8, paddingLeft: 12, borderLeft: "3px solid var(--line)", fontSize: 14 }}><b>Your reply:</b> {r.reply}</p>}
              {canEdit && (
                <div className="stack" style={{ marginTop: 12 }}>
                  <div className="row">
                    {!r.isPublished && <form action={publishAction.bind(null, r.id, tab)}><SubmitButton className="btn btn-success" pending="…">Publish</SubmitButton></form>}
                    {(r.isPublished || !r.everDecided) && <form action={hideAction.bind(null, r.id, tab)}><SubmitButton className="btn btn-secondary" pending="…">{r.isPublished ? "Hide" : "Reject"}</SubmitButton></form>}
                  </div>
                  <details>
                    <summary className="link" style={{ cursor: "pointer" }}>{r.reply ? "Change your reply" : "Reply"}</summary>
                    <form action={replyAction.bind(null, r.id, tab)} className="stack" style={{ marginTop: 8 }}>
                      <textarea className="input" name="reply" rows={3} maxLength={500} defaultValue={r.reply ?? ""} aria-label="Reply" />
                      <SubmitButton className="btn btn-secondary" pending="Saving…">Save reply</SubmitButton>
                    </form>
                  </details>
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {canEdit && (
        <form action={autoPublishAction.bind(null, tab)} className="card stack" style={{ marginTop: 14 }} data-testid="auto-publish">
          <h2>Publishing</h2>
          <label className="row" style={{ flexWrap: "nowrap", gap: 8 }}><input type="checkbox" name="on" defaultChecked={auto} style={{ width: 20, height: 20 }} /> Publish new reviews at once, without waiting for me</label>
          <div><SubmitButton className="btn btn-secondary" pending="Saving…">Save</SubmitButton></div>
          <p className="muted" style={{ fontSize: 13 }}>You can still hide any review later.</p>
        </form>
      )}
    </>
  );
}
