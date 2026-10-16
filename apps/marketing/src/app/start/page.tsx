import type { Metadata } from "next";
import { THEMES, listPublicPlans, listPublishedTemplates, readKeptStore, verificationRequired } from "@biztrackbd/core";
import { planBullets } from "@/lib/plans";
import { Wizard } from "./wizard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Open Your Online Store: 14-Day Free Trial",
  description: "Start a free 14-day trial for your Bangladeshi online store. Sell with bKash, Nagad, and Cash on Delivery. No credit card required.",
  robots: { index: false },
};

export default async function Start({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const plans = await listPublicPlans();
  const wantedPlan = typeof sp.plan === "string" ? sp.plan : "";
  const wantedTheme = typeof sp.theme === "string" ? sp.theme : "";
  const initialPlan =
    plans.find((p) => p.tier === wantedPlan)?.tier ??
    plans.find((p) => p.tier === "PRO")?.tier ??
    plans[0]!.tier;

  // Coming from a demo: its store comes with the visitor, in the template they were trying.
  const from = typeof sp.from === "string" ? sp.from.slice(0, 120) : "";
  const kept = from ? await readKeptStore(from).catch(() => null) : null;
  // The templates on offer are the published list (the originals plus any staff have published). If it cannot be read, the originals still work.
  const templates = await listPublishedTemplates().catch(() => []);
  const offered = templates.length > 0 ? templates.map((t) => ({ id: t.id, name: t.name, blurb: t.blurb, live: true, look: t.baseLook })) : THEMES.map((t) => ({ id: t.id, name: t.name, blurb: t.blurb, live: t.live, look: t.id }));
  const wantedTemplate = typeof sp.template === "string" ? sp.template.toLowerCase() : "";
  let resolvedMode: "ECOMMERCE" | "PORTFOLIO" | "HYBRID" | null = null;
  let resolvedVertical: string | undefined = undefined;

  if (wantedTemplate === "dhaka-bistro") {
    resolvedMode = "PORTFOLIO";
    resolvedVertical = "RESTAURANT";
  } else if (wantedTemplate === "modern-clinic") {
    resolvedMode = "PORTFOLIO";
    resolvedVertical = "DOCTOR_CLINIC";
  } else if (wantedTemplate === "apex-corporate") {
    resolvedMode = "PORTFOLIO";
    resolvedVertical = "BUSINESS_COMPANY";
  } else if (wantedTemplate === "local-service-pro") {
    resolvedMode = "PORTFOLIO";
    resolvedVertical = "SERVICE_PROVIDER";
  } else if (wantedTemplate === "portfolio-focus") {
    resolvedMode = "PORTFOLIO";
    resolvedVertical = "PERSONAL_PORTFOLIO";
  }

  const rawMode = typeof sp.mode === "string" ? sp.mode.toUpperCase() : "";
  const initialMode: "ECOMMERCE" | "PORTFOLIO" | "HYBRID" =
    resolvedMode ?? (rawMode === "PORTFOLIO" || rawMode === "HYBRID" ? rawMode : "ECOMMERCE");
  const rawVertical = typeof sp.vertical === "string" ? sp.vertical.toUpperCase() : "";
  const validVerticals = ["RESTAURANT", "DOCTOR_CLINIC", "PUBLIC_FIGURE", "BUSINESS_COMPANY", "SERVICE_PROVIDER", "PERSONAL_PORTFOLIO"];
  const initialVertical =
    resolvedVertical ?? (validVerticals.includes(rawVertical) ? (rawVertical as any) : (initialMode === "PORTFOLIO" ? "RESTAURANT" : undefined));

  let defaultTheme = "kapor";
  if (wantedTemplate) defaultTheme = wantedTemplate;
  else if (initialVertical === "RESTAURANT") defaultTheme = "dhaka-bistro";
  else if (initialVertical === "DOCTOR_CLINIC") defaultTheme = "modern-clinic";
  else if (initialVertical === "BUSINESS_COMPANY") defaultTheme = "apex-corporate";
  else if (initialVertical === "SERVICE_PROVIDER") defaultTheme = "local-service-pro";
  else if (initialVertical === "PERSONAL_PORTFOLIO") defaultTheme = "portfolio-focus";

  const initialTheme = offered.find((t) => t.id === (kept?.template || wantedTheme || defaultTheme) && t.live)?.id ?? defaultTheme ?? offered[0]?.id ?? "kapor";
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";

  return (
    <Wizard
      verify={verificationRequired()}
      keepCode={kept ? from : ""}
      keptProductsCount={kept?.products.length}
      rootDomain={rootDomain}
      initialPlan={initialPlan}
      initialTheme={initialTheme}
      initialMode={initialMode}
      initialVertical={initialVertical}
      themes={offered}
      plans={plans.map((p) => ({
        tier: p.tier,
        name: p.name,
        priceMonthly: p.priceMonthly,
        blurb: planBullets(p).slice(0, 3).join(", "),
      }))}
    />
  );
}
