import type { Metadata } from "next";
import Link from "next/link";
import { DEMO_SESSION_HOURS, DEMO_TEMPLATES } from "@biztrackbd/core";
import { one } from "@/lib/query";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Try the BizTrackBD admin", robots: { index: false } };

/** Pick a demo store to run. Public: nothing here needs a sign-in. */
export default async function DemoChooser({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const msg = one((await searchParams).msg);
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 16px 56px" }}>
      <h1 style={{ marginTop: 0 }}>Try the admin</h1>
      <p className="muted">Pick a store. You get your own private copy with products and orders, to look around and change as you like. It is deleted after {DEMO_SESSION_HOURS} hours. Nothing you do here reaches real customers.</p>
      {msg && <div className="notice bad" role="alert" data-testid="demo-msg" style={{ margin: "12px 0" }}>{msg}</div>}
      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }} data-testid="demo-choices">
        {DEMO_TEMPLATES.map((t) => (
          <li key={t.id} className="card" style={{ display: "grid", gap: 6 }}>
            <b>{t.storeName}</b>
            <span className="muted" style={{ fontSize: 13.5 }}>{t.tagline}</span>
            <Link className="btn btn-primary" href={`/demo/start?template=${t.id}`} prefetch={false} data-testid={`demo-open-${t.id}`}>Open this admin</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
