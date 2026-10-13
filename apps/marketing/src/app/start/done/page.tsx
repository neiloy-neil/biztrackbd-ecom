import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Your store is open", robots: { index: false } };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function Done({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const store = one(sp.store);
  // Only a label we would have created is shown or linked: this page cannot be used to put another address in front of someone.
  if (!store || !/^[a-z0-9-]{3,40}$/.test(store)) notFound();
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  const proto = root.startsWith("localhost") ? "http" : "https";
  const storeUrl = `${proto}://${store}.${root}`;
  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3001";
  const email = one(sp.email);
  // Sign in with the email and password chosen while opening the store: nobody is signed in on their behalf.
  const adminParams = new URLSearchParams({
    ...(email ? { email } : {}),
    next: "/?welcome=1",
  });
  const adminEntryUrl = `${adminUrl.replace(/\/$/, "")}/login?${adminParams.toString()}`;
  const ends = one(sp.ends) ? new Date(one(sp.ends)!) : null;
  const endsText = ends && !Number.isNaN(ends.getTime()) ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dhaka" }).format(ends) : null;
  const review = one(sp.review) === "1";

  return (
    <div className="wrap">
      <div className="wizard done-box" data-testid="done">
        <h1>Your store is open</h1>
        <p className="muted" style={{ marginTop: 8 }}>{one(sp.name) ? `${one(sp.name)?.slice(0, 60)} is ready.` : "Your store is ready."}{endsText ? ` Your free trial runs until ${endsText}.` : ""}</p>
        {Number(one(sp.kept)) > 0 && <p className="notice good" role="status" data-testid="kept-done" style={{ marginTop: 12 }}>Your demo store came with you: {one(sp.kept)} products with their pictures and your home page. Everything can be edited.</p>}
        <div className="card" style={{ margin: "24px 0", textAlign: "left" }}>
          <div className="muted" style={{ fontSize: 14 }}>Your store address</div>
          <div className="big" data-testid="store-url">{storeUrl}</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
            <a className="btn btn-primary btn-lg" href={storeUrl} data-testid="open-store">Open my store</a>
            <a className="btn btn-secondary btn-lg" href={adminEntryUrl} data-testid="open-admin">Sign in to my admin</a>
          </div>
        </div>
        {review && <div className="notice" style={{ textAlign: "left", marginBottom: 16 }}>Your store name looks like a well-known brand, so a person will check it. Your store works as normal. Connecting your own domain opens once the check is done, usually within a day.</div>}
        <div className="card" style={{ textAlign: "left" }}>
          <h3>What to do next</h3>
          <ol style={{ margin: "12px 0 0", paddingLeft: 20, color: "var(--ink-2)", display: "grid", gap: 8 }}>
            <li>Replace the sample products with yours.</li>
            <li>Add your bKash and Nagad numbers under Payments.</li>
            <li>Check your delivery charges, then connect your courier.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
