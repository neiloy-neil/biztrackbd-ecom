import React from "react";
import Link from "next/link";
import type { Lang } from "@/lib/i18n-core";

export interface ChamberItem {
  id: string;
  name: string;
  nameBn?: string;
  hospital: string;
  hospitalBn?: string;
  address: string;
  addressBn?: string;
  days: string;
  daysBn?: string;
  hours: string;
  hoursBn?: string;
  room?: string;
  phone?: string;
  fee?: number;
}

const DEFAULT_SAMPLE_CHAMBERS: ChamberItem[] = [
  {
    id: "c1",
    name: "Central Hospital Limited",
    nameBn: "সেন্ট্রাল হসপিটাল লিমিটেড",
    hospital: "Dhanmondi Branch",
    hospitalBn: "ধানমন্ডি শাখা",
    address: "House 02, Road 05, Green Road, Dhanmondi, Dhaka",
    addressBn: "বাড়ি ০২, রোড ০৫, গ্রিন রোড, ধানমন্ডি, ঢাকা",
    days: "Saturday to Wednesday",
    daysBn: "শনিবার হতে বুধবার",
    hours: "5:00 PM – 9:00 PM",
    hoursBn: "বিকাল ৫:০০ – রাত ৯:০০",
    room: "Room 402 (4th Floor)",
    phone: "01712-345678",
    fee: 1500,
  },
  {
    id: "c2",
    name: "Ibn Sina Diagnostic & Consultation Center",
    nameBn: "ইবনে সিনা ডায়াগনস্টিক সেন্টার",
    hospital: "Uttara Branch",
    hospitalBn: "উত্তরা শাখা",
    address: "House 52, Gausul Azam Avenue, Sector 13, Uttara, Dhaka",
    addressBn: "বাড়ি ৫২, গাউসুল আজম এভিনিউ, সেক্টর ১৩, উত্তরা, ঢাকা",
    days: "Thursday & Friday",
    daysBn: "বৃহস্পতিবার ও শুক্রবার",
    hours: "6:00 PM – 10:00 PM",
    hoursBn: "সন্ধ্যা ৬:০০ – রাত ১০:০০",
    room: "Room 205 (2nd Floor)",
    phone: "01819-876543",
    fee: 1500,
  },
];

export function ClinicChambersSection({
  title,
  titleBn,
  subtitle,
  subtitleBn,
  chambers = DEFAULT_SAMPLE_CHAMBERS,
  appointmentLink = "/appointment",
  lang,
}: {
  title?: string;
  titleBn?: string;
  subtitle?: string;
  subtitleBn?: string;
  chambers?: ChamberItem[];
  appointmentLink?: string;
  lang: Lang;
}) {
  const heading = lang === "bn" && titleBn ? titleBn : title || (lang === "bn" ? "চেম্বার ও রোগী দেখার সময়সূচি" : "Chambers & Consultation Schedules");
  const sub = lang === "bn" && subtitleBn ? subtitleBn : subtitle || (lang === "bn" ? "রোগী দেখার জন্য নির্ধারিত চেম্বার ও সরাসরি সিরিয়ালের নম্বর" : "Direct chamber schedules and appointment contact details");
  const list = chambers && chambers.length > 0 ? chambers : DEFAULT_SAMPLE_CHAMBERS;

  return (
    <section className="wrap" style={{ padding: "48px 0" }}>
      <div style={{ textAlign: "center", marginBottom: 36, maxWidth: 640, margin: "0 auto 36px" }}>
        <h2 style={{ fontSize: "1.9rem", fontWeight: 800, margin: "0 0 8px" }}>{heading}</h2>
        {sub && <p style={{ fontSize: "0.95rem", color: "var(--muted, #64748b)", margin: 0 }}>{sub}</p>}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 24,
        }}
      >
        {list.map((c) => {
          const cName = lang === "bn" && c.nameBn ? c.nameBn : c.name;
          const hosp = lang === "bn" && c.hospitalBn ? c.hospitalBn : c.hospital;
          const addr = lang === "bn" && c.addressBn ? c.addressBn : c.address;
          const days = lang === "bn" && c.daysBn ? c.daysBn : c.days;
          const hours = lang === "bn" && c.hoursBn ? c.hoursBn : c.hours;

          return (
            <div
              key={c.id}
              style={{
                border: "1px solid var(--border, #e2e8f0)",
                borderRadius: "var(--radius, 16px)",
                padding: "24px",
                background: "var(--bg, #ffffff)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "0 4px 16px rgba(0,0,0,0.03)",
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
                  <div>
                    <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 4px" }}>{cName}</h3>
                    <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--accent, #0d9488)" }}>{hosp}</div>
                  </div>
                  {c.fee && (
                    <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--muted, #64748b)", display: "block" }}>{lang === "bn" ? "পরামর্শ ফি" : "Fee"}</span>
                      <span style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--fg, #0f172a)" }}>৳{c.fee}</span>
                    </div>
                  )}
                </div>

                <p style={{ fontSize: "0.88rem", color: "var(--muted, #64748b)", margin: "0 0 16px", lineHeight: 1.4 }}>
                  📍 {addr}
                </p>

                <div
                  style={{
                    background: "var(--tint-1, #f8fafc)",
                    borderRadius: 10,
                    padding: "12px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    fontSize: "0.88rem",
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <strong style={{ color: "var(--fg, #334155)" }}>🗓️ {lang === "bn" ? "দিন" : "Days"}:</strong> {days}
                  </div>
                  <div>
                    <strong style={{ color: "var(--fg, #334155)" }}>⏰ {lang === "bn" ? "সময়" : "Time"}:</strong> {hours}
                  </div>
                  {c.room && (
                    <div>
                      <strong style={{ color: "var(--fg, #334155)" }}>🚪 {lang === "bn" ? "রুম নং" : "Room"}:</strong> {c.room}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {c.phone && (
                  <a
                    href={`tel:${c.phone}`}
                    style={{
                      flex: 1,
                      display: "inline-block",
                      textAlign: "center",
                      padding: "10px",
                      borderRadius: "var(--radius, 8px)",
                      border: "1px solid var(--border, #cbd5e1)",
                      fontWeight: 600,
                      fontSize: "0.88rem",
                      textDecoration: "none",
                      color: "var(--fg, #0f172a)",
                    }}
                  >
                    📞 {lang === "bn" ? "সিরিয়াল দিন" : "Call Chamber"}
                  </a>
                )}
                <Link
                  href={appointmentLink}
                  style={{
                    flex: 1,
                    display: "inline-block",
                    textAlign: "center",
                    padding: "10px",
                    borderRadius: "var(--radius, 8px)",
                    background: "var(--btn-bg, #0d9488)",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: "0.88rem",
                    textDecoration: "none",
                  }}
                >
                  {lang === "bn" ? "অনলাইন রিকোয়েস্ট" : "Request Slot"}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
