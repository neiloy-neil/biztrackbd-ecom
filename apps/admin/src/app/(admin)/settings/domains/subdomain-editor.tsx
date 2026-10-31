"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { checkSubdomainAction, changeSubdomainAction } from "./actions";
import { type SubdomainAvailabilityResult } from "@biztrackbd/core";

interface Props {
  currentSubdomain: string;
  rootDomain: string;
  canEdit: boolean;
}

export function SubdomainEditor({ currentSubdomain, rootDomain, canEdit }: Props) {
  const [isEditing, setIsEditing] = useState(false);
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
    setCandidate(currentSubdomain);
    setSubmitError(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setCandidate(currentSubdomain);
    setSubmitError(null);
    setIsEditing(false);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (checkState.status !== "available") return;

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

  return (
    <section className="card p-md" data-testid="subdomain-card">
      <div className="card-head flex-between items-center mb-sm">
        <div>
          <h2 className="text-base font-bold m-0">Store Subdomain</h2>
          <p className="muted text-xs m-0 mt-xs">
            Your default, free BizTrackBD storefront address with automated SSL.
          </p>
        </div>
        {!isEditing && canEdit && (
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
              <span className="pill ok text-xs">Active</span>
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
        <form onSubmit={handleSubmit} className="stack gap-md mt-sm" data-testid="subdomain-edit-form">
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
            className="notice warn text-xs"
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              lineHeight: 1.5,
            }}
          >
            <b>Notice:</b> Changing your subdomain will update your storefront address immediately.
            Any existing links, QR codes, or bookmarks to <code>{fullStoreUrl}</code> will no longer work.
            (Any custom domains connected below will remain active).
          </div>

          <div className="row gap-xs items-center">
            <button
              type="submit"
              disabled={checkState.status !== "available" || isPending}
              className="btn btn-primary btn-sm"
              data-testid="save-subdomain-btn"
            >
              {isPending ? "Updating Subdomain…" : "Save New Subdomain"}
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
  );
}
