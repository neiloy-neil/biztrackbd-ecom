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
    <div className="stack gap-4">
      {doneMessage === "mode_transitioned" && (
        <div className="notice good" role="status">
          ✓ <strong>Mode Transition Successfully Executed!</strong> Your store is now operating in{" "}
          <strong>{tenant.siteMode}</strong> mode. All historical leads and orders remain 100% preserved.
        </div>
      )}

      {/* Current Operational State Card */}
      <section className="card">
        <div className="row-between items-start flex-wrap gap-3">
          <div>
            <div className="row gap-2 items-center mb-1">
              <span
                className={
                  tenant.siteMode === "HYBRID"
                    ? "badge-green"
                    : tenant.siteMode === "PORTFOLIO"
                    ? "badge-blue"
                    : "badge-purple"
                }
              >
                CURRENT ACTIVE MODE: {tenant.siteMode}
              </span>
              {tenant.businessVertical && (
                <span className="text-xs muted font-semibold">
                  Vertical: {tenant.businessVertical}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold m-0 my-1">Store Operating Architecture</h2>
            <p className="muted text-sm m-0">
              Controls what engines and customer routes are unlocked on your storefront.
            </p>
          </div>

          <div className="row gap-3 flex-wrap">
            <div className="stat-box-sm text-center min-w-28">
              <div className="text-xs font-bold muted">LEADS PRESERVED</div>
              <div className="text-lg font-bold text-success">{counts.leads}</div>
            </div>
            <div className="stat-box-sm text-center min-w-28">
              <div className="text-xs font-bold muted">ORDERS</div>
              <div className="text-lg font-bold">{counts.orders}</div>
            </div>
            <div className="stat-box-sm text-center min-w-28">
              <div className="text-xs font-bold muted">PRODUCTS</div>
              <div className="text-lg font-bold">{counts.products}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Mode Transition Execution Form */}
      {canEdit ? (
        <section className="card">
          <h2 className="text-lg font-bold m-0 mb-1">Evolve Operating Mode</h2>
          <p className="muted text-sm m-0 mb-4">
            Transition smoothly between Portfolio, Hybrid, and Commerce. Our atomic transition engine guarantees that your past inquiries, patient booking notes, and customers are never lost.
          </p>

          <form
            action={async (formData) => {
              const res = await executeMerchantModeTransitionAction(formState, formData);
              if (res?.error) setFormState(res);
            }}
            className="stack gap-4"
          >
            {formState.error && (
              <div className="notice bad" role="alert">
                {formState.error}
              </div>
            )}

            {/* Target Mode Selector */}
            <div>
              <span className="label mb-2 block">
                Select Target Mode:
              </span>
              <div className="grid-280">
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
                      className={`card p-3 cursor-pointer relative ${
                        isSelected ? "border-primary bg-subtle" : "border"
                      }`}
                    >
                      {isCurrent && (
                        <span className="absolute top-2 right-2 pill grey text-xs font-bold">
                          CURRENT
                        </span>
                      )}
                      <div className={`font-bold text-base ${isSelected ? "text-primary" : ""}`}>
                        {m.title}
                      </div>
                      <div className="text-xs muted mt-1 leading-normal">
                        {m.desc}
                      </div>
                    </div>
                  );
                })}
              </div>
              <input type="hidden" name="targetMode" value={targetMode} />
            </div>

            {/* Target Vertical Selector */}
            <label className="field">
              <span className="label">Business Vertical / Industry Preset:</span>
              <select
                id="targetVertical"
                name="targetVertical"
                className="input"
                value={targetVertical}
                onChange={(e) => handleVerticalChange(e.target.value)}
              >
                {VERTICAL_OPTIONS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>

            {/* Pre-Flight Impact Analysis Card */}
            <div className="card bg-subtle p-3">
              <div className="row-between items-center mb-2">
                <h4 className="m-0 text-sm font-bold">
                  PRE-FLIGHT DRY-RUN IMPACT REPORT
                </h4>
                {isPendingDryRun && (
                  <span className="text-xs text-primary italic">
                    Analyzing impact…
                  </span>
                )}
              </div>

              {dryRun ? (
                <div className="stack gap-2 text-sm">
                  <div className="row gap-2 flex-wrap items-center">
                    <span className="font-semibold muted min-w-36">
                      Capabilities Gained:
                    </span>
                    {dryRun.capabilitiesGained.length > 0 ? (
                      dryRun.capabilitiesGained.map((c) => (
                        <span key={c} className="badge-green">
                          +{c}
                        </span>
                      ))
                    ) : (
                      <span className="muted">None (already enabled)</span>
                    )}
                  </div>

                  <div className="row gap-2 flex-wrap items-center">
                    <span className="font-semibold muted min-w-36">
                      Routes Unlocked:
                    </span>
                    {dryRun.routesAdded.length > 0 ? (
                      dryRun.routesAdded.map((r) => (
                        <code key={r} className="badge-blue font-mono">
                          {r}
                        </code>
                      ))
                    ) : (
                      <span className="muted">None altered</span>
                    )}
                  </div>

                  <div className="row gap-2 items-center">
                    <span className="font-semibold muted min-w-36">
                      Zero Data Loss:
                    </span>
                    <span className="text-success font-semibold">
                      ✓ Guaranteed: {dryRun.preservedDataSummary.leadsCount} inquiries and {dryRun.preservedDataSummary.productsCount} products preserved
                    </span>
                  </div>

                  {dryRun.warnings.length > 0 && (
                    <div className="notice warn mt-2">
                      {dryRun.warnings.map((w) => (
                        <div key={w}>⚠️ {w}</div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="muted text-sm">
                  Select a mode above to compute the pre-flight dry run impact.
                </div>
              )}
            </div>

            {/* Operational Reason */}
            <label className="field">
              <span className="label">Business Rationale for Mode Transition:</span>
              <input
                id="reason"
                name="reason"
                type="text"
                required
                minLength={3}
                placeholder="e.g. Clinic expanding to deliver diabetes supplies and testing kits directly to patients."
                className="input"
                defaultValue="Clinic expanding to offer direct home delivery of verified diabetic supplies and testing kits."
              />
            </label>

            {/* Affirmative Consent Checkbox */}
            <div className="advisory-box advisory-box-amber">
              <label className="check items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  id="confirmedConsent"
                  name="confirmedConsent"
                  required
                />
                <span className="text-sm leading-normal">
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
