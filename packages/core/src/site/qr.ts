import QRCode from "qrcode";

export interface BuildMenuUrlOptions {
  /** The verified store or custom domain base origin, e.g. "https://bistro.biztrack.me" */
  baseOrigin: string;
  /** Optional table number for in-restaurant contactless ordering */
  table?: string | number | null;
}

/**
 * Builds the canonical menu URL with optional table parameter.
 */
export function buildMenuUrl(options: BuildMenuUrlOptions): string {
  const cleanOrigin = options.baseOrigin.replace(/\/+$/, "");
  const url = new URL("/menu", cleanOrigin);
  if (options.table !== undefined && options.table !== null && String(options.table).trim()) {
    url.searchParams.set("table", String(options.table).trim());
  }
  return url.toString();
}

/**
 * Generates a crisp, vector SVG string of the QR code for print production (table cards, posters, stands).
 */
export async function generateMenuQrSvg(targetUrl: string): Promise<string> {
  return QRCode.toString(targetUrl, {
    type: "svg",
    margin: 2,
    color: {
      dark: "#0F172A",
      light: "#FFFFFF",
    },
  });
}

/**
 * Generates a PNG Data URL of the QR code for instant in-browser previews and PNG downloads.
 */
export async function generateMenuQrDataUrl(targetUrl: string, width = 600): Promise<string> {
  return QRCode.toDataURL(targetUrl, {
    margin: 2,
    width,
    color: {
      dark: "#0F172A",
      light: "#FFFFFF",
    },
  });
}
