/**
 * Shopping math for balloon recipes.
 *
 * A catalog item is one purchasable pack (brand + size + color + pack size +
 * price). A recipe is a list of (item, balloons needed per sculpture). From
 * those we derive the cost of one sculpture, and a pack plan: pick one item
 * and how many packs of it to buy, then how many packs of everything else are
 * needed to use it up, and how many sculptures that makes.
 */

export type BalloonSizeCode = "160" | "260" | "350" | "360" | "660" | string;

export interface CatalogItem {
  id: string;
  name: string;
  brand: string;
  size: BalloonSizeCode;
  color: string;
  /** Loose color family for matching design colors (e.g. "orange", "green") */
  colorFamily?: string;
  /** Finish or line, e.g. "standard", "jewel", "fashion", "neon", "chrome", "pearl" */
  finish?: string;
  /** Extra style tags from the listing, e.g. "nozzle-up" */
  styles?: string[];
  packQty: number;
  price: number;
  pricePerBalloon: number;
  sku?: string;
  url?: string;
  image?: string;
  /** Hex swatch for display when known */
  hex?: string;
}

export interface Catalog {
  source: string;
  sourceUrl?: string;
  fetchedAt: string;
  currency: string;
  /** True while the data is placeholder, not scraped from the store */
  sample?: boolean;
  items: CatalogItem[];
}

export interface RecipeLine {
  itemId: string;
  /** Balloons of this item used in one sculpture */
  qty: number;
}

export interface Recipe {
  id: string;
  name: string;
  lines: RecipeLine[];
  updatedAt: string;
}

export interface CostedLine {
  line: RecipeLine;
  item: CatalogItem | null;
  /** Cost of the balloons used by one sculpture, at the per-balloon price */
  balloonCost: number;
  /** Packs you must buy to make one sculpture, and what that costs */
  packsForOne: number;
  packCostForOne: number;
}

export interface RecipeCost {
  lines: CostedLine[];
  /** Pure per-balloon cost of one sculpture */
  perSculpture: number;
  /** Cost of buying the minimum packs that cover one sculpture */
  minimumPurchase: number;
  /** Sculptures you can make from that minimum purchase */
  sculpturesFromMinimum: number;
  missingItems: string[];
}

export const round2 = (v: number) => Math.round(v * 100) / 100;

export function pricePerBalloon(price: number, packQty: number): number {
  return packQty > 0 ? Math.round((price / packQty) * 10000) / 10000 : 0;
}

export function costRecipe(recipe: Recipe, catalog: Catalog): RecipeCost {
  const byId = new Map(catalog.items.map((i) => [i.id, i]));
  const lines: CostedLine[] = recipe.lines.map((line) => {
    const item = byId.get(line.itemId) ?? null;
    if (!item || line.qty <= 0) {
      return { line, item, balloonCost: 0, packsForOne: 0, packCostForOne: 0 };
    }
    const packsForOne = Math.ceil(line.qty / item.packQty);
    return {
      line,
      item,
      balloonCost: round2(line.qty * item.pricePerBalloon),
      packsForOne,
      packCostForOne: round2(packsForOne * item.price),
    };
  });
  const valid = lines.filter((l) => l.item && l.line.qty > 0);
  const sculpturesFromMinimum = valid.length
    ? Math.min(...valid.map((l) => Math.floor((l.packsForOne * l.item!.packQty) / l.line.qty)))
    : 0;
  return {
    lines,
    perSculpture: round2(valid.reduce((s, l) => s + l.balloonCost, 0)),
    minimumPurchase: round2(valid.reduce((s, l) => s + l.packCostForOne, 0)),
    sculpturesFromMinimum,
    missingItems: lines.filter((l) => !l.item).map((l) => l.line.itemId),
  };
}

export interface PackPlanLine {
  line: RecipeLine;
  item: CatalogItem;
  packs: number;
  balloons: number;
  cost: number;
  /** Balloons left over after making `sculptures` */
  leftover: number;
  /** Sculptures this line alone could supply */
  sculpturesSupported: number;
  isAnchor: boolean;
}

export interface PackPlan {
  anchorItemId: string;
  anchorPacks: number;
  /** Sculptures the anchor packs allow */
  targetSculptures: number;
  /** Sculptures actually achievable (min across lines) */
  sculptures: number;
  lines: PackPlanLine[];
  totalCost: number;
  costPerSculpture: number;
  missingItems: string[];
}

/**
 * Buy `anchorPacks` of `anchorItemId`; buy the fewest packs of every other
 * line so none of the anchor balloons go to waste.
 */
export function planPacks(
  recipe: Recipe,
  catalog: Catalog,
  anchorItemId: string,
  anchorPacks = 1
): PackPlan | null {
  const byId = new Map(catalog.items.map((i) => [i.id, i]));
  const anchorLine = recipe.lines.find((l) => l.itemId === anchorItemId && l.qty > 0);
  const anchorItem = byId.get(anchorItemId);
  if (!anchorLine || !anchorItem) return null;

  const packs = Math.max(1, Math.floor(anchorPacks));
  const targetSculptures = Math.floor((packs * anchorItem.packQty) / anchorLine.qty);
  const missingItems: string[] = [];

  const lines: PackPlanLine[] = [];
  recipe.lines.forEach((line) => {
    if (line.qty <= 0) return;
    const item = byId.get(line.itemId);
    if (!item) {
      missingItems.push(line.itemId);
      return;
    }
    const isAnchor = line.itemId === anchorItemId;
    const needed = targetSculptures * line.qty;
    const linePacks = isAnchor ? packs : Math.max(1, Math.ceil(needed / item.packQty));
    const balloons = linePacks * item.packQty;
    lines.push({
      line,
      item,
      packs: linePacks,
      balloons,
      cost: round2(linePacks * item.price),
      leftover: 0,
      sculpturesSupported: Math.floor(balloons / line.qty),
      isAnchor,
    });
  });

  const sculptures = lines.length ? Math.min(...lines.map((l) => l.sculpturesSupported)) : 0;
  lines.forEach((l) => {
    l.leftover = l.balloons - sculptures * l.line.qty;
  });
  const totalCost = round2(lines.reduce((s, l) => s + l.cost, 0));
  return {
    anchorItemId,
    anchorPacks: packs,
    targetSculptures,
    sculptures,
    lines,
    totalCost,
    costPerSculpture: sculptures > 0 ? round2(totalCost / sculptures) : 0,
    missingItems,
  };
}

/** Plain JSON view of a recipe with every price worked out, for export. */
export function recipeToJson(recipe: Recipe, catalog: Catalog, plan: PackPlan | null) {
  const cost = costRecipe(recipe, catalog);
  return {
    recipe: {
      id: recipe.id,
      name: recipe.name,
      updatedAt: recipe.updatedAt,
      lines: cost.lines.map((l) => ({
        itemId: l.line.itemId,
        qty: l.line.qty,
        item: l.item
          ? {
              name: l.item.name,
              brand: l.item.brand,
              size: l.item.size,
              color: l.item.color,
              finish: l.item.finish ?? null,
              packQty: l.item.packQty,
              packPrice: l.item.price,
              pricePerBalloon: l.item.pricePerBalloon,
              url: l.item.url ?? null,
            }
          : null,
        balloonCost: l.balloonCost,
        packsForOne: l.packsForOne,
        packCostForOne: l.packCostForOne,
      })),
    },
    cost: {
      currency: catalog.currency,
      perSculpture: cost.perSculpture,
      minimumPurchase: cost.minimumPurchase,
      sculpturesFromMinimum: cost.sculpturesFromMinimum,
    },
    packPlan: plan
      ? {
          anchorItemId: plan.anchorItemId,
          anchorPacks: plan.anchorPacks,
          sculptures: plan.sculptures,
          totalCost: plan.totalCost,
          costPerSculpture: plan.costPerSculpture,
          lines: plan.lines.map((l) => ({
            itemId: l.item.id,
            name: l.item.name,
            qtyPerSculpture: l.line.qty,
            packs: l.packs,
            balloons: l.balloons,
            leftover: l.leftover,
            cost: l.cost,
            isAnchor: l.isAnchor,
          })),
        }
      : null,
    catalog: {
      source: catalog.source,
      fetchedAt: catalog.fetchedAt,
      sample: catalog.sample ?? false,
    },
  };
}

/* ---------- matching a design's balloons to catalog items ---------- */

const FAMILY_WORDS: Array<[RegExp, string]> = [
  [/\b(orange|mandarin|tangerine|coral)\b/i, "orange"],
  [/\b(red|ruby|crimson|cherry|scarlet)\b/i, "red"],
  [/\b(yellow|canary|lemon|gold(?!en)|goldenrod)\b/i, "yellow"],
  [/\b(lime|emerald|green|mint|teal|jade)\b/i, "green"],
  [/\b(blue|sapphire|royal|navy|turquoise|periwinkle|sky)\b/i, "blue"],
  [/\b(purple|violet|lavender|lilac|quartz)\b/i, "purple"],
  [/\b(pink|magenta|rose|fuchsia|blush)\b/i, "pink"],
  [/\b(white|snow|ivory)\b/i, "white"],
  [/\b(black|onyx)\b/i, "black"],
  [/\b(brown|chocolate|mocha|tan)\b/i, "brown"],
  [/\b(silver|chrome silver|grey|gray)\b/i, "silver"],
];

export function colorFamilyOf(name: string): string | undefined {
  for (const [re, fam] of FAMILY_WORDS) if (re.test(name)) return fam;
  return undefined;
}

/** Best catalog match for a design balloon by size and color name; cheapest per balloon wins ties. */
export function matchCatalogItem(
  catalog: Catalog,
  size: string,
  colorName: string
): CatalogItem | null {
  const sizeKey = size === "360" ? /^3[56]0$/ : new RegExp(`^${size}$`);
  const fam = colorFamilyOf(colorName);
  const candidates = catalog.items.filter((i) => sizeKey.test(i.size));
  if (candidates.length === 0) return null;
  const exact = candidates.filter((i) => i.color.toLowerCase() === colorName.toLowerCase());
  const byFamily = fam ? candidates.filter((i) => (i.colorFamily ?? colorFamilyOf(i.color)) === fam) : [];
  const pool = exact.length ? exact : byFamily.length ? byFamily : [];
  if (pool.length === 0) return null;
  return [...pool].sort((a, b) => a.pricePerBalloon - b.pricePerBalloon)[0];
}
