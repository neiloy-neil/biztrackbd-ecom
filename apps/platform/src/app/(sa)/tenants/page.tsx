import type { Metadata } from "next";
import Link from "next/link";
import { ACCESS_LABELS, listTenants, type TenantFilter } from "@biztrackbd/core";
import { Pager } from "@/components/ui";
import { dateOnly, taka } from "@/lib/format";
import { one, pageOf, qs } from "@/lib/query";
import { requireAccess } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tenants" };

const FILTERS: [TenantFilter, string][] = [
  ["all", "All"],
  ["paying", "Paying"],
  ["trial", "Trial"],
  ["overdue", "Past due"],
  ["locked", "Locked"],
  ["flagged", "Flagged"],
  ["suspended", "Suspended"],
  ["cancelled", "Cancelled"],
];

const PASTEL_BGS = [
  "#E9DCCB", "#DFF1EA", "#DCDCEB", "#DDE5DA", "#FCE6D8", "#F5E4E4", "#E1ECF4", "#E3EBE1", "#F5EBD0", "#E4E6EC",
];

function avatarBg(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PASTEL_BGS[Math.abs(hash) % PASTEL_BGS.length] ?? "#E9DCCB";
}

export default async function Tenants({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requireAccess("tenants");
  const filter = (FILTERS.find((f) => f[0] === one(sp.filter))?.[0] ?? "all") as TenantFilter;
  const q = one(sp.q)?.trim() ?? "";
  const page = pageOf(one(sp.page));
  const list = await listTenants(s.actor, { q: q || undefined, filter, page });
  const base = { q, filter: filter === "all" ? undefined : filter };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, flexGrow: 1 }} data-testid="tenants-title">Tenants</h1>
        <form method="get" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
          <div style={{ display: "flex", alignItems: "center", gap: 10, width: 340, maxWidth: "100%", height: 38, boxSizing: "border-box", padding: "0 12px", border: "1px solid #E7E7F0", borderRadius: 8, background: "#fff" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B6B8D" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4" />
            </svg>
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search tenants, domains, owners"
              style={{ border: "none", outline: "none", background: "transparent", fontSize: 13.5, width: "100%", minHeight: 40, color: "#1A1A4E" }}
            />
          </div>
          <button type="submit" className="btn btn-secondary" style={{ height: 38 }}>Search</button>
        </form>
      </div>

      <div style={{ display: "flex", gap: 24, borderBottom: "1px solid #E7E7F0", overflowX: "auto" }}>
        {FILTERS.map(([k, label]) => {
          const active = k === filter;
          const count = list.counts[k as keyof typeof list.counts] ?? (k === "all" ? list.total : 0);
          return (
            <Link
              key={k}
              href={`/tenants${qs({ ...base, filter: k === "all" ? undefined : k })}`}
              style={{
                padding: "6px 0 12px",
                borderBottom: active ? "2.5px solid #5B4FE8" : "2.5px solid transparent",
                marginBottom: -1,
                fontSize: 14,
                fontWeight: active ? 700 : 600,
                color: active ? "#1A1A4E" : "#6B6B8D",
                whiteSpace: "nowrap",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
              prefetch={false}
            >
              <span>{label}</span>
              <span
                style={{
                  padding: "1px 8px",
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 700,
                  background: active ? "#E9E7FD" : "#EFEFF6",
                  color: active ? "#5B4FE8" : "#4B4B73",
                }}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      <div style={{ background: "#fff", border: "1px solid #E7E7F0", borderRadius: 12, overflow: "hidden" }}>
        {list.rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6B6B8D" }} data-testid="tenants-empty">
            No stores match this filter.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 960 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 2fr) 100px 120px 110px 90px 120px",
                  padding: "12px 20px",
                  background: "#FAFAFC",
                  borderBottom: "1px solid #E7E7F0",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#6B6B8D",
                  letterSpacing: "0.3px",
                  alignItems: "center",
                }}
              >
                <div>STORE</div>
                <div>PLAN</div>
                <div>STATUS</div>
                <div style={{ textAlign: "right" }}>MRR</div>
                <div style={{ textAlign: "right" }}>ORDERS</div>
                <div style={{ textAlign: "right" }}>JOINED</div>
              </div>

              {list.rows.map((t) => {
                const bg = avatarBg(t.name);
                const isTrial = t.access.state === "TRIAL";
                const isPaying = t.access.state === "ACTIVE";
                const isOverdue = t.access.state === "GRACE";
                const isSuspended = Boolean(t.access.suspendedByPlatform);

                const statusLabel = isSuspended
                  ? "Suspended"
                  : isOverdue
                  ? "Past due"
                  : isTrial
                  ? `Trial (${t.access.daysLeft ?? 0}d left)`
                  : isPaying
                  ? "Active"
                  : ACCESS_LABELS[t.access.state];

                const statusBg = isSuspended ? "#FCEBEB" : isOverdue ? "#FDF3E3" : isTrial ? "#E9E7FD" : "#E8F6EE";
                const statusColor = isSuspended ? "#DC2626" : isOverdue ? "#B45309" : isTrial ? "#5B4FE8" : "#15803D";

                return (
                  <div
                    key={t.id}
                    data-testid="tenant-row"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 2fr) 100px 120px 110px 90px 120px",
                      padding: "0 20px",
                      height: 62,
                      alignItems: "center",
                      borderBottom: "1px solid #F0F0F6",
                      fontSize: 13.5,
                      background: "#fff",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 9,
                          background: bg,
                          fontWeight: 700,
                          color: "#1A1A4E",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flex: "0 0 36px",
                          fontSize: 16,
                        }}
                      >
                        {t.name.charAt(0)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <Link
                          href={`/tenants/${t.id}`}
                          style={{ fontWeight: 600, color: "#1A1A4E", textDecoration: "none", display: "inline-flex", alignItems: "center", minHeight: 40 }}
                          prefetch={false}
                        >
                          {t.name}
                        </Link>
                        <div style={{ fontSize: 12, color: "#6B6B8D", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {t.customDomain ?? `${t.subdomain}.biztrack.bd`}
                          {t.quarantined && <span style={{ marginLeft: 6, color: "#DC2626", fontWeight: 700 }}>[Flagged]</span>}
                        </div>
                      </div>
                    </div>

                    <div style={{ fontWeight: 600 }}>
                      {t.tier.charAt(0) + t.tier.slice(1).toLowerCase()}
                    </div>

                    <div>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 10px",
                          borderRadius: 11,
                          fontSize: 12,
                          fontWeight: 600,
                          background: statusBg,
                          color: statusColor,
                        }}
                      >
                        {statusLabel}
                      </span>
                    </div>

                    <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {t.mrr ? taka(t.mrr) : "৳ 0"}
                    </div>

                    <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {t.ordersCount ?? 0}
                    </div>

                    <div style={{ textAlign: "right", color: "#6B6B8D", fontSize: 12.5 }}>
                      {dateOnly(t.createdAt)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ padding: "12px 20px" }}>
          <Pager page={list.page} pageSize={list.pageSize} total={list.total} path="/tenants" params={base} />
        </div>
      </div>
    </div>
  );
}
