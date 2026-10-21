"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { parseCatalogCsv, type CatalogParseResult } from "@/lib/catalog-parser";

const SAMPLE_SHOPIFY_CSV = `Handle,Title,Body (HTML),Vendor,Product Category,Type,Tags,Published,Option1 Name,Option1 Value,Option2 Name,Option2 Value,Variant SKU,Variant Inventory Qty,Variant Price,Variant Compare At Price,Image Src
panjabi-cotton-navy,Premium Embroidered Cotton Panjabi,<p>Handcrafted premium cotton panjabi for festive and everyday wear in Dhaka.</p>,Aarong-Style,Clothing,Panjabi,"eid, men, festive",true,Size,M,Color,Navy,PJ-NV-M,15,1850,2200,https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&auto=format&fit=crop&q=80
panjabi-cotton-navy,,,,,,,,Size,L,Color,Navy,PJ-NV-L,22,1850,2200,https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&auto=format&fit=crop&q=80
panjabi-cotton-navy,,,,,,,,Size,XL,Color,Navy,PJ-NV-XL,8,1950,2300,
silk-sharee-jamdani,Dhakai Jamdani Silk Sharee,<p>Traditional Dhakai Jamdani woven with pure cotton-silk threads. Breathable and elegant.</p>,Dhakai Weaves,Clothing,Sharee,"sharee, wedding, formal",true,Color,Crimson Red,,,SH-JM-RD,6,6500,7500,https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&auto=format&fit=crop&q=80
silk-sharee-jamdani,,,,,,,,Color,Emerald Green,,,SH-JM-GN,4,6500,7500,https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&auto=format&fit=crop&q=80
leather-wallet-oxford,Full Grain Vegetable Tanned Leather Wallet,<p>Locally tanned cowhide bifold wallet with 8 card slots and dual cash pocket.</p>,CraftLeather BD,Accessories,Leather Goods,"leather, wallet, everyday",true,Color,Classic Brown,,,LW-BR-01,35,1150,1450,https://images.unsplash.com/photo-1627123424574-724758594e93?w=600&auto=format&fit=crop&q=80
leather-wallet-oxford,,,,,,,,Color,Midnight Black,,,LW-BK-01,20,1150,1450,https://images.unsplash.com/photo-1627123424574-724758594e93?w=600&auto=format&fit=crop&q=80
wireless-earbuds-anc,BassPro Wireless ANC Earbuds,<p>Bluetooth 5.3 with Active Noise Cancellation tuned for loud Dhaka commutes.</p>,GadgetNation,Electronics,Audio,"gadgets, earbuds, bluetooth",true,Color,Matte Black,,,EB-BK-ANC,50,2450,2990,https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80`;

const SAMPLE_WOO_CSV = `Name,Regular price,Sale price,Stock,Categories,Images,Short description
Men's Oxford Formal Shoe,3800,3200,12,Footwear,https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=600&auto=format&fit=crop&q=80,Genuine leather formal shoes for office wear.
Organic Mustard Honey (500g),650,550,45,Groceries,https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=600&auto=format&fit=crop&q=80,Raw unpasteurized mustard flower honey from Sundarbans.
Matte Ceramic Mug Set (4 Pcs),1400,1190,18,Home Decor,https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80,Handcrafted stoneware mugs made in Mirpur ceramic studios.`;

export function MigrateAnalyzer() {
  const [result, setResult] = useState<CatalogParseResult | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [isDragging, setIsDragging] = useState(false);

  function handleFile(file: File) {
    setFileName(file.name);
    startTransition(async () => {
      const text = await file.text();
      const parsed = parseCatalogCsv(text);
      setResult(parsed);
      try {
        sessionStorage.setItem("biztrack_migration_catalog", JSON.stringify({
          platform: parsed.platform,
          totalProducts: parsed.totalProducts,
          products: parsed.products.slice(0, 15),
        }));
      } catch {
        // storage quota fallback
      }
    });
  }

  function loadSample(type: "shopify" | "woo") {
    setFileName(type === "shopify" ? "sample-shopify-products_export.csv" : "sample-woocommerce-products.csv");
    startTransition(() => {
      const text = type === "shopify" ? SAMPLE_SHOPIFY_CSV : SAMPLE_WOO_CSV;
      const parsed = parseCatalogCsv(text);
      setResult(parsed);
      try {
        sessionStorage.setItem("biztrack_migration_catalog", JSON.stringify({
          platform: parsed.platform,
          totalProducts: parsed.totalProducts,
          products: parsed.products.slice(0, 15),
        }));
      } catch {
        // storage quota fallback
      }
    });
  }

  const whatsappHref = result
    ? `https://wa.me/8801700000000?text=${encodeURIComponent(
        `Hello BizTrackBD team! I inspected my store catalog on /migrate. I have ${result.totalProducts} products (${result.totalVariants} variants) currently on ${result.platform.toUpperCase()} and I would like your Dhaka migration team to assist with zero-downtime migration.`
      )}`
    : `https://wa.me/8801700000000?text=${encodeURIComponent(
        "Hello BizTrackBD team! I would like help migrating my existing ecommerce store to BizTrackBD."
      )}`;

  return (
    <div className="migrate-analyzer" style={{ display: "grid", gap: 24 }}>
      {/* Upload Dropzone */}
      <div
        className="card"
        style={{
          border: isDragging ? "2px dashed var(--brand)" : "2px dashed var(--line-strong)",
          background: isDragging ? "var(--tint)" : "var(--bg)",
          borderRadius: "var(--radius)",
          padding: "36px 24px",
          textAlign: "center",
          transition: "all 0.15s ease",
          cursor: "pointer",
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
        onClick={() => {
          const input = document.getElementById("migrate-file-input") as HTMLInputElement;
          input?.click();
        }}
      >
        <input
          id="migrate-file-input"
          type="file"
          accept=".csv,text/csv"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />

        <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: "50%", background: "var(--tint)", color: "var(--brand)", marginBottom: 16 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>

        <h3 style={{ fontSize: 19, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
          {fileName ? `Loaded: ${fileName}` : "Drop your Shopify or WooCommerce CSV here"}
        </h3>
        <p className="muted" style={{ fontSize: 14.5, maxWidth: 480, margin: "0 auto 18px" }}>
          100% private & client-side. We instantly detect your multi-variant options, product images, and calculate your exact annual BDT savings.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10 }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={(e) => {
              e.stopPropagation();
              const input = document.getElementById("migrate-file-input") as HTMLInputElement;
              input?.click();
            }}
          >
            Select CSV from computer
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={(e) => {
              e.stopPropagation();
              loadSample("shopify");
            }}
          >
            Try sample Shopify export
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={(e) => {
              e.stopPropagation();
              loadSample("woo");
            }}
          >
            Try sample WooCommerce
          </button>
        </div>
      </div>

      {isPending && (
        <div className="card" style={{ padding: 24, textAlign: "center" }}>
          <p className="muted">Analyzing catalog schema, variants, and external media URLs…</p>
        </div>
      )}

      {/* Analysis Result Banner */}
      {result && result.totalProducts > 0 && (
        <div style={{ display: "grid", gap: 24 }}>
          {/* Key Metrics Dashboard */}
          <div
            className="card"
            style={{
              background: "linear-gradient(135deg, #0B4D3B 0%, #0B4D3B 100%)",
              color: "#FFFFFF",
              padding: "28px 24px",
              borderRadius: "var(--radius)",
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 20 }}>
              <div>
                <span
                  style={{
                    display: "inline-block",
                    padding: "3px 10px",
                    borderRadius: 999,
                    background: "#11795A",
                    color: "#FFFFFF",
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    marginBottom: 8,
                  }}
                >
                  {result.platform.toUpperCase()} CATALOG DETECTED
                </span>
                <h3 style={{ fontSize: 22, fontWeight: 800 }}>Migration Readiness: 100% Compatible</h3>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Estimated Annual Cost Savings</span>
                <span style={{ fontSize: 26, fontWeight: 800, color: "#8FD3B8", fontFamily: "var(--font-display)" }}>
                  ৳ {result.estimatedAnnualSavingsBdt.toLocaleString()}+ / yr
                </span>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: 12,
                paddingTop: 16,
                borderTop: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              <div>
                <span style={{ display: "block", fontSize: 12.5, color: "rgba(255,255,255,0.7)" }}>Products</span>
                <span style={{ fontSize: 22, fontWeight: 700 }}>{result.totalProducts}</span>
              </div>
              <div>
                <span style={{ display: "block", fontSize: 12.5, color: "rgba(255,255,255,0.7)" }}>Variants Mapped</span>
                <span style={{ fontSize: 22, fontWeight: 700 }}>{result.totalVariants}</span>
              </div>
              <div>
                <span style={{ display: "block", fontSize: 12.5, color: "rgba(255,255,255,0.7)" }}>Photos Preserved</span>
                <span style={{ fontSize: 22, fontWeight: 700 }}>{result.totalImages}</span>
              </div>
              <div>
                <span style={{ display: "block", fontSize: 12.5, color: "rgba(255,255,255,0.7)" }}>Categories</span>
                <span style={{ fontSize: 22, fontWeight: 700 }}>{result.categories.length || "1 (General)"}</span>
              </div>
            </div>
          </div>

          {/* Interactive Storefront Preview Header */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)" }}>Live Storefront Preview</h3>
              <p className="muted" style={{ fontSize: 14 }}>
                Here is how your imported products render natively on BizTrackBD with zero extra configuration:
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Link href="/start" className="btn btn-primary" style={{ fontWeight: 700 }}>
                Start store with these {result.totalProducts} products &rarr;
              </Link>
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                Free concierge migration (WhatsApp)
              </a>
            </div>
          </div>

          {/* Product Cards Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 18,
            }}
          >
            {result.products.map((p, idx) => (
              <div
                key={p.handle || idx}
                className="card"
                style={{
                  padding: 16,
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--line)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {/* Image */}
                <div
                  style={{
                    width: "100%",
                    height: 180,
                    borderRadius: "var(--radius-sm)",
                    background: "var(--soft)",
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  {p.imageUrls[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.imageUrls[0]}
                      alt={p.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--ink-3)", fontSize: 13 }}>
                      No photo in row
                    </div>
                  )}
                  {p.categoryName && (
                    <span
                      style={{
                        position: "absolute",
                        top: 8,
                        left: 8,
                        background: "rgba(11, 77, 59, ,0.85)",
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 4,
                      }}
                    >
                      {p.categoryName}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  <h4 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", lineHeight: 1.4 }}>
                    {p.title}
                  </h4>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 17, fontWeight: 800, color: "var(--brand)", fontFamily: "var(--font-display)" }}>
                      ৳ {p.basePrice.toLocaleString()}
                    </span>
                    {p.compareAtPrice && (
                      <span style={{ fontSize: 13, color: "var(--ink-3)", textDecoration: "line-through" }}>
                        ৳ {p.compareAtPrice.toLocaleString()}
                      </span>
                    )}
                  </div>

                  {/* Variants */}
                  <div style={{ marginTop: "auto", paddingTop: 8 }}>
                    <span style={{ display: "block", fontSize: 11.5, color: "var(--ink-3)", marginBottom: 4 }}>
                      {p.variants.length} {p.variants.length === 1 ? "variant" : "variants"}:
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {p.variants.slice(0, 4).map((v, vIdx) => (
                        <span
                          key={vIdx}
                          style={{
                            fontSize: 11,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: "var(--soft)",
                            border: "1px solid var(--line)",
                            color: "var(--ink-2)",
                          }}
                        >
                          {v.title}
                        </span>
                      ))}
                      {p.variants.length > 4 && (
                        <span style={{ fontSize: 11, color: "var(--ink-3)", alignSelf: "center" }}>
                          +{p.variants.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Action Bar */}
          <div
            className="card"
            style={{
              padding: "20px 24px",
              background: "var(--tint)",
              border: "1px solid var(--tint-border)",
              borderRadius: "var(--radius)",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <div>
              <b style={{ fontSize: 16, color: "var(--ink)", display: "block" }}>
                Ready to make the switch without dropping a single sale?
              </b>
              <span className="muted" style={{ fontSize: 14 }}>
                Keep your existing domain. Zero downtime. Your Dhaka migration specialist handles DNS & courier links.
              </span>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Link href="/start" className="btn btn-primary" style={{ fontWeight: 700 }}>
                Start Free Onboarding &rarr;
              </Link>
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                WhatsApp Us (01700-000000)
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
