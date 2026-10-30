"use client";

import React, { useState, useTransition } from "react";
import { PageHeader } from "@biztrackbd/ui";
import type { SiteDownload } from "@biztrackbd/db";
import {
  saveDownloadAction,
  deleteDownloadAction,
  reorderDownloadsAction,
  exportDownloadsCsvAction,
} from "./actions";

interface Props {
  initialDownloads: SiteDownload[];
  storeOrigin: string;
}

const DOWNLOAD_KINDS = [
  { value: "CV", label: "Curriculum Vitae / Resume", icon: "📄" },
  { value: "BROCHURE", label: "Company Brochure", icon: "📑" },
  { value: "PROFILE", label: "Company Profile", icon: "🏢" },
  { value: "MENU_PDF", label: "Restaurant Menu PDF", icon: "🍽️" },
  { value: "CATALOG", label: "Product / Service Catalog", icon: "📦" },
  { value: "FILE", label: "Document / Other", icon: "📎" },
];

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DownloadsManager({ initialDownloads, storeOrigin }: Props) {
  const [downloads, setDownloads] = useState<SiteDownload[]>(initialDownloads);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  // Modal / Editing state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SiteDownload | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form fields
  const [label, setLabel] = useState("");
  const [labelBn, setLabelBn] = useState("");
  const [kind, setKind] = useState("FILE");
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [fileSize, setFileSize] = useState<string>("");
  const [requiresLead, setRequiresLead] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormError(null);
    setLabel("");
    setLabelBn("");
    setKind("BROCHURE");
    setFileName("");
    setFileUrl("");
    setFileSize("");
    setRequiresLead(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: SiteDownload) => {
    setEditingItem(item);
    setFormError(null);
    setLabel(item.label);
    setLabelBn(item.labelBn || "");
    setKind(item.kind);
    setFileName(item.fileName);
    setFileUrl(item.fileUrl);
    setFileSize(item.fileSize ? String(item.fileSize) : "");
    setRequiresLead(!item.isPublic);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      setFormError("Asset label is required");
      return;
    }
    if (!fileName.trim()) {
      setFormError("File name is required");
      return;
    }
    if (!fileUrl.trim()) {
      setFormError("File URL is required");
      return;
    }

    setFormError(null);

    startTransition(async () => {
      try {
        const res = await saveDownloadAction({
          id: editingItem ? editingItem.id : undefined,
          label: label.trim(),
          labelBn: labelBn.trim() || null,
          kind,
          fileName: fileName.trim(),
          fileUrl: fileUrl.trim(),
          fileSize: fileSize ? Number(fileSize) : null,
          isPublic: !requiresLead,
          requiresLead,
          sortOrder: editingItem ? editingItem.sortOrder : 0,
        });

        if (res.ok && res.data) {
          if (editingItem) {
            setDownloads((prev) => prev.map((x) => (x.id === res.data.id ? res.data : x)));
          } else {
            setDownloads((prev) => [...prev, res.data]);
          }
          setIsModalOpen(false);
        }
      } catch (err: any) {
        setFormError(err.message || "Failed to save download asset");
      }
    });
  };

  const handleDelete = (id: string, itemLabel: string) => {
    if (!confirm(`Are you sure you want to delete "${itemLabel}"?`)) return;
    startTransition(async () => {
      await deleteDownloadAction(id);
      setDownloads((prev) => prev.filter((x) => x.id !== id));
    });
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= filteredDownloads.length) return;

    const newFiltered = [...filteredDownloads];
    const [moved] = newFiltered.splice(index, 1);
    if (!moved) return;
    newFiltered.splice(targetIndex, 0, moved);

    const reorderedIds = newFiltered.map((it) => it.id);

    startTransition(async () => {
      await reorderDownloadsAction(reorderedIds);
      setDownloads(newFiltered);
    });
  };

  const handleCopyLink = (id: string) => {
    const fullUrl = `${storeOrigin}/api/downloads/${id}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportCsv = async () => {
    const res = await exportDownloadsCsvAction();
    if (res.ok && res.csv) {
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `downloads-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Filter
  const filteredDownloads = downloads.filter((it) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        it.label.toLowerCase().includes(q) ||
        (it.labelBn && it.labelBn.toLowerCase().includes(q)) ||
        it.fileName.toLowerCase().includes(q) ||
        it.kind.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalDownloadsCount = downloads.reduce((acc, curr) => acc + (curr.downloadCount || 0), 0);
  const gatedCount = downloads.filter((x) => !x.isPublic).length;

  return (
    <div className="downloads-workspace">
      <PageHeader
        title="Digital Downloads & Lead Magnets"
        crumbs={[{ label: "Home", href: "/" }, { label: "Downloads" }]}
        sub="Upload brochures, CVs, and menus. Set assets as direct 1-click or gate them to capture visitor contact leads."
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleExportCsv}
              disabled={isPending || downloads.length === 0}
            >
              Export CSV
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleOpenCreate}
              data-testid="add-download-asset-btn"
            >
              + Add Download Asset
            </button>
          </div>
        }
      />

      {/* Metrics Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
        <div className="card" style={{ padding: "14px 18px", border: "1px solid var(--border, #e2e8f0)", borderRadius: 8 }}>
          <div className="muted" style={{ fontSize: "0.8rem", textTransform: "uppercase", fontWeight: 600 }}>Total Assets</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: 4 }}>{downloads.length}</div>
        </div>
        <div className="card" style={{ padding: "14px 18px", border: "1px solid var(--border, #e2e8f0)", borderRadius: 8 }}>
          <div className="muted" style={{ fontSize: "0.8rem", textTransform: "uppercase", fontWeight: 600 }}>Lead Magnets (Gated)</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#7c3aed", marginTop: 4 }}>{gatedCount}</div>
        </div>
        <div className="card" style={{ padding: "14px 18px", border: "1px solid var(--border, #e2e8f0)", borderRadius: 8 }}>
          <div className="muted" style={{ fontSize: "0.8rem", textTransform: "uppercase", fontWeight: 600 }}>Total Visitor Downloads</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#16a34a", marginTop: 4 }}>{totalDownloadsCount}</div>
        </div>
      </div>

      {/* Search Input */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          className="input input-sm"
          placeholder="Filter by label, filename, or kind..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: "100%", maxWidth: 400 }}
        />
      </div>

      {/* Downloads Table */}
      {filteredDownloads.length === 0 ? (
        <div
          className="empty-state card"
          style={{
            padding: 40,
            textAlign: "center",
            backgroundColor: "var(--card-bg, #fff)",
            border: "1px dashed var(--border, #e2e8f0)",
            borderRadius: 8,
          }}
        >
          <div style={{ fontSize: "1.2rem", marginBottom: 12, color: "var(--ink-3)" }}><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></div>
          <h3 style={{ margin: "0 0 6px", fontSize: "1.1rem" }}>No downloadable assets found</h3>
          <p className="muted" style={{ margin: "0 0 16px", fontSize: "0.9rem" }}>
            Add your company brochure, specialist CV, or restaurant menu PDF for visitors to download.
          </p>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleOpenCreate}>
            + Add Asset
          </button>
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden", border: "1px solid var(--border, #e2e8f0)", borderRadius: 8 }}>
          <table className="table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ background: "var(--bg-muted, #f8fafc)", borderBottom: "1px solid var(--border, #e2e8f0)", textAlign: "left" }}>
                <th style={{ padding: "10px 14px", width: 40 }}>#</th>
                <th style={{ padding: "10px 14px" }}>Asset Title & File</th>
                <th style={{ padding: "10px 14px", width: 120 }}>Kind</th>
                <th style={{ padding: "10px 14px", width: 150 }}>Access Mode</th>
                <th style={{ padding: "10px 14px", width: 110, textAlign: "center" }}>Downloads</th>
                <th style={{ padding: "10px 14px", width: 90, textAlign: "center" }}>Reorder</th>
                <th style={{ padding: "10px 14px", width: 160, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDownloads.map((it, idx) => {
                const isGated = !it.isPublic;
                const kindMeta = DOWNLOAD_KINDS.find((k) => k.value === it.kind);
                return (
                  <tr key={it.id} style={{ borderBottom: "1px solid var(--border, #f1f5f9)" }}>
                    <td style={{ padding: "12px 14px", color: "#64748b", fontWeight: 600 }}>{idx + 1}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 600, color: "var(--text, #1e293b)" }}>
                        {it.label}
                        {it.labelBn && <span className="muted" style={{ marginLeft: 6, fontWeight: 400 }}>({it.labelBn})</span>}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: 2 }}>
                        <span>{it.fileName}</span>
                        <span style={{ marginLeft: 8 }}>({formatBytes(it.fileSize)})</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span
                        className="badge"
                        style={{
                          padding: "3px 8px",
                          borderRadius: 12,
                          fontSize: "0.75rem",
                          background: "#f1f5f9",
                          color: "#334155",
                          fontWeight: 500,
                        }}
                      >
                        {kindMeta?.icon || "📎"} {it.kind}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      {isGated ? (
                        <span
                          className="badge"
                          style={{
                            padding: "3px 8px",
                            borderRadius: 12,
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            backgroundColor: "#f5f3ff",
                            color: "#7c3aed",
                            border: "1px solid #ddd6fe",
                          }}
                        >
                          Lead Magnet (Gated)
                        </span>
                      ) : (
                        <span
                          className="badge"
                          style={{
                            padding: "3px 8px",
                            borderRadius: 12,
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            backgroundColor: "#dcfce7",
                            color: "#15803d",
                          }}
                        >
                          Direct 1-Click
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "center", fontWeight: 600 }}>
                      {it.downloadCount}
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "center" }}>
                      <div style={{ display: "inline-flex", gap: 3 }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: "2px 6px", fontSize: "0.75rem" }}
                          disabled={idx === 0 || isPending}
                          onClick={() => handleMove(idx, "up")}
                          title="Move Up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: "2px 6px", fontSize: "0.75rem" }}
                          disabled={idx === filteredDownloads.length - 1 || isPending}
                          onClick={() => handleMove(idx, "down")}
                          title="Move Down"
                        >
                          ↓
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: "4px 8px" }}
                          onClick={() => handleCopyLink(it.id)}
                          title="Copy public download endpoint"
                        >
                          {copiedId === it.id ? "Copied!" : "Link"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: "4px 8px" }}
                          onClick={() => handleOpenEdit(it)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          style={{ padding: "4px 8px" }}
                          onClick={() => handleDelete(it.id, it.label)}
                          disabled={isPending}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit / Create Modal */}
      {isModalOpen && (
        <div
          className="modal-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
            padding: 20,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div
            className="modal-card"
            style={{
              background: "#ffffff",
              color: "#0f172a",
              width: "100%",
              maxWidth: 580,
              maxHeight: "90vh",
              overflowY: "auto",
              borderRadius: 12,
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>
                {editingItem ? "Edit Download Asset" : "Add New Download Asset"}
              </h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsModalOpen(false)}
                style={{ padding: "2px 8px" }}
              >
                ✕
              </button>
            </div>

            {formError && (
              <div
                style={{
                  background: "#fee2e2",
                  color: "#991b1b",
                  padding: "8px 12px",
                  borderRadius: 6,
                  marginBottom: 16,
                  fontSize: "0.85rem",
                }}
              >
                {formError}
              </div>
            )}

            <form onSubmit={handleSave}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 4 }}>
                    Asset Label (English) *
                  </label>
                  <input
                    type="text"
                    className="input input-sm"
                    required
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Official Company Brochure"
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 4 }}>
                    Label (বাংলা)
                  </label>
                  <input
                    type="text"
                    className="input input-sm"
                    value={labelBn}
                    onChange={(e) => setLabelBn(e.target.value)}
                    placeholder="যেমনঃ কোম্পানির অফিসিয়াল ব্রোশিউর"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 4 }}>
                    Asset Type
                  </label>
                  <select
                    className="select input-sm"
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                    style={{ width: "100%" }}
                  >
                    {DOWNLOAD_KINDS.map((k) => (
                      <option key={k.value} value={k.value}>
                        {k.icon} {k.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 4 }}>
                    File Name *
                  </label>
                  <input
                    type="text"
                    className="input input-sm"
                    required
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    placeholder="e.g. biztrack-profile-2026.pdf"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 4 }}>
                  File Storage / Download URL *
                </label>
                <input
                  type="url"
                  className="input input-sm"
                  required
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                  placeholder="https://storage.biztrack.me/... or Google Drive direct link"
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 4 }}>
                  File Size (Bytes, Optional)
                </label>
                <input
                  type="number"
                  className="input input-sm"
                  value={fileSize}
                  onChange={(e) => setFileSize(e.target.value)}
                  placeholder="e.g. 2500000 (for ~2.5 MB)"
                  style={{ width: "100%" }}
                />
              </div>

              {/* GRILL-ME DECISION 3: CONFIGURABLE LEAD GATE */}
              <div
                style={{
                  background: requiresLead ? "#f5f3ff" : "#f0fdf4",
                  border: `1px solid ${requiresLead ? "#c4b5fd" : "#bbf7d0"}`,
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 20,
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: "0.95rem", marginBottom: 6, color: "#1e293b" }}>
                  Access Mode & Lead Gate
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="leadGateMode"
                      checked={!requiresLead}
                      onChange={() => setRequiresLead(false)}
                      style={{ marginTop: 3 }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "#166534" }}>
                        Direct 1-Click Download
                      </div>
                      <div className="muted" style={{ fontSize: "0.8rem", marginTop: 2 }}>
                        Visitors can download the document immediately without providing contact info. Best for public menus and basic brochures.
                      </div>
                    </div>
                  </label>

                  <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="leadGateMode"
                      checked={requiresLead}
                      onChange={() => setRequiresLead(true)}
                      style={{ marginTop: 3 }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "#6b21a8" }}>
                        Require Visitor Contact Before Download (Lead Magnet Mode)
                      </div>
                      <div className="muted" style={{ fontSize: "0.8rem", marginTop: 2 }}>
                        A clean modal asks for visitor Name and Phone/Email before delivering the file. Saves a verified lead to your Lead Inbox for instant WhatsApp follow-up.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={isPending}
                  data-testid="save-download-asset-btn"
                >
                  {isPending ? "Saving..." : editingItem ? "Update Asset" : "Save Asset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
