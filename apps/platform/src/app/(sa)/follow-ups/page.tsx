import type { Metadata } from "next";
import Link from "next/link";
import { listCrmTeam, listFollowUps, type FollowUpBucket } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { dateTime } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { completeFromQueueAction, removeFromQueueAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Follow-ups" };

const BUCKETS: { id: FollowUpBucket; label: string }[] = [
  { id: "overdue", label: "Overdue" }, { id: "today", label: "Today" }, { id: "upcoming", label: "Upcoming" }, { id: "done", label: "Done (30 days)" },
];
const field = { height: 40, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 8, background: "#fff" } as const;

export default async function FollowUps({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("tenants");
  const team = await listCrmTeam(s.actor);
  const assigneeRaw = one(sp.assignee) ?? "me";
  const assignee = ["me", "all", "none"].includes(assigneeRaw) || team.some((u) => u.id === assigneeRaw) ? assigneeRaw : "me";
  const bucketRaw = one(sp.bucket);
  const q = await listFollowUps(s.actor, { assignee, bucket: BUCKETS.some((b) => b.id === bucketRaw) ? (bucketRaw as FollowUpBucket) : undefined });
  const err = one(sp.err);
  const here = `/follow-ups?assignee=${encodeURIComponent(assignee)}&bucket=${q.bucket}`;

  return (
    <div className="stack">
      <div className="page-head"><h1>Follow-ups</h1></div>
      <p className="page-sub">What the team owes our stores, and when. Add one from a store&apos;s page.</p>
      {err && <div className="notice bad" role="alert">{err}</div>}

      <form className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input type="hidden" name="bucket" value={q.bucket} />
        <label htmlFor="fu-assignee" style={{ fontSize: 13.5, fontWeight: 600 }}>Showing</label>
        <select id="fu-assignee" name="assignee" defaultValue={assignee} style={field}>
          <option value="me">My follow-ups</option>
          <option value="all">Everyone&apos;s</option>
          <option value="none">Nobody&apos;s</option>
          {team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <button className="btn btn-secondary btn-sm" type="submit">Show</button>
      </form>

      <div style={{ display: "flex", gap: 24, borderBottom: "1px solid var(--line)", overflowX: "auto" }} role="tablist" aria-label="Follow-up groups">
        {BUCKETS.map((b) => {
          const active = b.id === q.bucket;
          return (
            <Link key={b.id} href={`/follow-ups?assignee=${encodeURIComponent(assignee)}&bucket=${b.id}`} prefetch={false} role="tab" aria-selected={active} data-testid={`bucket-${b.id}`}
              style={{ padding: "6px 0 12px", borderBottom: active ? "2.5px solid var(--brand)" : "2.5px solid transparent", marginBottom: -1, fontSize: 14, fontWeight: active ? 700 : 600, color: active ? "var(--ink)" : "var(--ink-3)", textDecoration: "none", whiteSpace: "nowrap" }}>
              {b.label} <span className="muted">{q.counts[b.id]}</span>
            </Link>
          );
        })}
      </div>

      {q.items.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center" }} data-testid="followups-empty"><span className="muted">Nothing here.</span></div>
      ) : (
        <div style={{ display: "grid", gap: 10 }} data-testid="followup-list">
          {q.items.map((f) => (
            <form key={f.id} className="card" style={{ padding: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", borderLeft: f.daysLate > 0 ? "4px solid var(--danger)" : undefined }} data-testid={`queue-${f.id}`}>
              <input type="hidden" name="back" value={here} />
              <div style={{ flex: "1 1 280px", fontSize: 14 }}>
                <Link href={`/tenants/${f.tenantId}`} prefetch={false} style={{ fontWeight: 700, color: "var(--ink)" }}>{f.storeName}</Link> <span className="muted">({f.subdomain})</span>
                <div>{f.note}</div>
                <div className="muted" style={{ fontSize: 12.5 }}>
                  {f.status === "DONE" ? `Done ${dateTime(f.doneAt)}` : `${dateTime(f.dueAt)}${f.daysLate > 0 ? ` · ${f.daysLate} day${f.daysLate === 1 ? "" : "s"} late` : ""}`} · {f.assigneeName ?? "Nobody"}
                </div>
              </div>
              {f.status === "OPEN" && (
                <>
                  <input name="outcome" placeholder="What came of it?" aria-label={`What came of the follow-up for ${f.storeName}`} maxLength={300} style={{ ...field, flex: "1 1 180px" }} />
                  <SubmitButton formAction={completeFromQueueAction.bind(null, f.id)} className="btn btn-primary btn-sm" pending="Saving…">Done</SubmitButton>
                  <SubmitButton formAction={removeFromQueueAction.bind(null, f.id)} className="btn btn-secondary btn-sm" pending="…">Remove</SubmitButton>
                </>
              )}
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
