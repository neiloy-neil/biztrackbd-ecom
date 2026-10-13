"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { BD_GEO } from "@biztrackbd/core/geo";
import { placeLandingOrderAction, saveLandingLeadAction, type LandingOrderState } from "@/app/l/actions";
import { trackEvent } from "./tracker";
import { money, type Lang } from "@/lib/i18n-core";
import type { LP_FORM_KEYS } from "@/lib/strings";

export type LpStrings = Record<(typeof LP_FORM_KEYS)[number], string>;

export interface LandingVariant { id: string; title: string; price: number; stock: number }
export interface LandingOption { id: string; label: string; labelBn: string | null; productTitle: string; quantity: number | null; deal: { kind: "none" | "percent" | "amount"; value: number }; variants: LandingVariant[] }
export interface LandingBump { label: string; labelBn: string | null; price: number; percentOff: number; stock: number }

/** The same arithmetic the server does (priceLandingChoice), so the total shown is the total charged. */
export function dealOff(deal: LandingOption["deal"], line: number): number {
  if (deal.kind === "percent") return Math.min(line, Math.round(line * deal.value) / 100);
  if (deal.kind === "amount") return Math.min(line, deal.value);
  return 0;
}

const uuid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** Cash on delivery order form: no cart, no account. The button text and the intro come from the page's own section. */
export function LandingOrderForm({ slug, options, bump, lang, s, buttonText, utm, track = true }: { slug: string; options: LandingOption[]; bump: LandingBump | null; lang: Lang; s: LpStrings; buttonText: string; utm?: { source?: string; campaign?: string; medium?: string }; /** False in the editor preview: nothing is counted or sent. */ track?: boolean }) {
  const t = (k: keyof LpStrings) => s[k];
  const [state, action, pending] = useActionState<LandingOrderState, FormData>(placeLandingOrderAction.bind(null, slug), {});
  const router = useRouter();
  const key = useRef(uuid());
  useEffect(() => { if (state.redirectTo) router.push(state.redirectTo); }, [state.redirectTo, router]);
  const [optionId, setOptionId] = useState(options[0]?.id ?? "");
  const option = options.find((o) => o.id === optionId) ?? options[0]!;
  const variants = option.variants;
  const [variantId, setVariantId] = useState((variants.find((v) => v.stock > 0) ?? variants[0])?.id ?? "");
  const [qty, setQty] = useState(1);
  const [withBump, setWithBump] = useState(false);
  const pick = (id: string) => {
    const o = options.find((x) => x.id === id) ?? options[0]!;
    setOptionId(id);
    setVariantId((o.variants.find((v) => v.stock > 0) ?? o.variants[0])?.id ?? "");
  };
  const name = (o: { label: string; labelBn: string | null }) => (lang === "bn" && o.labelBn ? o.labelBn : o.label);
  const available = variants.filter((v) => v.stock > 0);
  const [division, setDivision] = useState("");
  const districts = useMemo(() => BD_GEO.find((d) => d.name === division)?.districts ?? [], [division]);
  const variant = variants.find((v) => v.id === variantId);
  const soldOut = available.length === 0;
  const pieces = option.quantity ?? qty;
  const line = (variant?.price ?? 0) * pieces;
  const total = line - dealOff(option.deal, line) + (withBump && bump ? bump.price - Math.round(bump.price * bump.percentOff) / 100 : 0);
  const bad = (f: string) => (state.field === f ? true : undefined);
  const started = useRef(false);
  const savedLead = useRef("");

  return (
    <form
      action={action}
      className="lp-form"
      data-ribbon={t("lpRibbon")}
      data-testid="lp-order-form"
      noValidate={false}
      // The first time the visitor touches the form they have started to buy: tell the ad platforms once (Meta, TikTok, Google).
      onFocusCapture={() => {
        if (!track || started.current) return;
        started.current = true;
        trackEvent("InitiateCheckout", { contentIds: [option.id], numItems: pieces, value: total });
      }}
      // A name and a valid number are kept as a lead if the order is not finished. The note under the form says so.
      onBlurCapture={(e) => {
        if (!track || (e.target as HTMLElement).getAttribute("name") !== "phone") return;
        const f = (e.currentTarget as HTMLFormElement).elements;
        const phone = (f.namedItem("phone") as HTMLInputElement | null)?.value.replace(/[\s-]/g, "") ?? "";
        const name = (f.namedItem("name") as HTMLInputElement | null)?.value ?? "";
        if (!/^(\+?88)?01[3-9]\d{8}$/.test(phone) || name.trim().length < 2 || savedLead.current === phone) return;
        savedLead.current = phone;
        void saveLandingLeadAction(slug, { name, phone, offerLabel: option.label, utmSource: utm?.source, utmCampaign: utm?.campaign });
      }}
    >
      <input type="hidden" name="key" value={key.current} />
      <input type="hidden" name="utm_source" value={utm?.source ?? ""} />
      <input type="hidden" name="utm_campaign" value={utm?.campaign ?? ""} />
      <input type="hidden" name="utm_medium" value={utm?.medium ?? ""} />
      <input type="hidden" name="optionId" value={option.id} />
      {options.length > 1 && (
        <fieldset className="lp-offers" data-testid="lp-offers" style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 8 }}>
          <legend>{t("lpOrderOffer")}</legend>
          {options.map((o) => {
            const v = o.variants.find((x) => x.stock > 0) ?? o.variants[0];
            const line = (v?.price ?? 0) * (o.quantity ?? 1);
            const off = dealOff(o.deal, line);
            return (
              <label key={o.id} className="opt" style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}>
                <input type="radio" name="offerPick" value={o.id} checked={o.id === optionId} onChange={() => pick(o.id)} data-testid={`lp-offer-${o.id}`} />
                <span style={{ flex: 1 }}><b>{name(o)}</b>{options.some((x) => x.productTitle !== o.productTitle) && <span className="muted" style={{ fontSize: 13 }}> · {o.productTitle}</span>}</span>
                <span><b>{money(line - off, lang)}</b>{off > 0 && <span className="muted" style={{ fontSize: 12, display: "block" }}>{t("lpOrderSave")} {money(off, lang)}</span>}</span>
              </label>
            );
          })}
        </fieldset>
      )}
      {variants.length > 1 && (
        <label>{t("lpOrderOption")}
          <select className="select" name="variantId" value={variantId} onChange={(e) => setVariantId(e.target.value)} aria-invalid={bad("variantId")}>
            {variants.map((v) => <option key={v.id} value={v.id} disabled={v.stock <= 0}>{v.title} · {money(v.price, lang)}{v.stock <= 0 ? ` (${t("soldOut")})` : ""}</option>)}
          </select>
        </label>
      )}
      {variants.length <= 1 && <input type="hidden" name="variantId" value={variantId} />}
      {option.quantity == null ? (
        <label>{t("lpOrderQty")}
          <select className="select" name="quantity" value={qty} onChange={(e) => setQty(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      ) : <input type="hidden" name="quantity" value={option.quantity} />}
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
      {bump && bump.stock > 0 && (
        <label className="opt" style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }} data-testid="lp-bump">
          <input type="checkbox" name="bump" checked={withBump} onChange={(e) => setWithBump(e.target.checked)} />
          <span style={{ flex: 1 }}><b>{t("lpOrderBump")}:</b> {name(bump)}</span>
          <span><b>{money(bump.price - Math.round(bump.price * bump.percentOff) / 100, lang)}</b></span>
        </label>
      )}
      {variant && <div className="lp-price"><span>{t("lpOrderTotal")}</span><span data-testid="lp-total">{money(total, lang)}</span></div>}
      <p className="muted" style={{ fontSize: 13 }}>{t("lpOrderNote")}</p>
      <p className="muted" style={{ fontSize: 12 }} data-testid="lp-lead-note">{t("lpLeadNote")}</p>
      {state.error && <p className="err" role="alert">{state.error}</p>}
      <button type="submit" className="btn btn-primary btn-round btn-block" disabled={pending || soldOut || !!state.redirectTo}>{pending || state.redirectTo ? t("lpOrderSending") : soldOut ? t("soldOut") : buttonText}</button>
    </form>
  );
}
