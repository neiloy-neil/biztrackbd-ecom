import type { Metadata } from "next";
import { NOTIFY_KINDS, NOTIFY_LABELS, canPlatform, listNotifications, listNotifyRecipients } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";
import { removeRecipientAction, saveRecipientAction, testRecipientAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Notifications" };

const when = (d: Date) => d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" });
const flash = (ok: boolean) => ({ padding: "12px 16px", borderRadius: 8, fontWeight: 600, background: ok ? "var(--success-bg)" : "var(--danger-bg)", color: ok ? "var(--success)" : "var(--danger)" }) as const;
const cell = { padding: "12px 16px", borderBottom: "1px solid var(--line)" } as const;

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const s = await requireAccess("tenants");
  const sp = await searchParams;
  const [recipients, feed] = await Promise.all([listNotifyRecipients(s.actor), listNotifications(s.actor, 60)]);
  const canEdit = canPlatform(s.user.role, "settings", "edit");
  const ok = typeof sp.ok === "string" ? sp.ok : null;
  const err = typeof sp.err === "string" ? sp.err : null;

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="page-head">
        <h1>Notifications</h1>
        <p style={{ margin: "4px 0 0", color: "var(--ink-3)", fontSize: 13.5 }}>
          Choose who gets an email when something happens, and see everything that happened. Every event also appears in the list below even if nobody is on the email list.
        </p>
      </div>

      {ok && <div role="status" style={flash(true)}>{ok}</div>}
      {err && <div role="alert" style={flash(false)}>{err}</div>}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 22px", fontSize: 14, fontWeight: 700, borderBottom: "1px solid var(--line)" }}>Who gets emails</div>

        {canEdit && (
          <form action={saveRecipientAction} style={{ ...cell, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", background: "var(--bg)" }}>
            <input name="email" type="email" required placeholder="name@example.com" className="input" style={{ height: 38, flex: "1 1 220px" }} aria-label="Email address" />
            <input name="label" placeholder="Name or role (optional)" className="input" style={{ height: 38, flex: "1 1 160px" }} aria-label="Name or role" />
            {NOTIFY_KINDS.map((k) => (
              <label key={k} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
                <input type="checkbox" name={`event_${k}`} defaultChecked={k === "SIGNUP"} /> {NOTIFY_LABELS[k]}
              </label>
            ))}
            <input type="hidden" name="active" value="on" />
            <button type="submit" className="btn btn-primary btn-sm">Add</button>
          </form>
        )}

        {recipients.length === 0 ? (
          <div style={{ padding: 28, textAlign: "center", color: "var(--ink-3)", fontSize: 13.5 }}>
            Nobody is on the list yet, so no emails go out. {canEdit ? "Add an address above." : "Ask the platform owner to add one."}
          </div>
        ) : (
          recipients.map((r) => (
            <div key={r.id} style={{ ...cell, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", opacity: r.active ? 1 : 0.6 }}>
              <form action={saveRecipientAction} style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", flex: 1 }}>
                <input type="hidden" name="id" value={r.id} />
                <input name="email" type="email" required defaultValue={r.email} className="input" style={{ height: 36, flex: "1 1 220px" }} disabled={!canEdit} aria-label="Email address" />
                <input name="label" defaultValue={r.label ?? ""} placeholder="Name or role" className="input" style={{ height: 36, flex: "1 1 140px" }} disabled={!canEdit} aria-label="Name or role" />
                {NOTIFY_KINDS.map((k) => (
                  <label key={k} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
                    <input type="checkbox" name={`event_${k}`} defaultChecked={r.events.includes(k)} disabled={!canEdit} /> {NOTIFY_LABELS[k]}
                  </label>
                ))}
                <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
                  <input type="checkbox" name="active" defaultChecked={r.active} disabled={!canEdit} /> On
                </label>
                {canEdit && <button type="submit" className="btn btn-secondary btn-sm">Save</button>}
              </form>
              {canEdit && (
                <>
                  <form action={testRecipientAction}>
                    <input type="hidden" name="email" value={r.email} />
                    <button type="submit" className="btn btn-secondary btn-sm">Send test</button>
                  </form>
                  <form action={removeRecipientAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className="btn btn-secondary btn-sm" style={{ color: "var(--danger)" }}>Remove</button>
                  </form>
                </>
              )}
            </div>
          ))
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 22px", fontSize: 14, fontWeight: 700, borderBottom: "1px solid var(--line)" }}>Recent activity</div>
        {feed.length === 0 ? (
          <div style={{ padding: 28, textAlign: "center", color: "var(--ink-3)", fontSize: 13.5 }}>Nothing yet. New signups, inquiries, payment proofs and tickets will show here.</div>
        ) : (
          feed.map((n) => (
            <details key={n.id} style={cell}>
              <summary style={{ cursor: "pointer", display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ padding: "2px 9px", borderRadius: 10, fontSize: 11.5, fontWeight: 600, background: "var(--bg)", color: "var(--ink-2)" }}>
                  {NOTIFY_LABELS[n.kind as keyof typeof NOTIFY_LABELS] ?? n.kind}
                </span>
                <b style={{ flex: 1, fontSize: 14 }}>{n.title}</b>
                <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{when(n.createdAt)}</span>
              </summary>
              <table style={{ marginTop: 10, fontSize: 13, borderCollapse: "collapse" }}>
                <tbody>
                  {n.rows.map(([k, v]) => (
                    <tr key={k}>
                      <td style={{ padding: "3px 14px 3px 0", color: "var(--ink-3)", whiteSpace: "nowrap", verticalAlign: "top" }}>{k}</td>
                      <td style={{ padding: "3px 0", fontWeight: 600 }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {n.link && /^https?:\/\//.test(n.link.url) && (
                <p style={{ margin: "8px 0 0", fontSize: 13 }}>
                  <a href={n.link.url} target="_blank" rel="noopener noreferrer">{n.link.label} ↗</a>
                </p>
              )}
            </details>
          ))
        )}
      </div>
    </div>
  );
}
