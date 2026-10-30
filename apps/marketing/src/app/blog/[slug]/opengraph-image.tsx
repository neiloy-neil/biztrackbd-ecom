import { ImageResponse } from "next/og";
import { getBlogPost, readingMinutes } from "@/lib/blog";

export const alt = "BizTrackBD guide";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

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

/** The cover for a guide: its own title on the brand card, so every post gets a matching social and in-page image. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  const title = post?.title ?? "Guides for Bangladesh online sellers";
  const meta = post ? `Guide · ${readingMinutes(post.body)} min read` : "Guide";
  const font = await loadDisplayFont(`biztrack.bd${title}${meta}`);
  const display = font ? "Baloo" : "system-ui";
  const fontSize = title.length > 70 ? 54 : title.length > 45 ? 64 : 76;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 70px",
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
              fontSize: "18px",
              fontWeight: 700,
            }}
          >
            {meta}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", width: "96px", height: "10px", borderRadius: "6px", backgroundColor: MARIGOLD }} />
          <h1 style={{ fontFamily: display, fontSize: `${fontSize}px`, fontWeight: 800, lineHeight: 1.08, color: GREEN_DEEP, margin: 0, maxWidth: "1040px" }}>
            {title}
          </h1>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: MUTED, fontSize: "22px", fontWeight: 700 }}>
          <span style={{ display: "flex" }}>Online store software for Bangladesh</span>
          <span style={{ display: "flex", color: GOLD_DARK }}>biztrack.bd/blog</span>
        </div>
      </div>
    ),
    { ...size, fonts: font ? [{ name: "Baloo", data: font, weight: 800, style: "normal" }] : undefined },
  );
}
