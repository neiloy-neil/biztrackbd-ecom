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
  const token = one(sp.token);
  const email = one(sp.email);
  const autoLoginUrl = token
    ? `${adminUrl.replace(/\/$/, "")}/login/token?token=${encodeURIComponent(token)}&next=/?welcome=1`
    : `${adminUrl.replace(/\/$/, "")}/login?${new URLSearchParams({ ...(email ? { email } : {}), next: "/?welcome=1" }).toString()}`;
  const ends = one(sp.ends) ? new Date(one(sp.ends)!) : null;
  const endsText = ends && !Number.isNaN(ends.getTime()) ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dhaka" }).format(ends) : null;
  const review = one(sp.review) === "1";

  return (
    <div className="wrap">
      <div className="wizard done-box" data-testid="done" style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 8 }} aria-hidden="true">🎉</div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Your Store is Live!</h1>
        <p className="muted" style={{ marginTop: 8, fontSize: 16 }}>
          {one(sp.name) ? <b>{one(sp.name)?.slice(0, 60)}</b> : "Your store"} is officially open.
          {endsText ? ` Your 14-day free Pro trial runs until ${endsText}.` : ""}
        </p>

        {Number(one(sp.kept)) > 0 && (
          <p className="notice good" role="status" data-testid="kept-done" style={{ marginTop: 12, textAlign: "left" }}>
            Your demo store came with you: {one(sp.kept)} products with their pictures and your home page. Everything can be edited.
          </p>
        )}

        <div className="card" style={{ margin: "24px 0", textAlign: "left", padding: 20 }}>
          <div className="muted" style={{ fontSize: 13, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.03em" }}>
            Your Live Store Address
          </div>
          <div className="big" data-testid="store-url" style={{ color: "var(--brand)", fontSize: 20, fontWeight: 700, margin: "6px 0 16px", wordBreak: "break-all" }}>
            {storeUrl}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a className="btn btn-primary btn-lg" href={autoLoginUrl} data-testid="open-admin" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span>Enter Store Admin & Start Selling</span>
              <span>→</span>
            </a>
            <a className="btn btn-secondary btn-lg" href={storeUrl} target="_blank" rel="noopener noreferrer" data-testid="open-store">
              View Storefront ↗
            </a>
          </div>
        </div>

        {review && (
          <div className="notice" style={{ textAlign: "left", marginBottom: 16 }}>
            Your store name looks like a well-known brand, so a person will check it. Your store works as normal. Connecting your own domain opens once the check is done, usually within a day.
          </div>
        )}

        <div className="card" style={{ textAlign: "left", padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>What to do next</h3>
          <ol style={{ margin: "12px 0 0", paddingLeft: 20, color: "var(--ink-2)", display: "grid", gap: 10, fontSize: 14.5 }}>
            <li><b>Verify bKash & Nagad:</b> Put your merchant or personal wallet number under Settings &gt; Payments.</li>
            <li><b>Connect a Courier:</b> Link your Steadfast or Pathao account to book pickups with 1-click.</li>
            <li><b>Share with Customers:</b> Post your store link on your Facebook page and WhatsApp status to get your first orders!</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
