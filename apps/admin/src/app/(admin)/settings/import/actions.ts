"use server";

import { revalidatePath } from "next/cache";
import {
  upsertContentItem,
  getStoreSettings,
  saveStoreDetails,
  type UpsertContentItemInput,
} from "@biztrackbd/core";
import { getSession } from "@/lib/session";

export interface AnalyzedBusinessData {
  businessName?: string;
  tagline?: string;
  phone?: string;
  email?: string;
  address?: string;
  whatsappNumber?: string;
  services: Array<{
    title: string;
    summary: string;
    price?: number;
    features?: string[];
  }>;
  team: Array<{
    name: string;
    role: string;
    credentials?: string;
  }>;
}

export interface ApprovedImportData {
  businessProfile?: {
    storeName?: string;
    tagline?: string;
    contactPhone?: string;
    whatsappNumber?: string;
    address?: string;
  };
  services: Array<{
    title: string;
    summary: string;
    price?: number;
    features?: string[];
  }>;
  team: Array<{
    name: string;
    role: string;
    credentials?: string;
  }>;
}

/**
 * Parses unstructured pasted text into structured business entities using deterministic heuristics.
 */
export async function analyzeImportContentAction(
  sourceText: string,
  sourceUrl?: string
): Promise<{ ok: boolean; data: AnalyzedBusinessData }> {
  await getSession();
  const text = sourceText.trim();
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const result: AnalyzedBusinessData = {
    services: [],
    team: [],
  };

  // Heuristic phone extraction (BD phones: 01xxxxxxxxx or +8801xxxxxxxxx)
  const phoneMatch = text.match(/(?:\+?880|0)1[3-9]\d{8}/);
  if (phoneMatch) {
    result.phone = phoneMatch[0];
    result.whatsappNumber = phoneMatch[0];
  }

  // Heuristic email extraction
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    result.email = emailMatch[0];
  }

  // First line often serves as company or clinic name if short
  const firstLine = lines[0];
  if (firstLine && firstLine.length < 80 && !firstLine.includes("@")) {
    result.businessName = firstLine.replace(/^(welcome to|about)\s+/i, "");
  }

  // Address heuristic (Dhaka, Banani, Gulshan, Chittagong, Road, House, Floor, etc.)
  const addressLine = lines.find(
    (l) =>
      l &&
      /\b(road|house|block|sector|dhaka|chittagong|sylhet|gulshan|banani|dhanmondi|uttara|mirpur|chittagong|floor|avenue)\b/i.test(l)
  );
  if (addressLine) {
    result.address = addressLine.slice(0, 150);
  }

  // Identify Services and Team patterns
  let currentSection: "GENERAL" | "SERVICES" | "TEAM" = "GENERAL";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    if (/^(our services|services|specialties|treatments|what we do|solutions|packages)/i.test(line)) {
      currentSection = "SERVICES";
      continue;
    }

    if (/^(our team|team|doctors|specialists|physicians|consultants|about the doctor|who we are)/i.test(line)) {
      currentSection = "TEAM";
      continue;
    }

    // Service item heuristic: bullet points (•, -, *, 1., 2.) or short lines under Services section
    if (currentSection === "SERVICES" || /^[•\-\*]\s+/.test(line)) {
      const clean = line.replace(/^[•\-\*\d.]+\s*/, "").trim();
      if (clean.length > 3 && clean.length < 100) {
        // Price detection inside service line (e.g. "5000 tk" or "BDT 3,000" or "$50")
        const priceMatch = clean.match(/(?:bdt|tk|৳|\$)\s*([\d,]+)/i);
        const price = priceMatch && priceMatch[1] ? Number(priceMatch[1].replace(/,/g, "")) : undefined;
        const title = (clean.split(/[-–:]/)[0] || "").trim();
        const summary = clean.includes(":") || clean.includes("-")
          ? clean.slice(title.length + 1).trim()
          : `Professional ${title} service`;

        if (title.length > 2 && !result.services.some((s) => s.title.toLowerCase() === title.toLowerCase())) {
          result.services.push({
            title,
            summary: summary || title,
            price: !isNaN(price || 0) && price ? price : undefined,
          });
        }
      }
    }

    // Team / Doctor item heuristic: "Dr.", "Professor", "Consultant", "Director", "Lead", "MBBS", "FCPS"
    if (
      currentSection === "TEAM" ||
      /\b(dr\.|doctor|prof\.|professor|consultant|ceo|cto|founder|specialist|mbbs|fcps)\b/i.test(line)
    ) {
      const clean = line.replace(/^[•\-\*\d.]+\s*/, "").trim();
      if (clean.length > 3 && clean.length < 100) {
        // Extract doctor degrees if in parentheses or after comma
        const parts = clean.split(/[,–(]/);
        const name = (parts[0] || "").trim();
        const role = parts.length > 1 ? parts.slice(1).join(" ").replace(/[)]/g, "").trim() : "Specialist / Consultant";
        const creds = parts.length > 2 && parts[2] ? parts[2].replace(/[)]/g, "").trim() : undefined;

        if (name.length > 2 && !result.team.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
          result.team.push({
            name,
            role: role || "Consultant",
            credentials: creds,
          });
        }
      }
    }
  }

  // Fallback defaults if few extracted
  if (result.services.length === 0) {
    result.services.push({
      title: "General Consultation & Assessment",
      summary: "Comprehensive initial evaluation and tailored recommendations.",
    });
  }

  return { ok: true, data: result };
}

/**
 * Applies approved imported items to the tenant store settings and structured content tables.
 */
export async function applyImportContentAction(
  approved: ApprovedImportData
): Promise<{ ok: boolean; count: { services: number; team: number } }> {
  const session = await getSession();
  const tenantId = session.tenantId;

  // 1. Update store settings if provided
  if (approved.businessProfile) {
    try {
      const current = await getStoreSettings(tenantId, session.actor);
      if (current) {
        await saveStoreDetails(tenantId, session.actor, {
          storeName: approved.businessProfile.storeName || current.storeName,
          tagline: approved.businessProfile.tagline || current.tagline,
          contactPhone: approved.businessProfile.contactPhone || current.contactPhone,
          whatsappNumber: approved.businessProfile.whatsappNumber || current.whatsappNumber,
          addressLine: approved.businessProfile.address || current.addressLine,
        });
      }
    } catch {
      // Store settings update best effort
    }
  }

  // 2. Insert approved services
  let servicesCreated = 0;
  for (const s of approved.services) {
    try {
      const slug = s.title
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);

      await upsertContentItem(tenantId, {
        kind: "SERVICE",
        slug: slug || `service-${Date.now().toString(36)}`,
        title: s.title,
        summary: s.summary,
        data: {
          priceStartingAt: s.price || null,
          features: s.features || [],
          ctaLabel: "Book Consultation",
          ctaUrl: "/contact",
        },
        isPublished: true,
      });
      servicesCreated++;
    } catch {
      // Ignore single item collision
    }
  }

  // 3. Insert approved team members
  let teamCreated = 0;
  for (const t of approved.team) {
    try {
      const slug = t.name
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);

      await upsertContentItem(tenantId, {
        kind: "TEAM",
        slug: slug || `team-${Date.now().toString(36)}`,
        title: t.name,
        summary: t.role,
        data: {
          role: t.role,
          credentials: t.credentials ? [t.credentials] : [],
        },
        isPublished: true,
      });
      teamCreated++;
    } catch {
      // Ignore single item collision
    }
  }

  revalidatePath("/settings");
  revalidatePath("/settings/import");
  revalidatePath("/services");
  revalidatePath("/team");
  revalidatePath("/content-items");
  revalidatePath("/");

  return { ok: true, count: { services: servicesCreated, team: teamCreated } };
}
