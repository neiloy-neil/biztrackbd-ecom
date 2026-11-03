import { AuthBrand } from "@/components/auth-brand";

/** A page that does not exist: say so plainly and offer the places people most likely wanted. */
export default function NotFound() {
  return (
    <div className="card" style={{ margin: "64px auto", maxWidth: 460, textAlign: "center" }}>
      <AuthBrand />
      <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>That page does not exist</h1>
      <p style={{ margin: "0 0 20px", color: "var(--ink-2, #4A3E31)", lineHeight: 1.5 }}>The link may be old, or the page was moved.</p>
      <div>
        <a href="/" className="btn btn-primary" style={{ marginInline: 4, marginBlock: 4 }}>Back to the overview</a>
          <a href="/tenants" className="btn btn-secondary" style={{ marginInline: 4, marginBlock: 4 }}>Tenants</a>
          <a href="/payments" className="btn btn-secondary" style={{ marginInline: 4, marginBlock: 4 }}>Payments</a>
      </div>
    </div>
  );
}
