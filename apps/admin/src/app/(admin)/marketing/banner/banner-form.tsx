"use client";

import { useActionState, useState } from "react";
import type { BannerSettingsView } from "@biztrackbd/core";
import { saveBannerAction, type BannerFormState } from "./actions";

export function BannerForm({
  initialSettings,
  canEdit,
  storeName,
}: {
  initialSettings: BannerSettingsView;
  canEdit: boolean;
  storeName: string;
}) {
  const [state, action, pending] = useActionState<BannerFormState, FormData>(
    saveBannerAction,
    {}
  );

  const [announcement, setAnnouncement] = useState(
    initialSettings.announcement ?? ""
  );
  const [announcementBn, setAnnouncementBn] = useState(
    initialSettings.announcementBn ?? ""
  );
  const [flashSaleActive, setFlashSaleActive] = useState(
    initialSettings.flashSaleActive
  );
  const [flashSaleEndsAt, setFlashSaleEndsAt] = useState(
    initialSettings.flashSaleEndsAt
      ? new Date(initialSettings.flashSaleEndsAt).toISOString().slice(0, 16)
      : ""
  );
  const [flashSaleCoupon, setFlashSaleCoupon] = useState(
    initialSettings.flashSaleCoupon ?? ""
  );
  const [previewLang, setPreviewLang] = useState<"en" | "bn">("en");
  const [copied, setCopied] = useState(false);

  const activeText =
    previewLang === "bn" && announcementBn
      ? announcementBn
      : announcement || "Special Offer: Enjoy free delivery on orders over ৳1,000!";

  function handleCopy() {
    if (!flashSaleCoupon) return;
    navigator.clipboard?.writeText(flashSaleCoupon);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <form action={action} className="stack gap-lg">
      {state.error && <div className="notice bad">{state.error}</div>}
      {state.ok && <div className="notice good">Banner & Flash Sale settings saved successfully.</div>}

      {/* Live Storefront Simulation */}
      <div className="card p-md">
        <div className="flex-between items-center mb-md flex-wrap gap-sm">
          <div className="row items-center gap-sm">
            <span className="text-xs font-bold text-ink-3 uppercase tracking-wider">
              Live Storefront Header Simulation
            </span>
            {flashSaleActive && (
              <span className="pill warn text-xs">
                Flash Sale Active
              </span>
            )}
          </div>
          <div className="row gap-xs">
            <button
              type="button"
              className={`chip ${previewLang === "en" ? "active" : ""}`}
              onClick={() => setPreviewLang("en")}
            >
              English Preview
            </button>
            <button
              type="button"
              className={`chip ${previewLang === "bn" ? "active" : ""}`}
              onClick={() => setPreviewLang("bn")}
            >
              বাংলা প্রিভিউ
            </button>
          </div>
        </div>

        {/* Mock Storefront Header Container */}
        <div className="storefront-sim">
          {/* Top Announcement Bar */}
          <div className={`sim-bar ${flashSaleActive ? "sim-bar-flash" : "sim-bar-normal"}`}>
            <span>{activeText}</span>

            {flashSaleActive && (
              <div className="row items-center gap-sm flex-wrap">
                <span className="pill info font-mono text-xs">
                  Ends in 05h : 42m : 19s
                </span>

                {flashSaleCoupon && (
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="btn btn-secondary btn-sm"
                    title="Click to copy coupon code"
                  >
                    <span>{flashSaleCoupon}</span>
                    <span className="text-xs opacity-75">
                      {copied ? "✓ Copied" : "[Copy]"}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Simulated Store Navigation */}
          <div className="sim-nav">
            <div className="font-bold text-base text-ink">
              {storeName}
            </div>
            <div className="row gap-md text-sm text-ink-3 font-medium">
              <span>Home</span>
              <span>Catalog</span>
              <span>Flash Deals</span>
              <span>Contact</span>
            </div>
            <div className="row gap-md text-sm text-ink-3">
              <span>Search</span>
              <span>Cart (0)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Editor Controls */}
      <div className="grid-320">
        {/* Banner Texts */}
        <div className="card p-md">
          <h3 className="font-bold text-base mb-xs">Announcement Bar Text</h3>
          <p className="muted text-sm mb-md">
            Displays at the very top of every page across your customer storefront.
          </p>

          <div className="mb-md">
            <label
              htmlFor="announcement"
              className="label font-semibold mb-xs"
            >
              English Announcement Text
            </label>
            <input
              id="announcement"
              name="announcement"
              type="text"
              className="input w-full"
              value={announcement}
              disabled={!canEdit}
              maxLength={300}
              placeholder="e.g. Grand Eid Sale: Flat 20% OFF sitewide! Use code EID20"
              onChange={(e) => setAnnouncement(e.target.value)}
            />
          </div>

          <div>
            <label
              htmlFor="announcementBn"
              className="label font-semibold mb-xs"
            >
              Bangla Announcement Text (বাংলা টেক্সট)
            </label>
            <input
              id="announcementBn"
              name="announcementBn"
              type="text"
              className="input w-full"
              value={announcementBn}
              disabled={!canEdit}
              maxLength={300}
              placeholder="যেমন: বিশেষ ঈদ অফার: সব অর্ডারে ফ্রি ডেলিভারি!"
              onChange={(e) => setAnnouncementBn(e.target.value)}
            />
          </div>
        </div>

        {/* Flash Sale Controls */}
        <div className="card p-md">
          <h3 className="font-bold text-base mb-xs">Flash Sale Countdown & Coupon</h3>
          <p className="muted text-sm mb-md">
            Adds high-urgency red styling, live ticking countdown, and 1-click coupon copy badge.
          </p>

          <div className="mb-md">
            <label className="row items-center gap-sm pointer font-semibold text-sm">
              <input
                type="checkbox"
                name="flashSaleActive"
                checked={flashSaleActive}
                disabled={!canEdit}
                onChange={(e) => setFlashSaleActive(e.target.checked)}
              />
              <span>Enable Flash Sale Mode</span>
            </label>
          </div>

          <div className="mb-md">
            <label
              htmlFor="flashSaleEndsAt"
              className="label font-semibold mb-xs"
            >
              Countdown End Time
            </label>
            <input
              id="flashSaleEndsAt"
              name="flashSaleEndsAt"
              type="datetime-local"
              className="input w-full"
              value={flashSaleEndsAt}
              disabled={!canEdit || !flashSaleActive}
              onChange={(e) => setFlashSaleEndsAt(e.target.value)}
            />
          </div>

          <div>
            <label
              htmlFor="flashSaleCoupon"
              className="label font-semibold mb-xs"
            >
              Quick Copy Promo Code
            </label>
            <input
              id="flashSaleCoupon"
              name="flashSaleCoupon"
              type="text"
              className="input font-mono uppercase w-full"
              value={flashSaleCoupon}
              disabled={!canEdit || !flashSaleActive}
              maxLength={40}
              placeholder="e.g. FLASH20"
              onChange={(e) => setFlashSaleCoupon(e.target.value.toUpperCase())}
            />
          </div>
        </div>
      </div>

      {canEdit && (
        <div className="row gap-md items-center mt-xs">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={pending}
            aria-busy={pending}
          >
            {pending ? "Saving Changes..." : "Save Banner & Flash Sale"}
          </button>
        </div>
      )}
    </form>
  );
}
