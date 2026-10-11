import type { Metadata } from "next";
import Link from "next/link";
import { THEMES } from "@biztrackbd/core";

export const metadata: Metadata = { title: "Templates", description: "Store templates for Bangladeshi businesses." };

export default function Templates() {
  const demo = process.env.NEXT_PUBLIC_DEMO_STORE_URL ?? "http://rongdhonu.localhost:3000";
  return (
    <section className="block">
      <div className="wrap">
        <span className="eyebrow">Templates</span>
        <h1 style={{ fontSize: "clamp(32px, 6vw, 48px)", letterSpacing: "-1.2px", lineHeight: 1.1, fontWeight: 800 }}>Start from a store that already works</h1>
        <p className="sub">Pick a template, add your products, and change the look whenever you want. Products, orders and content stay in place.</p>
        <div className="grid g3" data-testid="templates">
          {THEMES.map((t) => (
            <div key={t.id} className="card" data-testid={`theme-${t.id}`}>
              <div className={`theme${t.live ? "" : " soon"}`} aria-hidden="true">{t.name}</div>
              <div className="row-between"><h3>{t.name}</h3><span className={`pill${t.live ? " live" : ""}`}>{t.live ? "Ready" : "Coming soon"}</span></div>
              <p>{t.blurb}</p>
              {t.live && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
                  <Link href={`/start?theme=${t.id}`} className="btn btn-primary btn-sm" prefetch={false}>Use this template</Link>
                  {t.id === "kapor" && <a href={demo} className="btn btn-secondary btn-sm" target="_blank" rel="noopener noreferrer">See demo store</a>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
