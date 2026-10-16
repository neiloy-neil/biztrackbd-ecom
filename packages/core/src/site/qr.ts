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

export interface TableQrItem {
  table: string;
  url: string;
  svg: string;
  dataUrl: string;
}

export interface BatchTableQrOptions {
  baseOrigin: string;
  mode: "range" | "custom";
  /** If mode is "range", start table number e.g. 1 */
  rangeStart?: number;
  /** If mode is "range", end table number e.g. 20 (max 100) */
  rangeEnd?: number;
  /** If mode is "custom", list of table identifiers e.g. ["1", "2", "VIP-1", "Roof-A"] */
  customTables?: string[];
}

/**
 * Parses user-provided comma or newline separated table labels into clean unique strings.
 */
export function parseCustomTableLabels(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s.length <= 20)
    )
  ).slice(0, 100);
}

/**
 * Batch generates QR codes (SVG & PNG dataUrl) for a series of tables.
 */
export async function generateBatchTableQrs(options: BatchTableQrOptions): Promise<TableQrItem[]> {
  const tableNames: string[] = [];

  if (options.mode === "range") {
    const start = Math.max(1, options.rangeStart ?? 1);
    const end = Math.min(start + 99, Math.max(start, options.rangeEnd ?? start + 9));
    for (let i = start; i <= end; i++) {
      tableNames.push(String(i));
    }
  } else {
    const custom = options.customTables ?? [];
    for (const name of custom) {
      const clean = name.trim();
      if (clean && !tableNames.includes(clean)) {
        tableNames.push(clean);
      }
    }
    if (tableNames.length === 0) {
      tableNames.push("1");
    }
  }

  return Promise.all(
    tableNames.map(async (table) => {
      const url = buildMenuUrl({ baseOrigin: options.baseOrigin, table });
      const [svg, dataUrl] = await Promise.all([
        generateMenuQrSvg(url),
        generateMenuQrDataUrl(url, 500),
      ]);
      return {
        table,
        url,
        svg,
        dataUrl,
      };
    })
  );
}

export interface TableOrderItemSummary {
  name: string;
  quantity: number;
  price: number;
}

export interface FormatTableOrderMessageOptions {
  storeName?: string;
  table?: string | null;
  items: TableOrderItemSummary[];
  total: number;
  note?: string;
}

/**
 * Formats a clean, readable WhatsApp order ticket for kitchen or counter staff.
 */
export function formatTableOrderMessage(options: FormatTableOrderMessageOptions): string {
  const lines: string[] = [];
  if (options.table) {
    lines.push(`🍽️ *Table Order — Table ${options.table}*`);
  } else {
    lines.push(`🛍️ *Takeaway / Dining Order*`);
  }
  if (options.storeName) {
    lines.push(`📍 *Restaurant:* ${options.storeName}`);
  }
  lines.push(``);
  lines.push(`*Ordered Items:*`);
  for (const item of options.items) {
    lines.push(`• ${item.quantity}x ${item.name} — ৳${(item.price * item.quantity).toLocaleString("en-BD")}`);
  }
  lines.push(``);
  lines.push(`*Total Bill:* ৳${options.total.toLocaleString("en-BD")}`);
  if (options.note?.trim()) {
    lines.push(`📝 *Note:* ${options.note.trim()}`);
  }
  lines.push(``);
  lines.push(`_Sent via BizTrack Digital Menu at ${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}_`);
  return lines.join("\n");
}
