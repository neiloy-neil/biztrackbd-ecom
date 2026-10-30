"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  analyzeImportContentAction,
  applyImportContentAction,
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
    <div className="stack gap-4">
      {/* Progress tracker */}
      <div className="tab-strip">
        <button
          type="button"
          className={`tab-btn ${step >= 1 ? "active" : ""}`}
          onClick={() => step > 1 && setStep(1)}
        >
          1. Paste Business Text
        </button>
        <button
          type="button"
          className={`tab-btn ${step >= 2 ? "active" : ""}`}
          onClick={() => step > 2 && setStep(2)}
        >
          2. Review &amp; Select Entities
        </button>
        <button
          type="button"
          className={`tab-btn ${step === 3 ? "active" : ""}`}
          disabled={step < 3}
        >
          3. Apply to Website
        </button>
      </div>

      {error && (
        <div className="notice bad" role="alert">
          {error}
        </div>
      )}

      {/* STEP 1: INPUT SOURCE */}
      {step === 1 && (
        <section className="card">
          <h2 className="text-xl font-bold m-0 mb-1">
            Paste Existing Business or Clinic Content
          </h2>
          <p className="muted text-sm m-0 mb-3">
            Paste text from your existing website, Facebook About section, doctor prescription pad, or service brochure. Our assistant extracts your contact details, services list, and staff profiles automatically.
          </p>

          <div className="row gap-2 flex-wrap items-center mb-3">
            <span className="text-xs text-muted font-semibold">
              Quick Templates:
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setSourceText(SAMPLE_DOCTOR_TEXT)}
            >
              Doctor &amp; Clinic Example
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setSourceText(SAMPLE_AGENCY_TEXT)}
            >
              Corporate Agency Example
            </button>
          </div>

          <label className="field">
            <textarea
              className="textarea"
              rows={10}
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder="Paste your business description, services list, prices, contact phone, and doctor credentials here..."
            />
          </label>

          <div className="row-end mt-3">
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
        </section>
      )}

      {/* STEP 2: REVIEW & SELECT */}
      {step === 2 && (
        <div className="stack gap-3">
          <div className="card bg-subtle p-3 row-between items-center gap-3">
            <div>
              <div className="font-bold text-primary">
                Found {services.length} Services and {team.length} Team Members
              </div>
              <div className="text-xs muted mt-1">
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
          <section className="card">
            <label className="check items-center gap-2 mb-3">
              <input
                type="checkbox"
                checked={includeProfile}
                onChange={(e) => setIncludeProfile(e.target.checked)}
              />
              <h3 className="m-0 text-base font-bold">
                1. Business Identity &amp; Contact Info
              </h3>
            </label>

            {includeProfile && (
              <div className="grid-280">
                <label className="field">
                  <span className="label">Business Name</span>
                  <input
                    type="text"
                    className="input"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span className="label">Tagline / Slogan</span>
                  <input
                    type="text"
                    className="input"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span className="label">Phone Number</span>
                  <input
                    type="text"
                    className="input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span className="label">WhatsApp Number</span>
                  <input
                    type="text"
                    className="input"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                  />
                </label>
                <label className="field full-width">
                  <span className="label">Physical Address</span>
                  <input
                    type="text"
                    className="input"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </label>
              </div>
            )}
          </section>

          {/* 2. Services Checklist */}
          {services.length > 0 && (
            <section className="card">
              <div className="row-between items-center mb-3">
                <h3 className="m-0 text-base font-bold">
                  2. Services &amp; Treatments ({selectedServicesCount}/{services.length})
                </h3>
                <div className="row gap-2 text-xs">
                  <button
                    type="button"
                    className="link font-semibold"
                    onClick={() => setServices(services.map((s) => ({ ...s, selected: true })))}
                  >
                    Select All
                  </button>
                  <span className="muted">|</span>
                  <button
                    type="button"
                    className="link font-semibold"
                    onClick={() => setServices(services.map((s) => ({ ...s, selected: false })))}
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="stack gap-2">
                {services.map((s, idx) => (
                  <div
                    key={s.id}
                    className={`card p-3 row items-start gap-3 ${s.selected ? "bg-subtle" : "opacity-60"}`}
                  >
                    <input
                      type="checkbox"
                      checked={s.selected}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setServices((prev) => prev.map((item, i) => (i === idx ? { ...item, selected: checked } : item)));
                      }}
                      className="mt-1"
                    />
                    <div className="flex-1 row-2 gap-2">
                      <div>
                        <input
                          type="text"
                          className="input input-sm font-semibold mb-1"
                          value={s.title}
                          onChange={(e) => {
                            const val = e.target.value;
                            setServices((prev) => prev.map((item, i) => (i === idx ? { ...item, title: val } : item)));
                          }}
                          placeholder="Service Title"
                        />
                        <input
                          type="text"
                          className="input input-sm text-xs"
                          value={s.summary}
                          onChange={(e) => {
                            const val = e.target.value;
                            setServices((prev) => prev.map((item, i) => (i === idx ? { ...item, summary: val } : item)));
                          }}
                          placeholder="Brief Summary"
                        />
                      </div>
                      <div>
                        <span className="label text-xs">Price (৳)</span>
                        <input
                          type="number"
                          className="input input-sm"
                          value={s.price || ""}
                          onChange={(e) => {
                            const val = e.target.value ? Number(e.target.value) : undefined;
                            setServices((prev) => prev.map((item, i) => (i === idx ? { ...item, price: val } : item)));
                          }}
                          placeholder="Starting ৳"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 3. Team Checklist */}
          {team.length > 0 && (
            <section className="card">
              <div className="row-between items-center mb-3">
                <h3 className="m-0 text-base font-bold">
                  3. Team &amp; Doctors ({selectedTeamCount}/{team.length})
                </h3>
                <div className="row gap-2 text-xs">
                  <button
                    type="button"
                    className="link font-semibold"
                    onClick={() => setTeam(team.map((t) => ({ ...t, selected: true })))}
                  >
                    Select All
                  </button>
                  <span className="muted">|</span>
                  <button
                    type="button"
                    className="link font-semibold"
                    onClick={() => setTeam(team.map((t) => ({ ...t, selected: false })))}
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="stack gap-2">
                {team.map((t, idx) => (
                  <div
                    key={t.id}
                    className={`card p-3 row items-start gap-3 ${t.selected ? "bg-subtle" : "opacity-60"}`}
                  >
                    <input
                      type="checkbox"
                      checked={t.selected}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setTeam((prev) => prev.map((item, i) => (i === idx ? { ...item, selected: checked } : item)));
                      }}
                      className="mt-1"
                    />
                    <div className="flex-1 row-2 gap-2">
                      <div>
                        <input
                          type="text"
                          className="input input-sm font-semibold mb-1"
                          value={t.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTeam((prev) => prev.map((item, i) => (i === idx ? { ...item, name: val } : item)));
                          }}
                          placeholder="Doctor / Specialist Name"
                        />
                        <input
                          type="text"
                          className="input input-sm text-xs"
                          value={t.role}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTeam((prev) => prev.map((item, i) => (i === idx ? { ...item, role: val } : item)));
                          }}
                          placeholder="Designation / Role"
                        />
                      </div>
                      <div>
                        <span className="label text-xs">Degrees / Qualifications</span>
                        <input
                          type="text"
                          className="input input-sm"
                          value={t.credentials || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTeam((prev) => prev.map((item, i) => (i === idx ? { ...item, credentials: val } : item)));
                          }}
                          placeholder="e.g. MBBS, FCPS"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Action Bar */}
          <div className="row-end gap-2 mt-2">
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
        <section className="card text-center py-5">
          <div className="icon-box-lg mx-auto mb-3">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-success m-0 mb-1">
            Content Successfully Applied!
          </h2>
          <p className="text-sm muted m-0 mb-4">
            Your business profile has been updated, and your extracted services and team members have been published.
          </p>

          <div className="row gap-3 justify-center mb-4 flex-wrap">
            <div className="stat-box-sm text-center min-w-32">
              <div className="text-xl font-bold text-success">
                {importedCounts?.services || 0}
              </div>
              <div className="text-xs muted">Services Added</div>
            </div>
            <div className="stat-box-sm text-center min-w-32">
              <div className="text-xl font-bold text-success">
                {importedCounts?.team || 0}
              </div>
              <div className="text-xs muted">Team Profiles Added</div>
            </div>
          </div>

          <div className="row gap-2 justify-center flex-wrap">
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
        </section>
      )}
    </div>
  );
}
