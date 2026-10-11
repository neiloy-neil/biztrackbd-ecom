import type { Metadata } from "next";
import Link from "next/link";
import { can, getTrackingOverview } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { dateTime } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { savePixelAction, testEventAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pixels" };

const LABEL: Record<string, string> = { PageView: "Page views", ViewContent: "Product views", AddToCart: "Added to cart", InitiateCheckout: "Started checkout", AddPaymentInfo: "Payment details", Purchase: "Purchases" };

export default async function Pixels({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("marketing");
  const o = await getTrackingOverview(s.tenantId, s.actor);
  const canEdit = can(s.user.role, "marketing", "edit");
  const c = o.config;
  const err = one(sp.err);
  const done = one(sp.done);
  const total = o.stats.reduce((n, e) => n + e.browser + e.server, 0);

  return (
    <>
      <div className="page-head"><h1>Pixels and tracking</h1></div>
      <p className="page-sub">Tell Facebook which ads led to orders. Each event is sent from the customer's browser and again from our server with the same ID, so Meta counts it once, even when an ad blocker hides the browser copy.</p>
      {err && <div className="notice bad" role="alert" style={{ marginBottom: 12 }} data-testid="pixel-error">{err}</div>}
      {done && <div className="notice good" role="status" style={{ marginBottom: 12 }}>{done === "saved" ? "Pixel ID saved." : "Test event sent. Check Meta's Test Events tab."}</div>}

      <div className="grid grid-2">
        <section className="card" data-testid="pixel-config">
          <div className="card-head"><h2>Facebook Pixel</h2><span className={`pill ${c.pixelId ? "ok" : "grey"}`}>{c.pixelId ? "Installed" : "Not set up"}</span></div>
          <form action={savePixelAction} className="stack">
            <label className="field" style={{ marginBottom: 0 }}><span className="label">Pixel ID</span><input className="input" name="pixelId" inputMode="numeric" defaultValue={c.pixelId ?? ""} placeholder="123456789012345" disabled={!canEdit} data-testid="pixel-id" /></label>
            {canEdit && <div><SubmitButton className="btn btn-primary" pending="Saving…">Save Pixel ID</SubmitButton></div>}
            <p className="muted" style={{ fontSize: 13 }}>Find it in Meta Events Manager under Data sources. Clear the box to switch tracking off.</p>
          </form>
        </section>

        <section className="card" data-testid="capi-config">
          <div className="card-head"><h2>Conversions API</h2><span className={`pill ${c.capiConnected && c.capiStatus === "CONNECTED" ? "ok" : c.capiConnected ? "warn" : "grey"}`}>{c.capiConnected ? (c.capiStatus === "CONNECTED" ? "Connected" : "Needs attention") : "Not connected"}</span></div>
          {c.capiConnected ? (
            <p className="muted" style={{ marginBottom: 10 }}>{c.capiMode === "TEST" ? "Test mode token saved." : "Token saved."}{c.lastError ? ` Last problem: ${c.lastError}` : ""}</p>
          ) : (
            <p className="muted" style={{ marginBottom: 10 }}>Add your access token from Meta in <Link href="/settings/integrations" className="link" prefetch={false}>Integrations</Link> (Meta Conversions API). Without it only the browser copy is sent.</p>
          )}
          {canEdit && c.pixelId && c.capiConnected && (
            <form action={testEventAction} className="row" style={{ flexWrap: "nowrap" }}>
              <input className="input" name="code" placeholder="Test code, like TEST12345" aria-label="Test event code" required />
              <SubmitButton className="btn btn-secondary" pending="Sending…">Send a test event</SubmitButton>
            </form>
          )}
        </section>
      </div>

      <section style={{ marginTop: 14 }}>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Last 7 days</h2>
        {!c.pixelId ? <div className="card empty">Save your Pixel ID to start counting events.</div> : (
          <table className="table" data-testid="event-stats">
            <thead><tr><th>Event</th><th className="r">Browser</th><th className="r">Server</th><th className="r">Matched</th><th className="r">Failed</th></tr></thead>
            <tbody>
              {o.stats.map((e) => (
                <tr key={e.name} data-event={e.name}>
                  <td>{LABEL[e.name] ?? e.name}</td><td className="r num">{e.browser}</td><td className="r num">{e.server}</td>
                  <td className="r num">{e.deduped > 0 ? <span className="pill ok">{e.deduped} counted once</span> : e.browser + e.server > 0 ? "—" : "—"}</td>
                  <td className="r num">{e.failed > 0 ? <span className="pill bad">{e.failed}</span> : 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {c.pixelId && total === 0 && <p className="muted" style={{ marginTop: 10, fontSize: 13 }}>No events yet. Open your store in another tab and look at a product.</p>}
      </section>

      {o.recent.length > 0 && (
        <section style={{ marginTop: 14 }}>
          <h2 style={{ fontSize: 16, marginBottom: 10 }}>Latest events</h2>
          <table className="table" data-testid="recent-events">
            <thead><tr><th>When</th><th>Event</th><th>From</th><th>Result</th></tr></thead>
            <tbody>{o.recent.slice(0, 15).map((e) => <tr key={e.id}><td className="muted">{dateTime(e.createdAt)}</td><td>{e.name}</td><td>{e.origin === "BROWSER" ? "Browser" : "Our server"}</td><td>{e.status === "FAILED" ? <span className="err" style={{ margin: 0 }}>{e.detail ?? "Failed"}</span> : <span className="pill ok">Sent</span>}</td></tr>)}</tbody>
          </table>
        </section>
      )}
    </>
  );
}
