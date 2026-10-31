"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { checkSubdomainAction, changeSubdomainAction } from "./actions";
import { type SubdomainAvailabilityResult } from "@biztrackbd/core";

interface Props {
  currentSubdomain: string;
  rootDomain: string;
  canEdit: boolean;
  inCooldown?: boolean;
  cooldownDaysLeft?: number;
  nextAllowedAt?: string | null;
  previousSubdomain?: string | null;
  previousSubdomainExpiresAt?: string | null;
}

export function SubdomainEditor({
  currentSubdomain,
  rootDomain,
  canEdit,
  inCooldown = false,
  cooldownDaysLeft = 0,
  nextAllowedAt = null,
  previousSubdomain = null,
  previousSubdomainExpiresAt = null,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [candidate, setCandidate] = useState(currentSubdomain);
  const [checkState, setCheckState] = useState<{
    status: "idle" | "checking" | "available" | "unavailable" | "current";
    message: string;
  }>({
    status: "current",
    message: "This is your current store address.",
  });

  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const checkId = useRef(0);

  // Debounced live availability check
  useEffect(() => {
    const trimmed = candidate.trim().toLowerCase();

    if (!trimmed) {
      setCheckState({
        status: "idle",
        message: "Enter a subdomain for your store.",
      });
      return;
    }

    if (trimmed === currentSubdomain.toLowerCase()) {
      setCheckState({
        status: "current",
        message: "This is your store's current subdomain.",
      });
      return;
    }

    if (trimmed.length < 3) {
      setCheckState({
        status: "unavailable",
        message: "Use at least 3 letters or numbers.",
      });
      return;
    }

    setCheckState({
      status: "checking",
      message: "Checking availability…",
    });

    const currentId = ++checkId.current;
    const timer = setTimeout(async () => {
      try {
        const result: SubdomainAvailabilityResult = await checkSubdomainAction(trimmed);
        if (currentId !== checkId.current) return;

        if (result.isCurrent) {
          setCheckState({
            status: "current",
            message: result.message,
          });
        } else if (result.ok) {
          setCheckState({
            status: "available",
            message: result.message,
          });
        } else {
          setCheckState({
            status: "unavailable",
            message: result.message,
          });
        }
      } catch {
        if (currentId !== checkId.current) return;
        setCheckState({
          status: "unavailable",
          message: "Could not check availability. Please try again.",
        });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [candidate, currentSubdomain]);

  const handleStartEdit = () => {
    if (inCooldown) return;
    setCandidate(currentSubdomain);
    setSubmitError(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setCandidate(currentSubdomain);
    setSubmitError(null);
    setShowConfirmModal(false);
    setIsEditing(false);
  };

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (checkState.status !== "available" || inCooldown) return;
    setSubmitError(null);
    setShowConfirmModal(true);
  };

  const handleExecuteChange = () => {
    setShowConfirmModal(false);
    setSubmitError(null);
    startTransition(async () => {
      const form = new FormData();
      form.set("subdomain", candidate.trim().toLowerCase());
      try {
        await changeSubdomainAction(form);
        setIsEditing(false);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Failed to update subdomain.");
      }
    });
  };

  const fullStoreUrl = `https://${currentSubdomain}.${rootDomain}`;
  const previousStoreUrl = previousSubdomain ? `https://${previousSubdomain}.${rootDomain}` : null;
  const formattedNextAllowed = nextAllowedAt ? new Date(nextAllowedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;
  const formattedExpiresAt = previousSubdomainExpiresAt ? new Date(previousSubdomainExpiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;

  return (
    <>
      <section className="card p-md" data-testid="subdomain-card">
        <div className="card-head flex-between items-center mb-sm">
          <div>
            <h2 className="text-base font-bold m-0">Store Subdomain</h2>
            <p className="muted text-xs m-0 mt-xs">
              Your default, free BizTrackBD storefront address with automated SSL.
            </p>
          </div>
          {!isEditing && canEdit && (
            <div>
              {inCooldown ? (
                <button
                  type="button"
                  disabled
                  className="btn btn-secondary btn-sm"
                  title={`Subdomain changed recently. Next change in ${cooldownDaysLeft} days.`}
                  style={{ opacity: 0.65, cursor: "not-allowed" }}
                >
                  Cooldown ({cooldownDaysLeft}d left)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="btn btn-secondary btn-sm"
                  data-testid="edit-subdomain-btn"
                >
                  Change Subdomain
                </button>
              )}
            </div>
          )}
        </div>

        {/* 14-day Cooldown Banner if active */}
        {inCooldown && (
          <div
            className="notice info text-xs mb-sm"
            style={{ padding: "8px 12px", borderRadius: 8 }}
            data-testid="cooldown-banner"
          >
            <b>14-Day Cooldown:</b> Your subdomain was updated recently. You can change your store address again in{" "}
            <b>{cooldownDaysLeft} {cooldownDaysLeft === 1 ? "day" : "days"}</b> (after {formattedNextAllowed}).
          </div>
        )}

        {/* 30-day Transitional Forwarding Banner if active */}
        {previousStoreUrl && (
          <div
            className="notice good text-xs mb-sm"
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
            }}
            data-testid="forwarding-banner"
          >
            <div>
              <b>30-Day Forwarding Active:</b> Visitors and links to{" "}
              <code style={{ fontSize: 12 }}>{previousStoreUrl}</code> are automatically forwarded to your new address until{" "}
              <b>{formattedExpiresAt}</b>.
            </div>
            <span className="pill ok text-xs">Forwarding 301</span>
          </div>
        )}

        {!isEditing ? (
          <div
            className="row items-center gap-md p-md bg-subtle border rounded-lg"
            style={{ borderRadius: 10, flexWrap: "wrap", justifyContent: "space-between" }}
          >
            <div className="stack gap-xs">
              <div className="row items-center gap-xs">
                <span className="font-mono text-sm font-bold" style={{ color: "var(--brand, #0B4D3B)" }}>
                  {fullStoreUrl}
                </span>
                <span className="pill ok text-xs">Primary</span>
              </div>
              <p className="muted text-xs m-0">
                Customers can always visit your store using this link, even without a custom domain.
              </p>
            </div>
            <a
              href={fullStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ textDecoration: "none" }}
            >
              Visit Store ↗
            </a>
          </div>
        ) : (
          <form onSubmit={handleOpenConfirm} className="stack gap-md mt-sm" data-testid="subdomain-edit-form">
            {submitError && (
              <div className="notice bad mb-xs" role="alert">
                {submitError}
              </div>
            )}

            <div className="field m-0">
              <label className="label" htmlFor="subdomain-input">
                Choose a new subdomain
              </label>

              {/* Prefix & Suffix URL input group */}
              <div
                className="row items-center border"
                style={{
                  borderRadius: 10,
                  background: "var(--surface)",
                  overflow: "hidden",
                  border: "1px solid var(--line-2)",
                }}
              >
                <span
                  style={{
                    padding: "0 12px",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--ink-2)",
                    background: "var(--bg)",
                    borderRight: "1px solid var(--line-2)",
                    minHeight: 44,
                    display: "flex",
                    alignItems: "center",
                    userSelect: "none",
                  }}
                >
                  https://
                </span>
                <input
                  id="subdomain-input"
                  name="subdomain"
                  value={candidate}
                  onChange={(e) => setCandidate(e.target.value)}
                  className="input font-mono"
                  style={{
                    border: 0,
                    outline: "none",
                    boxShadow: "none",
                    borderRadius: 0,
                    flex: 1,
                    fontSize: 15,
                    fontWeight: 600,
                    color: "var(--ink)",
                  }}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  maxLength={40}
                  placeholder="my-shop"
                  disabled={isPending}
                />
                <span
                  style={{
                    padding: "0 12px",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--ink-2)",
                    background: "var(--bg)",
                    borderLeft: "1px solid var(--line-2)",
                    minHeight: 44,
                    display: "flex",
                    alignItems: "center",
                    userSelect: "none",
                  }}
                >
                  .{rootDomain}
                </span>
              </div>

              {/* Live Availability Status Message */}
              <div className="mt-xs" style={{ minHeight: 22, fontSize: 13 }}>
                {checkState.status === "checking" && (
                  <span className="row items-center gap-xs" style={{ color: "var(--ink-2)" }}>
                    <span
                      style={{
                        display: "inline-block",
                        width: 12,
                        height: 12,
                        border: "2px solid var(--line)",
                        borderTopColor: "var(--brand)",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                      }}
                    />
                    <span>Checking availability…</span>
                  </span>
                )}
                {checkState.status === "available" && (
                  <span style={{ color: "#059669", fontWeight: 600 }}>
                    {checkState.message}
                  </span>
                )}
                {checkState.status === "unavailable" && (
                  <span style={{ color: "#dc2626", fontWeight: 600 }}>
                    ✗ {checkState.message}
                  </span>
                )}
                {checkState.status === "current" && (
                  <span style={{ color: "var(--ink-2)" }}>
                    {checkState.message}
                  </span>
                )}
              </div>

              <div className="muted text-xs mt-xs stack gap-xs">
                <span>Use 3 to 40 characters: lowercase letters, numbers, and single hyphens.</span>
              </div>
            </div>

            <div
              className="notice info text-xs"
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                lineHeight: 1.5,
              }}
            >
              <b>30-Day Forwarding Guarantee:</b> When you change your subdomain, visitors and existing links to{" "}
              <code>{fullStoreUrl}</code> will be <b>automatically forwarded (HTTP 301)</b> to your new address for 30 days.
              No customer links will break!
            </div>

            <div className="row gap-xs items-center">
              <button
                type="submit"
                disabled={checkState.status !== "available" || isPending}
                className="btn btn-primary btn-sm"
                data-testid="review-subdomain-btn"
              >
                {isPending ? "Updating Subdomain…" : "Review & Change Subdomain"}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isPending}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
          data-testid="subdomain-confirm-modal"
        >
          <div
            className="card p-lg stack gap-md"
            style={{
              maxWidth: 480,
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              borderRadius: 12,
            }}
          >
            <div>
              <h3 className="text-lg font-bold m-0">Confirm Address Change</h3>
              <p className="muted text-sm m-0 mt-xs">
                Your new storefront address will become:
              </p>
              <div
                className="font-mono text-sm font-bold p-xs mt-xs text-center"
                style={{
                  background: "var(--bg)",
                  borderRadius: 6,
                  color: "var(--brand, #0B4D3B)",
                  border: "1px solid var(--line)",
                }}
              >
                https://{candidate.trim().toLowerCase()}.{rootDomain}
              </div>
            </div>

            <div className="stack gap-xs text-xs" style={{ lineHeight: 1.5 }}>
              <div className="row gap-xs items-start">
                <span>✓</span>
                <span>
                  <b>30-Day Forwarding:</b> All traffic and product links to <code>{fullStoreUrl}</code> will automatically redirect to your new address for 30 days.
                </span>
              </div>
              <div className="row gap-xs items-start">
                <span>✓</span>
                <span>
                  <b>14-Day Cooldown:</b> You will be able to change your subdomain again 14 days after this change.
                </span>
              </div>
              <div className="row gap-xs items-start">
                <span>✓</span>
                <span>
                  <b>Custom Domains:</b> Any connected custom domains (e.g., <code>yourbrand.com</code>) will remain unaffected.
                </span>
              </div>
            </div>

            <div className="row gap-xs justify-end items-center mt-xs">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isPending}
                className="btn btn-secondary btn-sm"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleExecuteChange}
                disabled={isPending}
                className="btn btn-primary btn-sm"
                data-testid="confirm-subdomain-change-btn"
              >
                {isPending ? "Changing Address…" : "Confirm & Change Subdomain"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
