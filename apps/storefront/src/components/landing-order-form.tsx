"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { BD_GEO } from "@biztrackbd/core/geo";
import { placeLandingOrderAction, saveLandingLeadAction, type LandingOrderState } from "@/app/l/actions";
import { trackEvent } from "./tracker";
import { money, type Lang } from "@/lib/i18n-core";
import type { LP_FORM_KEYS } from "@/lib/strings";
import { GuaranteeStrip } from "./guarantee-strip";

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

/** Cash on delivery order form: no cart, no account. Includes multi-pack deal cards, debounced lead capture & trust guarantee. */
export function LandingOrderForm({
  slug,
  options,
  bump,
  lang,
  s,
  buttonText,
  utm,
  track = true,
  isDrawer = false,
  onOrderSuccess,
}: {
  slug: string;
  options: LandingOption[];
  bump: LandingBump | null;
  lang: Lang;
  s: LpStrings;
  buttonText: string;
  utm?: { source?: string; campaign?: string; medium?: string };
  /** False in the editor preview: nothing is counted or sent. */
  track?: boolean;
  isDrawer?: boolean;
  onOrderSuccess?: () => void;
}) {
  const t = (k: keyof LpStrings) => s[k];
  const [state, action, pending] = useActionState<LandingOrderState, FormData>(placeLandingOrderAction.bind(null, slug), {});
  const router = useRouter();
  const key = useRef(uuid());

  useEffect(() => {
    if (state.redirectTo) {
      if (onOrderSuccess) onOrderSuccess();
      router.push(state.redirectTo);
    }
  }, [state.redirectTo, router, onOrderSuccess]);

  const [optionId, setOptionId] = useState(options[0]?.id ?? "");
  const option = options.find((o) => o.id === optionId) ?? options[0]!;
  const variants = option.variants;
  const [variantId, setVariantId] = useState((variants.find((v) => v.stock > 0) ?? variants[0])?.id ?? "");
  const [qty, setQty] = useState(1);
  const [withBump, setWithBump] = useState(false);
  const [enteredName, setEnteredName] = useState("");
  const [enteredPhone, setEnteredPhone] = useState("");

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
  const off = dealOff(option.deal, line);
  const total = line - off + (withBump && bump ? bump.price - Math.round(bump.price * bump.percentOff) / 100 : 0);
  const bad = (f: string) => (state.field === f ? true : undefined);

  const started = useRef(false);
  const savedLead = useRef("");
  const leadTimer = useRef<NodeJS.Timeout | null>(null);

  // Debounced auto lead capture on typing 11 valid digits
  const triggerLeadCapture = (phoneVal: string, nameVal: string) => {
    if (!track) return;
    const cleanPhone = phoneVal.replace(/[\s-]/g, "");
    if (!/^(\+?88)?01[3-9]\d{8}$/.test(cleanPhone)) return;

    if (leadTimer.current) clearTimeout(leadTimer.current);
    leadTimer.current = setTimeout(() => {
      if (savedLead.current !== cleanPhone || (nameVal && nameVal.trim().length >= 2)) {
        savedLead.current = cleanPhone;
        void saveLandingLeadAction(slug, {
          name: nameVal.trim() || "Customer",
          phone: cleanPhone,
          offerLabel: option.label,
          utmSource: utm?.source,
          utmCampaign: utm?.campaign,
        });
      }
    }, 400);
  };

  useEffect(() => {
    return () => {
      if (leadTimer.current) clearTimeout(leadTimer.current);
    };
  }, []);

  return (
    <form
      action={action}
      className={`lp-form ${isDrawer ? "lp-form-drawer" : ""}`}
      data-ribbon={t("lpRibbon")}
      data-testid={isDrawer ? "lp-order-form-drawer" : "lp-order-form"}
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
        const custName = (f.namedItem("name") as HTMLInputElement | null)?.value ?? "";
        if (!/^(\+?88)?01[3-9]\d{8}$/.test(phone) || savedLead.current === phone) return;
        savedLead.current = phone;
        void saveLandingLeadAction(slug, {
          name: custName.trim() || "Customer",
          phone,
          offerLabel: option.label,
          utmSource: utm?.source,
          utmCampaign: utm?.campaign,
        });
      }}
    >
      <input type="hidden" name="key" value={key.current} />
      <input type="hidden" name="utm_source" value={utm?.source ?? ""} />
      <input type="hidden" name="utm_campaign" value={utm?.campaign ?? ""} />
      <input type="hidden" name="utm_medium" value={utm?.medium ?? ""} />
      <input type="hidden" name="optionId" value={option.id} />

      {/* Multi-Pack Quantity Deal Cards */}
      {options.length > 1 && (
        <fieldset className="lp-offers lp-deal-cards" data-testid="lp-offers">
          <legend className="lp-offers-legend">{t("lpOrderOffer")}</legend>
          <div className="lp-deal-grid">
            {options.map((o, idx) => {
              const isSelected = o.id === optionId;
              const v = o.variants.find((x) => x.stock > 0) ?? o.variants[0];
              const linePrice = (v?.price ?? 0) * (o.quantity ?? 1);
              const dealSavings = dealOff(o.deal, linePrice);
              const isBestSeller = idx === 1 || (o.deal.kind !== "none" && idx > 0);
              const isBestValue = idx === 2 || (o.quantity != null && o.quantity >= 3);

              return (
                <label
                  key={o.id}
                  className={`lp-deal-card ${isSelected ? "selected" : ""}`}
                  data-testid={`lp-offer-${o.id}`}
                >
                  <input
                    type="radio"
                    name="offerPick"
                    value={o.id}
                    checked={isSelected}
                    onChange={() => pick(o.id)}
                    className="lp-deal-radio"
                  />

                  {/* Badge: Most Popular or Best Value */}
                  {isBestSeller && !isBestValue && (
                    <span className="lp-deal-badge popular">
                      {lang === "bn" ? "সর্বাধিক বিক্রিত" : "Most Popular"}
                    </span>
                  )}
                  {isBestValue && (
                    <span className="lp-deal-badge value">
                      {lang === "bn" ? "সেরা অফার" : "Best Value"}
                    </span>
                  )}

                  <div className="lp-deal-body">
                    <div className="lp-deal-info">
                      <span className="lp-deal-title">{name(o)}</span>
                      {options.some((x) => x.productTitle !== o.productTitle) && (
                        <span className="lp-deal-subtitle">{o.productTitle}</span>
                      )}
                      {dealSavings > 0 && (
                        <span className="lp-deal-savings">
                          {t("lpOrderSave")} {money(dealSavings, lang)}
                        </span>
                      )}
                    </div>

                    <div className="lp-deal-pricing">
                      <b className="lp-deal-price">{money(linePrice - dealSavings, lang)}</b>
                      {dealSavings > 0 && (
                        <s className="lp-deal-was">{money(linePrice, lang)}</s>
                      )}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {variants.length > 1 && (
        <label className="lp-field">
          <span className="lp-field-label">{t("lpOrderOption")}</span>
          <select
            className="select"
            name="variantId"
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
            aria-invalid={bad("variantId")}
          >
            {variants.map((v) => (
              <option key={v.id} value={v.id} disabled={v.stock <= 0}>
                {v.title} · {money(v.price, lang)}
                {v.stock <= 0 ? ` (${t("soldOut")})` : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      {variants.length <= 1 && <input type="hidden" name="variantId" value={variantId} />}

      {option.quantity == null ? (
        <label className="lp-field">
          <span className="lp-field-label">{t("lpOrderQty")}</span>
          <select
            className="select"
            name="quantity"
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <input type="hidden" name="quantity" value={option.quantity} />
      )}

      <label className="lp-field">
        <span className="lp-field-label">{t("lpOrderName")}</span>
        <input
          className="input"
          name="name"
          autoComplete="name"
          required
          minLength={2}
          maxLength={120}
          value={enteredName}
          onChange={(e) => {
            setEnteredName(e.target.value);
            triggerLeadCapture(enteredPhone, e.target.value);
          }}
          placeholder={lang === "bn" ? "আপনার পূর্ণ নাম লিখুন" : "Your full name"}
          aria-invalid={bad("name")}
        />
      </label>

      <label className="lp-field">
        <span className="lp-field-label">{t("lpOrderPhone")}</span>
        <input
          className="input"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          placeholder="01XXXXXXXXX"
          value={enteredPhone}
          onChange={(e) => {
            setEnteredPhone(e.target.value);
            triggerLeadCapture(e.target.value, enteredName);
          }}
          aria-invalid={bad("phone")}
        />
      </label>

      <div className="lp-geo-row">
        <label className="lp-field">
          <span className="lp-field-label">{t("lpOrderDivision")}</span>
          <select
            className="select"
            name="division"
            required
            value={division}
            onChange={(e) => setDivision(e.target.value)}
          >
            <option value="">{t("lpOrderChoose")}</option>
            {BD_GEO.map((d) => (
              <option key={d.name} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
        </label>

        <label className="lp-field">
          <span className="lp-field-label">{t("lpOrderDistrict")}</span>
          <select
            className="select"
            name="district"
            required
            disabled={!division}
            aria-invalid={bad("district")}
            defaultValue=""
          >
            <option value="">{t("lpOrderChoose")}</option>
            {districts.map((d) => (
              <option key={d.name} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="lp-field">
        <span className="lp-field-label">{t("lpOrderAddress")}</span>
        <textarea
          className="textarea"
          name="address"
          rows={3}
          required
          minLength={5}
          maxLength={300}
          placeholder={lang === "bn" ? "বাসা নং, রোড নং, এলাকা/উপজেলা" : "House, road, area, thana"}
          style={{ padding: 12 }}
          aria-invalid={bad("address")}
        />
      </label>

      {/* Order Bump Extra Item */}
      {bump && bump.stock > 0 && (
        <label className="lp-bump-card" data-testid="lp-bump">
          <input
            type="checkbox"
            name="bump"
            checked={withBump}
            onChange={(e) => setWithBump(e.target.checked)}
            className="lp-bump-checkbox"
          />
          <div className="lp-bump-text">
            <span className="lp-bump-tag">{t("lpOrderBump")}</span>
            <b className="lp-bump-title">{name(bump)}</b>
          </div>
          <span className="lp-bump-price">
            +{money(bump.price - Math.round(bump.price * bump.percentOff) / 100, lang)}
          </span>
        </label>
      )}

      {/* Live Order Total Calculation */}
      {variant && (
        <div className="lp-order-summary">
          <div className="lp-summary-row">
            <span>{t("lpOrderTotal")}</span>
            <b data-testid="lp-total" className="lp-summary-amount">
              {money(total, lang)}
            </b>
          </div>
          <div className="lp-summary-sub">
            <span className="lp-cod-tag">
              ✓ {lang === "bn" ? "ক্যাশ অন ডেলিভারি (হাতে পেয়ে টাকা দিন)" : "Cash on Delivery"}
            </span>
          </div>
        </div>
      )}

      {state.error && <p className="err" role="alert">{state.error}</p>}

      <button
        type="submit"
        className="btn btn-primary btn-round btn-block lp-submit-cta"
        disabled={pending || soldOut || !!state.redirectTo}
      >
        {pending || state.redirectTo ? (
          <span className="lp-spinner-row">
            <span className="lp-spinner" />
            {t("lpOrderSending")}
          </span>
        ) : soldOut ? (
          t("soldOut")
        ) : (
          buttonText
        )}
      </button>

      {/* Reassurance Guarantee Strip */}
      <GuaranteeStrip lang={lang} compact className="lp-form-guarantees" />

      <p className="muted" style={{ fontSize: 13, textAlign: "center", marginTop: 8 }}>
        {t("lpOrderNote")}
      </p>
      <p className="muted" style={{ fontSize: 12, textAlign: "center" }} data-testid="lp-lead-note">
        {t("lpLeadNote")}
      </p>
    </form>
  );
}
