"use client";

import { useState } from "react";
import { divisionNames, districtsOf } from "@biztrackbd/core/geo";
import { SubmitButton } from "@/components/ui";
import { createCustomerAction } from "./actions";

export function AddCustomerModal() {
  const [open, setOpen] = useState(false);
  const [division, setDivision] = useState("Dhaka");
  const divisions = divisionNames();
  const districts = districtsOf(division);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-primary"
        data-testid="add-customer-btn"
      >
        Add customer
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="modal-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.45)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            backdropFilter: "blur(4px)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 580,
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
              borderRadius: 12,
              padding: "24px 28px",
              background: "#fff",
              border: "1px solid var(--line, #E2E8F0)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Add New Customer</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn btn-secondary btn-sm"
                style={{ padding: "4px 10px", lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            <form action={createCustomerAction} className="stack" style={{ gap: 14 }}>
              <div className="grid grid-2" style={{ gap: 12 }}>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="label">Customer Name *</span>
                  <input
                    name="name"
                    className="input"
                    placeholder="e.g. Tania Akter"
                    required
                    minLength={2}
                    maxLength={120}
                  />
                </label>

                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="label">Mobile Number *</span>
                  <input
                    name="phone"
                    className="input"
                    type="tel"
                    placeholder="01712-345678"
                    required
                    pattern="^(\+?880|0)?1[3-9]\d{8}$"
                    title="Bangladeshi mobile number (e.g. 01712345678)"
                  />
                </label>
              </div>

              <label className="field" style={{ marginBottom: 0 }}>
                <span className="label">Email Address <span className="opt">(optional)</span></span>
                <input
                  name="email"
                  className="input"
                  type="email"
                  placeholder="customer@example.com"
                />
              </label>

              <div style={{ borderTop: "1px solid var(--line, #E2E8F0)", paddingTop: 14, marginTop: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>Default Shipping Address <span className="opt">(optional)</span></span>
                  <div style={{ display: "flex", gap: 10, fontSize: 12.5 }}>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                      <input type="radio" name="addressLabel" value="Home" defaultChecked /> Home
                    </label>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                      <input type="radio" name="addressLabel" value="Office" /> Office
                    </label>
                  </div>
                </div>

                <div className="grid grid-2" style={{ gap: 12, marginBottom: 10 }}>
                  <label className="field" style={{ marginBottom: 0 }}>
                    <span className="label">Division</span>
                    <select
                      name="division"
                      className="input"
                      value={division}
                      onChange={(e) => setDivision(e.target.value)}
                    >
                      {divisions.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </label>

                  <label className="field" style={{ marginBottom: 0 }}>
                    <span className="label">District</span>
                    <select name="district" className="input">
                      {districts.map((dst) => (
                        <option key={dst.name} value={dst.name}>{dst.name}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="label">Street Address</span>
                  <input
                    name="address"
                    className="input"
                    placeholder="House 12, Road 4, Sector 7, Uttara"
                  />
                </label>
              </div>

              <div className="grid grid-2" style={{ gap: 12, marginTop: 4 }}>
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="label">Tags <span className="opt">(comma separated)</span></span>
                  <input
                    name="tags"
                    className="input"
                    placeholder="VIP, Eid Buyer"
                  />
                </label>

                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="label">Private Note <span className="opt">(internal)</span></span>
                  <input
                    name="notes"
                    className="input"
                    placeholder="Customer notes"
                    maxLength={1000}
                  />
                </label>
              </div>

              <div style={{ background: "var(--bg-subtle, #F8FAFC)", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginTop: 4 }}>
                <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 12.5, color: "var(--text-muted, #64748B)" }}>Marketing Preferences</div>
                <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input type="checkbox" name="smsConsent" defaultChecked /> Agreed to receive SMS offers
                  </label>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input type="checkbox" name="emailConsent" /> Agreed to receive email offers
                  </label>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <SubmitButton className="btn btn-primary" pending="Creating…">
                  Create Customer
                </SubmitButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
