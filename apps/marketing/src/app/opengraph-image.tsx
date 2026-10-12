import { ImageResponse } from "next/og";

export const alt = "BizTrackBD - Online store software for Bangladesh";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 70px",
          backgroundColor: "#F8FAFC",
          fontFamily: "system-ui, -apple-system, sans-serif",
          border: "14px solid #4338CA",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              backgroundColor: "#4338CA",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
              fontWeight: 800,
            }}
          >
            B
          </div>
          <span style={{ fontSize: "30px", fontWeight: 800, color: "#0F172A", letterSpacing: "-0.5px" }}>
            BizTrackBD
          </span>
          <span
            style={{
              marginLeft: "auto",
              padding: "6px 18px",
              borderRadius: "99px",
              backgroundColor: "#EEF2FF",
              border: "1px solid #C7D2FE",
              color: "#4338CA",
              fontSize: "16px",
              fontWeight: 700,
            }}
          >
            Bangladesh eCommerce Platform
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "980px" }}>
          <h1
            style={{
              fontSize: "50px",
              fontWeight: 800,
              color: "#0F172A",
              lineHeight: 1.18,
              letterSpacing: "-1.5px",
              margin: 0,
            }}
          >
            Launch your online store in a day. Sell with bKash, Nagad & Cash on Delivery.
          </h1>
          <p style={{ fontSize: "23px", color: "#475569", margin: 0, lineHeight: 1.4 }}>
            Book Steadfast & Pathao pickups straight from each order. Zero sales commission.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "24px", borderTop: "2px solid #E2E8F0", paddingTop: "26px" }}>
          <span style={{ fontSize: "17px", fontWeight: 700, color: "#0F172A" }}>
            ✓ 0% Sales Commission
          </span>
          <span style={{ fontSize: "17px", fontWeight: 700, color: "#0F172A" }}>
            ✓ Steadfast & Pathao Courier API
          </span>
          <span style={{ fontSize: "17px", fontWeight: 700, color: "#0F172A" }}>
            ✓ bKash & Nagad TrxID Desk
          </span>
          <span style={{ marginLeft: "auto", fontSize: "20px", fontWeight: 800, color: "#4338CA" }}>
            From ৳ 699/month
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
