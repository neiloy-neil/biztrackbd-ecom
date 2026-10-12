import type { Metadata } from "next";
import Link from "next/link";
import { listPlatformInquiries, type InquiryStatus } from "@biztrackbd/core";
import { requireAccess } from "@/lib/session";
import { updateInquiryStatusAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Marketing inquiries" };

const TOPIC_LABELS: Record<string, string> = {
  setup: "Store Setup",
  courier: "Courier Connection (Steadfast/Pathao)",
  bkash: "bKash / Nagad Checkout",
  shopify: "Migrating from Shopify",
  billing: "Plan Billing & Verification",
  enterprise: "Enterprise / Custom",
};

export default async function InquiriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const s = await requireAccess("tickets");
  const sp = await searchParams;

  const currentStatus = typeof sp.status === "string" ? (sp.status as InquiryStatus) : undefined;
  const currentTopic = typeof sp.topic === "string" ? sp.topic : undefined;

  const allInquiries = await listPlatformInquiries(s.actor);
  const filtered = allInquiries.filter((item) => {
    if (currentStatus && item.status !== currentStatus) return false;
    if (currentTopic && currentTopic !== "all" && item.topic !== currentTopic) return false;
    return true;
  });

  const newCount = allInquiries.filter((i) => i.status === "NEW").length;
  const contactedCount = allInquiries.filter((i) => i.status === "CONTACTED").length;
  const convertedCount = allInquiries.filter((i) => i.status === "CONVERTED").length;

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <h1>Marketing Inquiries &amp; Leads</h1>
          <div style={{ fontSize: 13.5, color: "var(--ink-2)", marginTop: 4 }}>
            Inbound prospective merchants from the marketing contact desk.
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <Link
          href="/inquiries"
          className={`chip${!currentStatus ? " active" : ""}`}
          prefetch={false}
        >
          All ({allInquiries.length})
        </Link>
        <Link
          href="/inquiries?status=NEW"
          className={`chip${currentStatus === "NEW" ? " active" : ""}`}
          prefetch={false}
          style={currentStatus === "NEW" ? { background: "var(--brand)", color: "#fff" } : {}}
        >
          New ({newCount})
        </Link>
        <Link
          href="/inquiries?status=CONTACTED"
          className={`chip${currentStatus === "CONTACTED" ? " active" : ""}`}
          prefetch={false}
        >
          Contacted ({contactedCount})
        </Link>
        <Link
          href="/inquiries?status=CONVERTED"
          className={`chip${currentStatus === "CONVERTED" ? " active" : ""}`}
          prefetch={false}
        >
          Converted ({convertedCount})
        </Link>
        <Link
          href="/inquiries?status=ARCHIVED"
          className={`chip${currentStatus === "ARCHIVED" ? " active" : ""}`}
          prefetch={false}
        >
          Archived
        </Link>
      </div>

      {/* Inquiry List */}
      {filtered.length === 0 ? (
        <div
          className="card"
          style={{
            padding: "48px 24px",
            textAlign: "center",
            color: "var(--ink-2)",
            borderRadius: 12,
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>No inquiries found</div>
          <p style={{ margin: "4px 0 0", fontSize: 14 }}>
            No contact submissions match the current status filter.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 18 }}>
          {filtered.map((item) => {
            const cleanPhone = item.phone.replace(/\D/g, "");
            const waNumber = cleanPhone.startsWith("88") ? cleanPhone : `88${cleanPhone}`;
            const topicLabel = TOPIC_LABELS[item.topic] || item.topic;

            return (
              <div
                key={item.id}
                className="card"
                style={{
                  padding: "24px 28px",
                  borderRadius: 14,
                  border: item.status === "NEW" ? "1.5px solid var(--brand)" : "1px solid var(--line)",
                  background: "#FFFFFF",
                  boxShadow: item.status === "NEW" ? "0 4px 16px rgba(91, 79, 232, 0.08)" : "none",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: 12,
                    marginBottom: 14,
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <strong style={{ fontSize: 18, color: "var(--ink)" }}>{item.name}</strong>
                      <span
                        className="pill"
                        style={{
                          background:
                            item.status === "NEW"
                              ? "#FEF3C7"
                              : item.status === "CONTACTED"
                              ? "#E0E7FF"
                              : item.status === "CONVERTED"
                              ? "#DCFCE7"
                              : "var(--soft)",
                          color:
                            item.status === "NEW"
                              ? "#B45309"
                              : item.status === "CONTACTED"
                              ? "#3730A3"
                              : item.status === "CONVERTED"
                              ? "#15803D"
                              : "var(--ink-3)",
                          fontSize: 11.5,
                          fontWeight: 700,
                        }}
                      >
                        {item.status}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          padding: "2px 8px",
                          borderRadius: 6,
                          background: "var(--soft)",
                          color: "var(--ink-2)",
                          fontWeight: 600,
                        }}
                      >
                        {topicLabel}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>
                      Received {item.createdAt.toLocaleString("en-BD", { timeZone: "Asia/Dhaka" })}
                    </div>
                  </div>

                  {/* 1-Click Communication Triggers */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <a
                      href={`https://wa.me/${waNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-primary"
                      style={{ background: "#15803D", borderRadius: 18 }}
                    >
                      💬 WhatsApp ({item.phone}) ↗
                    </a>
                    <a
                      href={`tel:${item.phone}`}
                      className="btn btn-sm btn-secondary"
                      style={{ borderRadius: 18 }}
                    >
                      📞 Call
                    </a>
                    <a
                      href={`mailto:${item.email}?subject=BizTrackBD Support Response`}
                      className="btn btn-sm btn-secondary"
                      style={{ borderRadius: 18 }}
                    >
                      ✉️ {item.email}
                    </a>
                  </div>
                </div>

                {/* Inquiry Content */}
                <div
                  style={{
                    padding: 16,
                    background: "var(--soft)",
                    borderRadius: 10,
                    border: "1px solid var(--line)",
                    fontSize: 14.5,
                    color: "var(--ink)",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {item.message}
                </div>

                {/* Status Update & Notes Form */}
                <div
                  style={{
                    marginTop: 16,
                    paddingTop: 14,
                    borderTop: "1px solid var(--line)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div style={{ fontSize: 13, color: "var(--ink-2)" }}>
                    Update Status:
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {item.status !== "NEW" && (
                      <form action={updateInquiryStatusAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="status" value="NEW" />
                        <button type="submit" className="btn btn-sm btn-secondary">
                          Mark New
                        </button>
                      </form>
                    )}
                    {item.status !== "CONTACTED" && (
                      <form action={updateInquiryStatusAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="status" value="CONTACTED" />
                        <button type="submit" className="btn btn-sm btn-secondary">
                          Mark Contacted
                        </button>
                      </form>
                    )}
                    {item.status !== "CONVERTED" && (
                      <form action={updateInquiryStatusAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="status" value="CONVERTED" />
                        <button
                          type="submit"
                          className="btn btn-sm btn-secondary"
                          style={{ borderColor: "#15803D", color: "#15803D" }}
                        >
                          ✓ Converted Store
                        </button>
                      </form>
                    )}
                    {item.status !== "ARCHIVED" && (
                      <form action={updateInquiryStatusAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="status" value="ARCHIVED" />
                        <button type="submit" className="btn btn-sm btn-secondary" style={{ opacity: 0.7 }}>
                          Archive
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
