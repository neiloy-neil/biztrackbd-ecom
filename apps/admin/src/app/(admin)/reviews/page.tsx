import type { Metadata } from "next";
import Link from "next/link";
import { can, getModuleStatus, listReviews, reviewTabCounts, reviewsAutoPublish, type ReviewTab } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { PageHeader } from "@biztrackbd/ui";
import { AppDisabledNotice } from "@/components/app-disabled-notice";
import { dateOnly, prettyPhone } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { autoPublishAction, hideAction, publishAction, replyAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reviews" };

const TABS: { key: ReviewTab; label: string; alert?: boolean }[] = [
  { key: "pending", label: "Waiting for you", alert: true },
  { key: "published", label: "Published" },
  { key: "hidden", label: "Hidden" },
  { key: "all", label: "All" },
];

export default async function Reviews({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("marketing");
  const mod = await getModuleStatus(s.tenantId, "product_reviews");

  if (!mod.active) {
    return (
      <AppDisabledNotice
        appName="Product Reviews & Social Proof"
        appKey="product_reviews"
        planTier={mod.planTier}
        minPlan="STARTER"
        description="Collect verified buyer photo reviews, star ratings, and display authentic social proof on your product pages."
      />
    );
  }

  const tab = (TABS.find((t) => t.key === one(sp.tab))?.key ?? "pending") as ReviewTab;
  const canEdit = can(s.user.role, "marketing", "edit");
  const [rows, counts, auto] = await Promise.all([listReviews(s.tenantId, s.actor, tab), reviewTabCounts(s.tenantId, s.actor), reviewsAutoPublish(s.tenantId)]);
  const err = one(sp.err);
  const done = one(sp.done);
  const DONE: Record<string, string> = { published: "Review published.", hidden: "Review hidden.", replied: "Reply saved.", saved: "Setting saved." };

  return (
    <>
      <PageHeader
        title="Reviews"
        crumbs={[{ label: "Home", href: "/" }, { label: "Reviews" }]}
        sub="Only customers whose order was delivered can review a product. Read each one, then publish or hide it."
      />
      <nav className="tabs" aria-label="Status">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/reviews?tab=${t.key}`}
            aria-current={t.key === tab ? "page" : undefined}
            prefetch={false}
          >
            {t.label}
            <span className={`n${t.alert && counts[t.key] > 0 ? " alert" : ""}`}>{counts[t.key]}</span>
          </Link>
        ))}
      </nav>
      {err && <div className="notice bad mb-md" role="alert">{err}</div>}
      {done && DONE[done] && <div className="notice good mb-md" role="status">{DONE[done]}</div>}

      {rows.length === 0 ? (
        <div className="card empty" data-testid="reviews-empty">
          {tab === "pending" ? "No reviews waiting." : "Nothing here."}
        </div>
      ) : (
        <div className="stack">
          {rows.map((r) => (
            <section key={r.id} className="card" data-testid="review-card">
              <div className="card-head">
                <h2>
                  <span aria-label={`${r.rating} stars`} className="text-warning">
                    {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}
                  </span>{" "}
                  {r.title ?? ""}
                </h2>
                <span className={`pill ${r.isPublished ? "ok" : r.everDecided ? "grey" : "warn"}`}>
                  {r.isPublished ? "Published" : r.everDecided ? "Hidden" : "Waiting"}
                </span>
              </div>
              <p className="break-word" data-testid="review-body">{r.body}</p>
              <p className="muted text-sm mt-xs">
                {r.customerName} · <span className="num">{prettyPhone(r.customerPhone)}</span> · {r.productTitle} · {dateOnly(r.createdAt)}
              </p>
              {r.reply && (
                <div className="review-reply">
                  <b>Your reply:</b> {r.reply}
                </div>
              )}
              {canEdit && (
                <div className="stack mt-md">
                  <div className="row">
                    {!r.isPublished && (
                      <form action={publishAction.bind(null, r.id, tab)}>
                        <SubmitButton className="btn btn-success" pending="…">Publish</SubmitButton>
                      </form>
                    )}
                    {(r.isPublished || !r.everDecided) && (
                      <form action={hideAction.bind(null, r.id, tab)}>
                        <SubmitButton className="btn btn-secondary" pending="…">
                          {r.isPublished ? "Hide" : "Reject"}
                        </SubmitButton>
                      </form>
                    )}
                  </div>
                  <details>
                    <summary className="link cursor-pointer">{r.reply ? "Change your reply" : "Reply"}</summary>
                    <form action={replyAction.bind(null, r.id, tab)} className="stack mt-xs">
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
        <form action={autoPublishAction.bind(null, tab)} className="card stack mt-md" data-testid="auto-publish">
          <h2>Publishing</h2>
          <label className="row nowrap gap-sm">
            <input type="checkbox" name="on" defaultChecked={auto} className="pick-checkbox" />
            Publish new reviews at once, without waiting for me
          </label>
          <div><SubmitButton className="btn btn-secondary" pending="Saving…">Save</SubmitButton></div>
          <p className="muted text-sm">You can still hide any review later.</p>
        </form>
      )}
    </>
  );
}
