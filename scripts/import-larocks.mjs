#!/usr/bin/env node
/**
 * Import the La Rock's balloon listing (saved "Webpage, Complete" pages from
 * https://larocks.com/balloons-s/1923.htm with the 160/260/350-360/660 size
 * filters) into src/data/balloonCatalog.json.
 *
 *   node scripts/import-larocks.mjs <dir-with-saved-html-pages> [--out src/data/balloonCatalog.json]
 *
 * The store sits behind a bot wall, so the pages are saved from a browser and
 * fed to this script. It reads BigCommerce product cards: title, brand, SKU,
 * price, product URL and image, and derives size, finish, color and pack size
 * from the title ("260Q Fashion Lime Green Balloon Qualatex 100ct").
 */
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--"));
const outIdx = args.indexOf("--out");
const outPath = outIdx >= 0 ? args[outIdx + 1] : "src/data/balloonCatalog.json";
if (!dir) {
  console.error("usage: node scripts/import-larocks.mjs <dir-with-saved-html> [--out file]");
  process.exit(1);
}

const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/* ---------- title parsing ---------- */

const FINISH_WORDS = [
  "Deluxe",
  "Fashion",
  "Neon",
  "Pastel Dusk",
  "Pastel",
  "Metallic",
  "Chrome",
  "Mirror",
  "Macaron",
  "Jewel",
  "Standard",
  "Pearl",
  "Crystal",
  "Reflex",
  "Satin",
  "Retro",
  "Matte",
  "Glitter",
  "Link-O-Loon",
  "Assortment",
  "Classic",
];
const NOISE_WORDS = ["Nozzle Up", "Balloons", "Balloon", "Pak", "Bag", "of"];

const COLOR_FAMILIES = [
  [/\b(orange|mandarin|tangerine|coral|peach|apricot|sunset|salmon)\b/i, "orange", "#EA580C"],
  [/\b(red|ruby|crimson|cherry|scarlet|cranberry|raspberry|wine|burgundy|maroon)\b/i, "red", "#E11D48"],
  [/\b(yellow|canary|lemon|gold|goldenrod|mustard|butter|honey)\b/i, "yellow", "#FACC15"],
  [/\b(lime|emerald|green|mint|teal|jade|forest|olive|sage|kiwi|apple|tea)\b/i, "green", "#16A34A"],
  [/\b(blue|sapphire|royal|navy|turquoise|periwinkle|sky|caribbean|aqua|robins|monet|denim|twilight)\b/i, "blue", "#2563EB"],
  [/\b(purple|violet|lavender|lilac|quartz|plum|grape|amethyst|eggplant)\b/i, "purple", "#7C3AED"],
  [/\b(pink|magenta|rose|fuchsia|blush|bubble gum|flamingo|hot pink|cameo rose)\b/i, "pink", "#DB2777"],
  [/\b(white|snow|ivory|sand|cream|vanilla|clear|diamond)\b/i, "white", "#F8FAFC"],
  [/\b(black|onyx|jet)\b/i, "black", "#1E293B"],
  [/\b(brown|chocolate|mocha|tan|latte|coffee|caramel|cocoa|toffee|cameo brown|camel)\b/i, "brown", "#78350F"],
  [/\b(silver|grey|gray|graphite|slate|smoke|stone|storm)\b/i, "silver", "#94A3B8"],
  [/\b(berry|cerise|garnet|rosewood)\b/i, "red", "#BE123C"],
  [/\b(champagne|amber|copper|hazelnut)\b/i, "yellow", "#D97706"],
  [/\b(azure|sea glass)\b/i, "blue", "#38BDF8"],
  [/\b(mauve)\b/i, "purple", "#9F7AEA"],
  [/\b(melon|mango)\b/i, "orange", "#FB923C"],
  [/\b(merlot)\b/i, "red", "#7F1D1D"],
  [/\b(cashmere|cameo|truffle|neutral|lace)\b/i, "brown", "#C4A484"],
  [/\b(eucalyptus)\b/i, "green", "#6B9080"],
  [/\b(assorted|assortment|mix|mixed|rainbow|circus|carnival|character|vibrant|special|colors vary)\b/i, "assorted", "#A3A3A3"],
];

/** Closer swatches for the most common names; the family hex is the fallback. */
const EXACT_HEX = {
  orange: "#F97316", red: "#DC2626", yellow: "#FACC15", lime: "#A3E635", "lime green": "#84CC16",
  "apple green": "#65A30D", green: "#16A34A", "emerald green": "#059669", "forest green": "#166534",
  mint: "#6EE7B7", "mint green": "#6EE7B7", teal: "#0D9488", turquoise: "#14B8A6", aqua: "#22D3EE",
  "caribbean blue": "#0EA5E9", "robins egg blue": "#7DD3FC", "pale blue": "#93C5FD", "sky blue": "#38BDF8",
  blue: "#2563EB", "royal blue": "#1D4ED8", "dark blue": "#1E3A8A", navy: "#1E3A8A", "sapphire blue": "#1D4ED8",
  purple: "#7C3AED", violet: "#8B5CF6", lilac: "#C4B5FD", lavender: "#C4B5FD", "spring lilac": "#C4B5FD",
  plum: "#6B21A8", "plum purple": "#6B21A8", "quartz purple": "#7E22CE", grape: "#6D28D9",
  pink: "#EC4899", "hot pink": "#DB2777", "bubble gum pink": "#F472B6", magenta: "#D946EF", fuchsia: "#C026D3",
  blush: "#FBCFE8", "creamy blush": "#FCE7F3", rose: "#F43F5E", "wild raspberry": "#BE185D", cranberry: "#9F1239",
  white: "#F8FAFC", "white sand": "#F5F5F4", clear: "#E2E8F0", "crystal clear": "#E2E8F0", "diamond clear": "#E2E8F0",
  ivory: "#FEF3C7", black: "#111827", onyx: "#111827", brown: "#78350F", chocolate: "#5B2C0A", mocha: "#6B4423",
  "mocha brown": "#6B4423", latte: "#C8A27A", coffee: "#6F4E37", "cameo brown": "#A0785A", tan: "#D2B48C",
  silver: "#A1A1AA", gold: "#EAB308", "chrome gold": "#EAB308", "chrome silver": "#A1A1AA", "rose gold": "#F4A6A6",
  copper: "#B45309", champagne: "#F1E2B3", peach: "#FDBA74", coral: "#FB7185", mauve: "#B07CC6", merlot: "#7F1D1D",
  gray: "#9CA3AF", grey: "#9CA3AF",
};

function colorFamily(color) {
  const exact = EXACT_HEX[color.toLowerCase()];
  for (const [re, fam, hex] of COLOR_FAMILIES) if (re.test(color)) return { family: fam, hex: exact ?? hex };
  return { family: undefined, hex: exact ?? "#64748B" };
}

function parseTitle(title, brand) {
  const m = /^(\d{3})\s*([A-Z]*)(?:-Pak)?\b\s*(.*)$/i.exec(title);
  if (!m) return null;
  let size = m[1];
  if (size === "350") size = "350";
  let rest = m[3];
  const pack = /(\d+)\s*ct\b/i.exec(rest);
  const packQty = pack ? parseInt(pack[1], 10) : null;
  rest = rest.replace(/\d+\s*ct\b/i, "");
  rest = rest.replace(new RegExp(`\\b${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"), "");
  const finishes = [];
  for (const w of FINISH_WORDS) {
    const re = new RegExp(`\\b${w.replace(/[-]/g, "\\-")}\\b`, "i");
    if (re.test(rest)) {
      finishes.push(w);
      rest = rest.replace(re, "");
    }
  }
  const styles = [];
  for (const w of NOISE_WORDS) {
    const re = new RegExp(`\\b${w}\\b`, "i");
    if (re.test(rest)) {
      if (w === "Nozzle Up") styles.push("nozzle-up");
      rest = rest.replace(re, "");
    }
  }
  const color = rest.replace(/\s+/g, " ").replace(/^[\s\-–]+|[\s\-–]+$/g, "").trim();
  const finish = finishes.length ? finishes.join(" ").toLowerCase() : "standard";
  return { size, color: color || "Assorted", finish, styles, packQty };
}

/* ---------- card parsing ---------- */

function parseCards(htmlText) {
  const cards = htmlText.split('class="productCard productCard--list"').slice(1);
  const items = [];
  for (const c of cards) {
    const title = decode((/<h4 class="card-title">\s*<a[^>]*>([\s\S]*?)<\/a>/.exec(c) || [])[1] || "");
    const url = (/<h4 class="card-title">\s*<a href="([^"]+)"/.exec(c) || [])[1] || "";
    const brand = decode((/card-text--brand"[^>]*>([\s\S]*?)<\/p>/.exec(c) || [])[1] || "");
    const sku = decode((/card-text--sku"[^>]*>\s*SKU:\s*([\s\S]*?)<\/p>/.exec(c) || [])[1] || "");
    const priceStr = (/price price--withoutTax price-primary"[^>]*>\s*\$?([\d,]+\.\d{2})/.exec(c) || [])[1];
    const productId = (/data-product-id="(\d+)"/.exec(c) || [])[1] || "";
    const img = (/srcset="(https:[^\s"]+)\s+80w/.exec(c) || [])[1] || "";
    if (!title || !priceStr) continue;
    items.push({ title, url, brand, sku, price: parseFloat(priceStr.replace(/,/g, "")), productId, img });
  }
  return items;
}

const files = fs
  .readdirSync(dir)
  .filter((f) => /\.html?$/i.test(f))
  .map((f) => path.join(dir, f));
if (files.length === 0) {
  console.error(`no .html files in ${dir}`);
  process.exit(1);
}

const seen = new Map();
let skipped = 0;
const unparsed = [];
for (const f of files) {
  const text = fs.readFileSync(f, "utf8");
  for (const raw of parseCards(text)) {
    const key = raw.productId || raw.sku || raw.url;
    if (seen.has(key)) continue;
    const parsed = parseTitle(raw.title, raw.brand);
    if (!parsed) {
      unparsed.push(raw.title);
      continue;
    }
    if (!parsed.packQty) {
      skipped += 1;
      unparsed.push(`${raw.title} (no pack count)`);
      continue;
    }
    const { family, hex } = colorFamily(parsed.color);
    seen.set(key, {
      id: `lr-${raw.productId || raw.sku}`,
      name: raw.title,
      brand: raw.brand,
      size: parsed.size,
      color: parsed.color,
      colorFamily: family,
      finish: parsed.finish,
      styles: parsed.styles,
      packQty: parsed.packQty,
      price: raw.price,
      pricePerBalloon: Math.round((raw.price / parsed.packQty) * 10000) / 10000,
      sku: raw.sku,
      url: raw.url,
      image: raw.img || undefined,
      hex,
    });
  }
}

const items = Array.from(seen.values()).sort(
  (a, b) => a.size.localeCompare(b.size) || a.brand.localeCompare(b.brand) || a.color.localeCompare(b.color)
);

const newest = files.map((f) => fs.statSync(f).mtime).sort((a, b) => b - a)[0];
const catalog = {
  source: "larocks.com",
  sourceUrl: "https://larocks.com/balloons-s/1923.htm",
  fetchedAt: newest.toISOString().slice(0, 10),
  currency: "USD",
  sample: false,
  items,
};
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(catalog, null, 2) + "\n");

const bySize = {};
items.forEach((i) => (bySize[i.size] = (bySize[i.size] || 0) + 1));
console.log(`wrote ${items.length} packs to ${outPath} from ${files.length} page(s)`);
console.log("by size:", bySize);
console.log("brands:", Array.from(new Set(items.map((i) => i.brand))).join(", "));
if (unparsed.length) console.log(`skipped ${unparsed.length}:`, unparsed.join(" | "));
