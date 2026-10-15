import React from "react";
import Link from "next/link";
import type { Lang } from "@/lib/i18n-core";

export function DoctorHeroSection({
  name,
  nameBn,
  designation,
  designationBn,
  degrees,
  degreesBn,
  bmdcReg,
  institute,
  instituteBn,
  specialty,
  specialtyBn,
  image,
  appointmentLink = "/appointment",
  lang,
}: {
  name?: string;
  nameBn?: string;
  designation?: string;
  designationBn?: string;
  degrees?: string;
  degreesBn?: string;
  bmdcReg?: string;
  institute?: string;
  instituteBn?: string;
  specialty?: string;
  specialtyBn?: string;
  image?: string;
  appointmentLink?: string;
  lang: Lang;
}) {
  const doctorName = lang === "bn" && nameBn ? nameBn : name || (lang === "bn" ? "ডাঃ আহমেদ তানভীর" : "Dr. Ahmed Tanvir");
  const desig = lang === "bn" && designationBn ? designationBn : designation || (lang === "bn" ? "সহযোগী অধ্যাপক ও কনসালট্যান্ট" : "Associate Professor & Senior Consultant");
  const deg = lang === "bn" && degreesBn ? degreesBn : degrees || "MBBS, FCPS, MD";
  const inst = lang === "bn" && instituteBn ? instituteBn : institute || (lang === "bn" ? "ঢাকা মেডিকেল কলেজ ও হাসপাতাল" : "Dhaka Medical College & Hospital");
  const spec = lang === "bn" && specialtyBn ? specialtyBn : specialty || (lang === "bn" ? "হৃদরোগ ও মেডিসিন বিশেষজ্ঞ" : "Cardiologist & Specialist Physician");
  const regNo = bmdcReg || "BMDC Reg No: A-48291";

  return (
    <section className="wrap" style={{ padding: "56px 0 48px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 40,
          alignItems: "center",
        }}
      >
        {/* Doctor Info */}
        <div>
          <div
            style={{
              display: "inline-block",
              background: "rgba(13, 148, 136, 0.12)",
              color: "#0f766e",
              fontSize: "0.82rem",
              fontWeight: 700,
              padding: "4px 12px",
              borderRadius: 9999,
              marginBottom: 12,
              letterSpacing: "0.02em",
            }}
          >
            {spec}
          </div>

          <h1
            style={{
              fontSize: "2.3rem",
              fontWeight: 900,
              margin: "0 0 10px",
              lineHeight: 1.2,
              letterSpacing: "-0.03em",
            }}
          >
            {doctorName}
          </h1>

          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--fg, #1e293b)", marginBottom: 4 }}>
            {deg}
          </div>

          <p style={{ fontSize: "1rem", color: "var(--muted, #64748b)", margin: "0 0 4px", lineHeight: 1.5 }}>
            {desig}
          </p>

          <p style={{ fontSize: "0.95rem", color: "var(--muted, #64748b)", margin: "0 0 16px", fontWeight: 500 }}>
            🏥 {inst}
          </p>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "var(--tint-1, #f1f5f9)",
              padding: "6px 14px",
              borderRadius: 8,
              fontSize: "0.82rem",
              fontWeight: 600,
              color: "var(--fg, #475569)",
              marginBottom: 28,
            }}
          >
            🛡️ {regNo}
          </div>

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
            <Link
              href={appointmentLink}
              style={{
                background: "var(--btn-bg, #0d9488)",
                color: "#ffffff",
                padding: "13px 28px",
                borderRadius: "var(--radius, 10px)",
                fontWeight: 700,
                fontSize: "1rem",
                textDecoration: "none",
                boxShadow: "0 4px 16px rgba(13, 148, 136, 0.25)",
              }}
            >
              {lang === "bn" ? "অ্যাপয়েন্টমেন্ট নিন" : "Book Appointment"}
            </Link>

            <Link
              href="/chambers"
              style={{
                background: "transparent",
                color: "var(--fg, #0f172a)",
                padding: "12px 20px",
                borderRadius: "var(--radius, 10px)",
                fontWeight: 600,
                fontSize: "0.95rem",
                textDecoration: "none",
                border: "1px solid var(--border, #cbd5e1)",
              }}
            >
              {lang === "bn" ? "চেম্বার ও সময়সূচি" : "View Chambers"}
            </Link>
          </div>
        </div>

        {/* Doctor Photo */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "100%",
              maxWidth: 380,
              aspectRatio: "4/5",
              margin: "0 auto",
              borderRadius: "var(--radius, 20px)",
              overflow: "hidden",
              border: "1px solid var(--border, #e2e8f0)",
              background: "var(--tint-1, #f8fafc)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 12px 36px rgba(0,0,0,0.06)",
            }}
          >
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt={doctorName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ fontSize: "5rem" }}>👨‍⚕️</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
