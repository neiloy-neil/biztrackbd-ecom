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
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="card modal-card">
            <div className="modal-head">
              <h2>Direct SMS to {customerName}</h2>
              <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary btn-sm btn-close-sm">✕</button>
            </div>

            <p className="muted text-sm my-xs">
              Sending to: <b className="num">{customerPhone}</b>
            </p>

            <form action={sendCustomerSmsAction.bind(null, customerId)} className="stack">
              <label className="field mb-xs">
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

              <div className="flex-between text-xs text-muted">
                <span>
                  {message.length} characters · {parts} {parts === 1 ? "SMS part" : "SMS parts"} {isNonAscii ? "(Bangla/Unicode)" : "(Standard)"}
                </span>
                <span>Uses {parts || 1} SMS credit</span>
              </div>

              <div className="flex-end gap-sm mt-md">
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
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="card modal-card modal-card-sm">
            <div className="modal-head">
              <h2>Adjust Store Credit</h2>
              <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary btn-sm btn-close-sm">✕</button>
            </div>

            <div className="card-subtle mb-md">
              <div className="text-xs text-muted">Current Store Credit Balance</div>
              <div className="num num-lg">{taka(currentCredit)}</div>
            </div>

            <form action={adjustCreditAction.bind(null, customerId)} className="stack">
              <div className="grid grid-2 gap-sm mb-md">
                <button
                  type="button"
                  onClick={() => setDirection("add")}
                  className={`btn ${direction === "add" ? "btn-primary" : "btn-secondary"}`}
                >
                  + Add Credit
                </button>
                <button
                  type="button"
                  onClick={() => setDirection("deduct")}
                  className={`btn ${direction === "deduct" ? "btn-danger" : "btn-secondary"}`}
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

              <div className="flex-end gap-sm mt-md">
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
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="card modal-card modal-card-sm">
            <div className="modal-head">
              <h2>Adjust Loyalty Points</h2>
              <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary btn-sm btn-close-sm">✕</button>
            </div>

            <div className="card-subtle mb-md">
              <div className="text-xs text-muted">Current Available Points</div>
              <div className="num num-lg">{currentPoints} pts</div>
            </div>

            <form action={adjustPointsAction.bind(null, customerId)} className="stack">
              <div className="grid grid-2 gap-sm mb-md">
                <button
                  type="button"
                  onClick={() => setDirection("add")}
                  className={`btn ${direction === "add" ? "btn-primary" : "btn-secondary"}`}
                >
                  + Add Points
                </button>
                <button
                  type="button"
                  onClick={() => setDirection("deduct")}
                  className={`btn ${direction === "deduct" ? "btn-danger" : "btn-secondary"}`}
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

              <div className="flex-end gap-sm mt-md">
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
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="card modal-card">
            <div className="modal-head">
              <h2>{address ? "Edit Address" : "Add Shipping Address"}</h2>
              <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary btn-sm btn-close-sm">✕</button>
            </div>

            <form action={saveAddressAction.bind(null, customerId)} className="stack">
              {address && <input type="hidden" name="addressId" value={address.id} />}

              <div className="grid grid-2 gap-md">
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

              <div className="grid grid-2 gap-md">
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

              <label className="check-label text-sm">
                <input
                  type="checkbox"
                  name="isDefault"
                  defaultChecked={address ? address.isDefault : true}
                />
                Set as default shipping address
              </label>

              <div className="flex-end gap-sm mt-md">
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
    <form action={deleteAddressAction.bind(null, customerId, addressId)} className="d-inline">
      <SubmitButton
        pending="Working…"
        className="link text-danger text-xs cursor-pointer p-0 border-none"
        onClick={(e) => {
          if (!confirm("Are you sure you want to remove this address?")) e.preventDefault();
        }}
      >
        Remove
      </SubmitButton>
    </form>
  );
}
