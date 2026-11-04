import type { Metadata } from "next";
import Link from "next/link";
import { listThemeStore, type ThemeStoreItem } from "@biztrackbd/core";
import { PageHeader } from "@biztrackbd/ui";
import { DemoLocked } from "@/components/demo-locked";
import { SubmitButton } from "@/components/ui";
import { trialHref } from "@/lib/demo";
import { taka } from "@/lib/format";
import { one } from "@/lib/query";
import { requireAccess } from "@/lib/session";
import { applyThemeAction } from "./actions";
import { BuyForm } from "./buy-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Themes" };

/** The look of each theme: a swatch for the cards without a preview picture. */
const SWATCH: Record<string, string> = {
  kapor: "linear-gradient(135deg,#E9DCCB 0 50%,#8C5A3C 50%)",
  gadgetstudio: "linear-gradient(135deg,#F6F8FC 0 50%,#155EEF 50%)",
  "mini-bunny": "linear-gradient(135deg,#FFF0E8 0 50%,#C24173 50%)",
  axionwear: "linear-gradient(135deg,#0B0D0F 0 50%,#D7FF3F 50%)",
  bindu: "linear-gradient(135deg,#FFF2F5 0 50%,#8A2855 50%)",
  berber: "linear-gradient(135deg,#0D121E 0 50%,#C9A24B 50%)",
  freshbasket: "linear-gradient(135deg,#FFF8EC 0 50%,#B4421C 50%)",
  bazaar: "linear-gradient(135deg,#F8F6F1 0 50%,#C2410C 50%)",
  nakshi: "linear-gradient(135deg,#FBF6EE 0 50%,#7A1F2E 50%)",
  maison: "linear-gradient(135deg,#FAF7F2 0 50%,#8F4A2B 50%)",
  voltedge: "linear-gradient(135deg,#0A1020 0 50%,#38BDF8 50%)",
  lumiere: "linear-gradient(135deg,#FDF7FB 0 50%,#7B3FA0 50%)",
  harvest: "linear-gradient(135deg,#FFFBF0 0 50%,#B45309 50%)",
};
/** Themes that have a picture of their demo store in /theme-previews. */
const HAS_PREVIEW = new Set(["kapor", "gadgetstudio", "mini-bunny", "axionwear", "bindu", "berber", "freshbasket", "bazaar", "nakshi", "maison", "voltedge", "lumiere", "harvest"]);
const DEMO_HOST: Record<string, string> = { "mini-bunny": "minibunny" };

/** Where a theme's live demo store is: <name>.<root domain>. */
function previewUrl(id: string): string {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? (process.env.NODE_ENV === "production" ? "biztrack.bd" : "localhost:3000");
  return `${root.includes("localhost") ? "http" : "https"}://${DEMO_HOST[id] ?? id}.${root}`;
}

export default async function Themes({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("design");
  if (s.demo) return <DemoLocked what="Themes" keepHref={trialHref(s.demo.keep)} />;
  const store = await listThemeStore(s.tenantId, s.actor);
  const free = store.themes.filter((t) => !t.premium);
  const premium = store.themes.filter((t) => t.premium);
  const canEdit = s.user.role === "STORE_OWNER" || s.user.role === "STORE_MANAGER" || s.user.role === "CONTENT_EDITOR";
  const canBuy = s.user.role === "STORE_OWNER";

  return (
    <>
      <PageHeader title="Themes" crumbs={[{ label: "Home", href: "/" }, { label: "Themes" }]} sub="Pick how your store looks. Changing the theme keeps your products, orders and pages." />
      {one(sp.applied) && <div className="notice good" role="status" style={{ marginBottom: 12 }} data-testid="theme-applied">Theme applied. <Link href="/design" className="link">Edit it in the designer</Link></div>}
      {one(sp.bought) && <div className="notice good" role="status" style={{ marginBottom: 12 }} data-testid="theme-bought">Payment received. Your new theme is unlocked and yours for life. Press Apply on it below.</div>}
      {one(sp.cancelled) && <div className="notice" role="status" style={{ marginBottom: 12 }}>Payment cancelled. You were not charged.</div>}
      {one(sp.sent) && <div className="notice good" role="status" style={{ marginBottom: 12 }} data-testid="purchase-sent">Thank you. We will check your payment and unlock the theme, usually within a few hours.</div>}
      {one(sp.err) && <div className="notice bad" role="alert" style={{ marginBottom: 12 }}>{one(sp.err)}</div>}

      <section aria-labelledby="premium-h" style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <h2 id="premium-h" style={{ margin: 0 }}>Premium themes</h2>
          <span className="muted" style={{ fontSize: 14 }}>Each theme has its own price. Some are included in your plan.</span>
        </div>
        <div className="theme-grid" data-testid="premium-themes">
          {premium.map((t) => <ThemeCard key={t.id} t={t} canEdit={canEdit} canBuy={canBuy} payTo={store.payTo} online={store.online} />)}
        </div>
      </section>

      <section aria-labelledby="free-h">
        <h2 id="free-h" style={{ margin: "0 0 12px" }}>Free themes</h2>
        <div className="theme-grid" data-testid="free-themes">
          {free.map((t) => <ThemeCard key={t.id} t={t} canEdit={canEdit} canBuy={canBuy} payTo={store.payTo} online={store.online} />)}
        </div>
      </section>

      <style>{`
        .theme-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
        .theme-card { display: flex; flex-direction: column; border: 1px solid var(--border, #e5e7eb); border-radius: 12px; overflow: hidden; background: var(--surface, #fff); }
        .theme-card[data-active="true"] { outline: 2px solid var(--accent, #0a7); }
        .theme-shot { aspect-ratio: 16 / 10; background-size: cover; background-position: top; border-bottom: 1px solid var(--border, #e5e7eb); }
        .theme-body { padding: 14px; display: grid; gap: 8px; flex: 1; align-content: start; }
        .theme-body h3 { margin: 0; font-size: 17px; }
        .theme-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
        .theme-actions .btn, .theme-actions a.btn { min-height: 44px; display: inline-flex; align-items: center; }
      `}</style>
    </>
  );
}

function ThemeCard({ t, canEdit, canBuy, payTo, online }: { t: ThemeStoreItem; canEdit: boolean; canBuy: boolean; online: boolean; payTo: { provider: "BKASH" | "NAGAD"; number: string; kind: string }[] }) {
  const shot = HAS_PREVIEW.has(t.id) ? `url(/theme-previews/${t.id}.webp)` : SWATCH[t.id];
  return (
    <article className="theme-card" data-active={t.active} data-testid={`theme-${t.id}`}>
      <div className="theme-shot" style={{ backgroundImage: shot ?? SWATCH.kapor }} role="img" aria-label={`${t.name} preview`} />
      <div className="theme-body">
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <h3>{t.name}</h3>
          {t.premium && <span className="pill warn" style={{ fontSize: 12 }}>Premium</span>}
          {t.active && <span className="pill ok" style={{ fontSize: 12 }}>In use</span>}
          {t.state === "OWNED" && !t.active && <span className="pill ok" style={{ fontSize: 12 }}>{t.priceModel === "MONTHLY" && t.expiresAt ? `Active until ${t.expiresAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "Owned"}</span>}
          {t.state === "INCLUDED" && !t.active && <span className="pill ok" style={{ fontSize: 12 }}>Included in your plan</span>}
          {t.state === "PENDING" && <span className="pill warn" style={{ fontSize: 12 }}>Payment being checked</span>}
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>{t.blurb}</p>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>Best for: {t.audience}</p>
        {t.lastRejection && <p className="notice bad" role="alert" style={{ margin: 0, fontSize: 13 }}>Your last payment was not accepted: {t.lastRejection}</p>}
        <div className="theme-actions">
          <a className="btn btn-secondary" href={previewUrl(t.id)} target="_blank" rel="noopener noreferrer" data-testid={`preview-${t.id}`}>Live preview</a>
          {(t.state === "FREE" || t.state === "OWNED" || t.state === "INCLUDED") && !t.active && canEdit && (
            <form action={applyThemeAction}>
              <input type="hidden" name="themeId" value={t.id} />
              <SubmitButton pending="Applying…" data-testid={`apply-${t.id}`}>Apply</SubmitButton>
            </form>
          )}
        </div>
        {t.state === "LOCKED" && (canBuy
          ? <BuyForm themeId={t.id} themeName={t.name} price={t.price} monthly={t.priceModel === "MONTHLY"} renew={t.expired} payTo={payTo} online={online} />
          : <p className="muted" style={{ margin: 0, fontSize: 13 }}>Ask the store owner to buy this theme.</p>)}
      </div>
    </article>
  );
}
