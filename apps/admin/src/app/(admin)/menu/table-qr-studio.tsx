"use client";

import React, { useState, useEffect, useTransition } from "react";
import type { TableQrItem } from "@biztrackbd/core";
import { generateBatchTableQrsAction } from "./actions";

interface TableQrStudioProps {
  storeOrigin: string;
  storeName?: string;
  logoUrl?: string | null;
}

type CardFormat = "stand" | "sticker";
type GenerationMode = "range" | "custom";

export function TableQrStudio({
  storeOrigin,
  storeName = "Restaurant Menu",
  logoUrl,
}: TableQrStudioProps) {
  const [mode, setMode] = useState<GenerationMode>("range");
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(12);
  const [customInput, setCustomInput] = useState<string>("VIP-1, VIP-2, Roof-A, Roof-B, Patio-1");
  const [format, setFormat] = useState<CardFormat>("stand");

  // Optional WiFi details for table stand cards
  const [showWifi, setShowWifi] = useState(false);
  const [wifiSsid, setWifiSsid] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");

  // Custom call to action text
  const [customCtaEn, setCustomCtaEn] = useState("Scan to View Menu & Order");
  const [customCtaBn, setCustomCtaBn] = useState("মেন্যু দেখতে এবং অর্ডার করতে স্ক্যান করুন");

  // State for generated QR items
  const [items, setItems] = useState<TableQrItem[]>([]);
  const [isPending, startTransition] = useTransition();
  const [hasGenerated, setHasGenerated] = useState(false);

  // Initial load: generate tables 1 to 12
  useEffect(() => {
    startTransition(async () => {
      const res = await generateBatchTableQrsAction({
        mode: "range",
        rangeStart: 1,
        rangeEnd: 12,
      });
      if (res.ok && res.items) {
        setItems(res.items);
        setHasGenerated(true);
      }
    });
  }, []);

  const handleGenerate = () => {
    startTransition(async () => {
      if (mode === "range") {
        const start = Math.max(1, Math.min(rangeStart, 100));
        const end = Math.max(start, Math.min(rangeEnd, 100));
        const res = await generateBatchTableQrsAction({
          mode: "range",
          rangeStart: start,
          rangeEnd: end,
        });
        if (res.ok && res.items) {
          setItems(res.items);
          setHasGenerated(true);
        }
      } else {
        const labels = customInput
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter(Boolean);
        const res = await generateBatchTableQrsAction({
          mode: "custom",
          customTables: labels.length > 0 ? labels : ["Table-1"],
        });
        if (res.ok && res.items) {
          setItems(res.items);
          setHasGenerated(true);
        }
      }
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const downloadSvg = (item: TableQrItem) => {
    const blob = new Blob([item.svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `table-${item.table}-qr.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadPng = (item: TableQrItem) => {
    const a = document.createElement("a");
    a.href = item.dataUrl;
    a.download = `table-${item.table}-qr.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadAllSvgs = () => {
    items.forEach((item, idx) => {
      setTimeout(() => {
        downloadSvg(item);
      }, idx * 150);
    });
  };

  return (
    <div className="space-y-8">
      {/* Print Stylesheet */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #print-root, #print-root * {
            visibility: visible;
          }
          #print-root {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            background: #ffffff !important;
          }
          .no-print {
            display: none !important;
          }
          .page-break-after-stand:nth-child(2n) {
            page-break-after: always;
            break-after: page;
          }
          .page-break-after-sticker:nth-child(6n) {
            page-break-after: always;
            break-after: page;
          }
        }
      `}} />

      {/* Screen Controls Header (Hidden in Print) */}
      <div className="no-print bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span>📱</span> Table QR Studio
              <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2.5 py-0.5 rounded-full">
                Interactive Generator
              </span>
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Design, preview, batch-download, and print professional table QR stands and stickers for your restaurant.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={items.length === 0 || isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              <span>🖨️</span> Print All Cards ({items.length})
            </button>
            <button
              type="button"
              onClick={downloadAllSvgs}
              disabled={items.length === 0 || isPending}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium border border-slate-300 rounded-xl transition disabled:opacity-50 cursor-pointer"
            >
              <span>⬇️</span> Download All SVGs
            </button>
          </div>
        </div>

        {/* Configuration Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Column 1: Generation Mode & Range */}
          <div className="space-y-4">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              1. Table Numbers / Labels
            </label>
            <div className="flex rounded-lg border border-slate-200 p-1 bg-slate-50">
              <button
                type="button"
                onClick={() => setMode("range")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
                  mode === "range" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Sequential Range (1 to N)
              </button>
              <button
                type="button"
                onClick={() => setMode("custom")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
                  mode === "custom" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Custom Labels
              </button>
            </div>

            {mode === "range" ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 font-medium">Start Table</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={rangeStart}
                    onChange={(e) => setRangeStart(parseInt(e.target.value) || 1)}
                    className="mt-1 w-full text-sm rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium">End Table</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(parseInt(e.target.value) || 1)}
                    className="mt-1 w-full text-sm rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="text-xs text-slate-500 font-medium">
                  Comma-separated table or room names
                </label>
                <textarea
                  rows={2}
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="VIP-1, VIP-2, Roof-A, Roof-B, Patio-1"
                  className="mt-1 w-full text-sm rounded-lg border border-slate-300 p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>
            )}

            <button
              type="button"
              onClick={handleGenerate}
              disabled={isPending}
              className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg transition shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {isPending ? "Generating QRs..." : "🔄 Refresh / Re-generate QRs"}
            </button>
          </div>

          {/* Column 2: Physical Format Presets */}
          <div className="space-y-4">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              2. Physical Format Preset
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormat("stand")}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  format === "stand"
                    ? "border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-600"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div>
                  <div className="text-xl mb-1">🖼️</div>
                  <div className="text-xs font-bold text-slate-900">A6 Stand Card</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Acrylic tent card with logo, table badge, CTA & WiFi
                  </div>
                </div>
                <div className="mt-2 text-[10px] text-emerald-700 font-semibold">
                  2 cards per A4 page
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat("sticker")}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  format === "sticker"
                    ? "border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-600"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div>
                  <div className="text-xl mb-1">🏷️</div>
                  <div className="text-xs font-bold text-slate-900">Square Sticker</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Compact tabletop sticker with bold table badge & QR
                  </div>
                </div>
                <div className="mt-2 text-[10px] text-emerald-700 font-semibold">
                  6 stickers per A4 page
                </div>
              </button>
            </div>

            {/* Custom CTA Inputs */}
            <div className="space-y-2 pt-1">
              <label className="text-xs text-slate-500 font-medium">Bilingual Call-to-Action</label>
              <div className="grid grid-cols-1 gap-1.5">
                <input
                  type="text"
                  value={customCtaEn}
                  onChange={(e) => setCustomCtaEn(e.target.value)}
                  placeholder="Scan to View Menu & Order"
                  className="text-xs rounded-md border border-slate-300 px-2.5 py-1.5 text-slate-900"
                />
                <input
                  type="text"
                  value={customCtaBn}
                  onChange={(e) => setCustomCtaBn(e.target.value)}
                  placeholder="মেন্যু দেখতে এবং অর্ডার করতে স্ক্যান করুন"
                  className="text-xs rounded-md border border-slate-300 px-2.5 py-1.5 text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Column 3: WiFi Details (Optional for Stand Cards) */}
          <div className="space-y-4">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              3. Guest WiFi (Optional on Stand)
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showWifi}
                onChange={(e) => setShowWifi(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
              />
              <span className="text-xs font-medium text-slate-700">Include WiFi details on card</span>
            </label>

            {showWifi && (
              <div className="space-y-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="text-[11px] text-slate-500 font-medium">WiFi Network (SSID)</label>
                  <input
                    type="text"
                    value={wifiSsid}
                    onChange={(e) => setWifiSsid(e.target.value)}
                    placeholder="e.g. SultanDine_Guest"
                    className="mt-0.5 w-full text-xs rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 font-medium">WiFi Password</label>
                  <input
                    type="text"
                    value={wifiPassword}
                    onChange={(e) => setWifiPassword(e.target.value)}
                    placeholder="e.g. biryani123"
                    className="mt-0.5 w-full text-xs rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-900"
                  />
                </div>
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
              <div className="font-semibold flex items-center gap-1.5">
                <span>💡</span> Printing Tip:
              </div>
              <div className="text-[11px] text-amber-800 mt-1">
                Use heavy cardstock (250–300 GSM) for acrylic stand inserts. Cut along the dashed lines for exact A6 fits.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Printable Cards Grid & Preview */}
      <div id="print-root">
        {/* Screen section header (Hidden in Print) */}
        <div className="no-print flex items-center justify-between pb-2 mb-4 border-b border-slate-200">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Live Preview: {items.length} Table {format === "stand" ? "Stand Cards" : "Stickers"}
            </h3>
            <p className="text-xs text-slate-500">
              High-resolution vector QR codes linking directly to <code className="text-emerald-700 font-semibold">{storeOrigin}/menu?table=N</code>
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            Format: {format === "stand" ? "A6 Acrylic Stand (2/A4)" : "Square Sticker (6/A4)"}
          </span>
        </div>

        {isPending && !hasGenerated && (
          <div className="text-center py-16 text-slate-500 text-sm">
            Generating high-definition table QR codes...
          </div>
        )}

        {/* Dynamic Card Grid */}
        {format === "stand" ? (
          /* A6 Stand Card Layout: 2 per row on screen, 2 per page on print */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 print:grid-cols-1 print:gap-6 print:m-0">
            {items.map((item) => (
              <div
                key={item.table}
                className="page-break-after-stand bg-white rounded-3xl border-2 border-slate-200 print:border-dashed print:border-slate-400 p-6 sm:p-8 flex flex-col items-center justify-between text-center shadow-md print:shadow-none relative group print:w-[135mm] print:h-[190mm] print:mx-auto print:my-4 print:box-border"
              >
                {/* Screen Action overlay */}
                <div className="no-print absolute top-3 right-3 flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition">
                  <button
                    type="button"
                    onClick={() => downloadSvg(item)}
                    title="Download SVG"
                    className="p-1.5 text-xs bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-slate-700 font-semibold rounded-lg transition cursor-pointer"
                  >
                    SVG
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadPng(item)}
                    title="Download PNG"
                    className="p-1.5 text-xs bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-slate-700 font-semibold rounded-lg transition cursor-pointer"
                  >
                    PNG
                  </button>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    title="Open Menu in new tab"
                    className="p-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                  >
                    ↗
                  </a>
                </div>

                {/* Top Branding */}
                <div className="w-full flex flex-col items-center pt-2">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoUrl}
                      alt={storeName}
                      className="h-12 w-auto max-w-[140px] object-contain mb-2 print:h-10"
                    />
                  ) : (
                    <div className="text-3xl mb-1 print:text-2xl">🍽️</div>
                  )}
                  <h4 className="text-lg font-extrabold text-slate-900 tracking-tight uppercase print:text-base">
                    {storeName}
                  </h4>
                  <div className="mt-2 inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-slate-900 text-white font-extrabold text-sm tracking-wide uppercase shadow-sm print:bg-black print:text-white print:text-xs">
                    <span>TABLE / টেবিল</span>
                    <span className="text-emerald-400 font-mono text-base ml-1">
                      {item.table}
                    </span>
                  </div>
                </div>

                {/* Center QR Code */}
                <div className="my-5 p-4 bg-white rounded-2xl border-2 border-slate-100 print:border-none flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.dataUrl}
                    alt={`Table ${item.table} QR Code`}
                    className="w-48 h-48 sm:w-56 sm:h-56 print:w-44 print:h-44 object-contain"
                  />
                </div>

                {/* Bottom Call to Action & WiFi */}
                <div className="w-full space-y-3 pb-1">
                  <div>
                    <p className="text-base font-bold text-slate-900 tracking-tight print:text-sm">
                      {customCtaEn}
                    </p>
                    <p className="text-xs text-slate-600 font-medium mt-0.5 print:text-[11px]">
                      {customCtaBn}
                    </p>
                  </div>

                  {showWifi && (wifiSsid || wifiPassword) && (
                    <div className="inline-flex items-center justify-center gap-3 px-4 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 print:border-slate-300 print:bg-white">
                      <span className="font-bold">📶 WiFi:</span>
                      {wifiSsid && <span><span className="text-slate-400">SSID:</span> <strong>{wifiSsid}</strong></span>}
                      {wifiPassword && <span><span className="text-slate-400">Pass:</span> <code className="font-mono font-bold">{wifiPassword}</code></span>}
                    </div>
                  )}

                  <div className="text-[10px] text-slate-400 font-mono tracking-tight print:text-[9px]">
                    {item.url}
                  </div>
                </div>

                {/* Subtle cut guide label for printing */}
                <div className="hidden print:block absolute bottom-1 right-2 text-[8px] text-slate-400 font-sans">
                  ✂ Cut along outer border (A6 Acrylic Stand)
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Square Sticker Layout: 3 per row on screen, 6 per page on print (2x3) */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 print:grid-cols-2 print:gap-4 print:m-0">
            {items.map((item) => (
              <div
                key={item.table}
                className="page-break-after-sticker bg-white rounded-2xl border-2 border-slate-200 print:border-dashed print:border-slate-400 p-4 flex flex-col items-center justify-between text-center shadow-sm print:shadow-none relative group print:w-[85mm] print:h-[85mm] print:mx-auto print:my-2 print:box-border"
              >
                {/* Screen Action overlay */}
                <div className="no-print absolute top-2 right-2 flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                  <button
                    type="button"
                    onClick={() => downloadSvg(item)}
                    title="Download SVG"
                    className="p-1 text-[10px] bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-slate-700 font-semibold rounded transition cursor-pointer"
                  >
                    SVG
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadPng(item)}
                    title="Download PNG"
                    className="p-1 text-[10px] bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-slate-700 font-semibold rounded transition cursor-pointer"
                  >
                    PNG
                  </button>
                </div>

                <div className="w-full">
                  <div className="inline-block px-3 py-0.5 rounded-full bg-slate-900 text-white font-black text-xs uppercase tracking-wider print:bg-black print:text-white">
                    TABLE {item.table}
                  </div>
                </div>

                <div className="my-2 p-2 bg-white rounded-xl flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.dataUrl}
                    alt={`Table ${item.table} QR Code`}
                    className="w-28 h-28 sm:w-32 sm:h-32 print:w-36 print:h-36 object-contain"
                  />
                </div>

                <div className="w-full">
                  <p className="text-xs font-bold text-slate-900 uppercase tracking-tight truncate max-w-full">
                    {storeName}
                  </p>
                  <p className="text-[10px] text-slate-600 font-medium">
                    {customCtaEn}
                  </p>
                </div>

                <div className="hidden print:block absolute bottom-0.5 right-1.5 text-[7px] text-slate-400 font-sans">
                  ✂ Cut sticker
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
