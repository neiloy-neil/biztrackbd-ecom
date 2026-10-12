import Link from "next/link";

/** What a locked page shows in a visitor's demo copy, in place of the real screen. */
export function DemoLocked({ what, keepHref }: { what: string; keepHref?: string }) {
  return (
    <div className="card" data-testid="demo-locked" style={{ maxWidth: 560 }}>
      <h1 style={{ fontSize: 20, marginTop: 0 }}>{what} is not in the demo</h1>
      <p className="muted">In your own store you would use this to change your real account. It is switched off here so the demo stays safe.</p>
      <p style={{ marginBottom: 0 }}>
        <a className="btn btn-primary" href={keepHref ?? "/demo/exit"}>Start your free trial</a>{" "}
        <Link className="btn btn-secondary" href="/" prefetch={false}>Back to the dashboard</Link>
      </p>
    </div>
  );
}
