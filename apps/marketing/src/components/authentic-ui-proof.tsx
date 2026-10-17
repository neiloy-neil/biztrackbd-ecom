"use client";

import Link from "next/link";
import { useState } from "react";

type ProofDeskTab = "leads" | "clinic" | "restaurant" | "services" | "tracking";

interface ProofDesk {
  id: ProofDeskTab;
  title: string;
  subtitle: string;
  badge: string;
  adminPath: string;
  description: string;
  metrics: { label: string; value: string; hint: string }[];
}

const DESKS: Record<ProofDeskTab, ProofDesk> = {
  leads: {
    id: "leads",
    title: "Inbound Leads & Private Follow-Up Notes",
    subtitle: "Centralized inquiry inbox for consulting firms, corporate B2B, and client inquiries",
    badge: "Admin: /leads",
    adminPath: "/leads",
    description:
      "Captured directly from your custom domain contact form or WhatsApp CTA. Every inquiry preserves campaign attribution, allows staff to record internal private notes, and offers 1-click WhatsApp dialer without third-party CRM subscription costs.",
    metrics: [
      { label: "Capture Latency", value: "< 240ms", hint: "Direct to PostgreSQL" },
      { label: "Data Ownership", value: "100% Exportable", hint: "CSV / JSON anytime" },
      { label: "Staff Collaboration", value: "Internal Notes", hint: "Zero client leakage" },
    ],
  },
  clinic: {
    id: "clinic",
    title: "Chambers Appointment & Patient Queue",
    subtitle: "Specialist doctor consultation slots and multi-chamber weekly schedules",
    badge: "Admin: /bookings",
    adminPath: "/bookings",
    description:
      "Manage visiting chamber schedules across Dhanmondi, Mirpur, and Uttara. Patients book exact serial numbers, staff confirm via 1-click WhatsApp, and verified BMDC registration is displayed authoritatively to eliminate patient doubt.",
    metrics: [
      { label: "Serial Queuing", value: "Daily Tokens", hint: "Auto-numbered 01 to 30" },
      { label: "Multi-Chamber", value: "Independent Desks", hint: "Separate timings & fee" },
      { label: "Confirmation", value: "1-Tap WhatsApp", hint: "Instant patient SMS/WA" },
    ],
  },
  restaurant: {
    id: "restaurant",
    title: "Digital QR Menu & Dine-In Table Tray",
    subtitle: "Contactless table ordering, guest party reservations, and live kitchen dispatch",
    badge: "Admin: /bookings",
    adminPath: "/bookings",
    description:
      "Replaces expensive 3rd-party tablet subscription software. Tables scan a unique QR, browse dishes with dietary/spice tags, order via WhatsApp or direct table tray, and staff monitor dine-in capacity in real time.",
    metrics: [
      { label: "Platform Fee", value: "0% Commission", hint: "No food app cuts" },
      { label: "Order Delivery", value: "Instant Kitchen Log", hint: "Table # + Dish notes" },
      { label: "Menu Updates", value: "Phone-First", hint: "Change 86'd items in 5s" },
    ],
  },
  services: {
    id: "services",
    title: "Technician Dispatch & Work Orders",
    subtitle: "AC servicing, home maintenance, and contractor job management",
    badge: "Admin: /leads",
    adminPath: "/leads",
    description:
      "Operational dispatch ledger designed for Bangladeshi appliance repair and contractor services. Shows service tier, customer location (e.g. Gulshan-2, Road 45), assigned technician, and job completion verification.",
    metrics: [
      { label: "Coverage Radius", value: "Neighborhood Map", hint: "Custom travel zones" },
      { label: "Technician Assignment", value: "Phone & Name", hint: "Direct customer connect" },
      { label: "Pricing Clarity", value: "Fixed Labor Tiers", hint: "Prevents customer friction" },
    ],
  },
  tracking: {
    id: "tracking",
    title: "Multi-Layer Meta CAPI & Pixel Health",
    subtitle: "Cryptographic SHA-256 PII hashing and dual first-touch attribution ledger",
    badge: "Admin: /marketing/pixels/health",
    adminPath: "/marketing/pixels/health",
    description:
      "Resilient conversion tracking for Facebook & Instagram ad campaigns. Browser and server events share collision-resistant event IDs to prevent duplicate counts, phone numbers are normalized to 8801..., and affirmative consent is strictly respected.",
    metrics: [
      { label: "Deduplication", value: "100% Match", hint: "Identical event_id" },
      { label: "PII Security", value: "SHA-256 Only", hint: "Plaintext never leaves" },
      { label: "CAPI Resilience", value: "Server Dispatch", hint: "Dual-layer redundancy" },
    ],
  },
};

export function AuthenticUiProof() {
  const [activeTab, setActiveTab] = useState<ProofDeskTab>("leads");
  const desk = DESKS[activeTab];

  return (
    <div className="card ledger-border" style={{ padding: 0, overflow: "hidden", background: "#FFFFFF" }}>
      {/* Top Header & Tab Navigation */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)", background: "#FAFAFA" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span className="status-stamp stamp-lead" style={{ fontSize: 10 }}>AUTHENTIC UI EVIDENCE</span>
              <span className="pill ok" style={{ fontSize: 11 }}>Live in Merchant Admin</span>
            </div>
            <h3 style={{ margin: 0, fontSize: "clamp(20px, 2.5vw, 24px)", color: "var(--ink-ledger)" }}>
              No mockups. Real merchant operational desks.
            </h3>
          </div>
          <div>
            <Link href="/demo" className="btn btn-secondary btn-sm">
              Try Interactive Demos →
            </Link>
          </div>
        </div>

        {/* Tab Buttons */}
        <div
          role="tablist"
          aria-label="Operational desks"
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            marginTop: 18,
            paddingBottom: 4,
          }}
        >
          {(
            [
              ["leads", "Inbound Leads & CRM"],
              ["clinic", "Doctor Chambers & Queue"],
              ["restaurant", "Dining QR & Tables"],
              ["services", "Service Technician Dispatch"],
              ["tracking", "Meta CAPI & Tracking Health"],
            ] as const
          ).map(([key, label]) => {
            const isSelected = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setActiveTab(key)}
                className={`btn btn-sm ${isSelected ? "btn-primary" : "btn-secondary"}`}
                style={{
                  whiteSpace: "nowrap",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: isSelected ? 700 : 500,
                  background: isSelected ? "var(--business)" : "#FFFFFF",
                  borderColor: isSelected ? "var(--business)" : "var(--line)",
                  color: isSelected ? "#FFFFFF" : "var(--ink)",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area: Left Ledger Preview + Right Architectural Breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", borderBottom: "1px solid var(--line)" }}>
        {/* Left: Operational Ledger Table */}
        <div style={{ padding: "20px 24px", overflowX: "auto", borderRight: "1px solid var(--line)", background: "#FFFFFF" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{desk.title}</div>
              <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{desk.subtitle}</div>
            </div>
            <code style={{ fontSize: 11, background: "var(--tint)", padding: "3px 8px", borderRadius: 4, color: "var(--business)", fontWeight: 600 }}>
              {desk.badge}
            </code>
          </div>

          {/* TAB 1: Leads & Follow-Up Notes */}
          {activeTab === "leads" && (
            <table className="table" style={{ margin: 0, fontSize: 12.5 }}>
              <thead>
                <tr>
                  <th>Client / Org</th>
                  <th>Inquiry Focus</th>
                  <th>Attribution</th>
                  <th>Private Staff Note</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <div style={{ fontWeight: 700 }}>Rafiqul Islam</div>
                    <div style={{ fontSize: 11, color: "var(--ink-3)" }}>Apex Holdings · 01711...</div>
                  </td>
                  <td>IT Advisory Proposal (15 seats)</td>
                  <td>
                    <span className="pill" style={{ fontSize: 10 }}>utm: linkedin / b2b</span>
                  </td>
                  <td style={{ color: "var(--ink-2)", fontStyle: "italic", maxWidth: 180 }}>
                    &ldquo;Called at 3:15 PM; requested corporate deck sent via WhatsApp&rdquo;
                  </td>
                  <td>
                    <span className="pill" style={{ background: "#DCFCE7", color: "#166534" }}>QUALIFIED</span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <div style={{ fontWeight: 700 }}>Sabrina Ahmed</div>
                    <div style={{ fontSize: 11, color: "var(--ink-3)" }}>Creative Hub · 01842...</div>
                  </td>
                  <td>Brand Identity Audit</td>
                  <td>
                    <span className="pill" style={{ fontSize: 10 }}>direct / organic</span>
                  </td>
                  <td style={{ color: "var(--ink-2)", fontStyle: "italic", maxWidth: 180 }}>
                    &ldquo;Meeting scheduled for Tuesday morning at Banani office&rdquo;
                  </td>
                  <td>
                    <span className="pill" style={{ background: "#E0E7FF", color: "#3730A3" }}>CONTACTED</span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <div style={{ fontWeight: 700 }}>Tanvir Hasan</div>
                    <div style={{ fontSize: 11, color: "var(--ink-3)" }}>Dhaka · 01915...</div>
                  </td>
                  <td>Website Migration Quote</td>
                  <td>
                    <span className="pill" style={{ fontSize: 10 }}>utm: google / search</span>
                  </td>
                  <td style={{ color: "var(--ink-3)", fontStyle: "italic", maxWidth: 180 }}>
                    Pending review
                  </td>
                  <td>
                    <span className="pill" style={{ background: "#FEF3C7", color: "#92400E" }}>NEW</span>
                  </td>
                </tr>
              </tbody>
            </table>
          )}

          {/* TAB 2: Doctor Chambers & Appointments */}
          {activeTab === "clinic" && (
            <table className="table" style={{ margin: 0, fontSize: 12.5 }}>
              <thead>
                <tr>
                  <th>Token #</th>
                  <th>Patient Name</th>
                  <th>Chamber &amp; Slot</th>
                  <th>Credentials</th>
                  <th>SMS Confirmation</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 800, color: "var(--business)" }}>#04</td>
                  <td>
                    <div style={{ fontWeight: 700 }}>Begum Nurjahan</div>
                    <div style={{ fontSize: 11, color: "var(--ink-3)" }}>Age 54 · 01712...</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>Dhanmondi Chamber</div>
                    <div style={{ fontSize: 11, color: "var(--ink-2)" }}>Sat 6:30 PM – 7:00 PM</div>
                  </td>
                  <td>
                    <span className="pill" style={{ fontSize: 10, background: "#EFF6FF", color: "#1D4ED8" }}>BMDC A-48291</span>
                  </td>
                  <td>
                    <span className="pill ok" style={{ fontSize: 10 }}>SENT (Greenweb)</span>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 800, color: "var(--business)" }}>#05</td>
                  <td>
                    <div style={{ fontWeight: 700 }}>Mahmudur Rahman</div>
                    <div style={{ fontSize: 11, color: "var(--ink-3)" }}>Age 38 · 01819...</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>Mirpur-10 Chamber</div>
                    <div style={{ fontSize: 11, color: "var(--ink-2)" }}>Sun 7:00 PM – 7:30 PM</div>
                  </td>
                  <td>
                    <span className="pill" style={{ fontSize: 10, background: "#EFF6FF", color: "#1D4ED8" }}>BMDC A-48291</span>
                  </td>
                  <td>
                    <span className="pill ok" style={{ fontSize: 10 }}>CONFIRMED</span>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 800, color: "var(--business)" }}>#06</td>
                  <td>
                    <div style={{ fontWeight: 700 }}>Shirin Akhter</div>
                    <div style={{ fontSize: 11, color: "var(--ink-3)" }}>Age 29 · 01673...</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>Dhanmondi Chamber</div>
                    <div style={{ fontSize: 11, color: "var(--ink-2)" }}>Sat 7:30 PM – 8:00 PM</div>
                  </td>
                  <td>
                    <span className="pill" style={{ fontSize: 10, background: "#EFF6FF", color: "#1D4ED8" }}>BMDC A-48291</span>
                  </td>
                  <td>
                    <span className="pill" style={{ fontSize: 10, background: "#FEF3C7", color: "#92400E" }}>PENDING</span>
                  </td>
                </tr>
              </tbody>
            </table>
          )}

          {/* TAB 3: Restaurant QR & Dine-In Tables */}
          {activeTab === "restaurant" && (
            <table className="table" style={{ margin: 0, fontSize: 12.5 }}>
              <thead>
                <tr>
                  <th>Table</th>
                  <th>Guests &amp; Contact</th>
                  <th>Dishes &amp; Special Instructions</th>
                  <th>Subtotal</th>
                  <th>Order State</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 800, color: "var(--business)" }}>Table 04</td>
                  <td>
                    <div style={{ fontWeight: 700 }}>Kamrul Hasan</div>
                    <div style={{ fontSize: 11, color: "var(--ink-3)" }}>4 Guests · 01711...</div>
                  </td>
                  <td>
                    <div>2x Mutton Kacchi Biryani, 4x Borhani</div>
                    <div style={{ fontSize: 11, color: "var(--ink-3)", fontStyle: "italic" }}>&ldquo;Extra salad, mild spice&rdquo;</div>
                  </td>
                  <td style={{ fontWeight: 700 }}>৳ 1,480</td>
                  <td>
                    <span className="pill ok" style={{ fontSize: 10 }}>KITCHEN READY</span>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 800, color: "var(--business)" }}>Table 09</td>
                  <td>
                    <div style={{ fontWeight: 700 }}>Farhana Chowdhury</div>
                    <div style={{ fontSize: 11, color: "var(--ink-3)" }}>2 Guests · 01815...</div>
                  </td>
                  <td>
                    <div>1x Shorshe Ilish with Steamed Rice, 2x Fresh Lime</div>
                  </td>
                  <td style={{ fontWeight: 700 }}>৳ 1,120</td>
                  <td>
                    <span className="pill" style={{ background: "#E0E7FF", color: "#3730A3", fontSize: 10 }}>COOKING</span>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 800, color: "var(--business)" }}>Reserve #12</td>
                  <td>
                    <div style={{ fontWeight: 700 }}>Anisul Huq</div>
                    <div style={{ fontSize: 11, color: "var(--ink-3)" }}>6 Guests · 01911...</div>
                  </td>
                  <td>
                    <div style={{ fontSize: 11, color: "var(--ink-2)" }}>Friday 8:30 PM Family Dinner</div>
                  </td>
                  <td style={{ fontWeight: 700 }}>৳ 500 deposit</td>
                  <td>
                    <span className="pill" style={{ background: "#DCFCE7", color: "#166534", fontSize: 10 }}>RESERVED</span>
                  </td>
                </tr>
              </tbody>
            </table>
          )}

          {/* TAB 4: Services & Technician Dispatch */}
          {activeTab === "services" && (
            <table className="table" style={{ margin: 0, fontSize: 12.5 }}>
              <thead>
                <tr>
                  <th>Job ID</th>
                  <th>Service Package</th>
                  <th>Customer Location</th>
                  <th>Assigned Tech</th>
                  <th>Work Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontFamily: "monospace", fontSize: 11 }}>#SRV-204</td>
                  <td>
                    <div style={{ fontWeight: 700 }}>Master AC Chemical Wash (1.5 Ton)</div>
                    <div style={{ fontSize: 11, color: "var(--ink-3)" }}>Tier: ৳ 1,200 fixed</div>
                  </td>
                  <td>
                    <div>Gulshan-2, Road 45, House 12</div>
                    <div style={{ fontSize: 11, color: "var(--ink-3)" }}>Apt 4B · 01711...</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>Kabir Hossain</div>
                    <div style={{ fontSize: 11, color: "var(--ink-3)" }}>Phone: 01755...</div>
                  </td>
                  <td>
                    <span className="pill ok" style={{ fontSize: 10 }}>IN PROGRESS</span>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontFamily: "monospace", fontSize: 11 }}>#SRV-205</td>
                  <td>
                    <div style={{ fontWeight: 700 }}>Inverter PCB Repair Diagnosis</div>
                    <div style={{ fontSize: 11, color: "var(--ink-3)" }}>Tier: ৳ 800 diagnosis</div>
                  </td>
                  <td>
                    <div>Uttara Sector 7, Road 18</div>
                    <div style={{ fontSize: 11, color: "var(--ink-3)" }}>01844...</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>Sajid Ali</div>
                    <div style={{ fontSize: 11, color: "var(--ink-3)" }}>Phone: 01822...</div>
                  </td>
                  <td>
                    <span className="pill" style={{ background: "#E0E7FF", color: "#3730A3", fontSize: 10 }}>DISPATCHED</span>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontFamily: "monospace", fontSize: 11 }}>#SRV-206</td>
                  <td>
                    <div style={{ fontWeight: 700 }}>Jet Pump Deep Cleaning</div>
                    <div style={{ fontSize: 11, color: "var(--ink-3)" }}>Tier: ৳ 1,500 fixed</div>
                  </td>
                  <td>
                    <div>Dhanmondi 9/A, House 24</div>
                    <div style={{ fontSize: 11, color: "var(--ink-3)" }}>01912...</div>
                  </td>
                  <td>
                    <span style={{ color: "var(--ink-3)", fontSize: 11 }}>Unassigned</span>
                  </td>
                  <td>
                    <span className="pill" style={{ background: "#FEF3C7", color: "#92400E", fontSize: 10 }}>NEW QUOTE</span>
                  </td>
                </tr>
              </tbody>
            </table>
          )}

          {/* TAB 5: Meta CAPI & Tracking Health */}
          {activeTab === "tracking" && (
            <table className="table" style={{ margin: 0, fontSize: 12.5 }}>
              <thead>
                <tr>
                  <th>Event Name</th>
                  <th>Client Deduplication ID</th>
                  <th>Hashed User Context</th>
                  <th>Browser Pixel</th>
                  <th>Meta CAPI Server</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 700 }}>Lead</td>
                  <td style={{ fontFamily: "monospace", fontSize: 11 }}>ev_m8k1p_x92a</td>
                  <td>
                    <code style={{ fontSize: 10, background: "var(--tint)", padding: "2px 4px", borderRadius: 3 }}>
                      ph: e4b2...8a91 (SHA-256)
                    </code>
                  </td>
                  <td><span className="pill ok" style={{ fontSize: 10 }}>MATCHED</span></td>
                  <td><span className="pill ok" style={{ fontSize: 10 }}>200 OK (0.2s)</span></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700 }}>Schedule</td>
                  <td style={{ fontFamily: "monospace", fontSize: 11 }}>ev_m8k2b_7z1c</td>
                  <td>
                    <code style={{ fontSize: 10, background: "var(--tint)", padding: "2px 4px", borderRadius: 3 }}>
                      ph: 7a1f...903c (SHA-256)
                    </code>
                  </td>
                  <td><span className="pill ok" style={{ fontSize: 10 }}>MATCHED</span></td>
                  <td><span className="pill ok" style={{ fontSize: 10 }}>200 OK (0.19s)</span></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700 }}>CompleteRegistration</td>
                  <td style={{ fontFamily: "monospace", fontSize: 11 }}>ev_m8k3r_4p8q</td>
                  <td>
                    <code style={{ fontSize: 10, background: "var(--tint)", padding: "2px 4px", borderRadius: 3 }}>
                      em: 3c8e...61bf (SHA-256)
                    </code>
                  </td>
                  <td><span className="pill ok" style={{ fontSize: 10 }}>MATCHED</span></td>
                  <td><span className="pill ok" style={{ fontSize: 10 }}>200 OK (0.22s)</span></td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* Right: Architectural Breakdown & Verification Badges */}
        <div style={{ padding: "22px 24px", background: "#F8FAFC", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <span className="eyebrow" style={{ fontSize: 11, marginBottom: 6 }}>HOW IT WORKS IN PRODUCTION</span>
            <h4 style={{ margin: "0 0 10px", fontSize: 16, color: "var(--ink-ledger)" }}>{desk.title}</h4>
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6 }}>{desk.description}</p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginTop: 20 }}>
              {desk.metrics.map((m) => (
                <div key={m.label} className="card ledger-border" style={{ padding: "10px 12px", background: "#FFFFFF" }}>
                  <div style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 600 }}>{m.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "var(--business)", marginTop: 2 }}>{m.value}</div>
                  <div style={{ fontSize: 10.5, color: "var(--ink-2)", marginTop: 2 }}>{m.hint}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
            <Link
              href="/start?mode=business"
              className="btn btn-primary btn-sm"
              style={{ width: "100%", justifyContent: "center", background: "var(--business)" }}
            >
              Start Free Trial with Sample Data →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
