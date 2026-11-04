import { inflateRawSync } from "node:zlib";
import { getPlatformPrisma, type PrismaClient } from "@biztrackbd/db";
import { ValidationError } from "../errors";
import { assertPlatformCan, type PlatformActor } from "./admin";
import { MAX_TEMPLATE_BUNDLE_BYTES, parseTemplateBundle } from "./template-bundle";
import { importTemplateBundle, type ImportedTemplate } from "./templates";

/**
 * A theme package as a .zip: `theme.json` (the same file format as a plain JSON upload) plus the pictures it uses. Everything in the zip is
 * untrusted, so it is read here by a small reader of our own that never trusts a size the file claims about itself:
 *  - the zip is capped, and so are the entry count, every picture, `theme.json`, and the total after unpacking;
 *  - only `theme.json` and pictures (png, jpg, webp, avif) may be inside. No SVG (it can carry script), no archive inside the archive, no other file;
 *  - entry names are plain relative paths (no `..`, no leading slash, no backslash, no drive letter, no odd characters);
 *  - every picture's first bytes must match its type, so a renamed file is refused;
 *  - unpacking is stopped at the size a file may have, whatever its header says, and the CRC and size are checked afterwards (zip bombs);
 *  - encrypted, zip64 and multi-disk archives and entries that overlap each other are refused.
 * The pictures go through the media layer (re-encoded, metadata stripped) and the JSON's references to them are rewritten to the stored
 * addresses, so the finished theme needs nothing from outside. The skin CSS keeps its own rules (no url()): pictures are named in the JSON only.
 */

/** Kept under the 4.5 MB request body a serverless host accepts, with room for the form around the file. */
export const MAX_TEMPLATE_ZIP_BYTES = 4 * 1024 * 1024;
export const MAX_ZIP_ENTRIES = 40;
export const MAX_ZIP_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_ZIP_UNPACKED_BYTES = 16 * 1024 * 1024;
export const THEME_JSON_NAME = "theme.json";
/** The media folder the platform's own theme pictures live in (a store's id never looks like this). */
export const TEMPLATE_MEDIA_OWNER = "platform-themes";

type ImageKind = "png" | "jpeg" | "webp" | "avif";
const EXTENSIONS: Record<string, ImageKind> = { png: "png", jpg: "jpeg", jpeg: "jpeg", webp: "webp", avif: "avif" };
const NAME = /^[A-Za-z0-9._\-/]+$/;
const JUNK = /(?:^|\/)(?:__MACOSX\/|\.DS_Store$|Thumbs\.db$)/;

const fail = (why: string): never => { throw new ValidationError(`Theme package: ${why}`); };

// ---- CRC-32 (the zip's own check of what came out) ----------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
export function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ---- Reading the archive ---------------------------------------------------------------------------------------------------

interface CentralEntry { name: string; method: number; flags: number; crc: number; csize: number; usize: number; offset: number }

const SIG_EOCD = 0x06054b50, SIG_CEN = 0x02014b50, SIG_LOC = 0x04034b50;

function listEntries(zip: Buffer): CentralEntry[] {
  // The end-of-central-directory record is in the last 64 KB + 22 bytes.
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 65535); i--) if (zip.readUInt32LE(i) === SIG_EOCD) { eocd = i; break; }
  if (eocd < 0) return fail("that file is not a zip archive");
  const disk = zip.readUInt16LE(eocd + 4), cdDisk = zip.readUInt16LE(eocd + 6);
  const onDisk = zip.readUInt16LE(eocd + 8), total = zip.readUInt16LE(eocd + 10);
  const cdSize = zip.readUInt32LE(eocd + 12), cdOffset = zip.readUInt32LE(eocd + 16);
  if (disk !== 0 || cdDisk !== 0 || onDisk !== total) return fail("zips split over several parts are not accepted");
  if (total === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) return fail("zip64 archives are not accepted");
  if (total === 0) return fail("the zip is empty");
  if (total > MAX_ZIP_ENTRIES) return fail(`it has too many files (${MAX_ZIP_ENTRIES} at most)`);
  if (cdOffset + cdSize > eocd) return fail("the zip's file list is damaged");
  const out: CentralEntry[] = [];
  let p = cdOffset;
  for (let i = 0; i < total; i++) {
    if (p + 46 > zip.length || zip.readUInt32LE(p) !== SIG_CEN) return fail("the zip's file list is damaged");
    const flags = zip.readUInt16LE(p + 8), method = zip.readUInt16LE(p + 10);
    const crc = zip.readUInt32LE(p + 16), csize = zip.readUInt32LE(p + 20), usize = zip.readUInt32LE(p + 24);
    const nLen = zip.readUInt16LE(p + 28), xLen = zip.readUInt16LE(p + 30), cLen = zip.readUInt16LE(p + 32);
    const diskStart = zip.readUInt16LE(p + 34), offset = zip.readUInt32LE(p + 42);
    if (p + 46 + nLen + xLen + cLen > zip.length) return fail("the zip's file list is damaged");
    if (diskStart !== 0) return fail("zips split over several parts are not accepted");
    if (csize === 0xffffffff || usize === 0xffffffff || offset === 0xffffffff) return fail("zip64 archives are not accepted");
    // Bit 11 says the name is UTF-8; names are limited to plain characters below, so both readings are the same text.
    const name = zip.toString("latin1", p + 46, p + 46 + nLen);
    out.push({ name, method, flags, crc, csize, usize, offset });
    p += 46 + nLen + xLen + cLen;
  }
  return out;
}

/** A file name inside the zip: a plain relative path. Throws a message that names the file. */
export function checkEntryName(name: string): void {
  const shown = JSON.stringify(name.slice(0, 60));
  if (name.length === 0 || name.length > 160) fail(`${shown} has an unusable name`);
  if (name.includes("\0") || /[\x00-\x1f\x7f]/.test(name)) fail(`${shown} has a control character in its name`);
  if (name.includes("\\")) fail(`${shown} uses a backslash in its name`);
  if (name.startsWith("/") || /^[A-Za-z]:/.test(name)) fail(`${shown} has an absolute path`);
  if (!NAME.test(name)) fail(`${shown} uses characters that are not allowed in a file name (letters, numbers, dot, dash, underscore and / only)`);
  for (const seg of name.replace(/\/$/, "").split("/")) {
    if (seg === "" || seg === "." || seg === "..") fail(`${shown} has a path that climbs out of the package`);
    if (seg.startsWith(".") && seg !== "") fail(`${shown} is a hidden file`);
  }
}

/** What a picture really is, from its first bytes. Null when it is none of the four allowed types. */
export function sniffImage(b: Uint8Array): ImageKind | null {
  const at = (i: number, s: string) => s.split("").every((c, k) => b[i + k] === c.charCodeAt(0));
  if (b.length >= 8 && b[0] === 0x89 && at(1, "PNG") && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 12 && at(0, "RIFF") && at(8, "WEBP")) return "webp";
  if (b.length >= 16 && at(4, "ftyp")) {
    // The major brand (bytes 8 to 12) and the compatible brands (from byte 16) name the format.
    const size = Math.min(((b[0]! << 24) | (b[1]! << 16) | (b[2]! << 8) | b[3]!) >>> 0, b.length, 96);
    const offsets = [8]; for (let i = 16; i + 4 <= size; i += 4) offsets.push(i);
    for (const i of offsets) {
      const brand = String.fromCharCode(b[i]!, b[i + 1]!, b[i + 2]!, b[i + 3]!);
      if (brand === "avif" || brand === "avis") return "avif";
    }
  }
  return null;
}

export interface PackageImage { name: string; kind: ImageKind; bytes: Buffer }
export interface ReadPackage { themeJson: string; images: PackageImage[] }

/** Opens the zip and checks every rule above. Nothing is stored here. */
export function readThemeZip(zip: Buffer): ReadPackage {
  if (zip.length === 0) fail("the file is empty");
  if (zip.length > MAX_TEMPLATE_ZIP_BYTES) fail(`the zip is too large (${MAX_TEMPLATE_ZIP_BYTES / 1024 / 1024} MB at most)`);
  if (zip.length < 22 || zip.readUInt32LE(0) !== SIG_LOC) fail("that file is not a zip archive");
  const all = listEntries(zip);

  const seen = new Set<string>();
  const entries: CentralEntry[] = [];
  for (const e of all) {
    if (JUNK.test(e.name)) continue; // what Finder and Explorer add; never read
    checkEntryName(e.name);
    const key = e.name.toLowerCase();
    if (seen.has(key)) fail(`${JSON.stringify(e.name)} appears twice`);
    seen.add(key);
    if (e.name.endsWith("/")) { if (e.usize !== 0) fail(`${JSON.stringify(e.name)} is a folder with content`); continue; }
    entries.push(e);
  }

  let unpacked = 0;
  const ranges: [number, number][] = [];
  let themeJson: string | null = null;
  const images: PackageImage[] = [];
  for (const e of entries) {
    const shown = JSON.stringify(e.name);
    if (e.flags & 0x1 || e.flags & 0x40) fail(`${shown} is encrypted`);
    if (e.method !== 0 && e.method !== 8) fail(`${shown} uses a compression method that is not accepted`);
    const isJson = e.name === THEME_JSON_NAME;
    const ext = e.name.slice(e.name.lastIndexOf(".") + 1).toLowerCase();
    const wanted = e.name.includes(".") ? EXTENSIONS[ext] : undefined;
    if (!isJson && !wanted) {
      if (e.name.endsWith("/" + THEME_JSON_NAME)) fail(`${shown} is in a folder. theme.json must be at the top of the zip`);
      if (/^(zip|jar|7z|rar|gz|tgz|tar|bz2|xz)$/.test(ext)) fail(`${shown} is an archive inside the archive`);
      if (ext === "svg") fail(`${shown} is an SVG. Use png, jpg, webp or avif pictures (SVG can carry scripts)`);
      fail(`${shown} is not allowed. A package holds theme.json and png, jpg, webp or avif pictures only`);
    }
    const limit = isJson ? MAX_TEMPLATE_BUNDLE_BYTES : MAX_ZIP_IMAGE_BYTES;
    if (e.usize > limit) fail(`${shown} is too large (${isJson ? "1 MB" : `${MAX_ZIP_IMAGE_BYTES / 1024 / 1024} MB`} at most)`);
    if (e.method === 0 && e.csize !== e.usize) fail(`${shown} is damaged`);
    unpacked += e.usize;
    if (unpacked > MAX_ZIP_UNPACKED_BYTES) fail(`it unpacks to more than ${MAX_ZIP_UNPACKED_BYTES / 1024 / 1024} MB`);

    // The local header says where the data starts; the central directory's own sizes decide how much of it is read.
    const o = e.offset;
    if (o + 30 > zip.length || zip.readUInt32LE(o) !== SIG_LOC) fail(`${shown} is damaged`);
    const nLen = zip.readUInt16LE(o + 26), xLen = zip.readUInt16LE(o + 28);
    if (zip.toString("latin1", o + 30, o + 30 + nLen) !== e.name) fail(`${shown} does not match its own header`);
    const start = o + 30 + nLen + xLen, end = start + e.csize;
    if (end > zip.length) fail(`${shown} is cut short`);
    for (const [a, b] of ranges) if (start < b && end > a) fail("two files in the zip overlap, which is how some zip bombs are made");
    ranges.push([o, end]);

    const raw = zip.subarray(start, end);
    let data: Buffer;
    if (e.method === 0) data = Buffer.from(raw);
    else {
      try { data = inflateRawSync(raw, { maxOutputLength: e.usize + 1 }); } // stops at the claimed size even if the data goes on
      catch { return fail(`${shown} is damaged or unpacks to more than it says`); }
    }
    if (data.length !== e.usize) fail(`${shown} unpacks to a different size than the zip says`);
    if (crc32(data) !== e.crc) fail(`${shown} is damaged (checksum does not match)`);

    if (isJson) { themeJson = data.toString("utf8").replace(/^\uFEFF/, ""); continue; }
    const kind = sniffImage(data);
    if (!kind) fail(`${shown} is not a real png, jpg, webp or avif picture (its content does not match)`);
    if (kind !== wanted) fail(`${shown} is a ${kind} picture with the wrong file ending`);
    images.push({ name: e.name, kind: kind!, bytes: data });
  }
  if (themeJson === null) fail("theme.json is missing. Put it at the top of the zip, not in a folder");
  return { themeJson: themeJson!, images };
}

// ---- Pictures named in the JSON -----------------------------------------------------------------------------------------------

const refOf = (s: string) => (s.startsWith("./") ? s.slice(2) : s);
const LOOKS_LIKE_PICTURE = /^(?!https?:|\/media\/)[A-Za-z0-9._\-/]+\.(?:png|jpe?g|webp|avif|gif|svg|bmp|tiff?)$/i;

/** Calls `fn` for every string in the JSON (except the skin CSS) and swaps it for what `fn` returns. */
function mapStrings(v: unknown, fn: (s: string) => string, top = true): unknown {
  if (typeof v === "string") return fn(v);
  if (Array.isArray(v)) return v.map((x) => mapStrings(x, fn, false));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, top && k === "skin" ? x : mapStrings(x, fn, false)]));
  return v;
}

export interface PictureStore {
  /** Saves one checked picture and returns the address pages use. Re-encodes it (the media layer does). */
  save(bytes: Buffer, name: string): Promise<string>;
  /** Best-effort clean up of a picture saved for a package that then failed. */
  discard?(url: string): Promise<void>;
}

export interface PreparedPackage { bundleText: string; used: string[]; unused: string[]; stored: Record<string, string> }

/**
 * Checks the zip, stores the pictures the JSON points at, and returns a plain template file (JSON text) whose picture references are the stored
 * addresses. The file is validated once with stand-in addresses BEFORE anything is stored, so a package with a mistake leaves no pictures behind.
 */
export async function prepareThemePackage(zip: Buffer, pictures: PictureStore): Promise<PreparedPackage> {
  const pkg = readThemeZip(zip);
  let json: unknown;
  try { json = JSON.parse(pkg.themeJson); } catch { return fail("theme.json is not valid JSON"); }
  const byName = new Map(pkg.images.map((i) => [i.name, i]));
  const used = new Set<string>();
  const STAND_IN = `/media/${TEMPLATE_MEDIA_OWNER}/00000000.webp`;
  const swap = (replace: (img: PackageImage) => string) => mapStrings(json, (s) => {
    const img = byName.get(refOf(s));
    if (img) { used.add(img.name); return replace(img); }
    if (LOOKS_LIKE_PICTURE.test(s)) fail(`theme.json refers to ${JSON.stringify(s.slice(0, 80))}, which is not in the zip. Add the picture or use an https:// address`);
    return s;
  });

  parseTemplateBundle(JSON.stringify(swap(() => STAND_IN))); // throws a message that names the bad part
  const refs = [...used];
  const stored: Record<string, string> = {};
  try {
    for (const name of refs) stored[name] = await pictures.save(byName.get(name)!.bytes, name);
  } catch (e) {
    if (pictures.discard) await Promise.all(Object.values(stored).map((u) => pictures.discard!(u).catch(() => undefined)));
    throw e;
  }
  const bundleText = JSON.stringify(swap((img) => stored[img.name]!));
  try { parseTemplateBundle(bundleText); } catch (e) {
    if (pictures.discard) await Promise.all(Object.values(stored).map((u) => pictures.discard!(u).catch(() => undefined)));
    throw e;
  }
  return { bundleText, used: refs, unused: pkg.images.filter((i) => !used.has(i.name)).map((i) => i.name), stored };
}

/** Uploads a zip theme package: checked, pictures stored, then imported exactly like a JSON template file. */
export async function importTemplatePackage(
  actor: PlatformActor, zip: Buffer, opts: { publish: boolean }, pictures: PictureStore, db: PrismaClient = getPlatformPrisma(),
): Promise<ImportedTemplate & { pictures: number; unused: string[] }> {
  assertPlatformCan(actor, "plans", "edit");
  const prepared = await prepareThemePackage(zip, pictures);
  try {
    const result = await importTemplateBundle(actor, prepared.bundleText, opts, db);
    return { ...result, pictures: prepared.used.length, unused: prepared.unused };
  } catch (e) {
    if (pictures.discard) await Promise.all(Object.values(prepared.stored).map((u) => pictures.discard!(u).catch(() => undefined)));
    throw e;
  }
}
