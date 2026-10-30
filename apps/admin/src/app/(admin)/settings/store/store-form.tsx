"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { ContactIcon, SaveBar, type ContactIconName } from "@biztrackbd/ui";
import { saveStoreAction, type FormState } from "./actions";

/** A field label with the same icon the store footer shows next to that link. */
const IconLabel = ({ icon, children }: { icon: ContactIconName; children: React.ReactNode }) => (
  <span className="label row items-center gap-sm">
    <ContactIcon name={icon} size={16} />
    <span>{children}</span>
  </span>
);

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
    <form action={action} noValidate className="stack" data-testid="store-form" onChange={() => setDirty(true)} onInput={() => setDirty(true)}>
      <div className="tab-strip" role="tablist" aria-label="Store details sections">
        {TABS.map(([k, l]) => (
          <button
            key={k}
            type="button"
            role="tab"
            id={`tab-${k}`}
            aria-selected={tab === k}
            aria-controls={`panel-${k}`}
            className={`tab-item ${tab === k ? "active" : ""}`}
            onClick={() => setTab(k)}
            data-testid={`store-tab-${k}`}
          >
            {l}
          </button>
        ))}
      </div>
      <input type="hidden" name="logoUrl" value={logo} />
      <section className="card" role="tabpanel" id="panel-brand" aria-labelledby="tab-brand" hidden={tab !== "brand"}>
        <h2 className="text-base font-bold mb-md">Brand</h2>
        <div className="row items-center gap-md mb-md">
          <span className="thumb w-64 h-64 rounded-md overflow-hidden bg-subtle border flex-center">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="Your logo" className="w-full h-full object-contain" />
            ) : (
              <span className="text-xs muted">Logo</span>
            )}
          </span>
          <label className="btn btn-secondary btn-sm pointer">
            {busy ? "Uploading…" : logo ? "Change logo" : "Upload logo"}
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {logo && <button type="button" className="link text-sm pointer border-none bg-none" onClick={() => setLogo("")}>Remove</button>}
        </div>
        {uploadError && <div className="err" role="alert">{uploadError}</div>}
        <label className="field"><span className="label">Store name</span><input className="input" name="storeName" defaultValue={initial.storeName} required {...bad("storeName")} data-testid="s-name" /></label>
        <label className="field"><span className="label">Store name in Bangla <span className="opt">(optional)</span></span><input className="input" name="storeNameBn" lang="bn" defaultValue={initial.storeNameBn} /></label>
        <label className="field"><span className="label">Short tagline <span className="opt">(optional)</span></span><input className="input" name="tagline" defaultValue={initial.tagline} maxLength={120} /></label>
        <label className="field m-0"><span className="label">Description for search engines and social previews</span><textarea className="textarea" name="description" defaultValue={initial.description} maxLength={300} /></label>
      </section>

      <section className="card" role="tabpanel" id="panel-contact" aria-labelledby="tab-contact" hidden={tab !== "contact"}>
        <h2 className="text-base font-bold mb-xs">Contact and address</h2>
        <p className="text-sm text-ink-3 mb-md">Whatever you fill in here appears in your store&apos;s footer with its icon. Leave a field empty to hide it.</p>
        <div className="row-2">
          <label className="field"><IconLabel icon="phone">Customer phone</IconLabel><input className="input" name="contactPhone" inputMode="tel" defaultValue={initial.contactPhone} {...bad("customer phone")} data-testid="s-phone" /></label>
          <label className="field"><IconLabel icon="whatsapp">WhatsApp number</IconLabel><input className="input" name="whatsappNumber" inputMode="tel" defaultValue={initial.whatsappNumber} {...bad("WhatsApp number")} /></label>
        </div>
        <label className="field"><IconLabel icon="email">Email for customers</IconLabel><input className="input" name="email" type="email" defaultValue={initial.email} {...bad("email")} /></label>
        <div className="row-2">
          <label className="field"><IconLabel icon="facebook">Facebook page</IconLabel><input className="input" name="facebookUrl" defaultValue={initial.facebookUrl} placeholder="facebook.com/yourpage" {...bad("Facebook page")} /></label>
          <label className="field"><IconLabel icon="instagram">Instagram</IconLabel><input className="input" name="instagramUrl" defaultValue={initial.instagramUrl} placeholder="instagram.com/yourstore" {...bad("Instagram")} /></label>
        </div>
        <label className="field"><span className="label">Address shown in the footer</span><input className="input" name="addressLine" defaultValue={initial.addressLine} maxLength={200} /></label>
        <label className="field m-0"><span className="label">Pickup address (invoices and couriers)</span><input className="input" name="pickupAddress" defaultValue={initial.pickupAddress} maxLength={250} /></label>
      </section>

      <section className="card" role="tabpanel" id="panel-banner" aria-labelledby="tab-banner" hidden={tab !== "banner"}>
        <h2 className="text-base font-bold mb-md">Announcement bar</h2>
        <label className="field"><span className="label">Text above your store header <span className="opt">(optional)</span></span><input className="input" name="announcement" defaultValue={initial.announcement} maxLength={200} /></label>
        <label className="field m-0"><span className="label">Same text in Bangla <span className="opt">(optional)</span></span><input className="input" name="announcementBn" lang="bn" defaultValue={initial.announcementBn} maxLength={200} /></label>
      </section>

      <section className="card" role="tabpanel" id="panel-orders" aria-labelledby="tab-orders" hidden={tab !== "orders"}>
        <h2 className="text-base font-bold mb-md">Orders</h2>
        <label className="field">
          <span className="label">Order number prefix</span>
          <input className="input max-w-160 uppercase" name="orderPrefix" defaultValue={initial.orderPrefix} maxLength={7} {...bad("orderPrefix")} data-testid="s-prefix" />
          <span className="hint">New orders are numbered like {initial.orderPrefix || "BT-"}10482. Existing orders keep their numbers.</span>
        </label>
        <p className="muted text-sm m-0">The look of invoices and packing slips is in <Link href="/settings/invoices" className="link" prefetch={false}>Invoices</Link>.</p>
      </section>

      {state.error && <div className="notice bad" role="alert" data-testid="store-error">{state.error}</div>}
      {state.ok && <div className="notice good" role="status" data-testid="store-saved">Saved.</div>}
      <SaveBar dirty={dirty && !busy} pending={pending} saveLabel="Save store details" />
    </form>
  );
}
