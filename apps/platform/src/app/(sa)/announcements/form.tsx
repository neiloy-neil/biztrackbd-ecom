"use client";

import { useState } from "react";
import { createAnnouncementAction } from "./actions";

interface FormProps {
  totalStores: number;
}

export function AnnouncementComposeForm({ totalStores }: FormProps) {
  const [title, setTitle] = useState("Pathao is changing its API on 20 October");
  const [titleBn, setTitleBn] = useState("২০ অক্টোবর পাঠাও এপিআই পরিবর্তন হচ্ছে");
  const [body, setBody] = useState(
    "If you use Pathao, open Settings, Integrations and re-enter your Pathao password before 20 October. Otherwise parcel booking will pause until you do."
  );
  const [audienceType, setAudienceType] = useState<"ALL" | "PLAN" | "INTEGRATION" | "TENANT">("ALL");
  const [audienceValue, setAudienceValue] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
      {/* Compose Card */}
      <form
        action={async (fd) => {
          setPending(true);
          await createAnnouncementAction(fd);
        }}
        className="card"
        style={{ flex: "1.2 1 520px", minWidth: 0, padding: "24px 26px", display: "flex", flexDirection: "column", gap: 18 }}
      >
        <div style={{ fontSize: 16, fontWeight: 700 }}>Compose</div>

        <div>
          <label htmlFor="title" style={{ display: "block", fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>
            Title (English)
          </label>
          <input
            id="title"
            name="title"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Scheduled maintenance this Friday"
            required
            style={{ width: "100%", height: 42, borderColor: "var(--brand)", fontSize: 14.5 }}
          />
        </div>

        <div>
          <label htmlFor="titleBn" style={{ display: "block", fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>
            Bangla title (optional)
          </label>
          <input
            id="titleBn"
            name="titleBn"
            className="input"
            value={titleBn}
            onChange={(e) => setTitleBn(e.target.value)}
            placeholder="বাংলা শিরোনাম"
            style={{ width: "100%", height: 42, fontSize: 14.5 }}
          />
        </div>

        <div>
          <label htmlFor="body" style={{ display: "block", fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>
            Message
          </label>
          <textarea
            id="body"
            name="body"
            className="input"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            required
            style={{ width: "100%", padding: 12, fontSize: 14, lineHeight: 1.65 }}
          />
        </div>

        <div>
          <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>
            Who sees it (Audience)
          </span>
          <input type="hidden" name="audienceType" value={audienceType} />
          <input type="hidden" name="audienceValue" value={audienceValue} />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => { setAudienceType("ALL"); setAudienceValue(""); }}
              style={{
                padding: "7px 14px",
                borderRadius: 18,
                border: audienceType === "ALL" ? "2px solid var(--brand)" : "1px solid var(--line)",
                background: audienceType === "ALL" ? "var(--tint)" : "transparent",
                color: audienceType === "ALL" ? "var(--brand)" : "var(--ink-2)",
                fontSize: 13,
                fontWeight: audienceType === "ALL" ? 700 : 600,
                cursor: "pointer",
              }}
            >
              All stores ({totalStores})
            </button>
            <button
              type="button"
              onClick={() => { setAudienceType("INTEGRATION"); setAudienceValue("PATHAO"); }}
              style={{
                padding: "7px 14px",
                borderRadius: 18,
                border: audienceType === "INTEGRATION" ? "2px solid var(--brand)" : "1px solid var(--line)",
                background: audienceType === "INTEGRATION" ? "var(--tint)" : "transparent",
                color: audienceType === "INTEGRATION" ? "var(--brand)" : "var(--ink-2)",
                fontSize: 13,
                fontWeight: audienceType === "INTEGRATION" ? 700 : 600,
                cursor: "pointer",
              }}
            >
              Stores with Pathao connected
            </button>
            <button
              type="button"
              onClick={() => { setAudienceType("PLAN"); setAudienceValue("PRO"); }}
              style={{
                padding: "7px 14px",
                borderRadius: 18,
                border: audienceType === "PLAN" ? "2px solid var(--brand)" : "1px solid var(--line)",
                background: audienceType === "PLAN" ? "var(--tint)" : "transparent",
                color: audienceType === "PLAN" ? "var(--brand)" : "var(--ink-2)",
                fontSize: 13,
                fontWeight: audienceType === "PLAN" ? 700 : 600,
                cursor: "pointer",
              }}
            >
              By plan
            </button>
            <button
              type="button"
              onClick={() => { setAudienceType("TENANT"); setAudienceValue(""); }}
              style={{
                padding: "7px 14px",
                borderRadius: 18,
                border: audienceType === "TENANT" ? "2px solid var(--brand)" : "1px solid var(--line)",
                background: audienceType === "TENANT" ? "var(--tint)" : "transparent",
                color: audienceType === "TENANT" ? "var(--brand)" : "var(--ink-2)",
                fontSize: 13,
                fontWeight: audienceType === "TENANT" ? 700 : 600,
                cursor: "pointer",
              }}
            >
              One store
            </button>
          </div>

          {audienceType === "PLAN" && (
            <div style={{ marginTop: 8 }}>
              <label htmlFor="planValue" style={{ fontSize: 12, color: "var(--ink-3)", display: "block", marginBottom: 4 }}>Select target plan:</label>
              <select
                id="planValue"
                className="select"
                value={audienceValue}
                onChange={(e) => setAudienceValue(e.target.value)}
                style={{ width: "100%", height: 38 }}
              >
                <option value="STARTER">Starter Plan</option>
                <option value="PRO">Pro Plan</option>
                <option value="BUSINESS">Business Plan</option>
              </select>
            </div>
          )}

          {audienceType === "INTEGRATION" && (
            <div style={{ marginTop: 8 }}>
              <label htmlFor="integValue" style={{ fontSize: 12, color: "var(--ink-3)", display: "block", marginBottom: 4 }}>Select integration provider:</label>
              <select
                id="integValue"
                className="select"
                value={audienceValue}
                onChange={(e) => setAudienceValue(e.target.value)}
                style={{ width: "100%", height: 38 }}
              >
                <option value="PATHAO">Pathao Courier</option>
                <option value="STEADFAST">Steadfast Courier</option>
                <option value="REDX">RedX Courier</option>
                <option value="BKASH">bKash Merchant Gateway</option>
              </select>
            </div>
          )}

          {audienceType === "TENANT" && (
            <div style={{ marginTop: 8 }}>
              <label htmlFor="tenantIdInput" style={{ fontSize: 12, color: "var(--ink-3)", display: "block", marginBottom: 4 }}>Enter Store Tenant ID:</label>
              <input
                id="tenantIdInput"
                className="input"
                placeholder="e.g. cm123..."
                value={audienceValue}
                onChange={(e) => setAudienceValue(e.target.value)}
                style={{ width: "100%", height: 38 }}
              />
            </div>
          )}
        </div>

        <div>
          <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>
            How to show it (Channels)
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13.5 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input type="checkbox" checked readOnly style={{ width: 18, height: 18, accentColor: "var(--brand)" }} />
              <span>Banner at the top of the admin</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--ink-3)" }}>
              <input type="checkbox" disabled style={{ width: 18, height: 18 }} />
              <span>Email to the owner <small style={{ color: "var(--ink-3)" }}>(Requires transactional SMTP key)</small></span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--ink-3)" }}>
              <input type="checkbox" disabled style={{ width: 18, height: 18 }} />
              <span>SMS to the owner <small style={{ color: "var(--ink-3)" }}>(Requires platform SMS credits)</small></span>
            </label>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ height: 40, padding: "0 14px", border: "1px solid var(--line)", borderRadius: 8, fontSize: 13.5, fontWeight: 600, display: "flex", alignItems: "center" }}>
            Show from: Now
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label htmlFor="endsAt" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>Hide after:</label>
            <input
              id="endsAt"
              type="date"
              name="endsAt"
              className="input"
              style={{ height: 40, fontSize: 13 }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, borderTop: "1px solid var(--line)", paddingTop: 18, marginTop: 4 }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={pending || !title.trim() || !body.trim()}
            style={{ height: 42, padding: "0 22px", fontWeight: 700 }}
          >
            {pending ? "Publishing…" : "Publish announcement"}
          </button>
        </div>
      </form>

      {/* Live Preview Panel */}
      <div style={{ flex: "1 1 360px", minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
        <div className="card" style={{ padding: "20px 22px" }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>How owners will see it</div>
          <div style={{ border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ background: "#FDF3E3", padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "0 0 18px", marginTop: 2 }}>
                <path d="M4 10v4h3l8 4V6L7 10H4zM18 9a4 4 0 010 6" />
              </svg>
              <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--ink-2)" }}>
                <b style={{ color: "#B45309" }}>{title || "Announcement Title"}</b>
                {titleBn && <div style={{ fontSize: 12, color: "#92400E", marginTop: 2 }}>{titleBn}</div>}
                <div style={{ marginTop: 4 }}>{body || "Announcement message description..."}</div>
              </div>
            </div>
            <div style={{ height: 80, background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-3)", fontSize: 12 }}>
              Store admin dashboard preview
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
