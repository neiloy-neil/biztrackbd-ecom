import Link from "next/link";
import {
  themeDefinition,
  getBusinessTemplateByVertical,
  type BusinessVertical,
} from "@biztrackbd/core";

export function DemoRibbon({
  themeId,
  lang,
  siteMode,
  vertical,
}: {
  themeId: string;
  lang: "bn" | "en";
  siteMode?: string;
  vertical?: string | null;
}) {
  const bn = lang === "bn";
  const bizTemplate = vertical ? getBusinessTemplateByVertical(vertical as BusinessVertical) : undefined;
  const theme = themeDefinition(themeId);
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";

  const startUrl = bizTemplate
    ? root.includes("localhost")
      ? `http://localhost:3002/start?template=${bizTemplate.id}&mode=portfolio&vertical=${vertical?.toLowerCase()}`
      : `https://biztrack.bd/start?template=${bizTemplate.id}&mode=portfolio&vertical=${vertical?.toLowerCase()}`
    : root.includes("localhost")
    ? `http://localhost:3002/start?theme=${themeId}`
    : `https://biztrack.bd/start?theme=${themeId}`;

  const templatesUrl = bizTemplate
    ? root.includes("localhost")
      ? "http://localhost:3002/templates?tab=business"
      : "https://biztrack.bd/templates?tab=business"
    : root.includes("localhost")
    ? "http://localhost:3002/templates"
    : "https://biztrack.bd/templates";

  const templateTitle = bizTemplate
    ? `${bizTemplate.name} ${bn ? "বিজনেস ডেমো" : "Business Demo"}`
    : `${theme.name} ${bn ? "টেমপ্লেট প্রিভিউ" : "Template Preview"}`;

  const simulationNotice = bizTemplate
    ? bn
      ? "• ডিজিটাল মেন্যু, সার্ভিস ও বুকিং রিকোয়েস্ট সিমুলেশন মোডে কাজ করছে।"
      : "• Interactive digital menu, services & booking requests in simulation mode."
    : bn
    ? "• কার্ট এবং ব্রাউজিং কাজ করে, কোনো আসল টাকা বা অর্ডার কাটা হবে না।"
    : "• Cart and checkout are in simulation mode. No real orders are placed.";

  return (
    <div
      role="region"
      aria-label="Demo store banner"
      style={{
        background: "linear-gradient(90deg, #101828 0%, #1d2939 100%)",
        color: "#f8fafc",
        padding: "8px 16px",
        fontSize: "13px",
        lineHeight: "1.4",
        borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
        position: "relative",
        zIndex: 50,
      }}
    >
      <div
        className="wrap"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "8px 16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              background: bizTemplate ? "#10b981" : "#3b82f6",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "11px",
              letterSpacing: "0.5px",
              padding: "2px 8px",
              borderRadius: "999px",
              textTransform: "uppercase",
            }}
          >
            {bn ? "লাইভ ডেমো" : "Live Demo"}
          </span>
          <span style={{ fontWeight: 600 }}>
            {templateTitle}
          </span>
          <span style={{ opacity: 0.85, fontSize: "12px" }}>
            {simulationNotice}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <a
            href={templatesUrl}
            style={{
              color: "#cbd5e1",
              fontSize: "12px",
              textDecoration: "underline",
              textUnderlineOffset: "3px",
            }}
          >
            {bn ? "সব টেমপ্লেট" : "All templates"}
          </a>
          <a
            href={startUrl}
            style={{
              display: "inline-flex",
              alignItems: "center",
              background: "#ffffff",
              color: "#0f172a",
              fontWeight: 600,
              fontSize: "12px",
              padding: "4px 12px",
              borderRadius: "6px",
              textDecoration: "none",
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
            }}
          >
            {bn ? "এই টেমপ্লেটটি ব্যবহার করুন" : "Use this template"} →
          </a>
        </div>
      </div>
    </div>
  );
}
