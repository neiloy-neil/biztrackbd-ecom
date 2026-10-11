import Link from "next/link";

export default function NoAccess() {
  return (
    <div className="card" style={{ margin: "64px auto", maxWidth: 480 }}>
      <h1 style={{ marginTop: 0 }}>You do not have access to this page</h1>
      <p className="muted">Your role does not include it. Ask the store owner if you need it.</p>
      <Link href="/orders">Back to orders</Link>
    </div>
  );
}
