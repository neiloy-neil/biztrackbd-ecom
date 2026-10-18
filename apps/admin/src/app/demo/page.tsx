import type { Metadata } from "next";
import Link from "next/link";
import { DEMO_SESSION_HOURS, DEMO_TEMPLATES, BUSINESS_DEMO_TEMPLATES } from "@biztrackbd/core";
import { one } from "@/lib/query";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Try the BizTrackBD admin", robots: { index: false } };

/** Pick a demo store or business to run. Public: nothing here needs a sign-in. */
export default async function DemoChooser({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const msg = one((await searchParams).msg);
  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "32px 16px 56px" }}>
      <h1 style={{ marginTop: 0 }}>Try the BizTrackBD admin</h1>
      <p className="muted">
        Pick a store or business template. You get your own private admin session with realistic products, menus, appointments, or leads to explore and test as you like. It is automatically reset after {DEMO_SESSION_HOURS} hours. Nothing you do here reaches real customers.
      </p>
      {msg && <div className="notice bad" role="alert" data-testid="demo-msg" style={{ margin: "12px 0" }}>{msg}</div>}

      <div style={{ marginTop: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>Online Stores & Retail (Commerce Mode)</h2>
          <span className="badge" style={{ fontSize: 12 }}>eCommerce</span>
        </div>
        <p className="muted" style={{ fontSize: 13.5, margin: "0 0 14px" }}>
          Physical retail with catalog management, product variants, inventory, COD checkout, courier tracking, and fraud radar.
        </p>
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }} data-testid="demo-choices">
          {DEMO_TEMPLATES.map((t) => (
            <li key={t.id} className="card" style={{ display: "grid", gap: 8, padding: 16 }}>
              <div>
                <b style={{ fontSize: 15 }}>{t.storeName}</b>
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{t.tagline}</div>
              </div>
              <Link className="btn btn-primary" href={`/demo/start?template=${t.id}`} prefetch={false} data-testid={`demo-open-${t.id}`} style={{ marginTop: "auto" }}>
                Open store admin
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div style={{ marginTop: 36 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>Restaurants, Clinics & Service Firms (Business Mode)</h2>
          <span className="badge" style={{ fontSize: 12, background: "rgba(16, 185, 129, 0.12)", color: "#059669" }}>Website & Portfolio</span>
        </div>
        <p className="muted" style={{ fontSize: 13.5, margin: "0 0 14px" }}>
          Service & dining workflows with interactive dining QR menus, table reservations, doctor appointments, quote inquiries, and client leads.
        </p>
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }} data-testid="demo-business-choices">
          {BUSINESS_DEMO_TEMPLATES.map((t) => (
            <li key={t.id} className="card" style={{ display: "grid", gap: 8, padding: 16 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
                  <b style={{ fontSize: 15 }}>{t.name}</b>
                  <span className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>{t.vertical}</span>
                </div>
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{t.tagline}</div>
              </div>
              <Link className="btn btn-primary" href={`/demo/start?template=${t.id}`} prefetch={false} data-testid={`demo-open-${t.id}`} style={{ marginTop: "auto" }}>
                Open business admin
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
