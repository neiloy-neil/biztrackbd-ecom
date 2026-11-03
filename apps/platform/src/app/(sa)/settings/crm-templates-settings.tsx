"use client";

import { useState, useTransition } from "react";
import { saveCrmTemplateAction } from "./actions";

export interface CrmTemplateItem {
  id: string;
  key: string;
  title: string;
  body: string;
  language: string;
  isDefault: boolean;
}

export function CrmTemplatesSettings({ initialTemplates }: { initialTemplates: CrmTemplateItem[] }) {
  const [templates, setTemplates] = useState<CrmTemplateItem[]>(initialTemplates);
  const [selectedKey, setSelectedKey] = useState(templates[0]?.key || "");
  const [editingTemplate, setEditingTemplate] = useState<CrmTemplateItem | null>(templates[0] || null);
  const [isPending, startTransition] = useTransition();
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const current = editingTemplate;

  const handleSelect = (tmpl: CrmTemplateItem) => {
    setSelectedKey(tmpl.key);
    setEditingTemplate({ ...tmpl });
    setStatusMsg(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) return;

    startTransition(async () => {
      const res = await saveCrmTemplateAction({
        key: current.key,
        title: current.title,
        body: current.body,
        language: current.language,
      });

      if (res.ok && res.template) {
        setStatusMsg({ type: "success", text: `Template "${current.title}" saved successfully!` });
        setTemplates((prev) =>
          prev.map((t) => (t.key === current.key ? (res.template as CrmTemplateItem) : t))
        );
      } else {
        setStatusMsg({ type: "error", text: res.error || "Failed to save template." });
      }
    });
  };

  return (
    <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--ink)" }}>
            WhatsApp & Outreach CRM Templates
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--ink-3)" }}>
            Customize default greeting scripts used by platform sales and support when messaging new store owners.
          </p>
        </div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            padding: "3px 10px",
            borderRadius: 6,
            background: "#F0FDF4",
            color: "#15803D",
            border: "1px solid #DCFCE7",
          }}
        >
          {templates.length} Templates Active
        </span>
      </div>

      {statusMsg && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 13,
            fontWeight: 600,
            background: statusMsg.type === "success" ? "#F0FDF4" : "#FEF2F2",
            color: statusMsg.type === "success" ? "#166534" : "#991B1B",
            border: `1px solid ${statusMsg.type === "success" ? "#BBF7D0" : "#FECACA"}`,
          }}
        >
          {statusMsg.text}
        </div>
      )}

      {/* Available Placeholders Callout */}
      <div
        style={{
          background: "var(--bg)",
          border: "1px solid var(--line)",
          borderRadius: 8,
          padding: "10px 14px",
          fontSize: 12,
          color: "var(--ink-2)",
          marginBottom: 16,
          lineHeight: 1.5,
        }}
      >
        <strong>Dynamic Tokens:</strong> You can use{" "}
        <code style={{ background: "var(--brand-light)", color: "var(--brand-hover)", padding: "1px 5px", borderRadius: 4 }}>
          {"{ownerName}"}
        </code>
        ,{" "}
        <code style={{ background: "var(--brand-light)", color: "var(--brand-hover)", padding: "1px 5px", borderRadius: 4 }}>
          {"{storeName}"}
        </code>
        ,{" "}
        <code style={{ background: "var(--brand-light)", color: "var(--brand-hover)", padding: "1px 5px", borderRadius: 4 }}>
          {"{subdomain}"}
        </code>
        , and{" "}
        <code style={{ background: "var(--brand-light)", color: "var(--brand-hover)", padding: "1px 5px", borderRadius: 4 }}>
          {"{storeUrl}"}
        </code>{" "}
        inside template bodies. They are automatically replaced with real merchant info.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px minmax(0, 1fr)", gap: 20 }}>
        {/* Template List Selector */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {templates.map((t) => {
            const isSelected = t.key === selectedKey;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => handleSelect(t)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: isSelected ? "1.5px solid var(--brand)" : "1px solid var(--line)",
                  background: isSelected ? "var(--brand-light)" : "#fff",
                  color: isSelected ? "var(--brand-hover)" : "var(--ink-2)",
                  fontSize: 13,
                  fontWeight: isSelected ? 700 : 500,
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <div>{t.title}</div>
                <div style={{ fontSize: 11, color: isSelected ? "var(--brand)" : "#94A3B8", marginTop: 2 }}>
                  Key: {t.key} · {t.language.toUpperCase()}
                </div>
              </button>
            );
          })}
        </div>

        {/* Template Editor */}
        {current && (
          <form
            onSubmit={handleSave}
            style={{
              background: "var(--bg)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--ink-2)", marginBottom: 4 }}>
                Template Title
              </label>
              <input
                type="text"
                value={current.title}
                onChange={(e) => setEditingTemplate({ ...current, title: e.target.value })}
                required
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "7px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--line-2)",
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--ink-2)", marginBottom: 4 }}>
                Message Text (WhatsApp Body)
              </label>
              <textarea
                value={current.body}
                onChange={(e) => setEditingTemplate({ ...current, body: e.target.value })}
                required
                rows={6}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px",
                  borderRadius: 6,
                  border: "1px solid var(--line-2)",
                  fontSize: 13,
                  lineHeight: 1.5,
                  fontFamily: "inherit",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
              <button
                type="submit"
                disabled={isPending}
                style={{
                  padding: "7px 16px",
                  borderRadius: 6,
                  background: "var(--brand)",
                  color: "#fff",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {isPending ? "Saving Template…" : "Save Template"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
