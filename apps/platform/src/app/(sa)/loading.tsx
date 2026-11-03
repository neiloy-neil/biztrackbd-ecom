/** Shown inside the platform shell while a page loads: a heading and list rows, so navigation never shows a blank pane. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <span className="sk sk-title" />
      {Array.from({ length: 8 }, (_, i) => (
        <span key={i} className="sk sk-row" />
      ))}
    </div>
  );
}
