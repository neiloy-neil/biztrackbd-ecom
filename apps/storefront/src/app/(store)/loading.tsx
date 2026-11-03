/** Shown while any store page streams in: a page title and a product-card grid in the same box sizes, so nothing jumps. */
export default function Loading() {
  return (
    <div className="wrap" aria-busy="true" aria-label="Loading">
      <span className="sk sk-title" />
      <div className="grid">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="sk-card">
            <span className="sk sk-img" />
            <span className="sk sk-line" style={{ width: "80%" }} />
            <span className="sk sk-line" style={{ width: "40%" }} />
          </div>
        ))}
      </div>
    </div>
  );
}
