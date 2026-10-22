import { BalloonSize, BalloonSpec, BubbleSpec, ComplexityLevel, FullDesign } from "@/types/balloon";
import { PRESET_DESIGNS, buildDesign } from "./balloonPresets";
import { defaultDiameterForSize } from "./balloonLayout";
import { computeAirBudget, fitTailForBubbles } from "./balloonAir";
import { TWISTER_COLORS } from "./balloonConstants";

/**
 * Body plans ("archetypes"): the way a twister actually designs. A dog is a snout,
 * an ear pair, a neck, a front leg pair, a body, a back leg pair and a tail, and
 * only the proportions and colors change between a dachshund and a greyhound.
 *
 * An archetype is a template design (balloons + bubbles, with all the bend, turn
 * and lock values already right) plus its PARTS: groups of bubbles that a twister
 * thinks of as one thing and that resize together (a lock pair, a leg with its
 * toes that folds back into the hip, a petal rosette). Building from an archetype
 * only sets part lengths, balloon colors and gauges; the geometry is reused.
 *
 * Built-in archetypes are derived from the hand-made presets. One- and two-balloon
 * designs from the editor can be saved as archetypes in this browser.
 */

export type PartKind = "single" | "pair" | "group";

export interface ArchetypePart {
  id: string;
  label: string;
  kind: PartKind;
  /** Template bubble indices (into `bubbles`) that make up this part, in build order */
  bubbleIndices: number[];
  /** Length of the part's main bubbles in the template (the slider's default), inches */
  templateLength: number;
  minLength: number;
  maxLength: number;
  /** Fixed small bubbles (pinch / toe / bead) do not get a length slider */
  fixed: boolean;
}

export interface Archetype {
  id: string;
  name: string;
  description: string;
  category: string;
  /** Which tier of its family this plan is (the beginner puppy, the intermediate dachshund) */
  complexity: ComplexityLevel;
  /** Family name: plans of the same subject at different tiers share it ("Dog") */
  family: string;
  builtIn: boolean;
  balloons: BalloonSpec[];
  bubbles: BubbleSpec[];
  parts: ArchetypePart[];
  orientation?: [number, number, number];
  createdAt?: string;
}

export interface ArchetypeBalloonChoice {
  color: string;
  colorName: string;
  size: BalloonSize;
}

export interface ArchetypeBuildSettings {
  /** Part id -> length in inches for the part's main bubbles */
  partLengths: Record<string, number>;
  /** Balloon id -> color and gauge */
  balloons: Record<string, ArchetypeBalloonChoice>;
  title?: string;
}

export const MAX_ARCHETYPE_BALLOONS = 2;

const STORAGE_KEY = "twistcraft.archetypes.v1";
const q = (v: number) => Math.round(v * 4) / 4;
const isSmallFixed = (b: BubbleSpec) =>
  b.twistType === "pinch" || b.twistType === "toe" || b.twistType === "cut_tail_bubbles" || b.isPinch === true;

/* ---------------- deriving parts from a design ---------------- */

const STRIP_WORDS = /\b(left|right|l|r|out|return|\d+)\b/gi;

function partLabel(labels: string[], kind: PartKind): string {
  const stripped = labels.map((l) => l.replace(STRIP_WORDS, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
  if (stripped.length === 0) return kind === "single" ? "Bubble" : "Group";
  // Most common stripped label wins (a leg + toes + leg group is still "legs")
  const counts = new Map<string, number>();
  stripped.forEach((s) => counts.set(s, (counts.get(s) ?? 0) + 1));
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1] || stripped.indexOf(a[0]) - stripped.indexOf(b[0]))[0][0];
  if (kind === "single") return best;
  if (/s$/i.test(best) || labels.length < 2) return best;
  return `${best}s`;
}

function lengthRange(mainBubbles: BubbleSpec[], kind: PartKind): { min: number; max: number } {
  const isLoop = mainBubbles.some((b) => b.twistType === "loop" || b.isLoop);
  const longest = Math.max(...mainBubbles.map((b) => b.lengthInches), 1);
  const cap = Math.min(isLoop ? 14 : 12, Math.max(4, longest * 2.2));
  // A long single piece (a 22" blade) keeps room to grow a little
  return { min: 0.75, max: q(Math.max(cap, longest * 1.4)) };
}

/**
 * Group a design's bubbles into the parts a twister would name: lock pairs, limbs
 * that fold back into an earlier joint (with their toes), bird-body rolls, loop
 * rosettes, and single bubbles.
 */
export function deriveParts(bubbles: BubbleSpec[]): ArchetypePart[] {
  const parts: ArchetypePart[] = [];
  const taken = new Set<number>();
  const byBalloon = new Map<string, number[]>();
  bubbles.forEach((b, i) => byBalloon.set(b.balloonId, [...(byBalloon.get(b.balloonId) ?? []), i]));
  const noLock = (i: number) => bubbles[i].lockToBubbleStart === undefined && !bubbles[i].lockToJoint;

  byBalloon.forEach((seq) => {
    for (let k = 0; k < seq.length; k++) {
      const i = seq[k];
      if (taken.has(i)) continue;
      const b = bubbles[i];
      let indices: number[] = [i];
      let kind: PartKind = "single";
      const next = seq[k + 1];
      // A limb that returns into this bubble's start joint closes a group (leg, toes, leg)
      const closer = seq.find((j) => j > i && bubbles[j].lockToBubbleStart === i);
      if (closer !== undefined) {
        indices = seq.filter((j) => j >= i && j <= closer);
        kind = "group";
      } else if (b.twistType === "lock" && noLock(i) && next !== undefined && bubbles[next].twistType === "lock" && noLock(next)) {
        indices = [i, next];
        kind = "pair";
      } else if (b.twistType === "bird_body") {
        indices = [i];
        let m = k + 1;
        while (m < seq.length && bubbles[seq[m]].twistType === "bird_body") indices.push(seq[m++]);
        kind = indices.length > 1 ? "group" : "single";
      } else if ((b.twistType === "loop" || b.isLoop) && !b.branchFrom) {
        indices = [i];
        let m = k + 1;
        while (m < seq.length && (bubbles[seq[m]].twistType === "loop" || bubbles[seq[m]].isLoop) && !bubbles[seq[m]].branchFrom) indices.push(seq[m++]);
        kind = indices.length > 1 ? "group" : "single";
      }
      indices.forEach((j) => taken.add(j));
      const members = indices.map((j) => bubbles[j]);
      const main = members.filter((m) => !isSmallFixed(m));
      const fixed = main.length === 0;
      const sizing = fixed ? members : main;
      const range = lengthRange(sizing, kind);
      parts.push({
        id: `part-${parts.length + 1}`,
        label: partLabel(members.map((m) => m.label), kind),
        kind,
        bubbleIndices: indices,
        templateLength: q(Math.max(...sizing.map((m) => m.lengthInches))),
        minLength: range.min,
        maxLength: range.max,
        fixed,
      });
    }
  });
  // Mirrored groups (left and right quillon) must keep what tells them apart
  const seen = new Map<string, number>();
  parts.forEach((p) => seen.set(p.label, (seen.get(p.label) ?? 0) + 1));
  parts.forEach((p) => {
    if ((seen.get(p.label) ?? 0) < 2) return;
    const first = bubbles[p.bubbleIndices[0]].label.replace(/\b(out|return|\d+)\b/gi, " ").replace(/\s+/g, " ").trim();
    if (first) p.label = first;
  });
  return parts;
}

/** Turn a design into an archetype (its geometry becomes the template). */
export function archetypeFromDesign(
  design: FullDesign,
  family: string,
  tier: ComplexityLevel = design.complexity,
  builtIn = false,
  id?: string,
  name?: string
): Archetype {
  const bubbles = design.bubbles.map((b, index) => ({ ...b, index }));
  return {
    id: id ?? `arch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: (name ?? "").trim() || design.title,
    description: design.description,
    category: design.category || "custom",
    complexity: tier,
    family: family.trim() || design.title,
    builtIn,
    balloons: design.balloons.map((b) => ({ ...b })),
    bubbles,
    parts: deriveParts(bubbles),
    orientation: design.orientation,
    createdAt: new Date().toISOString(),
  };
}

/* ---------------- built-in and saved archetypes ---------------- */

export const TIERS: ComplexityLevel[] = ["beginner", "intermediate", "advanced"];

export const BUILT_IN_ARCHETYPES: Archetype[] = (
  [
    ["dog", "Dog"],
    ["sword", "Sword"],
    ["flower", "Flower"],
  ] as Array<[keyof typeof PRESET_DESIGNS, string]>
).flatMap(([key, family]) =>
  TIERS.map((tier) => archetypeFromDesign(PRESET_DESIGNS[key][tier], family, tier, true, `builtin-${key}-${tier}`))
);

/* ---------------- families: the same subject at three tiers ---------------- */

export interface PlanFamily {
  /** Lower-cased family name, the id the builder and the AI pick by */
  key: string;
  name: string;
  builtIn: boolean;
  tiers: Partial<Record<ComplexityLevel, Archetype>>;
  plans: Archetype[];
}

export const familyKey = (name: string) => name.trim().toLowerCase();

export function groupFamilies(archetypes: Archetype[]): PlanFamily[] {
  const map = new Map<string, PlanFamily>();
  archetypes.forEach((a) => {
    const key = familyKey(a.family);
    const fam = map.get(key) ?? { key, name: a.family.trim(), builtIn: a.builtIn, tiers: {}, plans: [] };
    if (!fam.tiers[a.complexity]) fam.tiers[a.complexity] = a;
    fam.plans.push(a);
    fam.builtIn = fam.builtIn && a.builtIn;
    map.set(key, fam);
  });
  return [...map.values()];
}

/** The plan a family builds for a tier: its own, else the nearest lower tier, else the nearest higher. */
export function planForTier(f: PlanFamily, tier: ComplexityLevel): Archetype {
  const i = TIERS.indexOf(tier);
  for (let k = i; k >= 0; k--) if (f.tiers[TIERS[k]]) return f.tiers[TIERS[k]]!;
  for (let k = i + 1; k < TIERS.length; k++) if (f.tiers[TIERS[k]]) return f.tiers[TIERS[k]]!;
  return f.plans[0];
}

/** Parts with the same name in different tiers are the same thing ("Front Legs" on the puppy and on the dachshund) */
const PART_SYNONYMS: Array<[RegExp, string]> = [
  [/\b(torso|trunk)\b/g, "body"],
  [/\b(muzzle|nose)\b/g, "snout"],
  [/\b(rear)\b/g, "back"],
  [/\b(paws?|toes?)\b/g, "paw"],
];
const PART_FILLER = /\b(the|a|twist|bubble|bubbles|long|short|big|little|wiener|hound|perky|floppy|curved|s|loop|loops|pinch|bead|stem)\b/g;
export const partKey = (label: string) => {
  let k = label.toLowerCase().replace(/[^a-z0-9 ]+/g, " ");
  PART_SYNONYMS.forEach(([re, to]) => (k = k.replace(re, to)));
  const words = k.replace(PART_FILLER, " ").split(/\s+/).filter(Boolean);
  return words.filter((w, i) => words.indexOf(w) === i).join(" ");
};

export interface FamilyBuildSettings {
  title?: string;
  /** Per plan id, the settings its tier is built with */
  byPlan: Record<string, ArchetypeBuildSettings>;
}

export function defaultFamilySettings(f: PlanFamily): FamilyBuildSettings {
  const byPlan: Record<string, ArchetypeBuildSettings> = {};
  f.plans.forEach((a) => (byPlan[a.id] = defaultBuildSettings(a)));
  return { byPlan };
}

/**
 * Set a part's length on one plan and carry the same proportion (length relative to
 * the template) to parts of the same name in the family's other tiers, so "longer
 * legs" means longer legs in every tier.
 */
export function setFamilyPartLength(f: PlanFamily, s: FamilyBuildSettings, planId: string, partId: string, length: number): FamilyBuildSettings {
  const src = f.plans.find((a) => a.id === planId);
  const part = src?.parts.find((p) => p.id === partId);
  if (!src || !part) return s;
  const ratio = length / Math.max(0.25, part.templateLength);
  const key = partKey(part.label);
  const byPlan = { ...s.byPlan };
  f.plans.forEach((a) => {
    const cur = byPlan[a.id] ?? defaultBuildSettings(a);
    const partLengths = { ...cur.partLengths };
    a.parts.forEach((p) => {
      if (p.fixed) return;
      if (a.id === planId ? p.id === partId : partKey(p.label) === key) {
        partLengths[p.id] = q(Math.min(p.maxLength, Math.max(p.minLength, a.id === planId ? length : p.templateLength * ratio)));
      }
    });
    byPlan[a.id] = { ...cur, partLengths };
  });
  return { ...s, byPlan };
}

/** Set a balloon's color or gauge on one plan and carry it to the same balloon position in the other tiers. */
export function setFamilyBalloon(
  f: PlanFamily,
  s: FamilyBuildSettings,
  planId: string,
  balloonId: string,
  patch: Partial<ArchetypeBalloonChoice>
): FamilyBuildSettings {
  const src = f.plans.find((a) => a.id === planId);
  const order = src?.balloons.findIndex((b) => b.id === balloonId) ?? -1;
  if (!src || order < 0) return s;
  const byPlan = { ...s.byPlan };
  f.plans.forEach((a) => {
    const target = a.id === planId ? a.balloons[order] : a.balloons[order];
    if (!target) return;
    const cur = byPlan[a.id] ?? defaultBuildSettings(a);
    // Gauge only carries across when the template gauges agreed (a 160 collar stays a 160)
    const carry = a.id === planId || !patch.size || target.size === src.balloons[order].size ? patch : { color: patch.color, colorName: patch.colorName };
    byPlan[a.id] = { ...cur, balloons: { ...cur.balloons, [target.id]: { ...cur.balloons[target.id], ...carry } } };
  });
  return { ...s, byPlan };
}

/** Build the three editor tiers from a family: each tier from its own plan (or the nearest one). */
export function buildDesignsFromFamily(f: PlanFamily, s: FamilyBuildSettings): Record<ComplexityLevel, FullDesign> {
  const title = (s.title ?? "").trim() || f.name;
  const stamp = Date.now().toString(36);
  const out = {} as Record<ComplexityLevel, FullDesign>;
  TIERS.forEach((tier) => {
    const a = planForTier(f, tier);
    const settings = s.byPlan[a.id] ?? defaultBuildSettings(a);
    out[tier] = buildDesignFromArchetype(a, settings, tier, title, `arch-${stamp}-${tier}`);
  });
  return out;
}

function canStore(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

function isArchetype(a: unknown): a is Archetype {
  if (!a || typeof a !== "object") return false;
  const x = a as Record<string, unknown>;
  return typeof x.id === "string" && typeof x.name === "string" && Array.isArray(x.balloons) && Array.isArray(x.bubbles) && Array.isArray(x.parts);
}

export function listCustomArchetypes(): Archetype[] {
  if (!canStore()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter(isArchetype).map((a) => ({ ...a, builtIn: false, family: typeof a.family === "string" && a.family.trim() ? a.family : a.name }))
      : [];
  } catch {
    return [];
  }
}

function writeCustom(list: Archetype[]): boolean {
  if (!canStore()) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/** Save a one- or two-balloon design as the given tier of a body-plan family in this browser. */
export function saveDesignAsArchetype(
  design: FullDesign,
  family: string,
  tier: ComplexityLevel
): { ok: true; archetype: Archetype } | { ok: false; reason: string } {
  if (design.bubbles.length === 0) return { ok: false, reason: "The design has no bubbles yet." };
  if (design.balloons.length > MAX_ARCHETYPE_BALLOONS) {
    return { ok: false, reason: `Body plans are one- or two-balloon recipes (this design has ${design.balloons.length} balloons).` };
  }
  const archetype = archetypeFromDesign(design, family, tier, false, undefined, `${design.title} (${tier})`);
  if (BUILT_IN_ARCHETYPES.some((a) => familyKey(a.family) === familyKey(archetype.family))) {
    return { ok: false, reason: `"${archetype.family}" is a built-in family; give yours another name.` };
  }
  // One plan per tier per family: the same tier of the same family is replaced
  const rest = listCustomArchetypes().filter((a) => !(familyKey(a.family) === familyKey(archetype.family) && a.complexity === tier));
  return writeCustom([archetype, ...rest]) ? { ok: true, archetype } : { ok: false, reason: "Browser storage is unavailable or full." };
}

export function deleteCustomArchetype(id: string): void {
  writeCustom(listCustomArchetypes().filter((a) => a.id !== id));
}

/* ---------------- building a design from an archetype ---------------- */

export function defaultBuildSettings(a: Archetype): ArchetypeBuildSettings {
  const partLengths: Record<string, number> = {};
  a.parts.forEach((p) => (partLengths[p.id] = p.templateLength));
  const balloons: Record<string, ArchetypeBalloonChoice> = {};
  a.balloons.forEach((b) => (balloons[b.id] = { color: b.color, colorName: b.colorName, size: b.size }));
  return { partLengths, balloons };
}

/** Bubbles and balloons of the archetype with the chosen lengths, colors and gauges applied. */
export function applyBuildSettings(a: Archetype, s: ArchetypeBuildSettings): { balloons: BalloonSpec[]; bubbles: BubbleSpec[] } {
  const sizeScale = new Map<string, number>();
  const balloons = a.balloons.map((b) => {
    const choice = s.balloons[b.id] ?? { color: b.color, colorName: b.colorName, size: b.size };
    sizeScale.set(b.id, defaultDiameterForSize(choice.size) / defaultDiameterForSize(b.size));
    return {
      ...b,
      size: choice.size,
      color: choice.color,
      colorName: choice.colorName,
      name: b.name.replace(/\b(160|260|360)\b/g, choice.size),
      brand: undefined,
      catalogItemId: undefined,
    };
  });
  const bubbles = a.bubbles.map((b) => ({ ...b }));
  a.parts.forEach((p) => {
    const target = s.partLengths[p.id];
    if (target === undefined || p.fixed) return;
    const factor = target / Math.max(0.25, p.templateLength);
    p.bubbleIndices.forEach((i) => {
      const b = bubbles[i];
      if (!b || isSmallFixed(b)) return;
      b.lengthInches = q(Math.max(0.75, b.lengthInches * factor));
      b.lengthFingers = undefined;
    });
  });
  bubbles.forEach((b) => {
    const k = sizeScale.get(b.balloonId) ?? 1;
    const bal = balloons.find((x) => x.id === b.balloonId);
    b.diameterInches = q(Math.max(0.5, b.diameterInches * k));
    if (bal) b.color = bal.color;
  });
  return { balloons, bubbles };
}

/**
 * Air per balloon for a build, by the app's own air model: the balloon is inflated
 * just enough for its bubbles (as buildDesign does) and the budget is checked the
 * way the editor checks it, so the builder and the editor agree on what fits.
 */
export function buildAirUse(balloons: BalloonSpec[], bubbles: BubbleSpec[]): Array<{ balloon: BalloonSpec; used: number; capacity: number; over: boolean }> {
  return balloons.map((bal) => {
    const tail = fitTailForBubbles(bal, bubbles);
    const air = computeAirBudget({ ...bal, tailLengthInches: tail }, bubbles);
    return {
      balloon: bal,
      used: Math.round((air.bubbleInches + air.twistShiftInches) * 10) / 10,
      capacity: Math.round(air.inflatedInches * 10) / 10,
      over: air.status === "over_budget" || air.status === "pop_risk",
    };
  });
}

/** Build one tier's design from a plan with the chosen settings. */
export function buildDesignFromArchetype(a: Archetype, s: ArchetypeBuildSettings, complexity: ComplexityLevel, title: string, id: string): FullDesign {
  const { balloons, bubbles } = applyBuildSettings(a, s);
  return {
    ...buildDesign({
      id,
      title,
      description: `${title}: built from the "${a.name}" body plan.`,
      category: a.category,
      complexity,
      sourceType: "archetype",
      sourcePrompt: a.name,
      balloons: balloons.map((b) => ({ ...b })),
      bubbles: bubbles.map((b) => ({ ...b })),
      annotations: ["Built from a body plan: every twist is already anchored. Resize parts in 3D, or add detail bubbles from the palette."],
    }),
    orientation: a.orientation,
  };
}

export function colorNameForHex(hex: string): string {
  return TWISTER_COLORS.find((c) => c.hex.toLowerCase() === hex.toLowerCase())?.name ?? hex;
}
