"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { SaveBar } from "@biztrackbd/ui";
import { saveStoreAction, type FormState } from "./actions";

export interface StoreValues {
  storeName: string; storeNameBn: string; tagline: string; description: string; contactPhone: string; whatsappNumber: string; email: string; facebookUrl: string; instagramUrl: string;
  addressLine: string; pickupAddress: string; logoUrl: string; announcement: string; announcementBn: string; orderPrefix: string;
}

const TABS = [["brand", "Brand"], ["contact", "Contact and address"], ["banner", "Announcement bar"], ["orders", "Orders"]] as const;
type Tab = (typeof TABS)[number][0];
/** Which tab holds the field the server complained about, so the message is never hidden behind another tab. */
const FIELD_TAB: Record<string, Tab> = { storeName: "brand", "customer phone": "contact", "WhatsApp number": "contact", email: "contact", "Facebook page": "contact", Instagram: "contact", orderPrefix: "orders" };

export function StoreForm({ initial }: { initial: StoreValues }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveStoreAction, {});
  const [tab, setTab] = useState<Tab>("brand");
  const [dirty, setDirty] = useState(false);
  useEffect(() => { if (state.ok) setDirty(false); }, [state]);
  useEffect(() => { const t = state.field ? FIELD_TAB[state.field] : undefined; if (t) setTab(t); }, [state]);
  const [logo, setLogo] = useState(initial.logoUrl);
  const [uploadError, setUploadError] = useState("");
  const [busy, setBusy] = useState(false);
  const bad = (f: string) => (state.field === f ? { "aria-invalid": true as const } : {});

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setUploadError("");
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/media", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "Could not upload that image.");
      setLogo(json.url);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Could not upload that image.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form action={action} className="stack" data-testid="store-form" onChange={() => setDirty(true)} onInput={() => setDirty(true)}>
      <div className="tabs" role="tablist" aria-label="Store details sections">
        {TABS.map(([k, l]) => <button key={k} type="button" role="tab" id={`tab-${k}`} aria-selected={tab === k} aria-controls={`panel-${k}`} className="tabbtn" onClick={() => setTab(k)} data-testid={`store-tab-${k}`}>{l}</button>)}
      </div>
      <input type="hidden" name="logoUrl" value={logo} />
      <section className="card" role="tabpanel" id="panel-brand" aria-labelledby="tab-brand" hidden={tab !== "brand"}>
        <h2>Brand</h2>
        <div className="row" style={{ marginBottom: 14 }}>
          <span className="thumb" style={{ width: 64, height: 64, borderRadius: 12 }}>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="Your logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            ) : (
              "Logo"
            )}
          </span>
          <label className="btn btn-secondary btn-sm" style={{ cursor: "pointer" }}>
            {busy ? "Uploading…" : logo ? "Change logo" : "Upload logo"}
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {logo && <button type="button" className="link" style={{ border: 0, background: "none", cursor: "pointer" }} onClick={() => setLogo("")}>Remove</button>}
        </div>
        {uploadError && <div className="err" role="alert">{uploadError}</div>}
        <label className="field"><span className="label">Store name</span><input className="input" name="storeName" defaultValue={initial.storeName} required {...bad("storeName")} data-testid="s-name" /></label>
        <label className="field"><span className="label">Store name in Bangla <span className="opt">(optional)</span></span><input className="input" name="storeNameBn" lang="bn" defaultValue={initial.storeNameBn} /></label>
        <label className="field"><span className="label">Short tagline <span className="opt">(optional)</span></span><input className="input" name="tagline" defaultValue={initial.tagline} maxLength={120} /></label>
        <label className="field" style={{ marginBottom: 0 }}><span className="label">Description for search engines and social previews</span><textarea className="textarea" name="description" defaultValue={initial.description} maxLength={300} /></label>
      </section>

      <section className="card" role="tabpanel" id="panel-contact" aria-labelledby="tab-contact" hidden={tab !== "contact"}>
        <h2>Contact and address</h2>
        <div className="row-2">
          <label className="field"><span className="label">Customer phone</span><input className="input" name="contactPhone" inputMode="tel" defaultValue={initial.contactPhone} {...bad("customer phone")} data-testid="s-phone" /></label>
          <label className="field"><span className="label">WhatsApp number</span><input className="input" name="whatsappNumber" inputMode="tel" defaultValue={initial.whatsappNumber} {...bad("WhatsApp number")} /></label>
        </div>
        <label className="field"><span className="label">Email for customers</span><input className="input" name="email" type="email" defaultValue={initial.email} {...bad("email")} /></label>
        <div className="row-2">
          <label className="field"><span className="label">Facebook page</span><input className="input" name="facebookUrl" defaultValue={initial.facebookUrl} placeholder="facebook.com/yourpage" {...bad("Facebook page")} /></label>
          <label className="field"><span className="label">Instagram</span><input className="input" name="instagramUrl" defaultValue={initial.instagramUrl} {...bad("Instagram")} /></label>
        </div>
        <label className="field"><span className="label">Address shown in the footer</span><input className="input" name="addressLine" defaultValue={initial.addressLine} maxLength={200} /></label>
        <label className="field" style={{ marginBottom: 0 }}><span className="label">Pickup address (invoices and couriers)</span><input className="input" name="pickupAddress" defaultValue={initial.pickupAddress} maxLength={250} /></label>
      </section>

      <section className="card" role="tabpanel" id="panel-banner" aria-labelledby="tab-banner" hidden={tab !== "banner"}>
        <h2>Announcement bar</h2>
        <label className="field"><span className="label">Text above your store header <span className="opt">(optional)</span></span><input className="input" name="announcement" defaultValue={initial.announcement} maxLength={200} /></label>
        <label className="field" style={{ marginBottom: 0 }}><span className="label">Same text in Bangla <span className="opt">(optional)</span></span><input className="input" name="announcementBn" lang="bn" defaultValue={initial.announcementBn} maxLength={200} /></label>
      </section>

      <section className="card" role="tabpanel" id="panel-orders" aria-labelledby="tab-orders" hidden={tab !== "orders"}>
        <h2>Orders</h2>
        <label className="field">
          <span className="label">Order number prefix</span>
          <input className="input" name="orderPrefix" defaultValue={initial.orderPrefix} maxLength={7} style={{ maxWidth: 160, textTransform: "uppercase" }} {...bad("orderPrefix")} data-testid="s-prefix" />
          <span className="hint">New orders are numbered like {initial.orderPrefix || "BT-"}10482. Existing orders keep their numbers.</span>
        </label>
        <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>The look of invoices and packing slips is in <Link href="/settings/invoices" className="link" prefetch={false}>Invoices</Link>.</p>
      </section>

      {state.error && <div className="notice bad" role="alert" data-testid="store-error">{state.error}</div>}
      {state.ok && <div className="notice good" role="status" data-testid="store-saved">Saved.</div>}
      <SaveBar dirty={dirty && !busy} pending={pending} saveLabel="Save store details" />
    </form>
  );
}
