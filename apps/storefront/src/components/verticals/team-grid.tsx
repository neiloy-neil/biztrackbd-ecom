"use client";

import React from "react";
import type { Lang } from "@/lib/i18n-core";

export interface TeamMember {
  id: string;
  name: string;
  nameBn?: string;
  role: string;
  roleBn?: string;
  bio?: string;
  bioBn?: string;
  image?: string;
}

const DEFAULT_SAMPLE_TEAM: TeamMember[] = [
  {
    id: "t1",
    name: "Dr. Kazi Mahfuzur Rahman",
    nameBn: "ড. কাজী মাহফুজুর রহমান",
    role: "Managing Director & Chief Consultant",
    roleBn: "ব্যবস্থাপনা পরিচালক ও প্রধান কনসালট্যান্ট",
    bio: "20+ years of clinical and institutional leadership across South Asia and Europe.",
    bioBn: "দক্ষিণ এশিয়া ও ইউরোপে ২০ বছরের বেশি চিকিৎসা ও প্রাতিষ্ঠানিক নেতৃত্ব।",
  },
  {
    id: "t2",
    name: "Nusrat Jahan",
    nameBn: "নুসরাত জাহান",
    role: "Head of Operations & Client Experience",
    roleBn: "প্রধান পরিচালন কর্মকর্তা",
    bio: "Passionate about seamless customer communication, high service standards and team development.",
    bioBn: "গ্রাহক সন্তুষ্টি ও মানসম্মত সেবা নিশ্চিতকরণে দক্ষ সংগঠক।",
  },
  {
    id: "t3",
    name: "Engr. Salman Farooq",
    nameBn: "প্রকৌ. সালমান ফারুক",
    role: "Technical Lead & Senior Specialist",
    roleBn: "কারিগরি প্রধান ও জ্যেষ্ঠ বিশেষজ্ঞ",
    bio: "Specializes in process optimization, regulatory compliance and technical execution.",
    bioBn: "টেকনিক্যাল বাস্তবায়ন ও মান নিয়ন্ত্রণে অভিজ্ঞ প্রকৌশলী।",
  },
];

export function TeamGridSection({
  title,
  titleBn,
  subtitle,
  subtitleBn,
  members = DEFAULT_SAMPLE_TEAM,
  columns,
  lang,
}: {
  title?: string;
  titleBn?: string;
  subtitle?: string;
  subtitleBn?: string;
  members?: TeamMember[];
  columns?: string;
  lang: Lang;
}) {
  const heading = lang === "bn" && titleBn ? titleBn : title || (lang === "bn" ? "আমাদের টিম" : "Leadership & Team");
  const sub = lang === "bn" && subtitleBn ? subtitleBn : subtitle || (lang === "bn" ? "অভিজ্ঞ ও নিবেদিত পেশাদারদের সমাহার" : "Meet the experienced specialists dedicated to your success");
  const list = members && members.length > 0 ? members : DEFAULT_SAMPLE_TEAM;
  const minCol = columns === "2" ? "320px" : columns === "4" ? "220px" : "260px";

  return (
    <section className="wrap" style={{ padding: "48px 0" }}>
      <div style={{ textAlign: "center", marginBottom: 36, maxWidth: 640, margin: "0 auto 36px" }}>
        <h2 style={{ fontSize: "1.9rem", fontWeight: 800, margin: "0 0 8px" }}>{heading}</h2>
        {sub && <p style={{ fontSize: "0.95rem", color: "var(--muted, #64748b)", margin: 0 }}>{sub}</p>}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fit, minmax(${minCol}, 1fr))`,
          gap: 28,
        }}
      >
        {list.map((m) => {
          const mName = lang === "bn" && m.nameBn ? m.nameBn : m.name;
          const mRole = lang === "bn" && m.roleBn ? m.roleBn : m.role;
          const mBio = lang === "bn" && m.bioBn ? m.bioBn : m.bio;

          return (
            <div
              key={m.id}
              style={{
                border: "1px solid var(--border, #e2e8f0)",
                borderRadius: "var(--radius, 16px)",
                padding: "24px 20px",
                background: "var(--bg, #ffffff)",
                textAlign: "center",
                boxShadow: "0 4px 16px rgba(0,0,0,0.02)",
              }}
            >
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: "50%",
                  margin: "0 auto 16px",
                  background: "var(--tint-1, #f1f5f9)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "2.2rem",
                  overflow: "hidden",
                  border: "2px solid var(--border, #e2e8f0)",
                }}
              >
                {m.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.image} alt={mName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span>👤</span>
                )}
              </div>

              <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0 0 4px" }}>{mName}</h3>
              <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--accent, #1e3a8a)", marginBottom: 10 }}>
                {mRole}
              </div>
              {mBio && (
                <p style={{ fontSize: "0.85rem", color: "var(--muted, #64748b)", margin: 0, lineHeight: 1.5 }}>
                  {mBio}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
