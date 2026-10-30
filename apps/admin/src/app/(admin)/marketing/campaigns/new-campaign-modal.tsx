"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { SubmitButton } from "@/components/ui";
import { sendCampaignAction, estimateAudienceAction } from "./actions";
import type { CampaignChannel, CampaignSegment } from "@biztrackbd/core";

const SEGMENT_DESCRIPTIONS: Record<CampaignSegment, string> = {
  ALL: "All active customers with a valid phone number",
  ABANDONED_CART: "Leads with open carts / entered checkout in the last 24-72 hours",
  VIP: "VIP customers (spent ৳15,000+ or placed 5+ orders)",
  REPEAT: "Loyal repeat buyers (placed 2 or more orders)",
  DORMANT: "Past buyers who haven't placed an order in the last 60 days",
  DHAKA: "Customers whose shipping district is Dhaka",
  OUTSIDE_DHAKA: "Customers located outside Dhaka district across all 63 districts",
};

interface Props {
  isWhatsAppConnected?: boolean;
  whatsAppNumber?: string | null;
}

export function NewCampaignModal({ isWhatsAppConnected = false, whatsAppNumber }: Props) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<CampaignChannel>("WHATSAPP");
  const [segment, setSegment] = useState<CampaignSegment>("ALL");
  const [body, setBody] = useState("");
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");

  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [estimatedSeconds, setEstimatedSeconds] = useState<number>(0);
  const [isLoadingAudience, setIsLoadingAudience] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isNonAscii = /[^\u0000-\u007F]/.test(body);
  const limitPerPart = isNonAscii ? 70 : 160;
  const parts = body.length === 0 ? 0 : Math.ceil(body.length / limitPerPart);

  // Auto-fetch audience estimate on channel/segment change
  useEffect(() => {
    if (!open) return;
    let active = true;
    setIsLoadingAudience(true);
    estimateAudienceAction(channel, segment, body)
      .then((res) => {
        if (!active) return;
        setAudienceCount(res.count);
        setEstimatedSeconds(res.estimatedSeconds);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsLoadingAudience(false);
      });

    return () => {
      active = false;
    };
  }, [channel, segment, open, body]);

  const insertVariable = (varName: string) => {
    const textToInsert = `{{${varName}}}`;
    const textarea = textareaRef.current;
    if (!textarea) {
      setBody((prev) => prev + textToInsert);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newBody = body.substring(0, start) + textToInsert + body.substring(end);
    setBody(newBody);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
    }, 10);
  };

  const formatEstimatedTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.ceil(seconds / 60);
    if (mins < 60) return `~${mins} min${mins > 1 ? "s" : ""}`;
    const hours = (mins / 60).toFixed(1);
    return `~${hours} hours`;
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-primary"
        data-testid="create-campaign-modal-btn"
      >
        <span>+ New Broadcast</span>
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
          <div className="card modal-card max-w-640">
            <div className="modal-head">
              <div>
                <h2>Launch Broadcast Campaign</h2>
                <p className="muted text-sm m-0">
                  Engage customers with targeted promotional campaigns and anti-ban pacing.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn btn-secondary btn-sm btn-close-sm"
              >
                ✕
              </button>
            </div>

            <form action={sendCampaignAction} className="stack gap-md">
              {/* Channel Selector */}
              <div>
                <span className="label font-semibold mb-xs">Broadcast Channel *</span>
                <div className="grid grid-3 gap-sm">
                  <button
                    type="button"
                    onClick={() => setChannel("WHATSAPP")}
                    className={`btn ${channel === "WHATSAPP" ? "btn-primary" : "btn-secondary"}`}
                  >
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannel("SMS")}
                    className={`btn ${channel === "SMS" ? "btn-primary" : "btn-secondary"}`}
                  >
                    SMS Blast
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannel("EMAIL")}
                    className={`btn ${channel === "EMAIL" ? "btn-primary" : "btn-secondary"}`}
                  >
                    Email Blast
                  </button>
                  <input type="hidden" name="channel" value={channel} />
                </div>
              </div>

              {/* WhatsApp Connection Status Indicator */}
              {channel === "WHATSAPP" && (
                <div
                  className={`p-md border rounded-md flex-between items-center gap-md text-sm ${
                    isWhatsAppConnected ? "bg-success-subtle border-success" : "bg-warning-subtle border-warning"
                  }`}
                >
                  <div>
                    <div className={`font-semibold ${isWhatsAppConnected ? "text-success" : "text-warning"}`}>
                      {isWhatsAppConnected
                        ? `WhatsApp Web Connected (${whatsAppNumber || "Active Number"})`
                        : "WhatsApp Web Not Connected"}
                    </div>
                    <div className="text-xs text-ink-2 mt-xs">
                      {isWhatsAppConnected
                        ? "Ready for direct WhatsApp multi-message dispatch with natural pacing."
                        : "You must connect your device via QR/Pairing code to send WhatsApp broadcasts."}
                    </div>
                  </div>
                  {!isWhatsAppConnected && (
                    <Link
                      href="/marketing/whatsapp"
                      className="btn btn-sm btn-secondary shrink-0"
                    >
                      Connect Device →
                    </Link>
                  )}
                </div>
              )}

              {/* Campaign Name */}
              <label className="field m-0">
                <span className="label font-semibold">Campaign Name * <span className="opt">(internal reference)</span></span>
                <input
                  name="name"
                  className="input"
                  required
                  placeholder="e.g. Eid Flash Sale 20% Off or Cart Recovery"
                  minLength={2}
                />
              </label>

              {/* Audience Segment */}
              <label className="field m-0">
                <div className="flex-between items-center mb-xs">
                  <span className="label font-semibold m-0">Target Audience Segment *</span>
                  {audienceCount !== null && (
                    <span className="text-xs font-semibold text-primary">
                      {isLoadingAudience ? "Estimating…" : `${audienceCount.toLocaleString()} Recipients`}
                    </span>
                  )}
                </div>
                <select
                  name="targetSegment"
                  className="input"
                  value={segment}
                  onChange={(e) => setSegment(e.target.value as CampaignSegment)}
                >
                  <option value="ALL">All Customers (with valid phone)</option>
                  <option value="ABANDONED_CART">Abandoned Checkouts (Leads with items in cart in last 24-72h)</option>
                  <option value="VIP">VIP Customers (Spent ৳15,000+ or 5+ orders)</option>
                  <option value="REPEAT">Repeat Buyers (2+ orders)</option>
                  <option value="DORMANT">Dormant Customers (No order in 60 days)</option>
                  <option value="DHAKA">Inside Dhaka District</option>
                  <option value="OUTSIDE_DHAKA">Outside Dhaka District (63 Districts)</option>
                </select>
                <span className="muted text-xs mt-xs">
                  {SEGMENT_DESCRIPTIONS[segment]}
                </span>
              </label>

              {/* Email Subject if Email */}
              {channel === "EMAIL" && (
                <label className="field m-0">
                  <span className="label font-semibold">Email Subject Line *</span>
                  <input
                    name="subject"
                    className="input"
                    required
                    placeholder="Exclusive offer just for you: 20% off this weekend!"
                  />
                </label>
              )}

              {/* Message Body & Variable Chips */}
              <div>
                <div className="flex-between items-center mb-xs">
                  <span className="label font-semibold m-0">Message Content *</span>
                  <div className="row gap-xs flex-wrap">
                    <button
                      type="button"
                      onClick={() => insertVariable("customerName")}
                      className="btn btn-secondary btn-sm"
                      title="Insert Customer Name"
                    >
                      + Name
                    </button>
                    <button
                      type="button"
                      onClick={() => insertVariable("storeName")}
                      className="btn btn-secondary btn-sm"
                      title="Insert Store Name"
                    >
                      + Store
                    </button>
                    <button
                      type="button"
                      onClick={() => insertVariable("discountCode")}
                      className="btn btn-secondary btn-sm"
                      title="Insert Discount Coupon"
                    >
                      + Coupon
                    </button>
                    <button
                      type="button"
                      onClick={() => insertVariable("cartUrl")}
                      className="btn btn-secondary btn-sm"
                      title="Insert Recovery / Storefront URL"
                    >
                      + Link
                    </button>
                  </div>
                </div>
                <textarea
                  ref={textareaRef}
                  name="body"
                  className="textarea"
                  rows={4}
                  required
                  minLength={5}
                  placeholder={
                    channel === "WHATSAPP"
                      ? "Hi {{customerName}}! Special Eid sale at {{storeName}}. Use coupon code {{discountCode}} to get 20% off. Shop now: {{cartUrl}}\n\nReply STOP to unsubscribe."
                      : channel === "SMS"
                      ? "Hi {{customerName}}, don't miss our flash sale! Get 20% off with code {{discountCode}}. Shop: {{cartUrl}}"
                      : "Write your email promotional message or newsletter update..."
                  }
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>

              {/* WhatsApp specific fields: Coupon & Media */}
              {channel === "WHATSAPP" && (
                <div className="grid grid-2 gap-md">
                  <label className="field m-0">
                    <span className="label text-xs">Discount Coupon <span className="opt">(optional)</span></span>
                    <input
                      name="couponCode"
                      className="input font-mono"
                      placeholder="e.g. EID20"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    />
                  </label>
                  <label className="field m-0">
                    <span className="label text-xs">Flyer / Banner URL <span className="opt">(optional)</span></span>
                    <input
                      name="mediaUrl"
                      type="url"
                      className="input"
                      placeholder="https://.../banner.jpg"
                      value={mediaUrl}
                      onChange={(e) => setMediaUrl(e.target.value)}
                    />
                  </label>
                </div>
              )}

              {/* Anti-Ban & Pacing / SMS Details Info Box */}
              {channel === "WHATSAPP" && (
                <div className="p-md rounded-md border bg-subtle text-sm">
                  <div className="flex-between items-center mb-xs">
                    <span className="font-semibold text-success">Smart Anti-Ban Pacing</span>
                    <span className="font-semibold text-success">
                      ETA: {formatEstimatedTime(estimatedSeconds)}
                    </span>
                  </div>
                  <div className="text-xs text-ink-2">
                    4-12s randomized human pacing delay between messages to safeguard your WhatsApp account from spam filters.
                  </div>
                </div>
              )}

              {channel === "SMS" && (
                <div className="p-md rounded-md bg-subtle text-sm">
                  <div className="flex-between mb-xs">
                    <span>Characters: <b>{body.length}</b></span>
                    <span>
                      {parts} {parts === 1 ? "SMS part" : "SMS parts"} {isNonAscii ? "(Bangla/Unicode · 70 chars/part)" : "(Standard ASCII · 160 chars/part)"}
                    </span>
                  </div>
                  <div className="text-xs text-ink-3">
                    Each recipient consumes {parts || 1} SMS credit. Opted-out numbers are automatically skipped.
                  </div>
                </div>
              )}

              {/* Scheduling Section */}
              <div className="p-md border rounded-md bg-subtle">
                <div className="flex-between items-center">
                  <div className="row items-center gap-sm">
                    <input
                      type="checkbox"
                      id="schedule-toggle"
                      checked={isScheduled}
                      onChange={(e) => setIsScheduled(e.target.checked)}
                    />
                    <label htmlFor="schedule-toggle" className="font-semibold text-sm m-0 pointer">
                      Schedule for later (e.g. Evening peak at 8:30 PM)
                    </label>
                  </div>
                  {isScheduled && <span className="text-xs font-semibold text-warning">Scheduled</span>}
                </div>
                {isScheduled && (
                  <div className="mt-sm">
                    <input
                      type="datetime-local"
                      name="scheduledFor"
                      className="input text-sm"
                      required={isScheduled}
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="row justify-end gap-sm mt-sm">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <SubmitButton
                  className="btn btn-primary"
                  pending={isScheduled ? "Scheduling…" : "Dispatching…"}
                >
                  {isScheduled ? "Schedule Campaign" : "Launch Campaign Now"}
                </SubmitButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
