// Pure Code-128 drawing: no database, no server code, so a browser component can import it (@biztrackbd/core/barcode-render).

/**
 * Code-128 Symbol Patterns (Subset B for standard ASCII alphanumeric).
 * Each pattern defines 6 alternating bar/space widths totaling 11 units.
 * Stop symbol has 7 elements (13 units).
 */
const CODE128_PATTERNS: string[] = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", // 0-9
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", // 10-19
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", // 20-29
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", // 30-39
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", // 40-49
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", // 50-59
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", // 60-69
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", // 70-79
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", // 80-89
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", // 90-99
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112" // 100-106 (106 is STOP)
];

const START_CODE_B = 104;
const STOP_CODE = 106;

/**
 * Calculates modulo 103 checksum for Code 128 (Subset B)
 */
function getCode128CheckValue(codes: number[]): number {
  let sum = START_CODE_B;
  for (let i = 0; i < codes.length; i++) {
    sum += codes[i]! * (i + 1);
  }
  return sum % 103;
}

/**
 * Encodes ASCII text into Code-128 B symbol indices
 */
function textToCode128B(text: string): number[] {
  const codes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) - 32;
    if (code >= 0 && code <= 95) {
      codes.push(code);
    } else {
      codes.push(0); // Space fallback
    }
  }
  return codes;
}

export interface BarcodeRenderOptions {
  height?: number;
  barWidth?: number;
  showText?: boolean;
  fontSize?: number;
  color?: string;
  background?: string;
}

/**
 * Pure TypeScript Code-128 SVG Barcode Generator.
 * Creates an exact, crisp SVG barcode ready for web display, thermal label printers, and PDFs.
 */
export function renderCode128Svg(
  value: string,
  options: BarcodeRenderOptions = {}
): string {
  const cleanVal = (value || "").trim().toUpperCase() || "000000";
  // The value is drawn as text inside the SVG, so it must never carry markup: escape it for the text node.
  const textVal = cleanVal.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const height = options.height ?? 50;
  const barWidth = options.barWidth ?? 2;
  const showText = options.showText ?? true;
  const fontSize = options.fontSize ?? 12;
  const color = options.color ?? "#000000";
  const bg = options.background ?? "transparent";

  const symbolCodes = textToCode128B(cleanVal);
  const checkValue = getCode128CheckValue(symbolCodes);

  // Full symbol sequence: Start B + Symbols + Checksum + Stop
  const allSymbols = [START_CODE_B, ...symbolCodes, checkValue, STOP_CODE];

  // Convert to alternating bar and space segments
  const rects: Array<{ x: number; w: number }> = [];
  let currentX = 10; // Left quiet zone

  for (const sym of allSymbols) {
    const pattern = CODE128_PATTERNS[sym] || "111111";
    let isBar = true;
    for (let i = 0; i < pattern.length; i++) {
      const widthUnits = parseInt(pattern[i]!, 10) * barWidth;
      if (isBar) {
        rects.push({ x: currentX, w: widthUnits });
      }
      currentX += widthUnits;
      isBar = !isBar;
    }
  }

  const totalWidth = currentX + 10; // Right quiet zone
  const totalHeight = showText ? height + fontSize + 6 : height;

  const rectsSvg = rects
    .map((r) => `<rect x="${r.x}" y="0" width="${r.w}" height="${height}" fill="${color}" />`)
    .join("");

  const textSvg = showText
    ? `<text x="${totalWidth / 2}" y="${height + fontSize + 2}" font-family="monospace, monospace" font-size="${fontSize}" font-weight="600" fill="${color}" text-anchor="middle" letter-spacing="2">${textVal}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}" style="background:${bg};max-width:100%;height:auto;">
    ${rectsSvg}
    ${textSvg}
  </svg>`;
}
