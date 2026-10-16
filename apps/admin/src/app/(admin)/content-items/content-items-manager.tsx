"use client";

import React, { useState, useTransition } from "react";
import type { SiteContentItem, SiteContentKind } from "@biztrackbd/db";
import {
  saveContentItemAction,
  deleteContentItemAction,
  reorderContentItemsAction,
  exportContentItemsCsvAction,
} from "./actions";

interface Props {
  initialItems: SiteContentItem[];
  lockedKind?: SiteContentKind;
  storeOrigin: string;
}

const KIND_METAS: Record<SiteContentKind, { label: string; singular: string; icon: string; description: string }> = {
  SERVICE: {
    label: "Services & Offerings",
    singular: "Service",
    icon: "⚡",
    description: "Consultation, treatment, packages, and services with starting prices and key features.",
  },
  PORTFOLIO: {
    label: "Portfolio & Projects",
    singular: "Project",
    icon: "💼",
    description: "Showcase client projects, case studies, galleries, and client testimonials.",
  },
  TEAM: {
    label: "Team & Specialists",
    singular: "Team Member",
    icon: "👥",
    description: "Profiles, roles, bios, doctor designations, degrees, and social contact links.",
  },
  CREDENTIAL: {
    label: "Credentials & Degrees",
    singular: "Credential",
    icon: "🎓",
    description: "Accreditations, medical council registrations, certifications, and licenses.",
  },
  PUBLICATION: {
    label: "Publications & Research",
    singular: "Publication",
    icon: "📄",
    description: "Articles, clinical research, whitepapers, journals, and press appearances.",
  },
  EVENT: {
    label: "Events & Appearances",
    singular: "Event",
    icon: "📅",
    description: "Speaking gigs, conferences, webinars, public clinics, and workshops.",
  },
};

export function ContentItemsManager({ initialItems, lockedKind, storeOrigin }: Props) {
  const [items, setItems] = useState<SiteContentItem[]>(initialItems);
  const [selectedKind, setSelectedKind] = useState<SiteContentKind | "ALL">(lockedKind || "ALL");
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  // Modal / Editing state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SiteContentItem | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form fields
  const [formKind, setFormKind] = useState<SiteContentKind>(lockedKind || "SERVICE");
  const [formTitle, setFormTitle] = useState("");
  const [formTitleBn, setFormTitleBn] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formSummary, setFormSummary] = useState("");
  const [formSummaryBn, setFormSummaryBn] = useState("");
  const [formMediaUrl, setFormMediaUrl] = useState("");
  const [formIsPublished, setFormIsPublished] = useState(true);

  // Dynamic Kind fields
  // SERVICE
  const [servicePrice, setServicePrice] = useState<string>("");
  const [serviceDuration, setServiceDuration] = useState("");
  const [serviceFeatures, setServiceFeatures] = useState<string[]>([]);
  const [featureInput, setFeatureInput] = useState("");
  const [serviceCtaLabel, setServiceCtaLabel] = useState("");
  const [serviceCtaUrl, setServiceCtaUrl] = useState("");

  // PORTFOLIO
  const [portfolioClient, setPortfolioClient] = useState("");
  const [portfolioProjectUrl, setPortfolioProjectUrl] = useState("");
  const [portfolioTags, setPortfolioTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [portfolioQuote, setPortfolioQuote] = useState("");
  const [portfolioAuthor, setPortfolioAuthor] = useState("");

  // TEAM
  const [teamRole, setTeamRole] = useState("");
  const [teamRoleBn, setTeamRoleBn] = useState("");
  const [teamEmail, setTeamEmail] = useState("");
  const [teamPhone, setTeamPhone] = useState("");
  const [teamBio, setTeamBio] = useState("");
  const [teamLinkedin, setTeamLinkedin] = useState("");
  const [teamCredentials, setTeamCredentials] = useState<string[]>([]);
  const [credentialInput, setCredentialInput] = useState("");

  // CREDENTIAL
  const [credIssuer, setCredIssuer] = useState("");
  const [credYear, setCredYear] = useState("");
  const [credId, setCredId] = useState("");
  const [credVerifyUrl, setCredVerifyUrl] = useState("");

  // Open modal for Create
  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormError(null);
    setFormKind(lockedKind || "SERVICE");
    setFormTitle("");
    setFormTitleBn("");
    setFormSlug("");
    setFormSummary("");
    setFormSummaryBn("");
    setFormMediaUrl("");
    setFormIsPublished(true);

    // Reset dynamics
    setServicePrice("");
    setServiceDuration("");
    setServiceFeatures([]);
    setServiceCtaLabel("");
    setServiceCtaUrl("");

    setPortfolioClient("");
    setPortfolioProjectUrl("");
    setPortfolioTags([]);
    setPortfolioQuote("");
    setPortfolioAuthor("");

    setTeamRole("");
    setTeamRoleBn("");
    setTeamEmail("");
    setTeamPhone("");
    setTeamBio("");
    setTeamLinkedin("");
    setTeamCredentials([]);

    setCredIssuer("");
    setCredYear("");
    setCredId("");
    setCredVerifyUrl("");

    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (item: SiteContentItem) => {
    setEditingItem(item);
    setFormError(null);
    setFormKind(item.kind);
    setFormTitle(item.title);
    setFormTitleBn(item.titleBn || "");
    setFormSlug(item.slug);
    setFormSummary(item.summary || "");
    setFormSummaryBn(item.summaryBn || "");
    setFormMediaUrl(item.mediaUrl || "");
    setFormIsPublished(item.isPublished);

    const data = (item.data && typeof item.data === "object" ? item.data : {}) as Record<string, any>;

    // Populate kind-specific data
    if (item.kind === "SERVICE") {
      setServicePrice(data.priceStartingAt !== undefined && data.priceStartingAt !== null ? String(data.priceStartingAt) : "");
      setServiceDuration(data.duration || "");
      setServiceFeatures(Array.isArray(data.features) ? data.features : []);
      setServiceCtaLabel(data.ctaLabel || "");
      setServiceCtaUrl(data.ctaUrl || "");
    } else if (item.kind === "PORTFOLIO") {
      setPortfolioClient(data.clientName || "");
      setPortfolioProjectUrl(data.projectUrl || "");
      setPortfolioTags(Array.isArray(data.tags) ? data.tags : []);
      setPortfolioQuote(data.testimonialQuote || "");
      setPortfolioAuthor(data.testimonialAuthor || "");
    } else if (item.kind === "TEAM") {
      setTeamRole(data.role || "");
      setTeamRoleBn(data.roleBn || "");
      setTeamEmail(data.email || "");
      setTeamPhone(data.phone || "");
      setTeamBio(data.bio || "");
      setTeamLinkedin(data.socialLinks?.linkedin || "");
      setTeamCredentials(Array.isArray(data.credentials) ? data.credentials : []);
    } else if (item.kind === "CREDENTIAL") {
      setCredIssuer(data.issuer || "");
      setCredYear(data.issuedYear ? String(data.issuedYear) : "");
      setCredId(data.credentialId || "");
      setCredVerifyUrl(data.verificationUrl || "");
    }

    setIsModalOpen(true);
  };

  // Auto-slugify
  const handleAutoSlug = () => {
    if (!formTitle) return;
    const clean = formTitle
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
    setFormSlug(clean || `item-${Date.now().toString(36)}`);
  };

  // Submit Handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError("Title is required");
      return;
    }
    if (!formSlug.trim()) {
      setFormError("Slug is required");
      return;
    }

    setFormError(null);

    // Build kind-specific data payload
    let dynamicData: Record<string, any> = {};
    if (formKind === "SERVICE") {
      dynamicData = {
        priceStartingAt: servicePrice ? Number(servicePrice) : null,
        duration: serviceDuration || null,
        features: serviceFeatures,
        ctaLabel: serviceCtaLabel || null,
        ctaUrl: serviceCtaUrl || null,
      };
    } else if (formKind === "PORTFOLIO") {
      dynamicData = {
        clientName: portfolioClient || null,
        projectUrl: portfolioProjectUrl || null,
        tags: portfolioTags,
        testimonialQuote: portfolioQuote || null,
        testimonialAuthor: portfolioAuthor || null,
      };
    } else if (formKind === "TEAM") {
      dynamicData = {
        role: teamRole || null,
        roleBn: teamRoleBn || null,
        email: teamEmail || null,
        phone: teamPhone || null,
        bio: teamBio || null,
        socialLinks: teamLinkedin ? { linkedin: teamLinkedin } : null,
        credentials: teamCredentials,
      };
    } else if (formKind === "CREDENTIAL") {
      dynamicData = {
        issuer: credIssuer || null,
        issuedYear: credYear ? Number(credYear) || credYear : null,
        credentialId: credId || null,
        verificationUrl: credVerifyUrl || null,
      };
    }

    startTransition(async () => {
      try {
        const res = await saveContentItemAction({
          id: editingItem ? editingItem.id : undefined,
          kind: formKind,
          slug: formSlug.trim(),
          title: formTitle.trim(),
          titleBn: formTitleBn.trim() || null,
          summary: formSummary.trim() || null,
          summaryBn: formSummaryBn.trim() || null,
          mediaUrl: formMediaUrl.trim() || null,
          data: dynamicData,
          isPublished: formIsPublished,
          sortOrder: editingItem ? editingItem.sortOrder : 0,
        });

        if (res.ok && res.data) {
          if (editingItem) {
            setItems((prev) => prev.map((x) => (x.id === res.data.id ? res.data : x)));
          } else {
            setItems((prev) => [...prev, res.data]);
          }
          setIsModalOpen(false);
        }
      } catch (err: any) {
        setFormError(err.message || "Failed to save content item");
      }
    });
  };

  // Delete Handler
  const handleDelete = (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;
    startTransition(async () => {
      await deleteContentItemAction(id);
      setItems((prev) => prev.filter((x) => x.id !== id));
    });
  };

  // Move up/down
  const handleMove = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= filteredItems.length) return;

    const newFiltered = [...filteredItems];
    const [moved] = newFiltered.splice(index, 1);
    if (!moved) return;
    newFiltered.splice(targetIndex, 0, moved);

    const reorderedIds = newFiltered.map((it) => it.id);
    const targetKind: SiteContentKind | undefined =
      lockedKind || (selectedKind !== "ALL" ? selectedKind : newFiltered[0]?.kind);

    startTransition(async () => {
      if (targetKind) {
        await reorderContentItemsAction(targetKind, reorderedIds);
      }
      setItems((prev) => {
        const remaining = prev.filter((x) => !reorderedIds.includes(x.id));
        return [...newFiltered, ...remaining];
      });
    });
  };

  // CSV Export
  const handleExportCsv = async () => {
    const kind = lockedKind || (selectedKind !== "ALL" ? selectedKind : undefined);
    const res = await exportContentItemsCsvAction(kind);
    if (res.ok && res.csv) {
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `content-items-${kind?.toLowerCase() || "all"}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Filtering
  const filteredItems = items.filter((it) => {
    if (lockedKind && it.kind !== lockedKind) return false;
    if (!lockedKind && selectedKind !== "ALL" && it.kind !== selectedKind) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const match =
        it.title.toLowerCase().includes(q) ||
        (it.titleBn && it.titleBn.toLowerCase().includes(q)) ||
        (it.summary && it.summary.toLowerCase().includes(q)) ||
        it.slug.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const headerTitle = lockedKind
    ? KIND_METAS[lockedKind].label
    : "Structured Content & Vertical Items";
  const headerDescription = lockedKind
    ? KIND_METAS[lockedKind].description
    : "Manage reusable content items, services, portfolio, and specialist profiles.";

  return (
    <div className="content-items-workspace">
      {/* Page Header */}
      <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700 }}>{headerTitle}</h1>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.95rem" }}>
            {headerDescription}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleExportCsv}
            disabled={isPending || items.length === 0}
          >
            Export CSV
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleOpenCreate}
            data-testid="add-content-item-btn"
          >
            + Add {lockedKind ? KIND_METAS[lockedKind].singular : "Content Item"}
          </button>
        </div>
      </div>

      {/* Kind filter tabs if not locked */}
      {!lockedKind && (
        <div className="segmented-tabs" style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
          <button
            type="button"
            className={`btn btn-sm ${selectedKind === "ALL" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setSelectedKind("ALL")}
          >
            All Items ({items.length})
          </button>
          {(Object.keys(KIND_METAS) as SiteContentKind[]).map((k) => {
            const count = items.filter((x) => x.kind === k).length;
            return (
              <button
                key={k}
                type="button"
                className={`btn btn-sm ${selectedKind === k ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setSelectedKind(k)}
              >
                {KIND_METAS[k].icon} {KIND_METAS[k].label.split(" ")[0]} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Search Bar */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          className="input input-sm"
          placeholder="Filter by title, Bangla title, summary, or slug..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: "100%", maxWidth: 400 }}
        />
      </div>

      {/* Main Items Table */}
      {filteredItems.length === 0 ? (
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
          <div style={{ fontSize: "2rem", marginBottom: 12 }}>
            {lockedKind ? KIND_METAS[lockedKind].icon : "📂"}
          </div>
          <h3 style={{ margin: "0 0 6px", fontSize: "1.1rem" }}>
            No {lockedKind ? KIND_METAS[lockedKind].label.toLowerCase() : "content items"} found
          </h3>
          <p className="muted" style={{ margin: "0 0 16px", fontSize: "0.9rem" }}>
            {search
              ? "No items match your search filter."
              : `Click the button below to add your first ${lockedKind ? KIND_METAS[lockedKind].singular.toLowerCase() : "content item"}.`}
          </p>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleOpenCreate}>
            + Add {lockedKind ? KIND_METAS[lockedKind].singular : "Item"}
          </button>
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden", border: "1px solid var(--border, #e2e8f0)", borderRadius: 8 }}>
          <table className="table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ background: "var(--bg-muted, #f8fafc)", borderBottom: "1px solid var(--border, #e2e8f0)", textAlign: "left" }}>
                <th style={{ padding: "10px 14px", width: 40 }}>#</th>
                <th style={{ padding: "10px 14px" }}>Title & Details</th>
                {!lockedKind && <th style={{ padding: "10px 14px", width: 120 }}>Kind</th>}
                <th style={{ padding: "10px 14px", width: 100 }}>Status</th>
                <th style={{ padding: "10px 14px", width: 90, textAlign: "center" }}>Reorder</th>
                <th style={{ padding: "10px 14px", width: 120, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((it, idx) => {
                const data = (it.data && typeof it.data === "object" ? it.data : {}) as Record<string, any>;
                return (
                  <tr
                    key={it.id}
                    style={{
                      borderBottom: "1px solid var(--border, #f1f5f9)",
                      backgroundColor: it.isPublished ? "transparent" : "var(--bg-muted, #fafafa)",
                    }}
                  >
                    <td style={{ padding: "12px 14px", color: "#64748b", fontWeight: 600 }}>{idx + 1}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {it.mediaUrl ? (
                          <img
                            src={it.mediaUrl}
                            alt=""
                            style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 6,
                              background: "var(--bg-subtle, #e2e8f0)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "1.2rem",
                              flexShrink: 0,
                            }}
                          >
                            {KIND_METAS[it.kind]?.icon || "📄"}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--text, #1e293b)" }}>
                            {it.title}
                            {it.titleBn && <span className="muted" style={{ marginLeft: 6, fontWeight: 400 }}>({it.titleBn})</span>}
                          </div>
                          {it.summary && (
                            <div className="muted" style={{ fontSize: "0.8rem", marginTop: 2, maxLines: 1 }}>
                              {it.summary.slice(0, 90)}
                              {it.summary.length > 90 ? "..." : ""}
                            </div>
                          )}
                          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 3 }}>
                            <code>/{it.slug}</code>
                            {it.kind === "SERVICE" && data.priceStartingAt && (
                              <span style={{ marginLeft: 8, color: "#16a34a", fontWeight: 600 }}>
                                Starts: ৳{data.priceStartingAt}
                              </span>
                            )}
                            {it.kind === "TEAM" && data.role && (
                              <span style={{ marginLeft: 8, color: "#2563eb" }}>
                                {data.role}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    {!lockedKind && (
                      <td style={{ padding: "12px 14px" }}>
                        <span
                          className="badge"
                          style={{
                            padding: "3px 8px",
                            borderRadius: 12,
                            fontSize: "0.75rem",
                            background: "#eff6ff",
                            color: "#1d4ed8",
                            fontWeight: 600,
                          }}
                        >
                          {KIND_METAS[it.kind]?.singular || it.kind}
                        </span>
                      </td>
                    )}
                    <td style={{ padding: "12px 14px" }}>
                      <span
                        className="badge"
                        style={{
                          padding: "3px 8px",
                          borderRadius: 12,
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          backgroundColor: it.isPublished ? "#dcfce7" : "#f1f5f9",
                          color: it.isPublished ? "#15803d" : "#64748b",
                        }}
                      >
                        {it.isPublished ? "Published" : "Draft"}
                      </span>
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
                          disabled={idx === filteredItems.length - 1 || isPending}
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
                          onClick={() => handleOpenEdit(it)}
                          data-testid={`edit-item-${it.id}`}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          style={{ padding: "4px 8px" }}
                          onClick={() => handleDelete(it.id, it.title)}
                          disabled={isPending}
                          data-testid={`delete-item-${it.id}`}
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
              maxWidth: 620,
              maxHeight: "90vh",
              overflowY: "auto",
              borderRadius: 12,
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>
                {editingItem ? "Edit" : "Add"}{" "}
                {lockedKind ? KIND_METAS[lockedKind].singular : KIND_METAS[formKind]?.singular || "Content Item"}
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
              {/* Kind selector (if not locked) */}
              {!lockedKind && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 4 }}>
                    Content Kind
                  </label>
                  <select
                    className="select input-sm"
                    value={formKind}
                    onChange={(e) => setFormKind(e.target.value as SiteContentKind)}
                    style={{ width: "100%" }}
                  >
                    {(Object.keys(KIND_METAS) as SiteContentKind[]).map((k) => (
                      <option key={k} value={k}>
                        {KIND_METAS[k].icon} {KIND_METAS[k].label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Title & Bangla Title */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 4 }}>
                    Title (English) *
                  </label>
                  <input
                    type="text"
                    className="input input-sm"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Executive Health Checkup"
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 4 }}>
                    Title (বাংলা)
                  </label>
                  <input
                    type="text"
                    className="input input-sm"
                    value={formTitleBn}
                    onChange={(e) => setFormTitleBn(e.target.value)}
                    placeholder="যেমনঃ এক্সিকিউটিভ হেলথ চেকআপ"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              {/* Slug */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>URL Slug *</label>
                  <button
                    type="button"
                    onClick={handleAutoSlug}
                    style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: "0.75rem" }}
                  >
                    Generate from title
                  </button>
                </div>
                <input
                  type="text"
                  className="input input-sm"
                  required
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  placeholder="e.g. executive-health-checkup"
                  style={{ width: "100%" }}
                />
              </div>

              {/* Summary */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 4 }}>
                    Summary / Subtitle (English)
                  </label>
                  <textarea
                    className="textarea input-sm"
                    rows={2}
                    value={formSummary}
                    onChange={(e) => setFormSummary(e.target.value)}
                    placeholder="Brief 1-2 sentence overview"
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 4 }}>
                    Summary (বাংলা)
                  </label>
                  <textarea
                    className="textarea input-sm"
                    rows={2}
                    value={formSummaryBn}
                    onChange={(e) => setFormSummaryBn(e.target.value)}
                    placeholder="সংক্ষিপ্ত বিবরণ"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              {/* Media URL */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 4 }}>
                  Image or Photo URL
                </label>
                <input
                  type="url"
                  className="input input-sm"
                  value={formMediaUrl}
                  onChange={(e) => setFormMediaUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  style={{ width: "100%" }}
                />
              </div>

              {/* DYNAMIC KIND SECTIONS */}
              {formKind === "SERVICE" && (
                <div style={{ padding: 14, background: "#f8fafc", borderRadius: 8, marginBottom: 14, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: 10, color: "#1e293b" }}>
                    Service Details
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block" }}>Starting Price (৳ BDT)</label>
                      <input
                        type="number"
                        className="input input-sm"
                        value={servicePrice}
                        onChange={(e) => setServicePrice(e.target.value)}
                        placeholder="e.g. 5000"
                        style={{ width: "100%" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block" }}>Duration / Session</label>
                      <input
                        type="text"
                        className="input input-sm"
                        value={serviceDuration}
                        onChange={(e) => setServiceDuration(e.target.value)}
                        placeholder="e.g. 45 mins or 2 weeks"
                        style={{ width: "100%" }}
                      />
                    </div>
                  </div>

                  {/* Features tags */}
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block", marginBottom: 4 }}>
                      Key Features & Deliverables
                    </label>
                    <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                      <input
                        type="text"
                        className="input input-sm"
                        value={featureInput}
                        onChange={(e) => setFeatureInput(e.target.value)}
                        placeholder="Add feature and click Add"
                        style={{ flex: 1 }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (featureInput.trim()) {
                              setServiceFeatures([...serviceFeatures, featureInput.trim()]);
                              setFeatureInput("");
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          if (featureInput.trim()) {
                            setServiceFeatures([...serviceFeatures, featureInput.trim()]);
                            setFeatureInput("");
                          }
                        }}
                      >
                        + Add
                      </button>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {serviceFeatures.map((f, i) => (
                        <span key={i} className="badge" style={{ background: "#e2e8f0", padding: "2px 8px", borderRadius: 12, fontSize: "0.75rem" }}>
                          {f}{" "}
                          <button
                            type="button"
                            style={{ background: "none", border: "none", cursor: "pointer", marginLeft: 4, color: "#64748b" }}
                            onClick={() => setServiceFeatures(serviceFeatures.filter((_, idx) => idx !== i))}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block" }}>CTA Button Label</label>
                      <input
                        type="text"
                        className="input input-sm"
                        value={serviceCtaLabel}
                        onChange={(e) => setServiceCtaLabel(e.target.value)}
                        placeholder="e.g. Book Appointment"
                        style={{ width: "100%" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block" }}>CTA Link Target</label>
                      <input
                        type="text"
                        className="input input-sm"
                        value={serviceCtaUrl}
                        onChange={(e) => setServiceCtaUrl(e.target.value)}
                        placeholder="e.g. /contact or /appointment"
                        style={{ width: "100%" }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {formKind === "PORTFOLIO" && (
                <div style={{ padding: 14, background: "#f8fafc", borderRadius: 8, marginBottom: 14, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: 10, color: "#1e293b" }}>
                    Portfolio Project Details
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block" }}>Client / Brand Name</label>
                      <input
                        type="text"
                        className="input input-sm"
                        value={portfolioClient}
                        onChange={(e) => setPortfolioClient(e.target.value)}
                        placeholder="e.g. Beximco Pharma"
                        style={{ width: "100%" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block" }}>Live Project URL</label>
                      <input
                        type="url"
                        className="input input-sm"
                        value={portfolioProjectUrl}
                        onChange={(e) => setPortfolioProjectUrl(e.target.value)}
                        placeholder="https://..."
                        style={{ width: "100%" }}
                      />
                    </div>
                  </div>

                  {/* Project tags */}
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block", marginBottom: 4 }}>
                      Tech & Industry Tags
                    </label>
                    <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                      <input
                        type="text"
                        className="input input-sm"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        placeholder="e.g. E-Commerce, UI/UX"
                        style={{ flex: 1 }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (tagInput.trim()) {
                              setPortfolioTags([...portfolioTags, tagInput.trim()]);
                              setTagInput("");
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          if (tagInput.trim()) {
                            setPortfolioTags([...portfolioTags, tagInput.trim()]);
                            setTagInput("");
                          }
                        }}
                      >
                        + Add
                      </button>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {portfolioTags.map((t, i) => (
                        <span key={i} className="badge" style={{ background: "#e2e8f0", padding: "2px 8px", borderRadius: 12, fontSize: "0.75rem" }}>
                          {t}{" "}
                          <button
                            type="button"
                            style={{ background: "none", border: "none", cursor: "pointer", marginLeft: 4, color: "#64748b" }}
                            onClick={() => setPortfolioTags(portfolioTags.filter((_, idx) => idx !== i))}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Testimonial */}
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
                    <div>
                      <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block" }}>Client Testimonial Quote</label>
                      <input
                        type="text"
                        className="input input-sm"
                        value={portfolioQuote}
                        onChange={(e) => setPortfolioQuote(e.target.value)}
                        placeholder="&quot;BizTrack delivered beyond our expectations...&quot;"
                        style={{ width: "100%" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block" }}>Testimonial Author</label>
                      <input
                        type="text"
                        className="input input-sm"
                        value={portfolioAuthor}
                        onChange={(e) => setPortfolioAuthor(e.target.value)}
                        placeholder="e.g. Tanvir, CTO"
                        style={{ width: "100%" }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {formKind === "TEAM" && (
                <div style={{ padding: 14, background: "#f8fafc", borderRadius: 8, marginBottom: 14, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: 10, color: "#1e293b" }}>
                    Team Member Profile
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block" }}>Role / Designation (EN)</label>
                      <input
                        type="text"
                        className="input input-sm"
                        value={teamRole}
                        onChange={(e) => setTeamRole(e.target.value)}
                        placeholder="e.g. Associate Professor & Consultant"
                        style={{ width: "100%" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block" }}>Designation (বাংলা)</label>
                      <input
                        type="text"
                        className="input input-sm"
                        value={teamRoleBn}
                        onChange={(e) => setTeamRoleBn(e.target.value)}
                        placeholder="যেমনঃ সহকারী অধ্যাপক ও কনসালটেন্ট"
                        style={{ width: "100%" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block" }}>Contact Email</label>
                      <input
                        type="email"
                        className="input input-sm"
                        value={teamEmail}
                        onChange={(e) => setTeamEmail(e.target.value)}
                        placeholder="doctor@hospital.com"
                        style={{ width: "100%" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block" }}>LinkedIn URL</label>
                      <input
                        type="url"
                        className="input input-sm"
                        value={teamLinkedin}
                        onChange={(e) => setTeamLinkedin(e.target.value)}
                        placeholder="https://linkedin.com/in/..."
                        style={{ width: "100%" }}
                      />
                    </div>
                  </div>

                  {/* Degrees / Credentials */}
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block", marginBottom: 4 }}>
                      Degrees & Qualifications
                    </label>
                    <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                      <input
                        type="text"
                        className="input input-sm"
                        value={credentialInput}
                        onChange={(e) => setCredentialInput(e.target.value)}
                        placeholder="e.g. MBBS (DMC), FCPS (Medicine)"
                        style={{ flex: 1 }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (credentialInput.trim()) {
                              setTeamCredentials([...teamCredentials, credentialInput.trim()]);
                              setCredentialInput("");
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          if (credentialInput.trim()) {
                            setTeamCredentials([...teamCredentials, credentialInput.trim()]);
                            setCredentialInput("");
                          }
                        }}
                      >
                        + Add
                      </button>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {teamCredentials.map((c, i) => (
                        <span key={i} className="badge" style={{ background: "#e2e8f0", padding: "2px 8px", borderRadius: 12, fontSize: "0.75rem" }}>
                          {c}{" "}
                          <button
                            type="button"
                            style={{ background: "none", border: "none", cursor: "pointer", marginLeft: 4, color: "#64748b" }}
                            onClick={() => setTeamCredentials(teamCredentials.filter((_, idx) => idx !== i))}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Biography</label>
                    <textarea
                      className="textarea input-sm"
                      rows={2}
                      value={teamBio}
                      onChange={(e) => setTeamBio(e.target.value)}
                      placeholder="Doctor or specialist background, experience, and chamber schedule."
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>
              )}

              {formKind === "CREDENTIAL" && (
                <div style={{ padding: 14, background: "#f8fafc", borderRadius: 8, marginBottom: 14, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: 10, color: "#1e293b" }}>
                    Credential Details
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block" }}>Issuing Organization</label>
                      <input
                        type="text"
                        className="input input-sm"
                        value={credIssuer}
                        onChange={(e) => setCredIssuer(e.target.value)}
                        placeholder="e.g. Bangladesh Medical & Dental Council"
                        style={{ width: "100%" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block" }}>Year / Date</label>
                      <input
                        type="text"
                        className="input input-sm"
                        value={credYear}
                        onChange={(e) => setCredYear(e.target.value)}
                        placeholder="e.g. 2018"
                        style={{ width: "100%" }}
                      />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block" }}>Registration / Credential ID</label>
                      <input
                        type="text"
                        className="input input-sm"
                        value={credId}
                        onChange={(e) => setCredId(e.target.value)}
                        placeholder="e.g. BMDC-A-12345"
                        style={{ width: "100%" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.8rem", fontWeight: 500, display: "block" }}>Online Verification Link</label>
                      <input
                        type="url"
                        className="input input-sm"
                        value={credVerifyUrl}
                        onChange={(e) => setCredVerifyUrl(e.target.value)}
                        placeholder="https://..."
                        style={{ width: "100%" }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Published checkbox */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.9rem" }}>
                  <input
                    type="checkbox"
                    checked={formIsPublished}
                    onChange={(e) => setFormIsPublished(e.target.checked)}
                  />
                  <span>
                    <b>Publish immediately</b> — item will appear on your public website sections.
                  </span>
                </label>
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
                  data-testid="save-content-item-btn"
                >
                  {isPending ? "Saving..." : editingItem ? "Update Item" : "Create Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
