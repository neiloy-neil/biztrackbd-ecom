import { BrandLockup } from "@biztrackbd/ui";

/** A page that does not exist: say so plainly and offer the places people most likely wanted. */
export default function NotFound() {
  return (
    <div className="wrap" style={{ margin: "0 auto", maxWidth: 560, padding: "72px 0", textAlign: "center" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 20 }}><BrandLockup size={36} /></div>
      <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>We could not find that page</h1>
      <p style={{ margin: "0 0 20px", color: "var(--ink-2, #4A3E31)", lineHeight: 1.5 }}>The link may be old. These pages might help:</p>
      <div>
        <a href="/" className="btn btn-primary" style={{ marginInline: 4, marginBlock: 4 }}>Home</a>
          <a href="/pricing" className="btn btn-secondary" style={{ marginInline: 4, marginBlock: 4 }}>Pricing</a>
          <a href="/templates" className="btn btn-secondary" style={{ marginInline: 4, marginBlock: 4 }}>Templates</a>
          <a href="/start" className="btn btn-secondary" style={{ marginInline: 4, marginBlock: 4 }}>Start free</a>
      </div>
    </div>
  );
}
