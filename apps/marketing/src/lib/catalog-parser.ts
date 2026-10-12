export type DetectedPlatform = "shopify" | "woocommerce" | "biztrackbd" | "generic";

export interface ParsedVariant {
  title: string;
  sku: string | null;
  price: number;
  compareAtPrice: number | null;
  stockQuantity: number;
  options: Record<string, string>;
  imageUrl: string | null;
}

export interface ParsedProduct {
  handle: string;
  title: string;
  descriptionHtml: string;
  categoryName: string | null;
  tags: string[];
  basePrice: number;
  compareAtPrice: number | null;
  status: "ACTIVE" | "DRAFT";
  imageUrls: string[];
  variants: ParsedVariant[];
}

export interface CatalogParseResult {
  platform: DetectedPlatform;
  totalProducts: number;
  totalVariants: number;
  totalImages: number;
  categories: string[];
  products: ParsedProduct[];
  estimatedAnnualSavingsBdt: number;
  errors: { line: number; message: string }[];
}

const headerKey = (h: string) => h.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

const BN = "০১২৩৪৫৬৭৮৯";
function parseMoney(raw: string | undefined): number | null {
  if (raw == null) return null;
  let s = raw.trim().replace(/[০-৯]/g, (d) => String(BN.indexOf(d)));
  if (s === "" || s === "-") return null;
  const negative = /^\(.*\)$/.test(s) || s.startsWith("-");
  s = s.replace(/[^\d.]/g, "");
  if (s === "" || s === ".") return null;
  const n = Number(s);
  return Number.isFinite(n) ? (negative ? -n : n) : null;
}

function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

export function detectPlatformFormat(headers: string[]): DetectedPlatform {
  const norm = new Set(headers.map(headerKey));
  if (norm.has("handle") && (norm.has("option1name") || norm.has("option1value") || norm.has("imagesrc") || norm.has("variantprice"))) {
    return "shopify";
  }
  if ((norm.has("regularprice") || norm.has("saleprice")) && (norm.has("categories") || norm.has("images") || norm.has("shortdescription"))) {
    return "woocommerce";
  }
  if (norm.has("title") && norm.has("price") && (norm.has("stock") || norm.has("sku") || norm.has("category"))) {
    return "biztrackbd";
  }
  return "generic";
}

export function parseCatalogCsv(csvContent: string): CatalogParseResult {
  const rows = parseCsv(csvContent.replace(/^\uFEFF/, "")).filter((r) => r.some((c) => c.trim() !== ""));
  if (rows.length < 2) {
    return {
      platform: "generic",
      totalProducts: 0,
      totalVariants: 0,
      totalImages: 0,
      categories: [],
      products: [],
      estimatedAnnualSavingsBdt: 0,
      errors: [{ line: 1, message: "File contains no rows or missing header row." }],
    };
  }

  const rawHeaders = rows[0]!;
  const platform = detectPlatformFormat(rawHeaders);
  const head = rawHeaders.map(headerKey);
  const col = (...names: string[]) => head.findIndex((h) => names.includes(h));
  const body = rows.slice(1);

  let result: CatalogParseResult;
  if (platform === "shopify") {
    result = parseShopify(body, col);
  } else if (platform === "woocommerce") {
    result = parseWooCommerce(body, col);
  } else {
    result = parseStandard(body, col, platform);
  }

  // Estimated annual savings calculation
  // Shopify Basic $39/mo (~৳ 58,000/yr) + Shopify 2% transaction fee on avg 150 orders/mo @ ৳1500 (~৳ 54,000/yr) + Apps (~৳ 30,000/yr)
  // vs BizTrackBD Pro (৳ 8,388/yr) = ৳ 133,600+ net savings
  const estShopifyAnnual = 58000 + 54000 + 25000;
  const biztrackAnnual = 8388;
  result.estimatedAnnualSavingsBdt = Math.max(75000, estShopifyAnnual - biztrackAnnual);

  return result;
}

function parseShopify(body: string[][], col: (...names: string[]) => number): CatalogParseResult {
  const ix = {
    handle: col("handle"),
    title: col("title", "productname"),
    bodyHtml: col("bodyhtml", "description"),
    vendor: col("vendor"),
    category: col("productcategory", "type"),
    tags: col("tags"),
    published: col("published"),
    status: col("status"),
    opt1Name: col("option1name"),
    opt1Val: col("option1value"),
    opt2Name: col("option2name"),
    opt2Val: col("option2value"),
    opt3Name: col("option3name"),
    opt3Val: col("option3value"),
    sku: col("variantsku", "sku"),
    stock: col("variantinventoryqty", "stock", "quantity"),
    price: col("variantprice", "price"),
    comparePrice: col("variantcompareatprice", "compareatprice"),
    imageSrc: col("imagesrc", "imageurl", "image"),
  };

  const productMap = new Map<string, ParsedProduct>();
  const productOrder: string[] = [];
  const errors: { line: number; message: string }[] = [];

  for (let i = 0; i < body.length; i++) {
    const r = body[i]!;
    const line = i + 2;
    const at = (idx: number) => (idx >= 0 ? (r[idx] ?? "").trim() : "");

    const handle = at(ix.handle) || (at(ix.title) ? at(ix.title).toLowerCase().replace(/[^a-z0-9]+/g, "-") : "");
    if (!handle) continue;

    let p = productMap.get(handle);
    const rowTitle = at(ix.title);
    const rowBody = at(ix.bodyHtml);
    const rowCategory = at(ix.category);
    const rowTags = at(ix.tags) ? at(ix.tags).split(",").map((t) => t.trim()).filter(Boolean) : [];
    const rowImage = at(ix.imageSrc);

    if (!p) {
      if (!rowTitle) {
        continue;
      }
      p = {
        handle,
        title: rowTitle,
        descriptionHtml: rowBody,
        categoryName: rowCategory || null,
        tags: rowTags,
        basePrice: 0,
        compareAtPrice: null,
        status: at(ix.status).toLowerCase() === "draft" || at(ix.published).toLowerCase() === "false" ? "DRAFT" : "ACTIVE",
        imageUrls: [],
        variants: [],
      };
      productMap.set(handle, p);
      productOrder.push(handle);
    } else {
      if (rowCategory && !p.categoryName) p.categoryName = rowCategory;
      if (rowTags.length > 0 && p.tags.length === 0) p.tags = rowTags;
      if (rowBody && !p.descriptionHtml) p.descriptionHtml = rowBody;
    }

    if (rowImage && !p.imageUrls.includes(rowImage)) {
      p.imageUrls.push(rowImage);
    }

    const priceRaw = parseMoney(at(ix.price));
    if (priceRaw != null && priceRaw > 0) {
      const compareRaw = parseMoney(at(ix.comparePrice));
      const stockRaw = at(ix.stock);
      const stock = stockRaw === "" ? 10 : Math.max(0, parseInt(stockRaw, 10) || 0);

      const options: Record<string, string> = {};
      const opt1Name = at(ix.opt1Name) || "Option 1";
      const opt1Val = at(ix.opt1Val);
      if (opt1Val && opt1Val.toLowerCase() !== "default title") options[opt1Name] = opt1Val;

      const opt2Name = at(ix.opt2Name) || "Option 2";
      const opt2Val = at(ix.opt2Val);
      if (opt2Val) options[opt2Name] = opt2Val;

      const opt3Name = at(ix.opt3Name) || "Option 3";
      const opt3Val = at(ix.opt3Val);
      if (opt3Val) options[opt3Name] = opt3Val;

      const optParts = Object.values(options);
      const varTitle = optParts.length > 0 ? optParts.join(" / ") : "Default";

      p.variants.push({
        title: varTitle,
        sku: at(ix.sku) || null,
        price: priceRaw,
        compareAtPrice: compareRaw && compareRaw > priceRaw ? compareRaw : null,
        stockQuantity: stock,
        options,
        imageUrl: rowImage || null,
      });

      if (p.basePrice === 0 || priceRaw < p.basePrice) {
        p.basePrice = priceRaw;
        p.compareAtPrice = compareRaw && compareRaw > priceRaw ? compareRaw : p.compareAtPrice;
      }
    }
  }

  const products = productOrder.map((h) => {
    const prod = productMap.get(h)!;
    if (prod.variants.length === 0) {
      prod.variants.push({
        title: "Default",
        sku: null,
        price: prod.basePrice || 100,
        compareAtPrice: prod.compareAtPrice,
        stockQuantity: 10,
        options: {},
        imageUrl: prod.imageUrls[0] || null,
      });
    }
    return prod;
  });

  const categories = [...new Set(products.map((p) => p.categoryName).filter((c): c is string => Boolean(c)))];
  return {
    platform: "shopify",
    totalProducts: products.length,
    totalVariants: products.reduce((acc, p) => acc + p.variants.length, 0),
    totalImages: products.reduce((acc, p) => acc + p.imageUrls.length, 0),
    categories,
    products,
    estimatedAnnualSavingsBdt: 0,
    errors,
  };
}

function parseWooCommerce(body: string[][], col: (...names: string[]) => number): CatalogParseResult {
  const ix = {
    title: col("name", "title", "productname"),
    sku: col("sku"),
    regularPrice: col("regularprice", "price"),
    salePrice: col("saleprice"),
    stock: col("stock", "stockquantity"),
    categories: col("categories", "category"),
    images: col("images", "image"),
    shortDesc: col("shortdescription"),
    description: col("description"),
    published: col("published"),
  };

  const products: ParsedProduct[] = [];
  const errors: { line: number; message: string }[] = [];

  for (let i = 0; i < body.length; i++) {
    const r = body[i]!;
    const line = i + 2;
    const at = (idx: number) => (idx >= 0 ? (r[idx] ?? "").trim() : "");

    const title = at(ix.title);
    if (!title) continue;

    const regular = parseMoney(at(ix.regularPrice));
    const sale = parseMoney(at(ix.salePrice));
    const price = (sale != null && sale > 0) ? sale : (regular != null && regular > 0 ? regular : null);

    if (price == null || price <= 0) {
      errors.push({ line, message: `Product "${title}" has no valid price.` });
      continue;
    }

    const compareAt = (sale != null && sale > 0 && regular != null && regular > sale) ? regular : null;
    const stockRaw = at(ix.stock);
    const stock = stockRaw === "" ? 10 : Math.max(0, parseInt(stockRaw, 10) || 0);

    const rawCats = at(ix.categories);
    const categoryName = rawCats ? rawCats.split(",")[0]?.split(">").pop()?.trim() || null : null;

    const rawImages = at(ix.images);
    const imageUrls = rawImages ? rawImages.split(",").map((s) => s.trim()).filter((s) => s.startsWith("http")) : [];

    const handle = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const desc = at(ix.description) || at(ix.shortDesc) || "";

    products.push({
      handle: handle || `product-${line}`,
      title,
      descriptionHtml: desc.startsWith("<") ? desc : `<p>${desc}</p>`,
      categoryName,
      tags: [],
      basePrice: price,
      compareAtPrice: compareAt,
      status: at(ix.published) === "0" || at(ix.published).toLowerCase() === "draft" ? "DRAFT" : "ACTIVE",
      imageUrls,
      variants: [{
        title: "Default",
        sku: at(ix.sku) || null,
        price,
        compareAtPrice: compareAt,
        stockQuantity: stock,
        options: {},
        imageUrl: imageUrls[0] || null,
      }],
    });
  }

  const categories = [...new Set(products.map((p) => p.categoryName).filter((c): c is string => Boolean(c)))];
  return {
    platform: "woocommerce",
    totalProducts: products.length,
    totalVariants: products.reduce((acc, p) => acc + p.variants.length, 0),
    totalImages: products.reduce((acc, p) => acc + p.imageUrls.length, 0),
    categories,
    products,
    estimatedAnnualSavingsBdt: 0,
    errors,
  };
}

function parseStandard(body: string[][], col: (...names: string[]) => number, platform: DetectedPlatform): CatalogParseResult {
  const ix = {
    title: col("title", "name", "productname"),
    price: col("price", "baseprice", "amount"),
    stock: col("stock", "quantity", "qty"),
    sku: col("sku"),
    status: col("status"),
    category: col("category", "categories"),
    desc: col("description", "details", "body"),
    compare: col("compareatprice", "compareat", "mrp"),
    images: col("images", "image", "photos"),
  };

  const products: ParsedProduct[] = [];
  const errors: { line: number; message: string }[] = [];

  for (let i = 0; i < body.length; i++) {
    const r = body[i]!;
    const line = i + 2;
    const at = (idx: number) => (idx >= 0 ? (r[idx] ?? "").trim() : "");

    const title = at(ix.title);
    if (!title) continue;

    const price = parseMoney(at(ix.price));
    if (price == null || price <= 0) {
      errors.push({ line, message: `Product "${title}" line ${line} has no valid price.` });
      continue;
    }

    const compare = parseMoney(at(ix.compare));
    const stockRaw = at(ix.stock);
    const stock = stockRaw === "" ? 10 : Math.max(0, parseInt(stockRaw, 10) || 0);
    const category = at(ix.category) || null;
    const desc = at(ix.desc);
    const rawImages = at(ix.images);
    const imageUrls = rawImages ? rawImages.split(",").map((u) => u.trim()).filter((u) => u.startsWith("http")) : [];

    const handle = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

    products.push({
      handle: handle || `product-${line}`,
      title,
      descriptionHtml: desc ? (desc.startsWith("<") ? desc : `<p>${desc}</p>`) : "",
      categoryName: category,
      tags: [],
      basePrice: price,
      compareAtPrice: compare && compare > price ? compare : null,
      status: at(ix.status).toLowerCase() === "draft" ? "DRAFT" : "ACTIVE",
      imageUrls,
      variants: [{
        title: "Default",
        sku: at(ix.sku) || null,
        price,
        compareAtPrice: compare && compare > price ? compare : null,
        stockQuantity: stock,
        options: {},
        imageUrl: imageUrls[0] || null,
      }],
    });
  }

  const categories = [...new Set(products.map((p) => p.categoryName).filter((c): c is string => Boolean(c)))];
  return {
    platform,
    totalProducts: products.length,
    totalVariants: products.reduce((acc, p) => acc + p.variants.length, 0),
    totalImages: products.reduce((acc, p) => acc + p.imageUrls.length, 0),
    categories,
    products,
    estimatedAnnualSavingsBdt: 0,
    errors,
  };
}
