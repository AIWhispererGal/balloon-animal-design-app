import { BalloonSize, BalloonSpec, BubbleSpec, ComplexityLevel, FullDesign } from "@/types/balloon";
import { PRESET_DESIGNS, buildDesign } from "./balloonPresets";
import { defaultDiameterForSize } from "./balloonLayout";
import { twistAirCost } from "./balloonAir";
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
  complexity: ComplexityLevel;
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
export function archetypeFromDesign(design: FullDesign, name: string, builtIn = false, id?: string): Archetype {
  const bubbles = design.bubbles.map((b, index) => ({ ...b, index }));
  return {
    id: id ?? `arch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || design.title,
    description: design.description,
    category: design.category || "custom",
    complexity: design.complexity,
    builtIn,
    balloons: design.balloons.map((b) => ({ ...b })),
    bubbles,
    parts: deriveParts(bubbles),
    orientation: design.orientation,
    createdAt: new Date().toISOString(),
  };
}

/* ---------------- built-in and saved archetypes ---------------- */

export const BUILT_IN_ARCHETYPES: Archetype[] = [
  archetypeFromDesign(PRESET_DESIGNS.dog.beginner, "Dog / quadruped (1 balloon)", true, "builtin-dog-1"),
  archetypeFromDesign(PRESET_DESIGNS.dog.intermediate, "Dachshund with paws (2 balloons)", true, "builtin-dog-2"),
  archetypeFromDesign(PRESET_DESIGNS.sword.beginner, "Cutlass sword (1 balloon)", true, "builtin-sword-1"),
  archetypeFromDesign(PRESET_DESIGNS.sword.intermediate, "Broadsword (2 balloons)", true, "builtin-sword-2"),
  archetypeFromDesign(PRESET_DESIGNS.flower.beginner, "Daisy flower (2 balloons)", true, "builtin-flower-2"),
];

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
    return Array.isArray(parsed) ? parsed.filter(isArchetype).map((a) => ({ ...a, builtIn: false })) : [];
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

/** Save a one- or two-balloon design as a body plan in this browser. */
export function saveDesignAsArchetype(design: FullDesign, name: string): { ok: true; archetype: Archetype } | { ok: false; reason: string } {
  if (design.bubbles.length === 0) return { ok: false, reason: "The design has no bubbles yet." };
  if (design.balloons.length > MAX_ARCHETYPE_BALLOONS) {
    return { ok: false, reason: `Body plans are one- or two-balloon recipes (this design has ${design.balloons.length} balloons).` };
  }
  const archetype = archetypeFromDesign(design, name);
  const list = [archetype, ...listCustomArchetypes().filter((a) => a.name.toLowerCase() !== archetype.name.toLowerCase())];
  return writeCustom(list) ? { ok: true, archetype } : { ok: false, reason: "Browser storage is unavailable or full." };
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

/** Inches of balloon a build needs per balloon, against what one balloon can give. */
export function buildAirUse(balloons: BalloonSpec[], bubbles: BubbleSpec[]): Array<{ balloon: BalloonSpec; used: number; capacity: number; over: boolean }> {
  return balloons.map((bal) => {
    let used = 0;
    bubbles.forEach((b) => {
      if (b.balloonId !== bal.id) return;
      used += b.lengthInches + twistAirCost(b.twistType);
    });
    const capacity = bal.size === "260" ? 50 : 42;
    return { balloon: bal, used: Math.round(used * 10) / 10, capacity, over: used > capacity };
  });
}

/** Build the three editor tiers from an archetype. All three start as the same sculpture. */
export function buildDesignsFromArchetype(a: Archetype, s: ArchetypeBuildSettings): Record<ComplexityLevel, FullDesign> {
  const { balloons, bubbles } = applyBuildSettings(a, s);
  const title = (s.title ?? "").trim() || a.name.replace(/\s*\(\d balloons?\)\s*$/i, "");
  const stamp = Date.now().toString(36);
  const make = (complexity: ComplexityLevel): FullDesign => ({
    ...buildDesign({
      id: `arch-${stamp}-${complexity}`,
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
  });
  return { beginner: make("beginner"), intermediate: make("intermediate"), advanced: make("advanced") };
}

export function colorNameForHex(hex: string): string {
  return TWISTER_COLORS.find((c) => c.hex.toLowerCase() === hex.toLowerCase())?.name ?? hex;
}
