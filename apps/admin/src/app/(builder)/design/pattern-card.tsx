import React from "react";
import type { SectionPattern } from "@biztrackbd/core";
import { SECTION_GRADIENT_PRESETS, type SectionDef } from "@biztrackbd/core/builder-client";
import { SectionThumb } from "./section-thumbs";

interface PatternCardProps {
  pattern: SectionPattern;
  onInsert: (pattern: SectionPattern) => void;
  disabled?: boolean;
  disabledReason?: string;
  def?: SectionDef;
}

export function PatternCard({ pattern, onInsert, disabled, disabledReason, def }: PatternCardProps) {
  const gradientCss = pattern.style?.bgGradient
    ? SECTION_GRADIENT_PRESETS[pattern.style.bgGradient]?.css ?? pattern.style.bgGradient
    : pattern.style?.bgColor ?? null;

  const isDark = pattern.style?.textColor === "light" || pattern.style?.bgGradient === "clean-dark" || pattern.style?.bgGradient === "midnight" || pattern.style?.bgGradient === "emerald" || pattern.style?.bgGradient === "royal";

  return (
    <div
      className={`bld-pattern-card${disabled ? " is-disabled" : ""}`}
      style={{
        border: "1px solid var(--line-1)",
        borderRadius: 12,
        overflow: "hidden",
        background: "var(--surface-1)",
        display: "flex",
        flexDirection: "column",
        transition: "transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
        opacity: disabled ? 0.6 : 1,
      }}
      data-testid={`pattern-${pattern.id}`}
    >
      {/* Visual Header / Micro Preview */}
      <div
        style={{
          position: "relative",
          height: 80,
          background: gradientCss || (pattern.style?.cardMode ? "var(--surface-2)" : "var(--surface-3)"),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderBottom: "1px solid var(--line-1)",
          overflow: "hidden",
        }}
      >
        {/* Subtle grid pattern background for visual depth */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: isDark ? 0.12 : 0.05,
            backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
            backgroundSize: "12px 12px",
            color: isDark ? "#ffffff" : "#000000",
          }}
          aria-hidden
        />

        {/* Thumbnail wireframe */}
        <div
          style={{
            transform: "scale(0.9)",
            color: isDark ? "#ffffff" : "var(--text-1)",
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.12))",
            zIndex: 1,
          }}
        >
          <SectionThumb type={pattern.sectionType} />
        </div>

        {/* Top Badges */}
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            right: 8,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            zIndex: 2,
            pointerEvents: "none",
          }}
        >
          <span
            className="pill"
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: "2px 6px",
              background: isDark ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.75)",
              color: isDark ? "#ffffff" : "var(--text-1)",
              backdropFilter: "blur(4px)",
            }}
          >
            {def?.label ?? pattern.sectionType}
          </span>

          {pattern.badge && (
            <span
              className="pill ok"
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: "2px 6px",
                lineHeight: "14px",
                background: "var(--accent-tint, rgba(16,185,129,0.15))",
                color: "var(--accent, #10b981)",
                border: "1px solid var(--accent, #10b981)",
              }}
            >
              {pattern.badge}
            </span>
          )}
        </div>

        {/* Style attributes indicators at bottom of preview */}
        <div
          style={{
            position: "absolute",
            bottom: 6,
            left: 8,
            display: "flex",
            gap: 4,
            zIndex: 2,
          }}
        >
          {pattern.style?.animation && pattern.style.animation !== "none" && (
            <span
              style={{
                fontSize: 9,
                padding: "1px 4px",
                borderRadius: 4,
                background: isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.06)",
                color: isDark ? "#ffffff" : "var(--text-2)",
              }}
              title={`Entrance Motion: ${pattern.style.animation}`}
            >
              ✦ {pattern.style.animation}
            </span>
          )}
          {pattern.style?.cardMode && (
            <span
              style={{
                fontSize: 9,
                padding: "1px 4px",
                borderRadius: 4,
                background: isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.06)",
                color: isDark ? "#ffffff" : "var(--text-2)",
              }}
              title="Card container mode"
            >
              ⊞ Card
            </span>
          )}
        </div>
      </div>

      {/* Card Content */}
      <div style={{ padding: "12px 14px", flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ marginBottom: 4 }}>
          <b style={{ fontSize: 13, lineHeight: 1.3, display: "block", color: "var(--text-1)" }}>
            {pattern.title}
          </b>
          {pattern.titleBn && (
            <span style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginTop: 1 }}>
              {pattern.titleBn}
            </span>
          )}
        </div>

        <p
          style={{
            fontSize: 12,
            lineHeight: 1.4,
            color: "var(--text-2)",
            margin: "4px 0 10px 0",
            flex: 1,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
          title={pattern.description}
        >
          {pattern.description}
        </p>

        {/* Footer with Actions */}
        <div style={{ marginTop: "auto", paddingTop: 8, borderTop: "1px solid var(--line-2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {disabled ? (
            <span
              style={{
                fontSize: 11,
                color: "var(--text-3)",
                fontStyle: "italic",
              }}
            >
              {disabledReason || "Already on page"}
            </span>
          ) : (
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>
              {pattern.defaultLabel}
            </span>
          )}

          <button
            type="button"
            className={`btn btn-sm ${disabled ? "btn-secondary" : "btn-primary"}`}
            disabled={disabled}
            onClick={() => onInsert(pattern)}
            style={{
              padding: "3px 10px",
              fontSize: 11,
              fontWeight: 600,
              gap: 4,
            }}
            data-testid={`insert-pattern-${pattern.id}`}
          >
            {disabled ? "Limit Reached" : "+ Insert Pattern"}
          </button>
        </div>
      </div>
    </div>
  );
}
