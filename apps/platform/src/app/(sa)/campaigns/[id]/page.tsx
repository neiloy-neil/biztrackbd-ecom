import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CAMPAIGN_PLACEHOLDERS, DomainError, SMS_CAMPAIGN_DAILY_CAP, canPlatform, getMerchantCampaign } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { dateTime } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { deleteCampaignAction, editCampaignAction, sendCampaignAction, testCampaignAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Campaign" };

const DONE: Record<string, string> = { created: "Draft saved. Send a test to yourself next.", edited: "Wording saved. Send a new test before sending.", tested: "Test sent. Check it, then confirm below.", sent: "Sent." };
const field = { height: 40, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 8, background: "#fff", font: "inherit" } as const;

export default async function CampaignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const s = await requireAccess("tenants");
  const canEdit = canPlatform(s.user.role, "tenants", "edit");
  const data = await getMerchantCampaign(s.actor, id).catch((e) => { if (e instanceof DomainError) return null; throw e; });
  if (!data) notFound();
  const { campaign: c, preview: p } = data;
  const err = one(sp.err);
  const done = one(sp.done);
  const sms = c.channel === "SMS";

  return (
    <div className="stack">
      <p style={{ margin: 0 }}><Link href="/campaigns" className="link" prefetch={false}>← Campaigns</Link></p>
      <div className="page-head"><h1>{c.name}</h1></div>
      <p className="page-sub">{sms ? "Text message" : "Email"} to {c.segmentName ?? "a custom group"} · {c.status === "SENT" ? `sent ${dateTime(c.sentAt)}` : c.status === "SENDING" ? "sending" : "draft"}</p>
      {err && <div className="notice bad" role="alert" data-testid="campaign-error">{err}</div>}
      {done && DONE[done] && <div className="notice good" role="status">{DONE[done]}</div>}

      <section className="card" style={{ padding: 16 }} aria-labelledby="reach-h" data-testid="campaign-reach">
        <h2 id="reach-h" style={{ margin: "0 0 8px", fontSize: 17 }}>{c.status === "SENT" ? "Result" : "Who it reaches"}</h2>
        {c.status === "SENT" ? (
          <p style={{ margin: 0 }}>Sent to <b>{c.sentCount}</b> owner{c.sentCount === 1 ? "" : "s"}. Failed: <b>{c.failedCount}</b>. Skipped (opted out or no contact): <b>{c.skippedCount}</b>.</p>
        ) : (
          <>
            <p style={{ margin: 0 }}><b>{p.willSend}</b> of {p.total} stores will get this.</p>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 13.5 }}>Opted out of marketing: {p.optedOut}. No {sms ? "mobile number" : "email address"}: {p.noContact}.{p.alreadyDone > 0 ? ` Already done: ${p.alreadyDone}.` : ""}</p>
            {sms && <p className="muted" style={{ margin: "4px 0 0", fontSize: 13.5 }}>Texts cost us money. All text campaigns together are capped at {SMS_CAMPAIGN_DAILY_CAP} a day.</p>}
          </>
        )}
      </section>

      <section className="card" style={{ padding: 16 }} aria-labelledby="words-h">
        <h2 id="words-h" style={{ margin: "0 0 8px", fontSize: 17 }}>The message</h2>
        {c.status === "DRAFT" && canEdit ? (
          <form action={editCampaignAction.bind(null, id)} style={{ display: "grid", gap: 10, maxWidth: 640 }}>
            {!sms && <label style={{ display: "grid", gap: 4, fontSize: 13 }}>Subject<input name="subject" defaultValue={c.subject ?? ""} maxLength={120} required style={field} /></label>}
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>Message<textarea name="body" defaultValue={c.body} rows={6} required minLength={5} maxLength={2000} style={{ ...field, height: "auto", padding: 10 }} /></label>
            <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>Placeholders: {CAMPAIGN_PLACEHOLDERS.join(" ")}. Saving new words means testing again.</p>
            <div><SubmitButton className="btn btn-secondary btn-sm" pending="Saving…">Save wording</SubmitButton></div>
          </form>
        ) : (
          <div style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{!sms && <b>{c.subject}<br /></b>}{c.body}</div>
        )}
      </section>

      {c.status !== "SENT" && canEdit && (
        <>
          {c.status === "DRAFT" && (
            <section className="card" style={{ padding: 16 }} aria-labelledby="test-h" data-testid="campaign-test">
              <h2 id="test-h" style={{ margin: "0 0 8px", fontSize: 17 }}>1. Send yourself a test {c.tested && <span className="pill ok">Tested</span>}</h2>
              <form action={testCampaignAction.bind(null, id)} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input name="to" required placeholder={sms ? "Your mobile, 01712345678" : "Your email address"} aria-label={sms ? "Mobile number for the test" : "Email address for the test"} defaultValue={sms ? "" : s.user.email} style={{ ...field, minWidth: 260 }} />
                <SubmitButton className="btn btn-secondary btn-sm" pending="Sending…">Send test</SubmitButton>
              </form>
            </section>
          )}
          <section className="card" style={{ padding: 16 }} aria-labelledby="send-h" data-testid="campaign-send">
            <h2 id="send-h" style={{ margin: "0 0 8px", fontSize: 17 }}>{c.status === "SENDING" ? "Finish sending" : "2. Confirm and send"}</h2>
            {c.status === "DRAFT" && !c.tested ? <p className="muted" style={{ margin: 0 }}>Send a test of this exact message first.</p> : (
              <form action={sendCampaignAction.bind(null, id)} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {c.status === "DRAFT" && <input name="confirmCount" type="number" min={0} required placeholder={`Type ${p.willSend}`} aria-label={`Type ${p.willSend} to confirm`} style={{ ...field, width: 140 }} />}
                <SubmitButton className="btn btn-primary btn-sm" pending="Sending…" disabled={c.status === "DRAFT" && p.willSend === 0}>{c.status === "SENDING" ? "Resume sending" : `Send to ${p.willSend} store${p.willSend === 1 ? "" : "s"}`}</SubmitButton>
                {c.status === "DRAFT" && <span className="muted" style={{ fontSize: 13 }}>Type the number of stores to confirm. Sending cannot be undone.</span>}
              </form>
            )}
          </section>
          {c.status === "DRAFT" && <form action={deleteCampaignAction.bind(null, id)}><SubmitButton className="btn btn-secondary btn-sm" pending="…">Delete this draft</SubmitButton></form>}
        </>
      )}
    </div>
  );
}
