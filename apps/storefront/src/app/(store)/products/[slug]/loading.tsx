/** Product page skeleton: photo on one side, title, price and buy button on the other. */
export default function Loading() {
  return (
    <div className="wrap" aria-busy="true" aria-label="Loading" style={{ display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", paddingTop: 24 }}>
      <span className="sk" style={{ aspectRatio: "1 / 1", width: "100%" }} />
      <div>
        <span className="sk sk-title" style={{ width: "70%" }} />
        <span className="sk sk-line" style={{ width: "30%" }} />
        <span className="sk sk-line" style={{ width: "100%", marginTop: 24 }} />
        <span className="sk sk-line" style={{ width: "90%" }} />
        <span className="sk" style={{ display: "block", height: 48, width: "100%", marginTop: 28 }} />
      </div>
    </div>
  );
}
