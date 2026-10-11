import type { Metadata } from "next";
import { THEMES } from "@biztrackbd/core";
import { TemplateCard } from "@/components/template-card";

export const metadata: Metadata = { title: "Templates", description: "Store templates for Bangladeshi businesses, each with a live demo store you can open and try." };

export default function Templates() {
  return (
    <section className="block">
      <div className="wrap">
        <span className="eyebrow">Templates</span>
        <h1 style={{ fontSize: "clamp(32px, 6vw, 48px)", letterSpacing: "-1.2px", lineHeight: 1.1, fontWeight: 800 }}>Start from a store that already works</h1>
        <p className="sub">Open a live demo, add things to the cart and look around. Pick the one that suits your products, then change the look whenever you want. Products, orders and content stay in place.</p>
        <div className="grid g3" data-testid="templates">
          {THEMES.map((t) => <TemplateCard key={t.id} t={t} />)}
        </div>
      </div>
    </section>
  );
}
