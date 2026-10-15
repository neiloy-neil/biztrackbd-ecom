import React, { useState } from "react";
import type { Lang } from "@/lib/i18n-core";

export interface ProjectItem {
  id: string;
  title: string;
  titleBn?: string;
  category: string;
  categoryBn?: string;
  summary: string;
  summaryBn?: string;
  image?: string;
  projectUrl?: string;
}

const DEFAULT_SAMPLE_PROJECTS: ProjectItem[] = [
  {
    id: "p1",
    title: "Bashundhara Luxury Residence Architecture",
    titleBn: "বসুন্ধরা লাক্সারি রেসিডেন্স আর্কিটেকচার",
    category: "Architecture",
    categoryBn: "স্থাপত্য",
    summary: "Modern minimalist residential duplex focused on natural ventilation and rainwater harvesting.",
    summaryBn: "প্রাকৃতিক আলো-বাতাস ও বৃষ্টি সংরক্ষণের সুবিধা সম্বলিত আধুনিক ডুপ্লেক্স ডিজাইন।",
    projectUrl: "#",
  },
  {
    id: "p2",
    title: "Fintech Mobile Banking App Redesign",
    titleBn: "ফিনটেক মোবাইল ব্যাংকিং অ্যাপ ডিজাইন",
    category: "UI/UX Design",
    categoryBn: "ইউআই/ইউএক্স",
    summary: "Simplified bilingual interface designed for 5M+ mobile money users across Bangladesh.",
    summaryBn: "সহজ বাংলা ইন্টারফেসে তৈরি ৫০ লাখের বেশি গ্রাহকের জন্য পেমেন্ট অ্যাপ ডিজাইন।",
    projectUrl: "#",
  },
  {
    id: "p3",
    title: "Gulshan Tech Hub Interior & Acoustics",
    titleBn: "গুলশান টেক হাব ইন্টেরিয়র",
    category: "Interior Design",
    categoryBn: "ইন্টেরিয়র",
    summary: "Acoustic-treated open workspace with ergonomic breakout zones and energy-efficient lighting.",
    summaryBn: "শব্দহীন কর্মপরিবেশ ও আধুনিক আলো সম্বলিত আধুনিক অফিস ইন্টেরিয়র।",
    projectUrl: "#",
  },
];

export function PortfolioGridSection({
  title,
  titleBn,
  subtitle,
  subtitleBn,
  projects = DEFAULT_SAMPLE_PROJECTS,
  lang,
}: {
  title?: string;
  titleBn?: string;
  subtitle?: string;
  subtitleBn?: string;
  projects?: ProjectItem[];
  lang: Lang;
}) {
  const heading = lang === "bn" && titleBn ? titleBn : title || (lang === "bn" ? "নির্বাচিত কাজ ও প্রজেক্ট" : "Featured Projects & Portfolio");
  const sub = lang === "bn" && subtitleBn ? subtitleBn : subtitle || (lang === "bn" ? "সাম্প্রতিক বাস্তবায়িত কিছু উল্লেখযোগ্য কাজের এক ঝলক" : "A curated selection of recently completed projects and client work");
  const list = projects && projects.length > 0 ? projects : DEFAULT_SAMPLE_PROJECTS;

  const categories = ["ALL", ...Array.from(new Set(list.map((p) => p.category)))];
  const [activeCategory, setActiveCategory] = useState("ALL");

  const filtered = activeCategory === "ALL" ? list : list.filter((p) => p.category === activeCategory);

  return (
    <section className="wrap" style={{ padding: "48px 0" }}>
      <div style={{ textAlign: "center", marginBottom: 32, maxWidth: 640, margin: "0 auto 36px" }}>
        <h2 style={{ fontSize: "1.9rem", fontWeight: 800, margin: "0 0 8px" }}>{heading}</h2>
        {sub && <p style={{ fontSize: "0.95rem", color: "var(--muted, #64748b)", margin: 0 }}>{sub}</p>}
      </div>

      {categories.length > 2 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", marginBottom: 32 }}>
          {categories.map((cat) => {
            const isSelected = cat === activeCategory;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                style={{
                  border: "none",
                  background: isSelected ? "var(--btn-bg, #0f172a)" : "var(--tint-1, #f1f5f9)",
                  color: isSelected ? "var(--btn-fg, #ffffff)" : "var(--fg, #475569)",
                  padding: "6px 16px",
                  borderRadius: 9999,
                  fontWeight: isSelected ? 700 : 500,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                {cat === "ALL" ? (lang === "bn" ? "সবগুলো" : "All Projects") : cat}
              </button>
            );
          })}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 28,
        }}
      >
        {filtered.map((item) => {
          const pTitle = lang === "bn" && item.titleBn ? item.titleBn : item.title;
          const pCat = lang === "bn" && item.categoryBn ? item.categoryBn : item.category;
          const pSum = lang === "bn" && item.summaryBn ? item.summaryBn : item.summary;

          return (
            <div
              key={item.id}
              style={{
                border: "1px solid var(--border, #e2e8f0)",
                borderRadius: "var(--radius, 16px)",
                background: "var(--bg, #ffffff)",
                overflow: "hidden",
                boxShadow: "0 4px 16px rgba(0,0,0,0.03)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  width: "100%",
                  aspectRatio: "16/10",
                  background: "var(--tint-1, #f8fafc)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "3rem",
                  borderBottom: "1px solid var(--border, #e2e8f0)",
                }}
              >
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image} alt={pTitle} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span>📁</span>
                )}
              </div>

              <div style={{ padding: "20px", display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--accent, #6366f1)", marginBottom: 6, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    {pCat}
                  </div>
                  <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0 0 8px", lineHeight: 1.3 }}>{pTitle}</h3>
                  <p style={{ fontSize: "0.88rem", color: "var(--muted, #64748b)", margin: "0 0 16px", lineHeight: 1.5 }}>
                    {pSum}
                  </p>
                </div>

                {item.projectUrl && item.projectUrl !== "#" && (
                  <a
                    href={item.projectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: "0.88rem",
                      fontWeight: 600,
                      color: "var(--fg, #0f172a)",
                      textDecoration: "underline",
                      marginTop: "auto",
                    }}
                  >
                    {lang === "bn" ? "প্রজেক্টের বিস্তারিত দেখুন ↗" : "View Case Study ↗"}
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
