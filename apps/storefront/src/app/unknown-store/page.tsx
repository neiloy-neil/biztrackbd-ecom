export const dynamic = "force-dynamic";

/** The proxy rewrites unknown, reserved and malformed hostnames here with a 404. */
export default function UnknownStore() {
  return (
    <main className="wrap" style={{ padding: "80px 0", maxWidth: 520 }}>
      <h1>Store not found</h1>
      <p className="muted">This address is not connected to a store.</p>
    </main>
  );
}
