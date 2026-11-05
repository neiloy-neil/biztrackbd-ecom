import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { unsubscribeByToken, verifyUnsubscribe } from "@biztrackbd/core";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };

/** The link in a marketing email opens this page. It opts the store out only after the owner presses the button, so an email scanner opening the link changes nothing. */
async function confirm(form: FormData): Promise<void> {
  "use server";
  const token = String(form.get("t") ?? "");
  const ok = await unsubscribeByToken(token).catch(() => null);
  redirect(ok ? "/unsubscribe?done=1" : "/unsubscribe?bad=1");
}

export default async function Unsubscribe({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const t = typeof sp.t === "string" ? sp.t : "";
  const done = sp.done === "1";
  const valid = !done && verifyUnsubscribe(t) !== null;

  return (
    <main style={{ maxWidth: 520, margin: "64px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 26, margin: "0 0 12px" }}>{done ? "You are unsubscribed" : "Stop product tips and offers"}</h1>
      {done ? (
        <p>You will not get product tips or offers from BizTrackBD any more. Messages about your plan, payments and account will still reach you, because your store depends on them. You can turn tips back on any time in your store settings under Customer messages.</p>
      ) : valid ? (
        <form action={confirm}>
          <p>Press the button to stop product tips and offers from BizTrackBD for this store. Messages about your plan, payments and account will still be sent.</p>
          <input type="hidden" name="t" value={t} />
          <button type="submit" className="btn btn-primary" style={{ minHeight: 44, padding: "0 20px" }}>Unsubscribe</button>
        </form>
      ) : (
        <p>This link is not valid or has expired. To stop product tips and offers, open your store settings, go to Customer messages and switch them off.</p>
      )}
    </main>
  );
}
