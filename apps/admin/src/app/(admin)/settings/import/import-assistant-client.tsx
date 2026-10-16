"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  analyzeImportContentAction,
  applyImportContentAction,
  type AnalyzedBusinessData,
} from "./actions";

interface Props {
  storeOrigin: string;
}

const SAMPLE_DOCTOR_TEXT = `Modern Eye & Dental Care Clinic
Specialist chamber for advanced cataract surgery, LASIK, and root canal therapy.
Contact Phone: 01712345678
WhatsApp: 01712345678
Address: House 24, Road 11, Block D, Banani, Dhaka 1213

Our Specialties:
- Advanced Cataract Phaco Surgery: Micro-incision sutureless cataract removal with premium IOL lenses. (BDT 25,000)
- Digital Smile Makeover & Veneers: Cosmetic porcelain veneers and aesthetic dental restorations. (BDT 15,000)
- Root Canal Therapy & Crown: Painless single-sitting rotary endodontics. (BDT 6,000)
- Pediatric Dental Checkup: Comprehensive dental preventive care for children. (BDT 1,500)

Consultant Doctors:
- Prof. Dr. Tariqul Islam, Senior Consultant (MBBS, FCPS Ophthalmology)
- Dr. Nusrat Jahan, Dental Surgeon & Implantologist (BDS, PGT Endodontics)`;

const SAMPLE_AGENCY_TEXT = `NextGen Digital Creative Agency
We build high-converting e-commerce stores, modern corporate websites, and viral social campaigns.
Phone: 01898765432
Email: hello@nextgenagency.com
Address: Level 5, Navana Tower, Gulshan-1, Dhaka 1212

What We Do:
- Full-Stack Web App Development: Custom Next.js and Tailwind e-commerce platforms. (BDT 80,000)
- Brand Identity & UI/UX Design: Visual system, logo design, and high-fidelity Figma prototypes. (BDT 40,000)
- Performance Marketing & Meta Ads: Targeted Facebook/Instagram ads with ROAS optimization. (BDT 25,000)

Leadership Team:
- Tanvir Ahmed, Managing Director & Head of Strategy
- Samantha Roy, Creative Director & UX Lead`;

export function ImportAssistantClient({ storeOrigin }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [sourceText, setSourceText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Extracted Data State
  const [businessName, setBusinessName] = useState("");
  const [tagline, setTagline] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [address, setAddress] = useState("");
  const [includeProfile, setIncludeProfile] = useState(true);

  const [services, setServices] = useState<Array<{ id: string; selected: boolean; title: string; summary: string; price?: number }>>([]);
  const [team, setTeam] = useState<Array<{ id: string; selected: boolean; name: string; role: string; credentials?: string }>>([]);

  // Result Summary State
  const [importedCounts, setImportedCounts] = useState<{ services: number; team: number } | null>(null);

  // Step 1: Analyze
  const handleAnalyze = () => {
    if (!sourceText.trim()) {
      setError("Please paste some text about your business, services, or clinic.");
      return;
    }
    setError(null);

    startTransition(async () => {
      try {
        const res = await analyzeImportContentAction(sourceText);
        if (res.ok && res.data) {
          const d = res.data;
          setBusinessName(d.businessName || "");
          setTagline(d.tagline || "");
          setPhone(d.phone || "");
          setWhatsapp(d.whatsappNumber || d.phone || "");
          setAddress(d.address || "");
          setIncludeProfile(Boolean(d.businessName || d.phone || d.address));

          setServices(
            d.services.map((s, idx) => ({
              id: `srv_${idx}`,
              selected: true,
              title: s.title,
              summary: s.summary,
              price: s.price,
            }))
          );

          setTeam(
            d.team.map((t, idx) => ({
              id: `team_${idx}`,
              selected: true,
              name: t.name,
              role: t.role,
              credentials: t.credentials,
            }))
          );

          setStep(2);
        }
      } catch (err: any) {
        setError(err.message || "Failed to analyze content");
      }
    });
  };

  // Step 2: Apply
  const handleApply = () => {
    setError(null);
    startTransition(async () => {
      try {
        const approvedServices = services.filter((s) => s.selected).map((s) => ({
          title: s.title,
          summary: s.summary,
          price: s.price,
        }));

        const approvedTeam = team.filter((t) => t.selected).map((t) => ({
          name: t.name,
          role: t.role,
          credentials: t.credentials,
        }));

        const res = await applyImportContentAction({
          businessProfile: includeProfile
            ? {
                storeName: businessName || undefined,
                tagline: tagline || undefined,
                contactPhone: phone || undefined,
                whatsappNumber: whatsapp || undefined,
                address: address || undefined,
              }
            : undefined,
          services: approvedServices,
          team: approvedTeam,
        });

        if (res.ok) {
          setImportedCounts(res.count);
          setStep(3);
        }
      } catch (err: any) {
        setError(err.message || "Failed to apply content items");
      }
    });
  };

  const selectedServicesCount = services.filter((s) => s.selected).length;
  const selectedTeamCount = team.filter((t) => t.selected).length;
  const totalSelected = selectedServicesCount + selectedTeamCount + (includeProfile ? 1 : 0);

  return (
    <div className="content-import-assistant">
      {/* Progress tracker */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <div
          style={{
            flex: 1,
            padding: "8px 12px",
            background: step >= 1 ? "#4f46e5" : "#e2e8f0",
            color: step >= 1 ? "#fff" : "#64748b",
            borderRadius: 6,
            fontSize: "0.85rem",
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          1. Paste Business Text
        </div>
        <div
          style={{
            flex: 1,
            padding: "8px 12px",
            background: step >= 2 ? "#4f46e5" : "#e2e8f0",
            color: step >= 2 ? "#fff" : "#64748b",
            borderRadius: 6,
            fontSize: "0.85rem",
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          2. Review & Select Entities
        </div>
        <div
          style={{
            flex: 1,
            padding: "8px 12px",
            background: step === 3 ? "#16a34a" : "#e2e8f0",
            color: step === 3 ? "#fff" : "#64748b",
            borderRadius: 6,
            fontSize: "0.85rem",
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          3. Apply to Website
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "#fee2e2",
            color: "#991b1b",
            padding: "10px 14px",
            borderRadius: 8,
            marginBottom: 16,
            fontSize: "0.9rem",
          }}
        >
          {error}
        </div>
      )}

      {/* STEP 1: INPUT SOURCE */}
      {step === 1 && (
        <div className="card" style={{ padding: 24, border: "1px solid var(--border, #e2e8f0)", borderRadius: 10 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: "1.25rem", fontWeight: 700 }}>
            Paste Existing Business or Clinic Content
          </h2>
          <p className="muted" style={{ margin: "0 0 16px", fontSize: "0.9rem" }}>
            Paste text from your existing website, Facebook About section, doctor prescription pad, or service brochure. Our assistant extracts your contact details, services list, and staff profiles automatically.
          </p>

          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600, alignSelf: "center" }}>
              Quick Templates:
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setSourceText(SAMPLE_DOCTOR_TEXT)}
            >
              Doctor & Clinic Example
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setSourceText(SAMPLE_AGENCY_TEXT)}
            >
              Corporate Agency Example
            </button>
          </div>

          <textarea
            className="textarea"
            rows={10}
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="Paste your business description, services list, prices, contact phone, and doctor credentials here..."
            style={{ width: "100%", fontSize: "0.9rem", lineHeight: 1.5, marginBottom: 16 }}
          />

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleAnalyze}
              disabled={isPending || !sourceText.trim()}
              data-testid="analyze-content-btn"
            >
              {isPending ? "Analyzing Content..." : "Extract & Review Items →"}
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: REVIEW & SELECT */}
      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            className="card"
            style={{
              padding: "16px 20px",
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: 8,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontWeight: 700, color: "#1e40af" }}>
                Found {services.length} Services and {team.length} Team Members
              </div>
              <div style={{ fontSize: "0.85rem", color: "#3b82f6", marginTop: 2 }}>
                Review and uncheck anything you don't want to publish yet. You can also edit any field right here.
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setStep(1)}
            >
              ← Edit Source Text
            </button>
          </div>

          {/* 1. Business Profile */}
          <div className="card" style={{ padding: 20, border: "1px solid var(--border, #e2e8f0)", borderRadius: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <input
                type="checkbox"
                checked={includeProfile}
                onChange={(e) => setIncludeProfile(e.target.checked)}
                style={{ width: 18, height: 18 }}
              />
              <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}>
                1. Business Identity & Contact Info
              </h3>
            </div>

            {includeProfile && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, display: "block" }}>Business Name</label>
                  <input
                    type="text"
                    className="input input-sm"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, display: "block" }}>Tagline / Slogan</label>
                  <input
                    type="text"
                    className="input input-sm"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, display: "block" }}>Phone Number</label>
                  <input
                    type="text"
                    className="input input-sm"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, display: "block" }}>WhatsApp Number</label>
                  <input
                    type="text"
                    className="input input-sm"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, display: "block" }}>Physical Address</label>
                  <input
                    type="text"
                    className="input input-sm"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 2. Services Checklist */}
          {services.length > 0 && (
            <div className="card" style={{ padding: 20, border: "1px solid var(--border, #e2e8f0)", borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}>
                  2. Services & Treatments ({selectedServicesCount}/{services.length})
                </h3>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: "0.8rem" }}
                    onClick={() => setServices(services.map((s) => ({ ...s, selected: true })))}
                  >
                    Select All
                  </button>
                  <span style={{ color: "#cbd5e1" }}>|</span>
                  <button
                    type="button"
                    style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: "0.8rem" }}
                    onClick={() => setServices(services.map((s) => ({ ...s, selected: false })))}
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {services.map((s, idx) => (
                  <div
                    key={s.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: 12,
                      borderRadius: 6,
                      background: s.selected ? "#f8fafc" : "#fafafa",
                      border: `1px solid ${s.selected ? "#cbd5e1" : "#f1f5f9"}`,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={s.selected}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setServices((prev) => prev.map((item, i) => (i === idx ? { ...item, selected: checked } : item)));
                      }}
                      style={{ marginTop: 4 }}
                    />
                    <div style={{ flex: 1, display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
                      <div>
                        <input
                          type="text"
                          className="input input-sm"
                          value={s.title}
                          onChange={(e) => {
                            const val = e.target.value;
                            setServices((prev) => prev.map((item, i) => (i === idx ? { ...item, title: val } : item)));
                          }}
                          placeholder="Service Title"
                          style={{ width: "100%", fontWeight: 600, marginBottom: 4 }}
                        />
                        <input
                          type="text"
                          className="input input-sm"
                          value={s.summary}
                          onChange={(e) => {
                            const val = e.target.value;
                            setServices((prev) => prev.map((item, i) => (i === idx ? { ...item, summary: val } : item)));
                          }}
                          placeholder="Brief Summary"
                          style={{ width: "100%", fontSize: "0.82rem" }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block" }}>Price (৳)</label>
                        <input
                          type="number"
                          className="input input-sm"
                          value={s.price || ""}
                          onChange={(e) => {
                            const val = e.target.value ? Number(e.target.value) : undefined;
                            setServices((prev) => prev.map((item, i) => (i === idx ? { ...item, price: val } : item)));
                          }}
                          placeholder="Starting ৳"
                          style={{ width: "100%" }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Team Checklist */}
          {team.length > 0 && (
            <div className="card" style={{ padding: 20, border: "1px solid var(--border, #e2e8f0)", borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}>
                  3. Team & Doctors ({selectedTeamCount}/{team.length})
                </h3>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: "0.8rem" }}
                    onClick={() => setTeam(team.map((t) => ({ ...t, selected: true })))}
                  >
                    Select All
                  </button>
                  <span style={{ color: "#cbd5e1" }}>|</span>
                  <button
                    type="button"
                    style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: "0.8rem" }}
                    onClick={() => setTeam(team.map((t) => ({ ...t, selected: false })))}
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {team.map((t, idx) => (
                  <div
                    key={t.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: 12,
                      borderRadius: 6,
                      background: t.selected ? "#f8fafc" : "#fafafa",
                      border: `1px solid ${t.selected ? "#cbd5e1" : "#f1f5f9"}`,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={t.selected}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setTeam((prev) => prev.map((item, i) => (i === idx ? { ...item, selected: checked } : item)));
                      }}
                      style={{ marginTop: 4 }}
                    />
                    <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div>
                        <input
                          type="text"
                          className="input input-sm"
                          value={t.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTeam((prev) => prev.map((item, i) => (i === idx ? { ...item, name: val } : item)));
                          }}
                          placeholder="Doctor / Specialist Name"
                          style={{ width: "100%", fontWeight: 600, marginBottom: 4 }}
                        />
                        <input
                          type="text"
                          className="input input-sm"
                          value={t.role}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTeam((prev) => prev.map((item, i) => (i === idx ? { ...item, role: val } : item)));
                          }}
                          placeholder="Designation / Role"
                          style={{ width: "100%", fontSize: "0.82rem" }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block" }}>Degrees / Qualifications</label>
                        <input
                          type="text"
                          className="input input-sm"
                          value={t.credentials || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTeam((prev) => prev.map((item, i) => (i === idx ? { ...item, credentials: val } : item)));
                          }}
                          placeholder="e.g. MBBS, FCPS"
                          style={{ width: "100%" }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setStep(1)}
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleApply}
              disabled={isPending || totalSelected === 0}
              data-testid="apply-import-btn"
            >
              {isPending ? "Applying Items..." : `Apply ${totalSelected} Items to Website →`}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: SUCCESS */}
      {step === 3 && (
        <div
          className="card"
          style={{
            padding: 36,
            textAlign: "center",
            border: "1px solid #bbf7d0",
            background: "#f0fdf4",
            borderRadius: 10,
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: 12 }}>🎉</div>
          <h2 style={{ margin: "0 0 8px", fontSize: "1.5rem", fontWeight: 700, color: "#166534" }}>
            Content Successfully Applied!
          </h2>
          <p style={{ margin: "0 0 20px", color: "#15803d", fontSize: "0.95rem" }}>
            Your business profile has been updated, and your extracted services and team members have been published.
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
            <div style={{ background: "#ffffff", padding: "10px 18px", borderRadius: 8, border: "1px solid #bbf7d0" }}>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#166534" }}>
                {importedCounts?.services || 0}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#15803d" }}>Services Added</div>
            </div>
            <div style={{ background: "#ffffff", padding: "10px 18px", borderRadius: 8, border: "1px solid #bbf7d0" }}>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#166534" }}>
                {importedCounts?.team || 0}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#15803d" }}>Team Profiles Added</div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
            <Link href="/services" className="btn btn-secondary btn-sm" prefetch={false}>
              View Services
            </Link>
            <Link href="/team" className="btn btn-secondary btn-sm" prefetch={false}>
              View Team
            </Link>
            <Link href="/settings/store" className="btn btn-secondary btn-sm" prefetch={false}>
              Store Settings
            </Link>
            <a
              href={storeOrigin}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-sm"
            >
              Open Live Website ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
