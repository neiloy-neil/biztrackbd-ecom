"use client";

import { useState } from "react";
import { replyTicketAction } from "./actions";

interface ReplyBoxProps {
  ticketId: string;
}

const SAVED_REPLIES = [
  {
    label: "DNS: A record fix",
    text: "Hi! Your CNAME record is correct. The root A record still points to an old IP address. Please edit the A record at your domain registrar to 76.76.21.21 instead of adding a second record, then press 'Check now'.",
  },
  {
    label: "Courier: Pathao credentials",
    text: "Please open Settings > Integrations in your store admin and re-enter your Pathao merchant credentials and Store ID, then test booking a test parcel.",
  },
  {
    label: "Payment: bKash verification",
    text: "Thanks for submitting your payment proof. We have verified your transaction and your subscription plan is now active.",
  },
  {
    label: "Trial: 7-day extension",
    text: "We have extended your store's free trial by 7 days to give you ample time to configure your catalog and connect your delivery couriers.",
  },
];

export function TicketReplyBox({ ticketId }: ReplyBoxProps) {
  const [body, setBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [showMacros, setShowMacros] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <form
      action={async (fd) => {
        setPending(true);
        await replyTicketAction(fd);
      }}
      style={{
        padding: "16px 24px",
        borderTop: "1px solid var(--line)",
        background: isInternal ? "#FFFBEB" : "#fff",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="isInternal" value={isInternal ? "true" : "false"} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 13 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: 600 }}>
            <input
              type="radio"
              name="mode_toggle"
              checked={!isInternal}
              onChange={() => setIsInternal(false)}
              style={{ accentColor: "var(--brand)" }}
            />
            Public reply to merchant
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: 600, color: "#B45309" }}>
            <input
              type="radio"
              name="mode_toggle"
              checked={isInternal}
              onChange={() => setIsInternal(true)}
              style={{ accentColor: "#B45309" }}
            />
            Internal staff note (private)
          </label>
        </div>

        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setShowMacros(!showMacros)}
            style={{
              padding: "4px 12px",
              borderRadius: 6,
              border: "1px solid var(--line)",
              background: "var(--bg)",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Saved replies ▾
          </button>
          {showMacros && (
            <div
              style={{
                position: "absolute",
                right: 0,
                bottom: 34,
                width: 280,
                background: "#fff",
                border: "1px solid var(--line)",
                borderRadius: 8,
                boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                zIndex: 30,
                overflow: "hidden",
              }}
            >
              {SAVED_REPLIES.map((m) => (
                <button
                  key={m.label}
                  type="button"
                  onClick={() => {
                    setBody(m.text);
                    setShowMacros(false);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 14px",
                    border: "none",
                    background: "transparent",
                    fontSize: 13,
                    cursor: "pointer",
                    borderBottom: "1px solid var(--line)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--tint)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ fontWeight: 600, color: "var(--ink)" }}>{m.label}</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.text}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <textarea
        name="body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={isInternal ? "Write a private note for staff only..." : "Write a reply to the merchant..."}
        rows={3}
        required
        style={{
          width: "100%",
          padding: "10px 14px",
          borderRadius: 8,
          border: isInternal ? "1px solid #FCD34D" : "1px solid var(--line)",
          background: "#fff",
          fontSize: 14,
          lineHeight: 1.55,
          boxSizing: "border-box",
        }}
      />

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        {isInternal ? (
          <button
            type="submit"
            name="newStatus"
            value=""
            disabled={pending || !body.trim()}
            style={{
              height: 38,
              padding: "0 18px",
              borderRadius: 8,
              background: "#B45309",
              color: "#fff",
              border: "none",
              fontSize: 13.5,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {pending ? "Adding…" : "Add internal note"}
          </button>
        ) : (
          <>
            <button
              type="submit"
              name="newStatus"
              value="SOLVED"
              disabled={pending || !body.trim()}
              style={{
                height: 38,
                padding: "0 16px",
                borderRadius: 8,
                background: "var(--bg)",
                border: "1px solid var(--line)",
                fontSize: 13.5,
                fontWeight: 600,
                color: "var(--ink-2)",
                cursor: "pointer",
              }}
            >
              Send and solve
            </button>
            <button
              type="submit"
              name="newStatus"
              value="WAITING_ON_TENANT"
              disabled={pending || !body.trim()}
              className="btn btn-primary"
              style={{
                height: 38,
                padding: "0 20px",
                fontSize: 13.5,
                fontWeight: 700,
              }}
            >
              {pending ? "Sending…" : "Send and wait"}
            </button>
          </>
        )}
      </div>
    </form>
  );
}
