"use client";

import { useState } from "react";
import type { CustomerAddressView } from "@biztrackbd/core";
import { divisionNames, districtsOf } from "@biztrackbd/core/geo";
import { SubmitButton } from "@/components/ui";
import { taka } from "@/lib/format";
import {
  adjustCreditAction,
  adjustPointsAction,
  sendCustomerSmsAction,
  saveAddressAction,
  deleteAddressAction,
} from "./actions";

export function SendSmsModal({
  customerId,
  customerName,
  customerPhone,
}: {
  customerId: string;
  customerName: string;
  customerPhone: string;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  const isNonAscii = /[^\u0000-\u007F]/.test(message);
  const limitPerPart = isNonAscii ? 70 : 160;
  const parts = message.length === 0 ? 0 : Math.ceil(message.length / limitPerPart);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-secondary btn-sm"
        data-testid="send-sms-btn"
      >
        Send SMS
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
              maxWidth: 480,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
              borderRadius: 12,
              padding: "22px 24px",
              background: "#fff",
              border: "1px solid var(--line, #E2E8F0)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Direct SMS to {customerName}</h2>
              <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary btn-sm" style={{ padding: "4px 8px" }}>✕</button>
            </div>

            <p className="muted" style={{ fontSize: 13, margin: "-6px 0 14px" }}>
              Sending to: <b className="num">{customerPhone}</b>
            </p>

            <form action={sendCustomerSmsAction.bind(null, customerId)} className="stack">
              <label className="field" style={{ marginBottom: 4 }}>
                <span className="label">Message</span>
                <textarea
                  name="message"
                  className="textarea"
                  rows={4}
                  required
                  minLength={3}
                  maxLength={500}
                  placeholder={`Hi ${customerName}, your special offer is ready...`}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </label>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--text-muted, #64748B)" }}>
                <span>
                  {message.length} characters · {parts} {parts === 1 ? "SMS part" : "SMS parts"} {isNonAscii ? "(Bangla/Unicode)" : "(Standard)"}
                </span>
                <span>Uses {parts || 1} SMS credit</span>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
                <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <SubmitButton className="btn btn-primary" pending="Sending SMS…">
                  Send SMS
                </SubmitButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export function AdjustCreditModal({
  customerId,
  currentCredit,
}: {
  customerId: string;
  currentCredit: number;
}) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"add" | "deduct">("add");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-secondary btn-sm"
        data-testid="adjust-credit-btn"
      >
        Adjust credit
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
              maxWidth: 440,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
              borderRadius: 12,
              padding: "22px 24px",
              background: "#fff",
              border: "1px solid var(--line, #E2E8F0)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Adjust Store Credit</h2>
              <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary btn-sm" style={{ padding: "4px 8px" }}>✕</button>
            </div>

            <div style={{ background: "var(--bg-subtle, #F8FAFC)", padding: "10px 14px", borderRadius: 8, marginBottom: 14 }}>
              <div style={{ fontSize: 12.5, color: "var(--text-muted, #64748B)" }}>Current Store Credit Balance</div>
              <div className="num" style={{ fontSize: 20, fontWeight: 700 }}>{taka(currentCredit)}</div>
            </div>

            <form action={adjustCreditAction.bind(null, customerId)} className="stack">
              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <button
                  type="button"
                  onClick={() => setDirection("add")}
                  className={`btn ${direction === "add" ? "btn-primary" : "btn-secondary"}`}
                  style={{ flex: 1 }}
                >
                  + Add Credit
                </button>
                <button
                  type="button"
                  onClick={() => setDirection("deduct")}
                  className={`btn ${direction === "deduct" ? "btn-danger" : "btn-secondary"}`}
                  style={{ flex: 1 }}
                >
                  − Deduct Credit
                </button>
                <input type="hidden" name="direction" value={direction} />
              </div>

              <label className="field">
                <span className="label">Amount (৳) *</span>
                <input
                  name="amount"
                  className="input num"
                  type="number"
                  min="1"
                  max="1000000"
                  required
                  placeholder="e.g. 500"
                />
              </label>

              <label className="field">
                <span className="label">Reason * <span className="opt">(logged in audit trail)</span></span>
                <input
                  name="reason"
                  className="input"
                  required
                  minLength={3}
                  maxLength={200}
                  placeholder={direction === "add" ? "Goodwill credit for delivery delay" : "Correction of accidental overcredit"}
                />
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
                <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <SubmitButton className="btn btn-primary" pending="Updating…">
                  Update Credit
                </SubmitButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export function AdjustPointsModal({
  customerId,
  currentPoints,
}: {
  customerId: string;
  currentPoints: number;
}) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"add" | "deduct">("add");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-secondary btn-sm"
        data-testid="adjust-points-btn"
      >
        Adjust points
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
              maxWidth: 440,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
              borderRadius: 12,
              padding: "22px 24px",
              background: "#fff",
              border: "1px solid var(--line, #E2E8F0)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Adjust Loyalty Points</h2>
              <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary btn-sm" style={{ padding: "4px 8px" }}>✕</button>
            </div>

            <div style={{ background: "var(--bg-subtle, #F8FAFC)", padding: "10px 14px", borderRadius: 8, marginBottom: 14 }}>
              <div style={{ fontSize: 12.5, color: "var(--text-muted, #64748B)" }}>Current Available Points</div>
              <div className="num" style={{ fontSize: 20, fontWeight: 700 }}>{currentPoints} pts</div>
            </div>

            <form action={adjustPointsAction.bind(null, customerId)} className="stack">
              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <button
                  type="button"
                  onClick={() => setDirection("add")}
                  className={`btn ${direction === "add" ? "btn-primary" : "btn-secondary"}`}
                  style={{ flex: 1 }}
                >
                  + Add Points
                </button>
                <button
                  type="button"
                  onClick={() => setDirection("deduct")}
                  className={`btn ${direction === "deduct" ? "btn-danger" : "btn-secondary"}`}
                  style={{ flex: 1 }}
                >
                  − Deduct Points
                </button>
                <input type="hidden" name="direction" value={direction} />
              </div>

              <label className="field">
                <span className="label">Points *</span>
                <input
                  name="points"
                  className="input num"
                  type="number"
                  min="1"
                  max="100000"
                  required
                  placeholder="e.g. 200"
                />
              </label>

              <label className="field">
                <span className="label">Reason * <span className="opt">(logged in audit trail)</span></span>
                <input
                  name="reason"
                  className="input"
                  required
                  minLength={3}
                  maxLength={200}
                  placeholder="Campaign bonus points"
                />
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
                <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <SubmitButton className="btn btn-primary" pending="Updating…">
                  Update Points
                </SubmitButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export function AddressModal({
  customerId,
  address,
  triggerLabel,
}: {
  customerId: string;
  address?: CustomerAddressView;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [division, setDivision] = useState(address?.division ?? "Dhaka");
  const divisions = divisionNames();
  const districts = districtsOf(division);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-secondary btn-sm"
      >
        {triggerLabel ?? (address ? "Edit" : "+ Add address")}
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
              maxWidth: 480,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
              borderRadius: 12,
              padding: "22px 24px",
              background: "#fff",
              border: "1px solid var(--line, #E2E8F0)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{address ? "Edit Address" : "Add Shipping Address"}</h2>
              <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary btn-sm" style={{ padding: "4px 8px" }}>✕</button>
            </div>

            <form action={saveAddressAction.bind(null, customerId)} className="stack">
              {address && <input type="hidden" name="addressId" value={address.id} />}

              <div className="grid grid-2" style={{ gap: 12 }}>
                <label className="field">
                  <span className="label">Label</span>
                  <select name="label" className="input" defaultValue={address?.label ?? "Home"}>
                    <option value="Home">Home</option>
                    <option value="Office">Office</option>
                    <option value="Other">Other</option>
                  </select>
                </label>

                <label className="field">
                  <span className="label">Division *</span>
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
              </div>

              <div className="grid grid-2" style={{ gap: 12 }}>
                <label className="field">
                  <span className="label">District *</span>
                  <select name="district" className="input" defaultValue={address?.district ?? districts[0]?.name}>
                    {districts.map((dst) => (
                      <option key={dst.name} value={dst.name}>{dst.name}</option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span className="label">Upazila / Thana <span className="opt">(optional)</span></span>
                  <input
                    name="upazila"
                    className="input"
                    defaultValue={address?.upazila ?? ""}
                    placeholder="e.g. Uttara"
                  />
                </label>
              </div>

              <label className="field">
                <span className="label">Street Address *</span>
                <input
                  name="address"
                  className="input"
                  required
                  defaultValue={address?.address ?? ""}
                  placeholder="House 14, Road 7, Block C"
                />
              </label>

              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13.5 }}>
                <input
                  type="checkbox"
                  name="isDefault"
                  defaultChecked={address ? address.isDefault : true}
                />
                Set as default shipping address
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
                <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <SubmitButton className="btn btn-primary" pending="Saving…">
                  Save Address
                </SubmitButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export function DeleteAddressButton({
  customerId,
  addressId,
}: {
  customerId: string;
  addressId: string;
}) {
  return (
    <form action={deleteAddressAction.bind(null, customerId, addressId)} style={{ display: "inline" }}>
      <SubmitButton
        pending="Working…"
        className="link"
        style={{ color: "var(--danger, #DC2626)", fontSize: 12, cursor: "pointer", background: "none", border: "none", padding: 0 }}
        onClick={(e) => {
          if (!confirm("Are you sure you want to remove this address?")) e.preventDefault();
        }}
      >
        Remove
      </SubmitButton>
    </form>
  );
}
