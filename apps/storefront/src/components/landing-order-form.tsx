"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { BD_GEO } from "@biztrackbd/core/geo";
import { placeLandingOrderAction, type LandingOrderState } from "@/app/l/actions";
import { money, type Lang } from "@/lib/i18n-core";
import type { LP_FORM_KEYS } from "@/lib/strings";

export type LpStrings = Record<(typeof LP_FORM_KEYS)[number], string>;

export interface LandingVariant { id: string; title: string; price: number; stock: number }

const uuid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** Cash on delivery order form: no cart, no account. The button text and the intro come from the page's own section. */
export function LandingOrderForm({ slug, variants, lang, s, buttonText, utm }: { slug: string; variants: LandingVariant[]; lang: Lang; s: LpStrings; buttonText: string; utm?: { source?: string; campaign?: string } }) {
  const t = (k: keyof LpStrings) => s[k];
  const [state, action, pending] = useActionState<LandingOrderState, FormData>(placeLandingOrderAction.bind(null, slug), {});
  const router = useRouter();
  const key = useRef(uuid());
  useEffect(() => { if (state.redirectTo) router.push(state.redirectTo); }, [state.redirectTo, router]);
  const available = variants.filter((v) => v.stock > 0);
  const [variantId, setVariantId] = useState((available[0] ?? variants[0])?.id ?? "");
  const [qty, setQty] = useState(1);
  const [division, setDivision] = useState("");
  const districts = useMemo(() => BD_GEO.find((d) => d.name === division)?.districts ?? [], [division]);
  const variant = variants.find((v) => v.id === variantId);
  const soldOut = available.length === 0;
  const bad = (f: string) => (state.field === f ? true : undefined);

  return (
    <form action={action} className="lp-form" data-testid="lp-order-form" noValidate={false}>
      <input type="hidden" name="key" value={key.current} />
      <input type="hidden" name="utm_source" value={utm?.source ?? ""} />
      <input type="hidden" name="utm_campaign" value={utm?.campaign ?? ""} />
      {variants.length > 1 && (
        <label>{t("lpOrderOption")}
          <select className="select" name="variantId" value={variantId} onChange={(e) => setVariantId(e.target.value)} aria-invalid={bad("variantId")}>
            {variants.map((v) => <option key={v.id} value={v.id} disabled={v.stock <= 0}>{v.title} · {money(v.price, lang)}{v.stock <= 0 ? ` (${t("soldOut")})` : ""}</option>)}
          </select>
        </label>
      )}
      {variants.length <= 1 && <input type="hidden" name="variantId" value={variantId} />}
      <label>{t("lpOrderQty")}
        <select className="select" name="quantity" value={qty} onChange={(e) => setQty(Number(e.target.value))}>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <label>{t("lpOrderName")}<input className="input" name="name" autoComplete="name" required minLength={2} maxLength={120} aria-invalid={bad("name")} /></label>
      <label>{t("lpOrderPhone")}<input className="input" name="phone" type="tel" inputMode="tel" autoComplete="tel" required placeholder="01XXXXXXXXX" aria-invalid={bad("phone")} /></label>
      <label>{t("lpOrderDivision")}
        <select className="select" name="division" required value={division} onChange={(e) => setDivision(e.target.value)}>
          <option value="">{t("lpOrderChoose")}</option>
          {BD_GEO.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
        </select>
      </label>
      <label>{t("lpOrderDistrict")}
        <select className="select" name="district" required disabled={!division} aria-invalid={bad("district")} defaultValue="">
          <option value="">{t("lpOrderChoose")}</option>
          {districts.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
        </select>
      </label>
      <label>{t("lpOrderAddress")}<textarea className="textarea" name="address" rows={3} required minLength={5} maxLength={300} style={{ padding: 12 }} aria-invalid={bad("address")} /></label>
      {variant && <div className="lp-price"><span>{t("lpOrderTotal")}</span><span>{money(variant.price * qty, lang)}</span></div>}
      <p className="muted" style={{ fontSize: 13 }}>{t("lpOrderNote")}</p>
      {state.error && <p className="err" role="alert">{state.error}</p>}
      <button type="submit" className="btn btn-primary btn-round btn-block" disabled={pending || soldOut || !!state.redirectTo}>{pending || state.redirectTo ? t("lpOrderSending") : soldOut ? t("soldOut") : buttonText}</button>
    </form>
  );
}
