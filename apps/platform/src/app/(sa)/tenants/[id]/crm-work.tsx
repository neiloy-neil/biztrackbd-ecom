import type { FollowUpView, TimelineEvent } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { dateTime } from "@/lib/format";
import { addFollowUpTaskAction, assignOwnerAction, cancelFollowUpTaskAction, completeFollowUpTaskAction } from "./actions";

const KIND_ICON: Record<TimelineEvent["kind"], string> = { crm: "📞", note: "📝", followup: "⏰", payment: "💳", purchase: "🛒", account: "🏷️", ticket: "🎫", message: "✉️" };
const field = { height: 40, padding: "0 10px", border: "1px solid var(--line-2)", borderRadius: 8, fontSize: 14, background: "#fff" } as const;

/** Who owns this store, what we owe it, and everything that has happened with it. Dates are Dhaka time. */
export function CrmWork({ tenantId, ownerId, team, followUps, timeline, canAssign }: {
  tenantId: string; ownerId: string | null; team: { id: string; name: string }[]; followUps: FollowUpView[]; timeline: TimelineEvent[]; canAssign: boolean;
}) {
  return (
    <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "20px 24px", display: "grid", gap: 20 }} data-testid="crm-work" aria-labelledby="crm-work-h">
      <h2 id="crm-work-h" style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Owner, follow-ups and history</h2>

      <form action={assignOwnerAction.bind(null, tenantId)} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }} data-testid="crm-owner">
        <label htmlFor="crm-assignee" style={{ fontSize: 13.5, fontWeight: 600 }}>Looked after by</label>
        <select id="crm-assignee" name="assignee" defaultValue={ownerId ?? ""} disabled={!canAssign} style={field}>
          <option value="">Nobody yet</option>
          {team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        {canAssign && <SubmitButton className="btn btn-secondary btn-sm" pending="Saving…">Save</SubmitButton>}
      </form>

      <div data-testid="crm-followups">
        <h3 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700 }}>Follow-ups ({followUps.length})</h3>
        {followUps.length === 0 ? (
          <p className="muted" style={{ margin: "0 0 10px", fontSize: 13.5 }}>Nothing is owed to this store.</p>
        ) : (
          <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
            {followUps.map((f) => (
              <form key={f.id} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", padding: "10px 12px", borderRadius: 8, background: f.daysLate > 0 ? "#FEF2F2" : "var(--bg)", border: "1px solid var(--line)" }} data-testid={`followup-${f.id}`}>
                <div style={{ flex: "1 1 240px", fontSize: 13.5 }}>
                  <b>{f.note}</b>
                  <div className="muted" style={{ fontSize: 12.5 }}>
                    {dateTime(f.dueAt)}{f.daysLate > 0 ? ` · ${f.daysLate} day${f.daysLate === 1 ? "" : "s"} late` : ""} · {f.assigneeName ?? "Nobody"}
                  </div>
                </div>
                <input name="outcome" placeholder="What came of it?" aria-label="What came of it" maxLength={300} style={{ ...field, flex: "1 1 160px" }} />
                <SubmitButton formAction={completeFollowUpTaskAction.bind(null, tenantId, f.id)} className="btn btn-primary btn-sm" pending="Saving…">Done</SubmitButton>
                <SubmitButton formAction={cancelFollowUpTaskAction.bind(null, tenantId, f.id)} className="btn btn-secondary btn-sm" pending="…">Remove</SubmitButton>
              </form>
            ))}
          </div>
        )}
        <form action={addFollowUpTaskAction.bind(null, tenantId)} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }} data-testid="followup-add">
          <input name="note" required minLength={2} maxLength={300} placeholder="What to follow up on" aria-label="What to follow up on" style={{ ...field, flex: "2 1 220px" }} />
          <input name="dueAt" type="datetime-local" required aria-label="When it is due" style={field} />
          <select name="assignee" defaultValue="" aria-label="Who does it" style={field}>
            <option value="">Me</option>
            {team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <SubmitButton className="btn btn-primary btn-sm" pending="Adding…">Add follow-up</SubmitButton>
        </form>
      </div>

      <div data-testid="crm-timeline">
        <h3 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700 }}>Everything that happened ({timeline.length})</h3>
        {timeline.length === 0 ? (
          <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>Nothing yet.</p>
        ) : (
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6, maxHeight: 420, overflowY: "auto" }}>
            {timeline.map((e) => (
              <li key={e.id} style={{ display: "flex", gap: 10, fontSize: 13.5, padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                <span aria-hidden="true">{KIND_ICON[e.kind]}</span>
                <span style={{ flex: 1 }}>
                  <b>{e.title}</b>
                  {e.detail && <span style={{ color: "var(--ink-2)" }}>: {e.detail}</span>}
                </span>
                <span className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{e.by ? `${e.by} · ` : ""}{dateTime(e.at)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
