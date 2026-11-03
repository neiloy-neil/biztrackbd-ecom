/** Shown inside the site frame while a server-rendered page loads, so moving between pages never shows a blank gap under the header. */
export default function Loading() {
  return (
    <div className="wrap" style={{ padding: "48px 0", minHeight: "100vh" }} aria-busy="true" aria-label="Loading">
      <span className="sk sk-hero" />
      <span className="sk sk-line" style={{ width: "62%" }} />
      <span className="sk sk-line" style={{ width: "48%" }} />
      <div className="sk-grid">
        {Array.from({ length: 3 }, (_, i) => (
          <span key={i} className="sk sk-card" />
        ))}
      </div>
    </div>
  );
}
