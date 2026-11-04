import type { Metadata } from "next";
import Link from "next/link";
import { canPlatform, listThemeBundles, listThemeCatalogue, listThemeDiscounts } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";
import { SubmitButton } from "@/components/ui";
import { saveBundleAction, saveDiscountAction, setBundleActiveAction, setDiscountActiveAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Theme offers" };

const taka = (n: number) => `৳ ${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const day = (d: Date | null) => (d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dhaka" }) : "no end date");
const inputDate = (d: Date | null) => (d ? new Date(d.getTime() + 6 * 3600_000).toISOString().slice(0, 10) : "");

export default async function ThemeOffersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const s = await requireAccess("tenants");
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const canEdit = canPlatform(s.actor.role, "plans", "edit");
  const [discounts, bundles, themes] = await Promise.all([listThemeDiscounts(s.actor), listThemeBundles(s.actor), listThemeCatalogue(s.actor)]);
  const premium = themes.filter((t) => t.premium && t.status === "PUBLISHED");
  const name = (id: string) => themes.find((t) => t.id === id)?.name ?? id;

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Theme offers</h1>
        <Link className="btn btn-secondary btn-sm" href="/themes">Back to themes and modules</Link>
      </div>
      {one(sp.err) && <div className="notice bad" role="alert">{one(sp.err)}</div>}
      {one(sp.done) && <div className="notice good" role="status">{one(sp.done)}</div>}

      <div className="card" style={{ padding: 0, overflow: "hidden" }} data-testid="discount-codes">
        <div style={{ padding: "18px 24px", fontSize: 16, fontWeight: 700, borderBottom: "1px solid var(--line)" }}>Discount codes</div>
        <p className="muted" style={{ margin: 0, padding: "12px 24px", fontSize: 13.5 }}>A store types a code at theme checkout and sees the new price before paying. The price is worked out on the server and never goes below 1 taka. A rejected payment gives its use back. A code is switched off, never deleted, so past sales still point to it.</p>
        {discounts.map((d) => (
          <form key={d.id} action={saveDiscountAction} data-testid={`discount-${d.code}`} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "12px 24px", borderTop: "1px solid var(--line)" }}>
            <input type="hidden" name="id" value={d.id} />
            <input type="hidden" name="code" value={d.code} />
            <input type="hidden" name="note" value={d.note ?? ""} />
            {d.themeIds.map((t) => <input key={t} type="hidden" name="themeIds" value={t} />)}
            <div style={{ flex: "1 1 200px", minWidth: 180 }}>
              <b>{d.code}</b> {!d.active ? <span className="pill warn">Off</span> : d.expired ? <span className="pill warn">Expired</span> : d.usedUp ? <span className="pill warn">Used up</span> : <span className="pill ok">On</span>}
              <div className="muted" style={{ fontSize: 12 }} data-testid={`usage-${d.code}`}>
                Used {d.usedCount}{d.maxUses !== null ? ` of ${d.maxUses}` : ""} times · took off {taka(d.discountGiven)} · stores paid {taka(d.revenue)} · ends {day(d.expiresAt)}
              </div>
              {d.themeIds.length > 0 && <div className="muted" style={{ fontSize: 12 }}>Only for {d.themeIds.map(name).join(", ")}</div>}
              {d.note && <div className="muted" style={{ fontSize: 12 }}>{d.note}</div>}
            </div>
            <select name="kind" defaultValue={d.kind} aria-label={`${d.code} type`} disabled={!canEdit} style={{ minHeight: 40 }}>
              <option value="PERCENT">Percent off</option><option value="FIXED">Taka off</option>
            </select>
            <input name="value" type="number" min={1} step="1" defaultValue={d.value} aria-label={`${d.code} amount`} disabled={!canEdit} style={{ width: 80, minHeight: 40 }} />
            <input name="expiresAt" type="date" defaultValue={inputDate(d.expiresAt)} aria-label={`${d.code} last day`} disabled={!canEdit} style={{ minHeight: 40 }} />
            <input name="maxUses" type="number" min={1} step="1" defaultValue={d.maxUses ?? ""} placeholder="Max uses" aria-label={`${d.code} max uses`} disabled={!canEdit} style={{ width: 100, minHeight: 40 }} />
            {canEdit && (
              <>
                <SubmitButton pending="Saving…">Save</SubmitButton>
                <SubmitButton formAction={setDiscountActiveAction.bind(null, d.id, !d.active)} className="btn btn-secondary" pending="Working…">{d.active ? "Switch off" : "Switch on"}</SubmitButton>
              </>
            )}
          </form>
        ))}
        {discounts.length === 0 && <p className="muted" style={{ padding: "12px 24px", margin: 0, borderTop: "1px solid var(--line)" }}>No codes yet.</p>}
        {canEdit && (
          <form action={saveDiscountAction} data-testid="new-discount" style={{ display: "grid", gap: 10, padding: "16px 24px", borderTop: "1px solid var(--line)", background: "var(--bg)" }}>
            <b style={{ fontSize: 14 }}>New code</b>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input name="code" placeholder="EID25" required autoCapitalize="characters" aria-label="Code" style={{ width: 140, minHeight: 40 }} />
              <select name="kind" aria-label="Type" style={{ minHeight: 40 }}><option value="PERCENT">Percent off</option><option value="FIXED">Taka off</option></select>
              <input name="value" type="number" min={1} step="1" placeholder="Amount" required aria-label="Amount" style={{ width: 90, minHeight: 40 }} />
              <label style={{ display: "grid", fontSize: 12, gap: 2 }}>Last day (optional)<input name="expiresAt" type="date" style={{ minHeight: 40 }} /></label>
              <input name="maxUses" type="number" min={1} step="1" placeholder="Max uses" aria-label="Max uses" style={{ width: 100, minHeight: 40 }} />
              <input name="note" placeholder="Note (optional)" aria-label="Note" style={{ flex: "1 1 160px", minHeight: 40 }} />
            </div>
            <fieldset style={{ border: 0, margin: 0, padding: 0, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <legend className="muted" style={{ fontSize: 12, padding: 0 }}>Only for these themes (none ticked: every theme and bundle)</legend>
              {premium.map((t) => <label key={t.id} style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 13 }}><input type="checkbox" name="themeIds" value={t.id} />{t.name}</label>)}
            </fieldset>
            <div><SubmitButton pending="Saving…">Create code</SubmitButton></div>
          </form>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }} data-testid="theme-bundles">
        <div style={{ padding: "18px 24px", fontSize: 16, fontWeight: 700, borderBottom: "1px solid var(--line)" }}>Bundles</div>
        <p className="muted" style={{ margin: 0, padding: "12px 24px", fontSize: 13.5 }}>Several premium themes sold together for one price. One payment unlocks all of them. A monthly bundle lasts a month for every theme in it. Saving with an existing id changes that bundle.</p>
        {bundles.map((b) => (
          <form key={b.id} action={saveBundleAction} data-testid={`bundle-${b.id}`} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "12px 24px", borderTop: "1px solid var(--line)" }}>
            <input type="hidden" name="id" value={b.id} />
            <input type="hidden" name="name" value={b.name} />
            <input type="hidden" name="blurb" value={b.blurb} />
            {b.themeIds.map((t) => <input key={t} type="hidden" name="themeIds" value={t} />)}
            {b.active && <input type="hidden" name="active" value="on" />}
            <div style={{ flex: "1 1 240px", minWidth: 180 }}>
              <b>{b.name}</b> {b.active ? <span className="pill ok">On sale</span> : <span className="pill warn">Hidden</span>}
              <div className="muted" style={{ fontSize: 12 }}>{b.themeIds.map(name).join(" + ")} · separately {taka(b.listPrice)} · {b.sold} sold</div>
            </div>
            <select name="priceModel" defaultValue={b.priceModel} aria-label={`${b.name} type`} disabled={!canEdit} style={{ minHeight: 40 }}>
              <option value="ONE_TIME">One-time</option><option value="MONTHLY">Monthly</option>
            </select>
            <input name="priceBdt" type="number" min={1} step="1" defaultValue={b.price} aria-label={`${b.name} price`} disabled={!canEdit} style={{ width: 90, minHeight: 40 }} />
            {canEdit && (
              <>
                <SubmitButton pending="Saving…">Save</SubmitButton>
                <SubmitButton formAction={setBundleActiveAction.bind(null, b.id, !b.active)} className="btn btn-secondary" pending="Working…">{b.active ? "Hide" : "Put on sale"}</SubmitButton>
              </>
            )}
          </form>
        ))}
        {bundles.length === 0 && <p className="muted" style={{ padding: "12px 24px", margin: 0, borderTop: "1px solid var(--line)" }}>No bundles yet.</p>}
        {canEdit && (
          <form action={saveBundleAction} data-testid="new-bundle" style={{ display: "grid", gap: 10, padding: "16px 24px", borderTop: "1px solid var(--line)", background: "var(--bg)" }}>
            <b style={{ fontSize: 14 }}>New bundle</b>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input name="id" placeholder="id, like eid-pack" required aria-label="Bundle id" style={{ width: 160, minHeight: 40 }} />
              <input name="name" placeholder="Name" required aria-label="Bundle name" style={{ width: 200, minHeight: 40 }} />
              <select name="priceModel" aria-label="Type" style={{ minHeight: 40 }}><option value="ONE_TIME">One-time</option><option value="MONTHLY">Monthly</option></select>
              <input name="priceBdt" type="number" min={1} step="1" placeholder="Price in taka" required aria-label="Price" style={{ width: 120, minHeight: 40 }} />
              <input name="blurb" placeholder="One line for the store owner (optional)" aria-label="Description" style={{ flex: "1 1 220px", minHeight: 40 }} />
            </div>
            <fieldset style={{ border: 0, margin: 0, padding: 0, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <legend className="muted" style={{ fontSize: 12, padding: 0 }}>Themes in the bundle (at least two)</legend>
              {premium.map((t) => <label key={t.id} style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 13 }}><input type="checkbox" name="themeIds" value={t.id} />{t.name} ({taka(t.price)})</label>)}
            </fieldset>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}><input type="checkbox" name="active" defaultChecked />On sale</label>
            <div><SubmitButton pending="Saving…">Create bundle</SubmitButton></div>
          </form>
        )}
      </div>
    </div>
  );
}
