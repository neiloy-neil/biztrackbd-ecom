"use client";

/** The last resort: shown if the page frame itself fails, so it carries its own styles and cannot depend on the app's CSS. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#FBF7EC", color: "#0B4D3B", fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
        <div style={{ maxWidth: 440, padding: 24, textAlign: "center" }} role="alert">
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ margin: "0 0 20px", color: "#3D5A52", lineHeight: 1.5 }}>The page could not be shown. Please try again.</p>
          <button type="button" onClick={() => reset()} style={{ minHeight: 44, padding: "0 20px", border: 0, borderRadius: 10, background: "#11795A", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
            Try again
          </button>
          {error.digest ? <p style={{ marginTop: 20, fontSize: 12, color: "#55706A" }}>Code: {error.digest}</p> : null}
        </div>
      </body>
    </html>
  );
}
