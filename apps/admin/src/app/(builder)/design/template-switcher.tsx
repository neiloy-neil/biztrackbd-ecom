"use client";

import { useState } from "react";
import type { TemplateInfo, SiteMode, BusinessVertical } from "@biztrackbd/core";
import { SubmitButton } from "@/components/ui";
import { applyTemplateAction } from "./actions";

const STORE_PAGES: { key: string; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "product", label: "Product" },
  { key: "collection", label: "Collection" },
  { key: "cart", label: "Cart" },
];

export interface TemplateSwitcherProps {
  templates: TemplateInfo[];
  currentLook: string;
  currentTemplate: string | null;
  canEdit: boolean;
  siteMode?: SiteMode;
  businessVertical?: BusinessVertical;
}

const VERTICAL_LABELS: Record<string, string> = {
  RESTAURANT: "Restaurant & Dining",
  DOCTOR_CLINIC: "Healthcare & Clinic",
  BUSINESS_COMPANY: "Corporate & Advisory",
  SERVICE_PROVIDER: "Local Service Pro",
  PERSONAL_PORTFOLIO: "Portfolio & Creator",
  PUBLIC_FIGURE: "Public Profile",
};

/**
 * Choose another template for the store or business website (docs/47 part D).
 * The new layouts and style go into drafts; nothing is live until each page is published.
 */
export function TemplateSwitcher({
  templates,
  currentLook,
  currentTemplate,
  canEdit,
  siteMode = "ECOMMERCE",
  businessVertical,
}: TemplateSwitcherProps) {
  const isPortfolio = siteMode === "PORTFOLIO";
  const [filter, setFilter] = useState<"website" | "ecommerce" | "all">(
    isPortfolio ? "website" : "ecommerce"
  );

  const websiteTemplates = templates.filter(
    (t) => t.siteMode === "PORTFOLIO" || Boolean(t.vertical)
  );
  const ecommerceTemplates = templates.filter(
    (t) => !t.siteMode || t.siteMode === "ECOMMERCE"
  );

  const displayedTemplates =
    filter === "website"
      ? websiteTemplates
      : filter === "ecommerce"
      ? ecommerceTemplates
      : templates;

  const activeTemplate =
    templates.find((t) => t.id === currentTemplate) ??
    templates.find((t) => t.id === currentLook) ??
    templates[0];

  return (
    <section className="bld-group" data-testid="template-switcher" style={{ marginTop: 8 }}>
      <div className="bld-gh" style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
        {isPortfolio ? "Website Template" : "Storefront Template"}
      </div>

      {activeTemplate && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid var(--line)",
            background: "var(--surface)",
            marginBottom: 14,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: activeTemplate.settings?.background || "var(--surface)",
              border: `3px solid ${activeTemplate.settings?.accent || "var(--primary)"}`,
              flex: "none",
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700, fontSize: 13.5 }}>{activeTemplate.name}</span>
              <span className="pill ok" style={{ fontSize: 11, padding: "1px 6px" }}>
                Active
              </span>
              {activeTemplate.vertical && (
                <span
                  style={{
                    fontSize: 11,
                    background: "rgba(0,0,0,0.06)",
                    padding: "1px 6px",
                    borderRadius: 4,
                  }}
                >
                  {VERTICAL_LABELS[activeTemplate.vertical] || activeTemplate.vertical}
                </span>
              )}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              {activeTemplate.blurb || activeTemplate.audience}
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <button
          type="button"
          className={`btn btn-sm ${filter === "website" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setFilter("website")}
          style={{ fontSize: 12, padding: "4px 10px", flex: 1, justifyContent: "center" }}
        >
          Website & Portfolio ({websiteTemplates.length})
        </button>
        <button
          type="button"
          className={`btn btn-sm ${filter === "ecommerce" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setFilter("ecommerce")}
          style={{ fontSize: 12, padding: "4px 10px", flex: 1, justifyContent: "center" }}
        >
          E-Commerce ({ecommerceTemplates.length})
        </button>
      </div>

      <p className="muted" style={{ fontSize: 12.5, marginBottom: 12, lineHeight: 1.4 }}>
        {isPortfolio
          ? "Switching templates puts new layouts, pages, and colors into your drafts. Your existing menu dishes, reservations, and content stay safe."
          : "Your products, categories, and orders stay safe. The new layouts and colors go into your drafts so you can preview before publishing."}
      </p>

      <div className="stack" style={{ gap: 10 }}>
        {displayedTemplates.map((t) => {
          const current = (currentTemplate ?? currentLook) === t.id;
          const lookChange = t.baseLook !== currentLook;
          const isBusiness = t.siteMode === "PORTFOLIO" || Boolean(t.vertical);

          return (
            <form
              key={t.id}
              action={applyTemplateAction}
              className="bld-item"
              data-testid={`template-${t.id}`}
              style={{
                borderRadius: 8,
                border: current ? "2px solid var(--primary)" : "1px solid var(--line)",
                padding: 10,
                background: current ? "rgba(var(--primary-rgb, 16, 185, 129), 0.04)" : undefined,
              }}
            >
              <input type="hidden" name="templateId" value={t.id} />
              <div className="row" style={{ gap: 10, alignItems: "center" }}>
                <span
                  aria-hidden
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: t.settings?.background || "var(--surface)",
                    border: `3px solid ${t.settings?.accent || "var(--primary)"}`,
                    flex: "none",
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <b>{t.name}</b>
                    {current && <span className="pill ok" style={{ fontSize: 11 }}>Current</span>}
                    {t.vertical && (
                      <span
                        style={{
                          fontSize: 10.5,
                          background: "rgba(0,0,0,0.06)",
                          padding: "1px 5px",
                          borderRadius: 4,
                        }}
                      >
                        {VERTICAL_LABELS[t.vertical] || t.vertical}
                      </span>
                    )}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {t.blurb || t.audience}
                  </div>
                </div>
              </div>

              {!current && canEdit && (
                <div className="stack" style={{ gap: 8, marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--line)" }}>
                  <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                    <legend className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                      Apply layouts for
                    </legend>
                    <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
                      {isBusiness ? (
                        <>
                          <label className="check" style={{ fontSize: 12.5 }}>
                            <input type="checkbox" name="take" value="home" defaultChecked />
                            <span>Home page</span>
                          </label>
                          {t.customPages && t.customPages.length > 0 && (
                            <span className="muted" style={{ fontSize: 11.5, alignSelf: "center" }}>
                              + Includes {t.customPages.map((cp) => cp.title).join(", ")}
                            </span>
                          )}
                        </>
                      ) : (
                        STORE_PAGES.map((p) => (
                          <label key={p.key} className="check" style={{ fontSize: 12.5 }}>
                            <input type="checkbox" name="take" value={p.key} defaultChecked />
                            <span>{p.label}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </fieldset>

                  {t.chrome && (
                    <label className="check" style={{ fontSize: 12 }}>
                      <input type="checkbox" name="chrome" defaultChecked />
                      <span>Also apply its header and footer navigation</span>
                    </label>
                  )}

                  {lookChange && (
                    <div className="notice warn" role="note" style={{ fontSize: 12, padding: "6px 8px" }}>
                      This template uses the <b>{t.baseLook}</b> design look. New layouts will go into your drafts for review before publishing.
                    </div>
                  )}

                  <div>
                    <SubmitButton className="btn btn-secondary btn-sm" pending="Preparing drafts…">
                      Use this template (as drafts)
                    </SubmitButton>
                  </div>
                </div>
              )}
            </form>
          );
        })}
      </div>
    </section>
  );
}
