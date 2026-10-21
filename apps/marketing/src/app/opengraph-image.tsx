import { ImageResponse } from "next/og";

export const alt = "BizTrackBD - Online store software for Bangladesh";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GREEN_DEEP = "#0B4D3B";
const GOLD_DARK = "#946300";
const MARIGOLD = "#F2A900";
const CREAM = "#FBF7EC";
const MUTED = "#3D5A52";

/** Baloo Da 2 800 for the headline and wordmark; falls back to the bundled font if the fetch fails. */
async function loadDisplayFont(text: string) {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Baloo+Da+2:wght@800&text=${encodeURIComponent(text)}`)).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    return await (await fetch(url)).arrayBuffer();
  } catch {
    return null;
  }
}

const SMALL_TEXT = [
  "Bangladesh eCommerce Platform",
  "Book Steadfast & Pathao pickups straight from each order. Zero sales commission.",
  "• 0% Sales Commission",
  "• Steadfast & Pathao Courier API",
  "• bKash & Nagad TrxID Desk",
  "From Tk 399/month",
];
const HEADLINE = "Launch your online store in a day. Sell with bKash, Nagad & Cash on Delivery.";

export default async function Image() {
  const font = await loadDisplayFont(`biztrack.bd${HEADLINE}${SMALL_TEXT.join("")}`);
  const display = font ? "Baloo" : "system-ui";
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
          backgroundColor: CREAM,
          fontFamily: display,
          border: `14px solid ${GREEN_DEEP}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <svg width="56" height="56" viewBox="0 0 1440 1440">
            <rect width="1440" height="1440" rx="330" fill={GREEN_DEEP} />
            <g transform="translate(14 8)">
              <rect x="472" y="527" width="124" height="495" rx="26" fill="#FFFFFF" />
              <path
                fill="#FFFFFF"
                fillRule="evenodd"
                d="M789 596a233 233 0 1 0 0 466a233 233 0 1 0 0-466zM789 719a110 110 0 1 1 0 220a110 110 0 1 1 0-220z"
              />
              <path fill={MARIGOLD} d="M534 362L678 527H390z" />
            </g>
          </svg>
          <span style={{ display: "flex", fontFamily: display, fontSize: "40px", fontWeight: 800, color: GREEN_DEEP }}>
            biztrack<span style={{ color: GOLD_DARK }}>.bd</span>
          </span>
          <span
            style={{
              marginLeft: "auto",
              padding: "6px 18px",
              borderRadius: "99px",
              backgroundColor: "#E3F1EA",
              border: "1px solid #C6DFD3",
              color: GREEN_DEEP,
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
              fontFamily: display,
              fontSize: "58px",
              fontWeight: 800,
              color: GREEN_DEEP,
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            {HEADLINE}
          </h1>
          <p style={{ fontSize: "23px", color: MUTED, margin: 0, lineHeight: 1.4 }}>
            Book Steadfast & Pathao pickups straight from each order. Zero sales commission.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "24px", borderTop: "2px solid #DCE7E1", paddingTop: "26px" }}>
          <span style={{ fontSize: "17px", fontWeight: 700, color: GREEN_DEEP }}>• 0% Sales Commission</span>
          <span style={{ fontSize: "17px", fontWeight: 700, color: GREEN_DEEP }}>• Steadfast & Pathao Courier API</span>
          <span style={{ fontSize: "17px", fontWeight: 700, color: GREEN_DEEP }}>• bKash & Nagad TrxID Desk</span>
          <span style={{ marginLeft: "auto", fontSize: "20px", fontWeight: 800, color: GOLD_DARK }}>From Tk 399/month</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: font ? [{ name: "Baloo", data: font, weight: 800, style: "normal" }] : undefined,
    }
  );
}
