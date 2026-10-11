import type { Metadata } from "next";
import { requireAccess } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Themes and modules" };

interface ThemeRow {
  name: string;
  desc: string;
  version: string;
  storesUsing: number;
  requires: string;
  status: string;
  statusBg: string;
  statusColor: string;
}

interface ModuleRow {
  name: string;
  desc: string;
  minPlan: string;
  storesEnabled: number;
  enabled: boolean;
}

const THEMES: ThemeRow[] = [
  { name: "Kapor", desc: "Fashion, editorial", version: "2.3.1", storesUsing: 118, requires: "Bespoke ready", status: "Live", statusBg: "#E8F6EE", statusColor: "#15803D" },
  { name: "Gadget Studio", desc: "Electronics, clean", version: "2.1.0", storesUsing: 74, requires: "None", status: "Live", statusBg: "#E8F6EE", statusColor: "#15803D" },
  { name: "Mini Bunny", desc: "Kids wear", version: "1.9.2", storesUsing: 52, requires: "Kids profiles", status: "Live", statusBg: "#E8F6EE", statusColor: "#15803D" },
  { name: "Axionwear", desc: "Streetwear, lookbook", version: "2.0.0", storesUsing: 41, requires: "None", status: "Live", statusBg: "#E8F6EE", statusColor: "#15803D" },
  { name: "Bindu", desc: "Women's ethnic, drops", version: "1.4.0", storesUsing: 33, requires: "Drops", status: "Rolling out 25%", statusBg: "#E9E7FD", statusColor: "#5B4FE8" },
];

const MODULES: ModuleRow[] = [
  { name: "Bespoke tailoring", desc: "Measurements, fabrics, fittings", minPlan: "Pro", storesEnabled: 86, enabled: true },
  { name: "Drops and launches", desc: "Countdown, notify me, limits", minPlan: "Pro", storesEnabled: 52, enabled: true },
  { name: "Baby and kids profiles", desc: "Child size reminders", minPlan: "Pro", storesEnabled: 37, enabled: true },
  { name: "Loyalty and referrals", desc: "Points and store credit", minPlan: "Pro", storesEnabled: 64, enabled: true },
  { name: "Booking and appointments", desc: "Fittings and pickups", minPlan: "Pro", storesEnabled: 21, enabled: false },
  { name: "Wholesale prices", desc: "Approved buyers and tiers", minPlan: "Business", storesEnabled: 9, enabled: true },
];

export default async function ThemesPage() {
  await requireAccess("tenants");

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Themes and modules</h1>
        <div className="actions">
          <button type="button" className="btn btn-primary" style={{ height: 38 }}>
            Release a theme version
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 24px", fontSize: 16, fontWeight: 700, borderBottom: "1px solid var(--line)" }}>
          Themes
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.6fr) 90px 110px 110px 150px 90px",
            padding: "10px 24px",
            background: "var(--bg)",
            borderBottom: "1px solid var(--line)",
            fontSize: 12,
            fontWeight: 700,
            color: "var(--ink-3)",
            letterSpacing: "0.3px",
          }}
        >
          <div>THEME</div>
          <div>VERSION</div>
          <div style={{ textAlign: "right" }}>STORES USING</div>
          <div>REQUIRES</div>
          <div>STATUS</div>
          <div></div>
        </div>
        {THEMES.map((t) => (
          <div
            key={t.name}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.6fr) 90px 110px 110px 150px 90px",
              padding: "0 24px",
              height: 64,
              alignItems: "center",
              borderBottom: "1px solid var(--line)",
              fontSize: 13.5,
            }}
          >
            <div>
              <div style={{ fontWeight: 700 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{t.desc}</div>
            </div>
            <div className="num">{t.version}</div>
            <div className="num" style={{ textAlign: "right" }}>{t.storesUsing}</div>
            <div style={{ color: "var(--ink-2)" }}>{t.requires}</div>
            <div>
              <span style={{ padding: "3px 10px", borderRadius: 11, fontSize: 12, fontWeight: 600, background: t.statusBg, color: t.statusColor }}>
                {t.status}
              </span>
            </div>
            <div style={{ textAlign: "right", fontSize: 13, fontWeight: 700, color: "var(--brand)" }}>
              Manage
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 24px", fontSize: 16, fontWeight: 700, borderBottom: "1px solid var(--line)" }}>
          Modules
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.6fr) 130px 110px 120px 90px",
            padding: "10px 24px",
            background: "var(--bg)",
            borderBottom: "1px solid var(--line)",
            fontSize: 12,
            fontWeight: 700,
            color: "var(--ink-3)",
            letterSpacing: "0.3px",
          }}
        >
          <div>MODULE</div>
          <div>MIN PLAN</div>
          <div style={{ textAlign: "right" }}>ENABLED STORES</div>
          <div>FLAG</div>
          <div></div>
        </div>
        {MODULES.map((m) => (
          <div
            key={m.name}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.6fr) 130px 110px 120px 90px",
              padding: "0 24px",
              height: 60,
              alignItems: "center",
              borderBottom: "1px solid var(--line)",
              fontSize: 13.5,
            }}
          >
            <div>
              <div style={{ fontWeight: 700 }}>{m.name}</div>
              <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{m.desc}</div>
            </div>
            <div style={{ color: "var(--ink-2)" }}>{m.minPlan}</div>
            <div className="num" style={{ textAlign: "right" }}>{m.storesEnabled}</div>
            <div>
              <div
                style={{
                  width: 36,
                  height: 20,
                  borderRadius: 10,
                  background: m.enabled ? "var(--brand)" : "#D5D5E4",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 2,
                    left: m.enabled ? 18 : 2,
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    background: "#fff",
                    transition: "left 0.15s ease",
                  }}
                />
              </div>
            </div>
            <div style={{ textAlign: "right", fontSize: 13, fontWeight: 700, color: "var(--brand)" }}>
              Edit
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: "var(--tint)", borderRadius: 12, padding: "16px 20px", fontSize: 13, lineHeight: 1.55, color: "var(--ink-2)" }}>
        <b style={{ color: "var(--ink)" }}>How releases work.</b> A new theme version rolls out to 5% of stores first, then 25%, then everyone. Stores can keep their current version for 30 days. Their own edits are never overwritten.
      </div>
    </div>
  );
}
