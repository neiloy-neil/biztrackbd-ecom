import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deflateRawSync } from "node:zlib";
import { createBaseClient, setBasePrisma, setPlatformPrisma, type PrismaClient } from "@biztrackbd/db";
import { createOwnerClient, resetDatabase, seedPlans, testUrls } from "@biztrackbd/db/testing";
import {
  DomainError, MAX_TEMPLATE_ZIP_BYTES, MAX_ZIP_ENTRIES, MAX_ZIP_IMAGE_BYTES, crc32, getTemplate, templateToFile, importTemplatePackage, listThemeStore, prepareThemePackage, readThemeZip, signupStore, sniffImage,
  type PictureStore, type PlatformActor, type StaffActor,
} from "../src";

// ---- A tiny zip writer, so the tests can build good and hostile archives byte by byte ----------------------------------------------

interface Item { name: string; data: Buffer | string; method?: 0 | 8; flags?: number; claimSize?: number; claimCrc?: number; rawData?: Buffer }

function zip(items: Item[], opts: { overlapSecond?: boolean } = {}): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [idx, it] of items.entries()) {
    const data = Buffer.isBuffer(it.data) ? it.data : Buffer.from(it.data);
    const method = it.method ?? 8;
    const stored = it.rawData ?? (method === 8 ? deflateRawSync(data) : data);
    const name = Buffer.from(it.name, "latin1");
    const crc = it.claimCrc ?? crc32(data);
    const usize = it.claimSize ?? data.length;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(it.flags ?? 0, 6); local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(stored.length, 18); local.writeUInt32LE(usize, 22); local.writeUInt16LE(name.length, 26);
    // For the overlap case the second entry points back at the first one's bytes.
    const entryOffset = opts.overlapSecond && idx === 1 ? 0 : offset;
    parts.push(local, name, stored);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(it.flags ?? 0, 8); cen.writeUInt16LE(method, 10);
    cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(stored.length, 20); cen.writeUInt32LE(usize, 24); cen.writeUInt16LE(name.length, 28); cen.writeUInt32LE(entryOffset, 42);
    central.push(cen, name);
    offset += local.length + name.length + stored.length;
  }
  const cd = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(items.length, 8); eocd.writeUInt16LE(items.length, 10); eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, eocd]);
}

// Real file signatures with filler: enough for the magic-byte check (the media layer decodes the real picture when it stores it).
const png = (n = 64) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(n, 7)]);
const jpg = (n = 64) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(n, 7)]);
const webp = (n = 64) => Buffer.concat([Buffer.from("RIFF"), Buffer.from([n & 255, 0, 0, 0]), Buffer.from("WEBP"), Buffer.alloc(n, 7)]);
const avif = () => Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypavif"), Buffer.from([0, 0, 0, 0]), Buffer.from("avifmif1")]);

/** A real template file (the built-in kapor, under another id), as the JSON text a package carries. `mutate` edits it before it is written. */
async function goodJson(over: Record<string, unknown> = {}, mutate?: (file: { pages: { home: { sections: { type: string; settings: Record<string, unknown> }[] } } }) => void) {
  const t = await getTemplate("kapor");
  const file = JSON.parse(templateToFile(t!)) as Record<string, unknown> & { pages: { home: { sections: { type: string; settings: Record<string, unknown> }[] } } };
  Object.assign(file, { id: "zip-theme", name: "Zip theme", blurb: "From a zip", audience: "Everyone", category: "other", tags: [], previews: {} });
  mutate?.(file);
  return JSON.stringify({ ...file, ...over });
}

// Tiny real pictures made by sharp (8x8): the magic-byte check must accept what real encoders write, not only my hand-made headers.
const REAL = {
  "png": "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWM4uX0OVsQwtCQAyxSHAdaR1zkAAAAASUVORK5CYII=",
  "jpg": "/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCmAJhr/9k=",
  "webp": "UklGRjAAAABXRUJQVlA4ICQAAABQAQCdASoIAAgAAUAmJQBOgCgAAP7zS5eIunvAIZwJK1ZhAAA=",
  "avif": "AAAAHGZ0eXBhdmlmAAAAAG1pZjFhdmlmbWlhZgAAANZtZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAACJpbG9jAAAAAERAAAEAAQAAAAAA+gABAAAAAAAAACUAAAAjaWluZgAAAAAAAQAAABVpbmZlAgAAAAABAABhdjAxAAAAAA5waXRtAAAAAAABAAAAVmlwcnAAAAA4aXBjbwAAAAxhdjFDgSACAAAAABRpc3BlAAAAAAAAAAgAAAAIAAAAEHBpeGkAAAAAAwgICAAAABZpcG1hAAAAAAAAAAEAAQOBAgMAAAAtbWRhdBIACgg4CL9pAQ0GkDIXGUJjBMPPPPNBIACQQRnsduECQZdGa8A="
};

const fails = (fn: () => unknown, msg: RegExp) => {
  let err: unknown = null;
  try { fn(); } catch (e) { err = e; }
  expect(err).toBeInstanceOf(DomainError);
  expect((err as DomainError).message).toMatch(msg);
};

describe("reading a theme package (no database)", () => {
  const ok = (extra: Item[] = []) => zip([{ name: "theme.json", data: "{}" }, { name: "images/a.png", data: png() }, ...extra]);

  it("opens a good package: theme.json and pictures of the four types, deflated or stored", () => {
    const r = readThemeZip(zip([
      { name: "theme.json", data: '{"a":1}' }, { name: "images/a.png", data: png(), method: 0 }, { name: "images/b.jpg", data: jpg() }, { name: "c.jpeg", data: jpg() },
      { name: "images/d.webp", data: webp() }, { name: "images/e.avif", data: avif() },
    ]));
    expect(r.themeJson).toBe('{"a":1}');
    expect(r.images.map((i) => `${i.name}:${i.kind}`).sort()).toEqual(["c.jpeg:jpeg", "images/a.png:png", "images/b.jpg:jpeg", "images/d.webp:webp", "images/e.avif:avif"]);
  });

  it("accepts real pictures written by an image encoder", () => {
    expect(sniffImage(Buffer.from(REAL.png, "base64"))).toBe("png");
    expect(sniffImage(Buffer.from(REAL.jpg, "base64"))).toBe("jpeg");
    expect(sniffImage(Buffer.from(REAL.webp, "base64"))).toBe("webp");
    expect(sniffImage(Buffer.from(REAL.avif, "base64"))).toBe("avif");
  });

  it("ignores the junk Finder and Explorer add, without reading it", () => {
    const r = readThemeZip(zip([{ name: "theme.json", data: "{}" }, { name: "__MACOSX/._theme.json", data: "junk" }, { name: ".DS_Store", data: "junk" }, { name: "images/", data: "" }, { name: "images/a.png", data: png() }]));
    expect(r.images).toHaveLength(1);
  });

  it("refuses a file that is not a zip, an empty zip and a zip with no theme.json", () => {
    fails(() => readThemeZip(Buffer.from("not a zip at all, just text")), /not a zip/);
    fails(() => readThemeZip(Buffer.alloc(0)), /empty/);
    fails(() => readThemeZip(zip([{ name: "images/a.png", data: png() }])), /theme\.json is missing/);
    fails(() => readThemeZip(zip([{ name: "pack/theme.json", data: "{}" }])), /at the top of the zip/);
  });

  it("refuses names that climb out, start at the root, use backslashes or drive letters, or hide", () => {
    for (const name of ["../evil.png", "images/../../evil.png", "/etc/evil.png", "C:/evil.png", "images\\evil.png", ".hidden.png", "images/./a.png", "a b.png", "images//a.png", "im\u00e9.png"]) {
      fails(() => readThemeZip(ok([{ name, data: png() }])), /name|path|backslash|hidden|characters|absolute|climbs/);
    }
  });

  it("allows only theme.json and the four picture types: no SVG, no archive inside, no other file", () => {
    fails(() => readThemeZip(ok([{ name: "images/logo.svg", data: "<svg onload='alert(1)'/>" }])), /SVG/);
    fails(() => readThemeZip(ok([{ name: "more.zip", data: png() }])), /archive inside the archive/);
    fails(() => readThemeZip(ok([{ name: "a.tar", data: "x" }])), /archive inside the archive/);
    fails(() => readThemeZip(ok([{ name: "x.js", data: "alert(1)" }])), /not allowed/);
    fails(() => readThemeZip(ok([{ name: "index.html", data: "<script>" }])), /not allowed/);
    fails(() => readThemeZip(ok([{ name: "images/a.gif", data: "GIF89a" }])), /not allowed/);
    fails(() => readThemeZip(ok([{ name: "noextension", data: png() }])), /not allowed/);
  });

  it("checks a picture's first bytes, so a renamed file or a zip dressed up as a picture is refused", () => {
    fails(() => readThemeZip(ok([{ name: "images/b.png", data: "<html>not a picture</html>" }])), /not a real/);
    fails(() => readThemeZip(ok([{ name: "images/b.png", data: zip([{ name: "x.txt", data: "hi" }]) }])), /not a real/);
    fails(() => readThemeZip(ok([{ name: "images/b.png", data: jpg() }])), /wrong file ending/);
    fails(() => readThemeZip(ok([{ name: "images/b.jpg", data: png() }])), /wrong file ending/);
    fails(() => readThemeZip(ok([{ name: "images/b.webp", data: Buffer.from("RIFF....WAVE") }])), /not a real/);
    expect(sniffImage(avif())).toBe("avif");
    expect(sniffImage(Buffer.from("GIF89a......"))).toBeNull();
  });

  it("caps the zip, the entry count, each picture, theme.json and the total", () => {
    fails(() => readThemeZip(Buffer.alloc(MAX_TEMPLATE_ZIP_BYTES + 1, 1)), /too large/);
    fails(() => readThemeZip(zip([{ name: "theme.json", data: "{}" }, ...Array.from({ length: MAX_ZIP_ENTRIES }, (_, i) => ({ name: `i/${i}.png`, data: png() }))])), /too many files/);
    fails(() => readThemeZip(ok([{ name: "images/big.png", data: png(MAX_ZIP_IMAGE_BYTES + 1) }])), /too large/);
    fails(() => readThemeZip(zip([{ name: "theme.json", data: "x".repeat(1_000_001) }])), /too large/);
    // Eight 2 MB pictures that each pass, but together unpack past the total.
    const many = Array.from({ length: 9 }, (_, i) => ({ name: `i/${i}.png`, data: png(MAX_ZIP_IMAGE_BYTES - 10) }));
    fails(() => readThemeZip(zip([{ name: "theme.json", data: "{}" }, ...many])), /unpacks to more than/);
  });

  it("stops a zip bomb: a file whose header lies about its size is cut off, not unpacked", () => {
    const bomb = Buffer.alloc(30_000_000, 0);
    const squashed = deflateRawSync(bomb);
    expect(squashed.length).toBeLessThan(40_000);
    // The header says the picture is 64 bytes; the data inflates to 30 MB.
    fails(() => readThemeZip(ok([{ name: "images/bomb.png", data: Buffer.alloc(64), rawData: squashed, claimSize: 64, claimCrc: 0 }])), /damaged or unpacks to more than/);
    // The honest header of the same data is refused by the size cap before anything is unpacked.
    fails(() => readThemeZip(ok([{ name: "images/bomb.png", data: bomb, rawData: squashed }])), /too large/);
  });

  it("refuses damaged data, a wrong checksum, encryption, odd compression and overlapping entries", () => {
    fails(() => readThemeZip(ok([{ name: "images/a2.png", data: png(), claimCrc: 123 }])), /checksum/);
    fails(() => readThemeZip(ok([{ name: "images/a2.png", data: png(), flags: 1 }])), /encrypted/);
    fails(() => readThemeZip(ok([{ name: "images/a2.png", data: png(), method: 0, rawData: Buffer.from("short") }])), /damaged/);
    fails(() => readThemeZip(ok([{ name: "images/lz.png", data: png(), method: 14 as never }])), /compression method/);
    fails(() => readThemeZip(zip([{ name: "theme.json", data: "{}" }, { name: "images/a.png", data: png() }], { overlapSecond: true })), /overlap|does not match|damaged/);
    fails(() => readThemeZip(ok([{ name: "images/a.png", data: png() }])), /appears twice/);
    fails(() => readThemeZip(ok([{ name: "IMAGES/A.PNG", data: png() }])), /appears twice/);
  });
});

describe("preparing a package: pictures named in theme.json", () => {
  const memory = () => {
    const saved: Record<string, Buffer> = {};
    const discarded: string[] = [];
    let n = 0;
    const store: PictureStore = {
      save: async (bytes) => { const url = `/media/platform-themes/pic${String(++n).padStart(8, "0")}.webp`; saved[url] = bytes; return url; },
      discard: async (url) => { discarded.push(url); delete saved[url]; },
    };
    return { store, saved, discarded };
  };

  beforeAll(() => { process.env.PHONE_TRUST_SALT = "test-salt-test-salt-test-salt-0001"; });

  it("swaps every reference for the stored address, in previews and in page pictures, and leaves unused pictures out", async () => {
    const m = memory();
    const json = await goodJson({ previews: { desktop: "images/desk.png", mobile: "./images/phone.jpg" } }, (f) => {
      const hero = f.pages.home.sections.find((x) => x.type === "hero")!;
      hero.settings.image = "images/hero.webp";
    });
    const r = await prepareThemePackage(zip([
      { name: "theme.json", data: json }, { name: "images/desk.png", data: png() }, { name: "images/phone.jpg", data: jpg() },
      { name: "images/hero.webp", data: webp() }, { name: "images/spare.png", data: png() },
    ]), m.store);
    const out = JSON.parse(r.bundleText) as { previews: { desktop: string; mobile: string }; pages: { home: { sections: { type: string; settings: { image: string } }[] } } };
    expect(out.previews.desktop).toMatch(/^\/media\/platform-themes\/pic\d{8}\.webp$/);
    expect(out.previews.mobile).toMatch(/^\/media\/platform-themes\//);
    expect(out.pages.home.sections.find((x) => x.type === "hero")!.settings.image).toMatch(/^\/media\/platform-themes\//);
    expect(r.bundleText).not.toContain("images/");
    expect(r.used.sort()).toEqual(["images/desk.png", "images/hero.webp", "images/phone.jpg"]);
    expect(r.unused).toEqual(["images/spare.png"]);
    expect(Object.keys(m.saved)).toHaveLength(3);
  });

  it("names the picture that is missing from the zip, and stores nothing", async () => {
    const m = memory();
    const e = await prepareThemePackage(zip([{ name: "theme.json", data: await goodJson({ previews: { desktop: "images/gone.png" } }) }]), m.store).then(() => null, (x) => x);
    expect(e).toBeInstanceOf(DomainError);
    expect((e as DomainError).message).toMatch(/images\/gone\.png.*not in the zip/);
    expect(Object.keys(m.saved)).toHaveLength(0);
  });

  it("checks theme.json before storing any picture, so a mistake leaves nothing behind", async () => {
    const m = memory();
    const json = await goodJson({ baseLook: "no-such-look", previews: { desktop: "images/a.png" } });
    await expect(prepareThemePackage(zip([{ name: "theme.json", data: json }, { name: "images/a.png", data: png() }]), m.store)).rejects.toThrow(/baseLook/);
    expect(Object.keys(m.saved)).toHaveLength(0);
    await expect(prepareThemePackage(zip([{ name: "theme.json", data: "{not json" }]), m.store)).rejects.toThrow(/not valid JSON/);
  });

  it("keeps the skin CSS rules: url() is still refused, even when it names a picture in the zip", async () => {
    const m = memory();
    const json = await goodJson({ skin: { css: ".hero { background: url(images/a.png); }" } });
    await expect(prepareThemePackage(zip([{ name: "theme.json", data: json }, { name: "images/a.png", data: png() }]), m.store)).rejects.toThrow(/url\(\)/);
    expect(Object.keys(m.saved)).toHaveLength(0);
    // Plain CSS in the package is fine.
    const fine = await goodJson({ skin: { css: ".hero { letter-spacing: 1px; }" } });
    expect((await prepareThemePackage(zip([{ name: "theme.json", data: fine }]), m.store)).bundleText).toContain("letter-spacing");
  });

  it("gives back the pictures it stored when saving one fails", async () => {
    const m = memory();
    let calls = 0;
    const flaky: PictureStore = { save: async (b, n) => { if (++calls === 2) throw new Error("storage down"); return m.store.save(b, n); }, discard: m.store.discard };
    const json = await goodJson({ previews: { desktop: "images/a.png", mobile: "images/b.png" } });
    await expect(prepareThemePackage(zip([{ name: "theme.json", data: json }, { name: "images/a.png", data: png() }, { name: "images/b.png", data: png(80) }]), flaky)).rejects.toThrow("storage down");
    expect(m.discarded).toHaveLength(1);
    expect(Object.keys(m.saved)).toHaveLength(0);
  });
});

// ---- Through the database: the package becomes a theme with its pictures on the card ---------------------------------------------

describe("importing a package", () => {
  let owner: PrismaClient;
  let app: PrismaClient;
  const boss: PlatformActor = { id: "pu-OWNER", email: "owner@biztrackbd.test", role: "OWNER" };
  let seq = 0;

  beforeAll(async () => {
    const urls = testUrls();
    await resetDatabase(urls.direct);
    owner = createOwnerClient(urls.direct);
    app = createBaseClient(urls.app, 10);
    setBasePrisma(app);
    setPlatformPrisma(owner);
    await seedPlans(owner);
  });
  afterAll(async () => { await app.$disconnect(); await owner.$disconnect(); });

  const pictures = (): PictureStore & { urls: string[] } => {
    const urls: string[] = [];
    return { urls, save: async () => { const u = `/media/platform-themes/up${String(++seq).padStart(8, "0")}.webp`; urls.push(u); return u; } };
  };

  it("saves the theme with its stored pictures, shows them on a store's Themes card, and JSON upload still works", async () => {
    const p = pictures();
    const json = await goodJson({ previews: { desktop: "images/desk.png" } });
    const r = await importTemplatePackage(boss, zip([{ name: "theme.json", data: json }, { name: "images/desk.png", data: png() }]), { publish: true }, p, owner);
    expect(r).toMatchObject({ created: true, pictures: 1, unused: [] });
    expect(r.template.previews?.desktop).toBe(p.urls[0]);
    expect((await owner.template.findUniqueOrThrow({ where: { id: "zip-theme" } })).status).toBe("PUBLISHED");
    expect((await owner.theme.findUniqueOrThrow({ where: { id: "zip-theme" } })).source).toBe("PACKAGE");

    const s = await signupStore({ ownerName: "Nusrat Jahan", email: "zip1@example.test", phone: "01955500001", storeName: "Zip store", subdomain: "zipstore1", plan: "STARTER", category: "FASHION" });
    const row = await owner.tenantUser.findFirstOrThrow({ where: { tenantId: s.tenantId } });
    const view = await listThemeStore(s.tenantId, { userId: row.id, email: row.email, name: row.name, role: "STORE_OWNER" } as StaffActor);
    expect(view.themes.find((t) => t.id === "zip-theme")).toMatchObject({ preview: p.urls[0], premium: false });
    expect(view.themes.find((t) => t.id === "bindu")!.preview).toBeNull();

    // The same file as plain JSON (with an https preview) still goes through the older route.
    const { importTemplateBundle } = await import("../src");
    const plain = await importTemplateBundle(boss, await goodJson({ id: "json-theme", previews: { desktop: "https://cdn.example.test/p.png" } }), { publish: true }, owner);
    expect(plain.template.previews?.desktop).toBe("https://cdn.example.test/p.png");
  });

  it("lets only staff who may edit import a package, and stores nothing for anyone else", async () => {
    let saves = 0;
    const p: PictureStore = { save: async () => { saves++; return "/media/platform-themes/xx000000.webp"; } };
    const json = await goodJson({ previews: { desktop: "images/a.png" } });
    await expect(importTemplatePackage({ id: "pu-S", email: "s@x.test", role: "SUPPORT" } as PlatformActor, zip([{ name: "theme.json", data: json }, { name: "images/a.png", data: png() }]), { publish: true }, p, owner)).rejects.toBeInstanceOf(DomainError);
    expect(saves).toBe(0);
  });
});
