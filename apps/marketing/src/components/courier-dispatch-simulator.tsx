"use client";

import { useState } from "react";
import { demoAdminUrl } from "@/lib/demo-admin";

interface CourierOption {
  id: "steadfast" | "pathao" | "redx";
  name: string;
  badge: string;
  insideDhakaFee: number;
  outsideDhakaFee: number;
  speed: string;
  consignmentPrefix: string;
}

const COURIERS: CourierOption[] = [
  {
    id: "steadfast",
    name: "Steadfast Courier",
    badge: "Most Popular",
    insideDhakaFee: 60,
    outsideDhakaFee: 110,
    speed: "24-48 Hours",
    consignmentPrefix: "ST",
  },
  {
    id: "pathao",
    name: "Pathao Delivery",
    badge: "Fastest Inside Dhaka",
    insideDhakaFee: 65,
    outsideDhakaFee: 120,
    speed: "Same-Day / 24h",
    consignmentPrefix: "PTH",
  },
  {
    id: "redx",
    name: "RedX Logistics",
    badge: "Wide Rural Coverage",
    insideDhakaFee: 65,
    outsideDhakaFee: 115,
    speed: "48-72 Hours",
    consignmentPrefix: "RDX",
  },
];

export function CourierDispatchSimulator() {
  const [destination, setDestination] = useState<"dhaka" | "outside">("outside");
  const [selectedCourierId, setSelectedCourierId] = useState<"steadfast" | "pathao" | "redx">("steadfast");
  const [isBooked, setIsBooked] = useState<boolean>(true);

  const selectedCourier = COURIERS.find((c) => c.id === selectedCourierId) ?? COURIERS[0]!;
  const deliveryFee = destination === "dhaka" ? selectedCourier.insideDhakaFee : selectedCourier.outsideDhakaFee;
  const consignmentNo = `${selectedCourier.consignmentPrefix}-99824`;

  return (
    <div
      className="card ledger-border"
      style={{
        padding: "32px 28px",
        background: "#FFFFFF",
        boxShadow: "0 10px 30px rgba(11, 77, 59, 0.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <span className="status-stamp stamp-courier">LIVE DISPATCH SIMULATOR</span>
          <h3 style={{ margin: "6px 0 0", fontSize: 22, color: "var(--ink-ledger)" }}>
            Provider-neutral courier rate &amp; 1-click booking desk
          </h3>
        </div>
        <span style={{ fontSize: 13, color: "var(--ink-3)" }}>
          Direct native APIs for Steadfast, Pathao &amp; RedX
        </span>
      </div>

      {/* Destination & Courier Selectors */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        {/* Destination Toggle */}
        <div>
          <label style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
            1. Customer Shipping Destination:
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setDestination("dhaka")}
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: destination === "dhaka" ? 700 : 500,
                border: destination === "dhaka" ? "2px solid var(--brand)" : "1px solid var(--line)",
                background: destination === "dhaka" ? "var(--tint)" : "#FBF7EC",
                color: destination === "dhaka" ? "var(--brand)" : "var(--ink-2)",
                cursor: "pointer",
              }}
            >
              Inside Dhaka (৳60–৳65)
            </button>
            <button
              type="button"
              onClick={() => setDestination("outside")}
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: destination === "outside" ? 700 : 500,
                border: destination === "outside" ? "2px solid var(--brand)" : "1px solid var(--line)",
                background: destination === "outside" ? "var(--tint)" : "#FBF7EC",
                color: destination === "outside" ? "var(--brand)" : "var(--ink-2)",
                cursor: "pointer",
              }}
            >
              Outside Dhaka (৳110–৳120)
            </button>
          </div>
        </div>

        {/* Courier Selector */}
        <div>
          <label style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
            2. Choose Delivery Provider:
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {COURIERS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCourierId(c.id)}
                style={{
                  flex: 1,
                  padding: "10px 8px",
                  borderRadius: 8,
                  fontSize: 12.5,
                  fontWeight: selectedCourierId === c.id ? 700 : 500,
                  border: selectedCourierId === c.id ? "2px solid #11795A" : "1px solid var(--line)",
                  background: selectedCourierId === c.id ? "#E3F1EA" : "#FBF7EC",
                  color: selectedCourierId === c.id ? "#11795A" : "var(--ink-2)",
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                <div>{c.name.split(" ")[0]}</div>
                <div style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 2 }}>{c.speed}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Dispatch Output Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: 24,
          background: "#FBF7EC",
          borderRadius: 12,
          padding: "22px 24px",
          border: "1px solid var(--line)",
        }}
      >
        {/* Left: Thermal Shipping Label Preview */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span className="status-stamp stamp-courier">PRINT-READY THERMAL SHIPPING LABEL</span>
            <span style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 600 }}>Standard 4×6 inch format</span>
          </div>

          <div
            style={{
              background: "#FFFFFF",
              border: "1.5px solid #0B4D3B",
              borderRadius: 8,
              padding: "16px 18px",
              fontFamily: "monospace",
              color: "#0B4D3B",
              fontSize: 12,
              boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1.5px solid #0B4D3B", paddingBottom: 8 }}>
              <div>
                <strong style={{ fontSize: 15 }}>{selectedCourier.name.toUpperCase()}</strong>
                <div style={{ fontSize: 11 }}>TRACKING: {consignmentNo}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ border: "1px solid #0B4D3B", padding: "2px 6px", fontSize: 11, fontWeight: 700 }}>
                  {destination === "dhaka" ? "ZONE: DHAKA CITY" : "ZONE: OUTSIDE DHAKA"}
                </span>
              </div>
            </div>

            {/* Simulated Barcode */}
            <div style={{ textAlign: "center", margin: "12px 0", letterSpacing: "4px", fontSize: 16, fontWeight: 800 }}>
              ||| | | |||| || | || ||||| | |||
              <div style={{ fontSize: 10, letterSpacing: "1px", fontWeight: 400, marginTop: 2 }}>*{consignmentNo}*</div>
            </div>

            <div style={{ borderTop: "1px dashed #0B4D3B", paddingTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontSize: 10, textTransform: "uppercase", color: "#3D5A52" }}>Recipient:</div>
                <strong>Tanzimul Haque</strong>
                <div>01712-345678</div>
                <div>{destination === "dhaka" ? "Uttara Sector 4, Dhaka" : "Zindabazar, Sylhet"}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", color: "#3D5A52" }}>COD Collection:</div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>৳ 2,450</div>
                <div style={{ fontSize: 10, color: "#0B4D3B" }}>Delivery Fee: ৳ {deliveryFee}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Automated Bangla SMS & Hub Pickup */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0, overflowWrap: "anywhere" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", marginBottom: 6 }}>
              Automated Bangla Tracking SMS:
            </div>
            <div
              style={{
                background: "#FFFFFF",
                border: "1px solid #8FD3B8",
                borderRadius: 8,
                padding: "12px 14px",
                fontSize: 12.5,
                lineHeight: 1.55,
                color: "var(--ink)",
              }}
            >
              &ldquo;প্রিয় গ্রাহক, আপনার অর্ডারটি (#{consignmentNo}) {selectedCourier.name} এ হস্তান্তর করা হয়েছে। লাইভ ট্র্যাকিং লিঙ্কঃ track.biztrack.bd/{consignmentNo.toLowerCase()}&rdquo;
            </div>
          </div>

          <div
            style={{
              background: "#E3F1EA",
              border: "1px solid #8FD3B8",
              borderRadius: 8,
              padding: "12px 14px",
              fontSize: 12.5,
              color: "#0B4D3B",
            }}
          >
            <strong>✓ 1-Click Dispatch Confirmed:</strong> Consignment automatically synchronized into your courier merchant account without copying addresses by hand.
          </div>

          <div style={{ marginTop: "auto" }}>
            <a
              href={demoAdminUrl("gadgetstudio")}
              className="btn btn-primary btn-sm"
              style={{ width: "100%", justifyContent: "center", background: "#11795A" }}
            >
              Test 1-Click Booking in Demo Admin ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
