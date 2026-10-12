import Image from "next/image";
import Link from "next/link";
import { demoTemplate } from "@biztrackbd/core";

/** Where a template's demo store lives: <name>.<root domain>. Local development uses http and the dev port. */
export function demoUrl(host: string): string {
  if (process.env.NEXT_PUBLIC_DEMO_URL_FORMAT === "path") {
    return `/demo/${host}`;
  }
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  return `${root.includes("localhost") ? "http" : "https"}://${host}.${root}`;
}

export interface TemplateInfo { id: string; name: string; blurb: string; audience?: string; live: boolean }

/** A template with a real preview of its demo store (desktop, and a phone overlapping the corner), and links to open the demo or start with it. */
export function TemplateCard({ t, compact }: { t: TemplateInfo; compact?: boolean }) {
  const demo = demoTemplate(t.id);
  return (
    <div className={`card tpl${compact ? " compact" : ""}`} data-testid={`theme-${t.id}`}>
      <div className="tpl-shot">
        <Image src={`/templates/${t.id}.webp`} alt={`${t.name} template, home page on a computer`} width={960} height={600} sizes="(min-width: 760px) 33vw, 100vw" className="tpl-desktop" />
        <Image src={`/templates/${t.id}-phone.webp`} alt={`${t.name} template on a phone`} width={390} height={844} sizes="90px" className="tpl-phone" />
      </div>
      <div className="row-between" style={{ marginTop: 16 }}><h3>{t.name}</h3>{!compact && <span className={`pill${t.live ? " live" : ""}`}>{t.live ? "Ready" : "Coming soon"}</span>}</div>
      <p>{compact && t.audience ? t.audience : t.blurb}</p>
      {t.live && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {demo && <a href={demoUrl(demo.host)} className="btn btn-secondary btn-sm" target="_blank" rel="noopener noreferrer" data-testid={`demo-${t.id}`}>View live demo</a>}
          <Link href={`/start?theme=${t.id}`} className="btn btn-primary btn-sm" prefetch={false}>Use this template</Link>
        </div>
      )}
    </div>
  );
}
