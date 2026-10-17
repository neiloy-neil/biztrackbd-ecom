"use client";

import { useState, useTransition } from "react";
import { SubmitButton } from "@/components/ui";
import {
  type ModeTransitionDryRunResult,
  type SiteMode,
  type BusinessVertical,
} from "@biztrackbd/core";
import { executeMerchantModeTransitionAction, getModeDryRunAction, type FormState } from "./actions";

interface ModeTransitionClientProps {
  tenant: {
    id: string;
    name: string;
    subdomain: string;
    siteMode: string;
    businessVertical: string | null;
    planTier: string;
  };
  initialDryRun: ModeTransitionDryRunResult | null;
  counts: {
    products: number;
    orders: number;
    leads: number;
    contentItems: number;
  };
  canEdit: boolean;
  doneMessage?: string | null;
}

const VERTICAL_OPTIONS: { id: BusinessVertical; label: string }[] = [
  { id: "DOCTOR_CLINIC", label: "Doctor & Medical Clinic (BMDC Verified, Chambers)" },
  { id: "RESTAURANT", label: "Restaurant & Cafe (Table QR Menu, Food Trays)" },
  { id: "SERVICE_PROVIDER", label: "Service Provider & Agency (Services, Quotes)" },
  { id: "BUSINESS_COMPANY", label: "Corporate Business (Team, Case Studies, RFQ)" },
  { id: "PERSONAL_PORTFOLIO", label: "Personal Portfolio (Career, CV Download, Showcase)" },
  { id: "PUBLIC_FIGURE", label: "Public Figure & Creator (Media Kit, Press, Events)" },
];

export function ModeTransitionClient({
  tenant,
  initialDryRun,
  counts,
  canEdit,
  doneMessage,
}: ModeTransitionClientProps) {
  const currentMode = (tenant.siteMode as SiteMode) || "PORTFOLIO";
  const defaultTarget = currentMode === "PORTFOLIO" ? "HYBRID" : currentMode === "HYBRID" ? "PORTFOLIO" : "HYBRID";

  const [targetMode, setTargetMode] = useState<SiteMode>(defaultTarget);
  const [targetVertical, setTargetVertical] = useState<string>(tenant.businessVertical || "DOCTOR_CLINIC");
  const [dryRun, setDryRun] = useState<ModeTransitionDryRunResult | null>(initialDryRun);
  const [isPendingDryRun, startDryRunTransition] = useTransition();
  const [formState, setFormState] = useState<FormState>({});

  const handleModeChange = (newMode: SiteMode) => {
    setTargetMode(newMode);
    startDryRunTransition(async () => {
      const res = await getModeDryRunAction(newMode, targetVertical);
      setDryRun(res);
    });
  };

  const handleVerticalChange = (newVertical: string) => {
    setTargetVertical(newVertical);
    startDryRunTransition(async () => {
      const res = await getModeDryRunAction(targetMode, newVertical);
      setDryRun(res);
    });
  };

  return (
    <div className="stack" style={{ gap: 24 }}>
      {doneMessage === "mode_transitioned" && (
        <div
          className="notice"
          style={{
            background: "#ECFDF3",
            color: "#027A48",
            border: "1px solid #A6F4C5",
            padding: "14px 18px",
            borderRadius: 8,
          }}
        >
          ✓ <strong>Mode Transition Successfully Executed!</strong> Your store is now operating in{" "}
          <strong>{tenant.siteMode}</strong> mode. All historical leads and orders remain 100% preserved.
        </div>
      )}

      {/* Current Operational State Card */}
      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "inline-flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.5px",
                  padding: "3px 10px",
                  borderRadius: 12,
                  background:
                    tenant.siteMode === "HYBRID"
                      ? "#EDFDF2"
                      : tenant.siteMode === "PORTFOLIO"
                      ? "#EFF8FF"
                      : "#F4F3FF",
                  color:
                    tenant.siteMode === "HYBRID"
                      ? "#027A48"
                      : tenant.siteMode === "PORTFOLIO"
                      ? "#175CD3"
                      : "#5B4FE8",
                  border: "1px solid currentColor",
                }}
              >
                CURRENT ACTIVE MODE: {tenant.siteMode}
              </span>
              {tenant.businessVertical && (
                <span style={{ fontSize: 12, color: "var(--ink-2)", fontWeight: 600 }}>
                  Vertical: {tenant.businessVertical}
                </span>
              )}
            </div>
            <h2 style={{ margin: "4px 0", fontSize: 20 }}>Store Operating Architecture</h2>
            <p className="muted" style={{ margin: 0 }}>
              Controls what engines and customer routes are unlocked on your storefront.
            </p>
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div style={{ textAlign: "center", background: "#F8F8FC", padding: "8px 16px", borderRadius: 8, border: "1px solid var(--line)" }}>
              <div style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 700 }}>LEADS PRESERVED</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#027A48" }}>{counts.leads}</div>
            </div>
            <div style={{ textAlign: "center", background: "#F8F8FC", padding: "8px 16px", borderRadius: 8, border: "1px solid var(--line)" }}>
              <div style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 700 }}>ORDERS</div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{counts.orders}</div>
            </div>
            <div style={{ textAlign: "center", background: "#F8F8FC", padding: "8px 16px", borderRadius: 8, border: "1px solid var(--line)" }}>
              <div style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 700 }}>PRODUCTS</div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{counts.products}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Mode Transition Execution Form */}
      {canEdit ? (
        <section className="card">
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Evolve Operating Mode</h2>
          <p className="muted" style={{ marginBottom: 20 }}>
            Transition smoothly between Portfolio, Hybrid, and Commerce. Our atomic transition engine guarantees that your past inquiries, patient booking notes, and customers are never lost.
          </p>

          <form
            action={async (formData) => {
              const res = await executeMerchantModeTransitionAction(formState, formData);
              if (res?.error) setFormState(res);
            }}
            className="stack"
            style={{ gap: 20 }}
          >
            {formState.error && (
              <div className="notice notice-error" style={{ color: "#B42318", background: "#FEF3F2", padding: "10px 14px", borderRadius: 6 }}>
                {formState.error}
              </div>
            )}

            {/* Target Mode Selector */}
            <div>
              <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>
                Select Target Mode:
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                {[
                  {
                    id: "PORTFOLIO",
                    title: "PORTFOLIO",
                    desc: "Lead & booking forms only. Zero cart or checkout friction.",
                  },
                  {
                    id: "HYBRID",
                    title: "HYBRID (Dual Engine)",
                    desc: "Appointments & leads PLUS retail product catalog & bKash checkout.",
                  },
                  {
                    id: "ECOMMERCE",
                    title: "COMMERCE",
                    desc: "Full retail e-commerce with courier rate shopping and COD fraud score.",
                  },
                ].map((m) => {
                  const isSelected = targetMode === m.id;
                  const isCurrent = currentMode === m.id;
                  return (
                    <div
                      key={m.id}
                      onClick={() => handleModeChange(m.id as SiteMode)}
                      style={{
                        padding: "14px 16px",
                        borderRadius: 8,
                        border: isSelected ? "2px solid #5B4FE8" : "1px solid var(--line)",
                        background: isSelected ? "#F8F8FF" : "#FFFFFF",
                        cursor: "pointer",
                        position: "relative",
                      }}
                    >
                      {isCurrent && (
                        <span
                          style={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            fontSize: 9.5,
                            fontWeight: 800,
                            padding: "2px 6px",
                            borderRadius: 6,
                            background: "#EAECF0",
                            color: "#344054",
                          }}
                        >
                          CURRENT
                        </span>
                      )}
                      <div style={{ fontWeight: 800, fontSize: 15, color: isSelected ? "#5B4FE8" : "var(--ink)" }}>
                        {m.title}
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 4, lineHeight: 1.4 }}>
                        {m.desc}
                      </div>
                    </div>
                  );
                })}
              </div>
              <input type="hidden" name="targetMode" value={targetMode} />
            </div>

            {/* Target Vertical Selector */}
            <div>
              <label htmlFor="targetVertical" style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>
                Business Vertical / Industry Preset:
              </label>
              <select
                id="targetVertical"
                name="targetVertical"
                className="input"
                value={targetVertical}
                onChange={(e) => handleVerticalChange(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 6 }}
              >
                {VERTICAL_OPTIONS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Pre-Flight Impact Analysis Card */}
            <div
              style={{
                background: "#F8F9FC",
                border: "1px solid var(--line)",
                borderRadius: 8,
                padding: "18px 20px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "var(--ink)" }}>
                  PRE-FLIGHT DRY-RUN IMPACT REPORT
                </h4>
                {isPendingDryRun && (
                  <span style={{ fontSize: 12, color: "#5B4FE8", fontStyle: "italic" }}>
                    Analyzing impact…
                  </span>
                )}
              </div>

              {dryRun ? (
                <div style={{ display: "grid", gap: 12, fontSize: 13 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    <span style={{ fontWeight: 700, color: "var(--ink-2)", minWidth: 140 }}>
                      Capabilities Gained:
                    </span>
                    {dryRun.capabilitiesGained.length > 0 ? (
                      dryRun.capabilitiesGained.map((c) => (
                        <span
                          key={c}
                          style={{
                            padding: "2px 8px",
                            background: "#ECFDF3",
                            color: "#027A48",
                            borderRadius: 12,
                            fontWeight: 700,
                            fontSize: 11.5,
                          }}
                        >
                          +{c}
                        </span>
                      ))
                    ) : (
                      <span className="muted">None (already enabled)</span>
                    )}
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    <span style={{ fontWeight: 700, color: "var(--ink-2)", minWidth: 140 }}>
                      Routes Unlocked:
                    </span>
                    {dryRun.routesAdded.length > 0 ? (
                      dryRun.routesAdded.map((r) => (
                        <code
                          key={r}
                          style={{
                            padding: "2px 6px",
                            background: "#EFF8FF",
                            color: "#175CD3",
                            borderRadius: 4,
                            fontSize: 11.5,
                          }}
                        >
                          {r}
                        </code>
                      ))
                    ) : (
                      <span className="muted">None altered</span>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontWeight: 700, color: "var(--ink-2)", minWidth: 140 }}>
                      Zero Data Loss:
                    </span>
                    <span style={{ color: "#027A48", fontWeight: 700 }}>
                      ✓ Guaranteed: {dryRun.preservedDataSummary.leadsCount} inquiries and {dryRun.preservedDataSummary.productsCount} products preserved
                    </span>
                  </div>

                  {dryRun.warnings.length > 0 && (
                    <div style={{ marginTop: 6, background: "#FFFBEB", color: "#B45309", padding: "8px 12px", borderRadius: 6 }}>
                      {dryRun.warnings.map((w) => (
                        <div key={w}>⚠️ {w}</div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="muted" style={{ fontSize: 13 }}>
                  Select a mode above to compute the pre-flight dry run impact.
                </div>
              )}
            </div>

            {/* Operational Reason */}
            <div>
              <label htmlFor="reason" style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>
                Business Rationale for Mode Transition:
              </label>
              <input
                id="reason"
                name="reason"
                type="text"
                required
                minLength={3}
                placeholder="e.g. Clinic expanding to deliver diabetes supplies and testing kits directly to patients."
                className="input"
                style={{ width: "100%", padding: "10px 12px", borderRadius: 6 }}
                defaultValue="Clinic expanding to offer direct home delivery of verified diabetic supplies and testing kits."
              />
            </div>

            {/* Affirmative Consent Checkbox */}
            <div
              style={{
                background: "#FAF9FE",
                border: "1.5px solid #D0C6FD",
                borderRadius: 8,
                padding: "14px 16px",
              }}
            >
              <label style={{ display: "flex", gap: 10, cursor: "pointer", alignItems: "flex-start" }}>
                <input
                  type="checkbox"
                  id="confirmedConsent"
                  name="confirmedConsent"
                  defaultChecked
                  style={{ marginTop: 3, width: 18, height: 18, accentColor: "#5B4FE8" }}
                />
                <span style={{ fontSize: 13.5, color: "var(--ink)", lineHeight: 1.5 }}>
                  <strong>I confirm affirmative consent for this mode transition.</strong> I understand that
                  storefront navigation routes and checkout capabilities will adjust according to the target mode,
                  and that all historical consultation inquiries, doctor chamber notes, and customer records will
                  remain 100% intact.
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <div>
              <SubmitButton
                className="btn btn-primary"
                pending="Executing Mode Transition…"
                style={{ padding: "12px 24px", fontSize: 15, fontWeight: 700 }}
              >
                Execute Mode Transition (Zero Data Loss)
              </SubmitButton>
            </div>
          </form>
        </section>
      ) : (
        <section className="card">
          <p className="muted">
            You have view-only access to store operating mode. Please contact your Store Owner to request a mode transition.
          </p>
        </section>
      )}
    </div>
  );
}
