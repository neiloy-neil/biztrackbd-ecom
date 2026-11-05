import type { Metadata } from "next";
import Link from "next/link";
import { CAMPAIGN_PLACEHOLDERS, canPlatform, listAutomations, listMerchantCampaigns, listSegments } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { dateTime } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { createCampaignAction, toggleAutomationAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Campaigns to stores" };

const STATUS: Record<string, [string, string]> = { DRAFT: ["Draft", "warn"], SENDING: ["Sending", "info"], SENT: ["Sent", "ok"] };
const MESSAGES: Record<string, string> = { deleted: "Draft deleted.", "automation-on": "Automation switched on. It runs with the daily sweep.", "automation-off": "Automation switched off." };
const field = { height: 40, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 8, background: "#fff", font: "inherit" } as const;

export default async function Campaigns({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("tenants");
  const canEdit = canPlatform(s.user.role, "tenants", "edit");
  const [campaigns, automations, segments] = await Promise.all([listMerchantCampaigns(s.actor), listAutomations(s.actor), listSegments(s.actor)]);
  const err = one(sp.err);
  const done = one(sp.done);

  return (
    <div className="stack">
      <div className="page-head"><h1>Campaigns to stores</h1></div>
      <p className="page-sub">Messages from us to store owners. Billing and account messages are separate and always go out. Everything here respects an owner&apos;s opt-out.</p>
      {err && <div className="notice bad" role="alert" data-testid="campaign-error">{err}</div>}
      {done && MESSAGES[done] && <div className="notice good" role="status">{MESSAGES[done]}</div>}

      <section className="card" style={{ padding: 16 }} aria-labelledby="auto-h" data-testid="automations">
        <h2 id="auto-h" style={{ margin: "0 0 4px", fontSize: 17 }}>Automatic nudges</h2>
        <p className="muted" style={{ margin: "0 0 12px", fontSize: 13.5 }}>Email only. Each store gets each nudge once (near a limit: at most once a month). All are off until you switch them on. Welcome, trial ending, renewal and overdue emails already send on their own.</p>
        <div style={{ display: "grid", gap: 10 }}>
          {automations.map((a) => (
            <div key={a.key} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", paddingTop: 10, borderTop: "1px solid var(--line)" }} data-testid={`automation-${a.key}`}>
              <div style={{ flex: "1 1 320px" }}>
                <b>{a.label}</b> <span className={`pill ${a.enabled ? "ok" : "warn"}`}>{a.enabled ? "On" : "Off"}</span>
                <div className="muted" style={{ fontSize: 13 }}>{a.when} Sent in the last 30 days: {a.sentLast30Days}.</div>
              </div>
              {canEdit && (
                <form action={toggleAutomationAction.bind(null, a.key, !a.enabled)}>
                  <SubmitButton className={a.enabled ? "btn btn-secondary btn-sm" : "btn btn-primary btn-sm"} pending="Saving…">{a.enabled ? "Switch off" : "Switch on"}</SubmitButton>
                </form>
              )}
            </div>
          ))}
        </div>
      </section>

      {canEdit && (
        <section className="card" style={{ padding: 16 }} aria-labelledby="new-h">
          <h2 id="new-h" style={{ margin: "0 0 10px", fontSize: 17 }}>Write a campaign</h2>
          {segments.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>A campaign goes to a saved group of stores. <Link href="/segments" className="link" prefetch={false}>Build and save a segment first</Link>.</p>
          ) : (
            <form action={createCampaignAction} style={{ display: "grid", gap: 12, maxWidth: 640 }} data-testid="campaign-form">
              <label style={{ display: "grid", gap: 4, fontSize: 13 }}>Name (for us, owners do not see it)
                <input name="name" required minLength={2} maxLength={80} style={field} />
              </label>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <label style={{ display: "grid", gap: 4, fontSize: 13 }}>Goes to
                  <select name="segmentId" required style={field}>{segments.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.count} stores)</option>)}</select>
                </label>
                <label style={{ display: "grid", gap: 4, fontSize: 13 }}>By
                  <select name="channel" style={field}><option value="EMAIL">Email</option><option value="SMS">Text message (costs us money, capped)</option></select>
                </label>
              </div>
              <label style={{ display: "grid", gap: 4, fontSize: 13 }}>Subject (email only)
                <input name="subject" maxLength={120} style={field} />
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 13 }}>Message
                <textarea name="body" required minLength={5} maxLength={2000} rows={6} style={{ ...field, height: "auto", padding: 10 }} />
              </label>
              <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>You can use {CAMPAIGN_PLACEHOLDERS.join(" ")}. Texts can be up to 320 characters. You will test it and confirm the number of stores before anything is sent.</p>
              <div><SubmitButton className="btn btn-primary btn-sm" pending="Saving…">Save draft</SubmitButton></div>
            </form>
          )}
        </section>
      )}

      <section className="card" style={{ padding: 0, overflowX: "auto" }} aria-labelledby="list-h" data-testid="campaign-list">
        <h2 id="list-h" style={{ margin: 0, padding: "14px 16px", fontSize: 17 }}>Campaigns ({campaigns.length})</h2>
        {campaigns.length === 0 ? <p className="muted" style={{ padding: "0 16px 16px", margin: 0 }}>None yet.</p> : (
          <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead><tr style={{ background: "var(--bg)", textAlign: "left", fontSize: 12, color: "var(--ink-3)" }}>
              <th scope="col" style={{ padding: "10px 16px" }}>NAME</th><th scope="col">GROUP</th><th scope="col">BY</th><th scope="col">STATUS</th><th scope="col" style={{ textAlign: "right" }}>SENT</th><th scope="col" style={{ paddingRight: 16 }}>WHEN</th>
            </tr></thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} style={{ borderTop: "1px solid var(--line)" }} data-testid={`campaign-${c.id}`}>
                  <td style={{ padding: "12px 16px" }}><Link href={`/campaigns/${c.id}`} prefetch={false} style={{ fontWeight: 700, color: "var(--ink)" }}>{c.name}</Link></td>
                  <td>{c.segmentName ?? "Custom filter"}</td>
                  <td>{c.channel === "EMAIL" ? "Email" : "Text"}</td>
                  <td><span className={`pill ${STATUS[c.status]![1]}`}>{STATUS[c.status]![0]}</span></td>
                  <td className="num" style={{ textAlign: "right" }}>{c.status === "DRAFT" ? "" : c.sentCount}</td>
                  <td style={{ paddingRight: 16 }}>{dateTime(c.sentAt ?? c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
