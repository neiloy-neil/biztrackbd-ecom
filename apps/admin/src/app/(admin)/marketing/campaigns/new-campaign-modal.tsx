"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/ui";
import { sendCampaignAction } from "./actions";

const SEGMENT_DESCRIPTIONS: Record<string, string> = {
  ALL: "All customers who opted in to receive marketing offers",
  VIP: "VIP customers (spent ৳10,000+ or placed 5+ orders)",
  REPEAT: "Repeat buyers (placed 2 or more orders)",
  DORMANT: "Customers who haven't placed an order in the last 60 days",
  DHAKA: "Customers whose shipping district is Dhaka",
  OUTSIDE_DHAKA: "Customers located outside Dhaka district",
};

export function NewCampaignModal() {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<"SMS" | "EMAIL">("SMS");
  const [segment, setSegment] = useState("ALL");
  const [body, setBody] = useState("");

  const isNonAscii = /[^\u0000-\u007F]/.test(body);
  const limitPerPart = isNonAscii ? 70 : 160;
  const parts = body.length === 0 ? 0 : Math.ceil(body.length / limitPerPart);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-primary"
        data-testid="create-campaign-modal-btn"
      >
        + New Broadcast
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
              maxWidth: 560,
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
              borderRadius: 12,
              padding: "24px 28px",
              background: "#fff",
              border: "1px solid var(--line, #E2E8F0)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Launch Broadcast Campaign</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn btn-secondary btn-sm"
                style={{ padding: "4px 8px" }}
              >
                ✕
              </button>
            </div>

            <form action={sendCampaignAction} className="stack" style={{ gap: 14 }}>
              {/* Channel Selector */}
              <div>
                <span className="label" style={{ marginBottom: 6, display: "block" }}>Broadcast Channel</span>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setChannel("SMS")}
                    className={`btn ${channel === "SMS" ? "btn-primary" : "btn-secondary"}`}
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                  >
                    <span>💬</span> Promotional SMS
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannel("EMAIL")}
                    className={`btn ${channel === "EMAIL" ? "btn-primary" : "btn-secondary"}`}
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                  >
                    <span>✉️</span> Promotional Email
                  </button>
                  <input type="hidden" name="channel" value={channel} />
                </div>
              </div>

              {/* Campaign Name */}
              <label className="field" style={{ marginBottom: 0 }}>
                <span className="label">Campaign Name * <span className="opt">(internal reference)</span></span>
                <input
                  name="name"
                  className="input"
                  required
                  placeholder="e.g. Eid Flash Sale 20% Off"
                  minLength={2}
                />
              </label>

              {/* Audience Segment */}
              <label className="field" style={{ marginBottom: 0 }}>
                <span className="label">Target Audience Segment *</span>
                <select
                  name="targetSegment"
                  className="input"
                  value={segment}
                  onChange={(e) => setSegment(e.target.value)}
                >
                  <option value="ALL">All Opted-In Customers</option>
                  <option value="VIP">VIP Customers (Spent ৳10,000+ or 5+ orders)</option>
                  <option value="REPEAT">Repeat Buyers (2+ orders)</option>
                  <option value="DORMANT">Dormant Customers (No order in 60 days)</option>
                  <option value="DHAKA">Inside Dhaka District</option>
                  <option value="OUTSIDE_DHAKA">Outside Dhaka District</option>
                </select>
                <span className="muted" style={{ fontSize: 12, display: "block", marginTop: 4 }}>
                  {SEGMENT_DESCRIPTIONS[segment]}
                </span>
              </label>

              {/* Email Subject if Email */}
              {channel === "EMAIL" && (
                <label className="field" style={{ marginBottom: 0 }}>
                  <span className="label">Email Subject Line *</span>
                  <input
                    name="subject"
                    className="input"
                    required
                    placeholder="Exclusive offer just for you: 20% off this weekend!"
                  />
                </label>
              )}

              {/* Message Body */}
              <label className="field" style={{ marginBottom: 0 }}>
                <span className="label">Message Body *</span>
                <textarea
                  name="body"
                  className="textarea"
                  rows={4}
                  required
                  minLength={5}
                  placeholder={
                    channel === "SMS"
                      ? "Hi, don't miss our special Eid sale! Enjoy 20% off all items with code EID20. Shop now: {store_url}"
                      : "Write your email promotional message or newsletter update..."
                  }
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </label>

              {/* SMS Character & Credit Details */}
              {channel === "SMS" && (
                <div style={{ background: "var(--bg-subtle, #F8FAFC)", padding: "10px 14px", borderRadius: 8, fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span>Characters: <b>{body.length}</b></span>
                    <span>
                      {parts} {parts === 1 ? "SMS part" : "SMS parts"} {isNonAscii ? "(Bangla/Unicode · 70 chars/part)" : "(Standard ASCII · 160 chars/part)"}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted, #64748B)" }}>
                    Each recipient consumes {parts || 1} SMS credit. Opted-out numbers are automatically skipped.
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <SubmitButton
                  className="btn btn-primary"
                  pending="Broadcasting…"
                >
                  Send Campaign Now
                </SubmitButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
