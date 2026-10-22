import Anthropic from "@anthropic-ai/sdk";
import { BalloonSize, BalloonSpec, BubbleSpec, ComplexityLevel, FullDesign, TwistType } from "@/types/balloon";
import { TWISTER_COLORS } from "./balloonConstants";
import { buildDesign } from "./balloonPresets";
import { autoStabilizeSculpture, defaultDiameterForSize } from "./balloonLayout";
import { Catalog, matchCatalogItem } from "./recipeMath";
import catalogJson from "@/data/balloonCatalog.json";

/**
 * AI design engine: sends the description and/or reference image to Claude and
 * asks for three buildable tiers in the app's own bubble schema. The answer is
 * validated, snapped to real latex colors and catalog packs, auto-stabilised by
 * the layout engine, and turned into FullDesign objects.
 */

const catalog = catalogJson as Catalog;

const TWIST_TYPES: TwistType[] = [
  "basic", "lock", "pinch", "loop", "toe", "tulip", "apple_link", "bird_body", "s_hook", "z_bend", "spiral", "cut_tail_bubbles",
];

export interface AiBalloonOut {
  id: string;
  name: string;
  size: "160" | "260" | "360";
  colorName: string;
  attachToBubble: number;
  attachEnd: "start" | "end";
}

export interface AiBubbleOut {
  balloonId: string;
  label: string;
  twistType: string;
  lengthInches: number;
  bend: number;
  turn: number;
  lockToBubbleStart: number;
}

export interface AiTierOut {
  title: string;
  description: string;
  balloons: AiBalloonOut[];
  bubbles: AiBubbleOut[];
}

export interface AiDesignOut {
  subject: string;
  category: string;
  beginner: AiTierOut;
  intermediate: AiTierOut;
  advanced: AiTierOut;
}

const balloonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "name", "size", "colorName", "attachToBubble", "attachEnd"],
  properties: {
    id: { type: "string", description: "Short unique id such as bal-1" },
    name: { type: "string", description: "What this balloon makes, e.g. 'Body 260'" },
    size: { type: "string", enum: ["160", "260", "360"] },
    colorName: { type: "string", description: "One of the latex color names given in the instructions" },
    attachToBubble: {
      type: "integer",
      description:
        "Global bubble index (0-based, across all balloons, in order) of the joint this balloon's knot is tied into. -1 for the first balloon or a free-standing balloon.",
    },
    attachEnd: { type: "string", enum: ["start", "end"], description: "Which twist of that bubble: start (toward the knot) or end" },
  },
};

const bubbleSchema = {
  type: "object",
  additionalProperties: false,
  required: ["balloonId", "label", "twistType", "lengthInches", "bend", "turn", "lockToBubbleStart"],
  properties: {
    balloonId: { type: "string" },
    label: { type: "string", description: "Body part, e.g. 'Left ear'" },
    twistType: { type: "string", enum: TWIST_TYPES },
    lengthInches: { type: "number", description: "Bubble length in inches along the balloon, 0.75 to 14" },
    bend: { type: "number", description: "Degrees the bubble pitches relative to the previous one: + up, - down, 0 straight" },
    turn: { type: "number", description: "Degrees the bubble yaws relative to the previous one: + left, - right, 0 straight" },
    lockToBubbleStart: {
      type: "integer",
      description:
        "Global index of an EARLIER bubble whose start twist this bubble's far end is twisted back into (closes a ring or locks a leg back to the body). -1 when not locked back.",
    },
  },
};

const tierSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "description", "balloons", "bubbles"],
  properties: {
    title: { type: "string" },
    description: { type: "string", description: "One sentence for the twister about what makes this tier distinctive" },
    balloons: { type: "array", items: balloonSchema },
    bubbles: { type: "array", items: bubbleSchema },
  },
};

export const AI_DESIGN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["subject", "category", "beginner", "intermediate", "advanced"],
  properties: {
    subject: { type: "string", description: "What the sculpture is, e.g. 'Dachshund'" },
    category: { type: "string", enum: ["animals", "objects", "flowers", "characters", "wearables", "custom"] },
    beginner: tierSchema,
    intermediate: tierSchema,
    advanced: tierSchema,
  },
};

const SYSTEM_PROMPT = `You are a professional balloon twister designing sculptures for TwistCraft, a balloon-twisting CAD tool. Given a description and/or a reference image, design the subject as a buildable twister-balloon sculpture in three tiers and return ONLY the JSON requested.

Balloons: 160 (1" x 60"), 260 (2" x 60", the workhorse), 360 (3" x 60", chunky). A balloon is one color. The sum of bubble lengths on a balloon must stay under about 48" for a 260 and 40" for a 360 or 160, because twists push air into the tail.

A balloon is a sequence of bubbles from the nozzle knot to the tail. Each bubble is twisted off the previous one; the joints between them are the twists. Twist types:
- basic: a plain bubble (snout, neck, body, stem).
- lock: TWO consecutive 'lock' bubbles of EQUAL length fold side by side and twist together at their base: ears, front legs, back legs, petal pairs. Always emit them as a pair, and give the pair a bend so the legs point down (bend about -90) or ears point up/out.
- pinch: a small round bubble (0.75-1.25") twisted on its own axis: cheeks, eyes, bear ears, a joint-angle changer. A pinch cannot be the very first bubble of a balloon.
- loop: one longer section folded into a teardrop and twisted at its base: wings, big ears, petals, sword guards. 4-8".
- toe: a tiny pinch at a paw (0.75-1").
- tulip: an apple/tulip twist with the knot pushed inside, only as the FIRST bubble of a balloon: round heads, apples, flower centers.
- apple_link, bird_body (three consecutive 'bird_body' bubbles of equal length roll through to make a round torso), s_hook (curved tail/neck), z_bend, spiral (160s only), cut_tail_bubbles (a bead at the very end).
- lockToBubbleStart: for a ring (petal rosette, sword guard) or a leg that folds back into the hip, set it on the last bubble of the group to the index of the group's first bubble; otherwise -1.

Directions: bend/turn are relative to the previous bubble. A quadruped in profile: snout along +x, ears a lock pair bent up (+60..+80), neck bent down (-50), front legs a lock pair bent down (-90), body straight (bend back up +90 so it runs horizontal), back legs bent down (-90), tail bent up (+60). Keep the sculpture roughly in one plane with small turns (±10..40) for ears and legs so pairs sit beside each other.

Multi-balloon: a second balloon's knot ties into an existing twist (attachToBubble = global index, attachEnd). Balloon ids must be unique and every bubble's balloonId must exist. Bubbles are listed balloon by balloon, in build order; global indices count across the whole list.

Tiers: beginner = 1 balloon (6-11 bubbles) that a busker makes in a minute; intermediate = 2 balloons with more shaping (pinches, loops, toes); advanced = 3-4 balloons including a 360 or 160 for detail. Use the reference image for the real proportions, pose and colors. Pick colors from this latex palette by exact name: ${TWISTER_COLORS.map((c) => c.name).join(", ")}.

Use realistic lengths: a 260 snout 2-3", ears 3-3.5", neck 2-3", legs 3-4", body 4-6", tail 3-4". Make every twist mechanically anchored: single bubbles between lock pairs are fine because the pairs lock them; a chain of plain basics with no locks will unravel.`;

export interface AiDesignRequest {
  apiKey: string;
  model: string;
  prompt: string;
  /** JPEG/PNG/WebP/GIF as base64 without the data: prefix */
  imageBase64?: string;
  imageMediaType?: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
}

export interface AiDesignResult {
  designs: Record<ComplexityLevel, FullDesign>;
  subject: string;
  model: string;
  usage: { input: number; output: number };
  warnings: string[];
}

export async function generateDesignsWithClaude(req: AiDesignRequest): Promise<AiDesignResult> {
  const client = new Anthropic({ apiKey: req.apiKey.trim(), dangerouslyAllowBrowser: true });
  const content: Anthropic.ContentBlockParam[] = [];
  if (req.imageBase64) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: req.imageMediaType ?? "image/jpeg", data: req.imageBase64 },
    });
  }
  const text = req.prompt.trim()
    ? req.imageBase64
      ? `Design this as a balloon sculpture. The twister describes it as: "${req.prompt.trim()}". Use the image for shape, pose, proportions and colors.`
      : `Design a balloon sculpture of: "${req.prompt.trim()}".`
    : "Design the subject of this image as a balloon sculpture, matching its shape, pose, proportions and colors.";
  content.push({ type: "text", text });

  const response = await client.messages.create({
    model: req.model,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
    output_config: { format: { type: "json_schema", schema: AI_DESIGN_SCHEMA } },
  });

  if (response.stop_reason === "refusal") {
    const why = response.stop_details?.type === "refusal" ? response.stop_details.explanation : "";
    throw new Error(`The model declined this request${why ? `: ${why}` : "."}`);
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("The model's answer was cut off. Try again with a shorter description.");
  }
  const raw = response.content.find((b) => b.type === "text")?.text ?? "";
  let parsed: AiDesignOut;
  try {
    parsed = JSON.parse(raw) as AiDesignOut;
  } catch {
    throw new Error("The model returned something that is not valid JSON. Try again.");
  }

  const warnings: string[] = [];
  const stamp = Date.now().toString(36);
  const tiers = {} as Record<ComplexityLevel, FullDesign>;
  (["beginner", "intermediate", "advanced"] as const).forEach((tier) => {
    tiers[tier] = tierToDesign(parsed[tier], tier, parsed, req.prompt, stamp, warnings);
  });
  return {
    designs: tiers,
    subject: parsed.subject,
    model: response.model,
    usage: { input: response.usage.input_tokens, output: response.usage.output_tokens },
    warnings,
  };
}

/* ---------------- validation and conversion ---------------- */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const q = (v: number) => Math.round(v * 4) / 4;

function snapColor(name: string): { hex: string; colorName: string } {
  const n = name.trim().toLowerCase();
  const exact = TWISTER_COLORS.find((c) => c.name.toLowerCase() === n);
  if (exact) return { hex: exact.hex, colorName: exact.name };
  const partial = TWISTER_COLORS.find((c) => c.name.toLowerCase().includes(n) || n.includes(c.name.toLowerCase().split(" ")[0]));
  if (partial) return { hex: partial.hex, colorName: partial.name };
  const words: Array<[RegExp, string]> = [
    [/red|ruby|crimson|scarlet/, "Ruby Red"], [/orange|tangerine/, "Mandarin Orange"], [/yellow|gold(?!en retriever)/, "Canary Yellow"],
    [/lime/, "Lime Green"], [/green|emerald|jade/, "Emerald Green"], [/sky|light blue|baby blue|pale blue/, "Pale Blue"],
    [/blue|navy|cobalt/, "Royal Blue"], [/purple|violet|indigo/, "Purple Violet"], [/magenta|hot pink|fuchsia/, "Magenta Pink"],
    [/pink|rose|blush/, "Chrome Rose Gold"], [/black|onyx|ebony/, "Onyx Black"], [/white|snow|ivory|cream/, "Snow White"],
    [/brown|chocolate|tan|beige|caramel/, "Chocolate Brown"], [/silver|gray|grey|chrome/, "Chrome Silver"], [/teal|turquoise|aqua|cyan/, "Teal Turquoise"],
    [/lavender|lilac/, "Lavender Pastel"], [/mint/, "Mint Pastel"], [/peach|skin|flesh/, "Blush / Skin Tone"],
  ];
  for (const [re, nm] of words) {
    if (re.test(n)) {
      const c = TWISTER_COLORS.find((x) => x.name === nm)!;
      return { hex: c.hex, colorName: c.name };
    }
  }
  return { hex: "#EA580C", colorName: "Mandarin Orange" };
}

function tierToDesign(
  tier: AiTierOut | undefined,
  complexity: ComplexityLevel,
  whole: AiDesignOut,
  prompt: string,
  stamp: string,
  warnings: string[]
): FullDesign {
  const subject = (whole.subject || prompt || "Custom sculpture").trim();
  const srcBalloons = Array.isArray(tier?.balloons) ? tier!.balloons : [];
  const srcBubbles = Array.isArray(tier?.bubbles) ? tier!.bubbles : [];

  // Balloons: unique ids, valid sizes, palette colors, catalog packs where one matches
  const usedIds = new Set<string>();
  const balloons: BalloonSpec[] = srcBalloons.map((b, i) => {
    let id = String(b.id || `bal-${i + 1}`).replace(/\s+/g, "-");
    while (usedIds.has(id)) id = `${id}-${i + 1}`;
    usedIds.add(id);
    const size: BalloonSize = b.size === "160" || b.size === "360" ? b.size : "260";
    const { hex, colorName } = snapColor(String(b.colorName ?? ""));
    const pack = matchCatalogItem(catalog, size, colorName);
    return {
      id,
      name: String(b.name || `${subject} ${size}`),
      size,
      color: pack?.hex ?? hex,
      colorName: pack ? pack.color : colorName,
      brand: pack?.brand,
      catalogItemId: pack?.id,
      inflatedLengthInches: 48,
      tailLengthInches: 12,
      tailFingers: 5,
      order: i + 1,
    };
  });
  if (balloons.length === 0) {
    const fallback = snapColor("orange");
    balloons.push({ id: "bal-1", name: `${subject} 260`, size: "260", color: fallback.hex, colorName: fallback.colorName, inflatedLengthInches: 48, tailLengthInches: 12, tailFingers: 5, order: 1 });
    warnings.push(`${complexity}: the model returned no balloons; used one 260.`);
  }
  const idRemap = new Map<string, string>();
  srcBalloons.forEach((b, i) => idRemap.set(String(b.id), balloons[i]?.id ?? balloons[0].id));

  // Bubbles: grouped per balloon in listed order, lengths and types validated
  const byBalloon = new Map<string, AiBubbleOut[]>();
  srcBubbles.forEach((bb) => {
    const bid = idRemap.get(String(bb.balloonId)) ?? balloons[0].id;
    const arr = byBalloon.get(bid) ?? [];
    arr.push({ ...bb, balloonId: bid });
    byBalloon.set(bid, arr);
  });
  // Global index mapping from the model's order to ours (balloon by balloon, in balloon order)
  const ordered: AiBubbleOut[] = [];
  balloons.forEach((bal) => ordered.push(...(byBalloon.get(bal.id) ?? [])));
  const newIndexByModelIndex = new Map<number, number>();
  {
    const perBalloonCounters = new Map<string, number>();
    const offsets = new Map<string, number>();
    let off = 0;
    balloons.forEach((bal) => {
      offsets.set(bal.id, off);
      off += (byBalloon.get(bal.id) ?? []).length;
    });
    srcBubbles.forEach((bb, i) => {
      const bid = idRemap.get(String(bb.balloonId)) ?? balloons[0].id;
      const k = perBalloonCounters.get(bid) ?? 0;
      perBalloonCounters.set(bid, k + 1);
      newIndexByModelIndex.set(i, (offsets.get(bid) ?? 0) + k);
    });
  }

  const bubbles: BubbleSpec[] = ordered.map((bb, index) => {
    const bal = balloons.find((b) => b.id === bb.balloonId)!;
    const twistType: TwistType = TWIST_TYPES.includes(bb.twistType as TwistType) ? (bb.twistType as TwistType) : "basic";
    const isPinchy = twistType === "pinch" || twistType === "toe";
    const diameter = defaultDiameterForSize(bal.size);
    const rawLen = Number.isFinite(bb.lengthInches) ? bb.lengthInches : 3;
    const lengthInches = q(clamp(rawLen, isPinchy ? 0.75 : 0.75, twistType === "loop" ? 14 : 12));
    const bend = Number.isFinite(bb.bend) ? Math.round(clamp(bb.bend, -165, 165) / 5) * 5 : 0;
    const turn = Number.isFinite(bb.turn) ? Math.round(clamp(bb.turn, -165, 165) / 5) * 5 : 0;
    let lockToBubbleStart: number | undefined;
    if (Number.isInteger(bb.lockToBubbleStart) && bb.lockToBubbleStart >= 0) {
      const mapped = newIndexByModelIndex.get(bb.lockToBubbleStart);
      if (mapped !== undefined && mapped < index && ordered[mapped].balloonId === bb.balloonId) lockToBubbleStart = mapped;
    }
    const spec: BubbleSpec = {
      id: `b-${index + 1}`,
      balloonId: bal.id,
      index,
      label: String(bb.label || `Bubble ${index + 1}`).slice(0, 40),
      lengthInches,
      diameterInches: isPinchy ? q(diameter * 0.7) : diameter,
      twistType,
      color: bal.color,
    };
    if (bend) spec.bend = bend;
    if (turn) spec.turn = turn;
    if (lockToBubbleStart !== undefined) spec.lockToBubbleStart = lockToBubbleStart;
    if (twistType === "pinch" || twistType === "toe") spec.isPinch = true;
    if (twistType === "loop") spec.isLoop = true;
    if (twistType === "tulip") spec.isTulip = true;
    return spec;
  });

  // First bubble of a balloon cannot be a pinch (nothing to pinch against)
  const seen = new Set<string>();
  bubbles.forEach((b) => {
    if (!seen.has(b.balloonId)) {
      seen.add(b.balloonId);
      if (b.twistType === "pinch" || b.twistType === "toe") {
        b.twistType = "basic";
        b.isPinch = undefined;
        b.lengthInches = Math.max(b.lengthInches, 1.5);
      }
    }
  });

  // Lock pairs must match in length; orphan locks become basics
  for (let i = 0; i < bubbles.length; i++) {
    const b = bubbles[i];
    if (b.twistType !== "lock" || b.lockToBubbleStart !== undefined) continue;
    const n = bubbles[i + 1];
    if (n && n.balloonId === b.balloonId && n.twistType === "lock" && n.lockToBubbleStart === undefined) {
      const len = q((b.lengthInches + n.lengthInches) / 2);
      b.lengthInches = len;
      n.lengthInches = len;
      i += 1;
    } else {
      b.twistType = "basic";
    }
  }

  // Balloon tie-ins
  srcBalloons.forEach((b, i) => {
    const bal = balloons[i];
    if (!bal || i === 0) return;
    const mapped = Number.isInteger(b.attachToBubble) && b.attachToBubble >= 0 ? newIndexByModelIndex.get(b.attachToBubble) : undefined;
    if (mapped !== undefined && bubbles[mapped] && bubbles[mapped].balloonId !== bal.id) {
      bal.attachTo = { bubbleIndex: mapped, end: b.attachEnd === "start" ? "start" : "end" };
    }
  });
  // A balloon that is not the first and has no tie-in: tie its knot to the first balloon's last twist
  balloons.forEach((bal, i) => {
    if (i === 0 || bal.attachTo) return;
    const firstBalBubbles = bubbles.filter((b) => b.balloonId === balloons[0].id);
    const target = firstBalBubbles[Math.min(firstBalBubbles.length - 1, Math.max(0, Math.floor(firstBalBubbles.length / 2)))];
    if (target) bal.attachTo = { bubbleIndex: target.index, end: "end" };
  });

  // Balloon air: drop bubbles that cannot fit, then let the layout engine lock what would unravel
  balloons.forEach((bal) => {
    const cap = bal.size === "260" ? 50 : 42;
    let total = 0;
    bubbles.forEach((b) => {
      if (b.balloonId !== bal.id) return;
      total += b.lengthInches;
    });
    if (total > cap) {
      const scale = cap / total;
      bubbles.forEach((b) => {
        if (b.balloonId === bal.id) b.lengthInches = Math.max(0.75, q(b.lengthInches * scale));
      });
      warnings.push(`${complexity}: ${bal.name} was over-length; bubbles scaled to fit the balloon.`);
    }
  });

  const stabilized = autoStabilizeSculpture(balloons, bubbles);
  if (stabilized.appliedCount > 0) warnings.push(`${complexity}: ${stabilized.appliedCount} stability fix${stabilized.appliedCount === 1 ? "" : "es"} applied.`);

  const title = String(tier?.title || `${subject} (${complexity})`);
  return buildDesign({
    id: `ai-${stamp}-${complexity}`,
    title,
    description: String(tier?.description || `${subject} designed from ${prompt ? "your description" : "the reference image"}.`),
    category: whole.category || "custom",
    complexity,
    sourceType: "ai",
    sourcePrompt: prompt,
    balloons: stabilized.balloons,
    bubbles: stabilized.bubbles.map((b, i) => ({ ...b, index: i })),
    annotations: [],
  });
}
/** Exposed for tests: converts one tier of a model answer without calling the API */
export const __test_tierToDesign = tierToDesign;
