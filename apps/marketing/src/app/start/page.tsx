import type { Metadata } from "next";
import { THEMES, listPublicPlans } from "@biztrackbd/core";
import { planBullets } from "@/lib/plans";
import { Wizard } from "./wizard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Open your store", description: "Start a free 14-day trial. No card needed.", robots: { index: false } };

export default async function Start({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const plans = await listPublicPlans();
  const wantedPlan = typeof sp.plan === "string" ? sp.plan : "";
  const wantedTheme = typeof sp.theme === "string" ? sp.theme : "";
  const initialPlan = plans.find((p) => p.tier === wantedPlan)?.tier ?? plans.find((p) => p.tier === "PRO")?.tier ?? plans[0]!.tier;
  const initialTheme = THEMES.find((t) => t.id === wantedTheme && t.live)?.id ?? "kapor";
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  return (
    <div className="split-start">
      <div className="split-form">
        <Wizard
          rootDomain={rootDomain} initialPlan={initialPlan} initialTheme={initialTheme}
          themes={THEMES.map((t) => ({ id: t.id, name: t.name, blurb: t.blurb, live: t.live }))}
          plans={plans.map((p) => ({ tier: p.tier, name: p.name, priceMonthly: p.priceMonthly, blurb: planBullets(p).slice(0, 3).join(", ") }))}
        />
      </div>
      <aside className="split-side" aria-label="What happens next">
        <span className="eyebrow">What happens next</span>
        <ol>
          <li><span>1</span><div><b>Pick a template</b><p>Choose a look for fashion, gadgets, kids wear, tailoring or beauty. Change it any time without losing your products.</p></div></li>
          <li><span>2</span><div><b>Add your products</b><p>Take photos on your phone, set prices in taka, and start with sample products if you want to look around first.</p></div></li>
          <li><span>3</span><div><b>Share your link and sell</b><p>Customers pay by cash on delivery, bKash or Nagad. You book Pathao, Steadfast or RedX from the order.</p></div></li>
        </ol>
        <p className="side-foot"><span>14 days free</span><span>No card required</span><span>Bangla and English</span></p>
      </aside>
    </div>
  );
}
