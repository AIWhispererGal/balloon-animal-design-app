import { BalloonSpec, BubbleSpec, TwistType } from "@/types/balloon";
import { roundQuarter } from "./balloonLayout";

/**
 * Pure, index-safe editing operations on a design's bubble sequence.
 *
 * Bubbles reference each other by array index (`lockToBubbleStart`,
 * `branchFrom`, `attachTo`), so every insertion / removal / reorder must remap
 * those references by bubble id. All helpers here return new arrays and never
 * mutate their inputs.
 */

export interface DesignEdit {
  balloons: BalloonSpec[];
  bubbles: BubbleSpec[];
  /** Index to select after the edit */
  focusIndex: number;
}

export const newBubbleId = (prefix = "b") =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function twistFlags(t: TwistType): Pick<BubbleSpec, "isLoop" | "isPinch" | "isTulip"> {
  return {
    isLoop: t === "loop",
    isPinch: t === "pinch" || t === "toe",
    isTulip: t === "tulip" || t === "tulip_chain",
  };
}

/**
 * Re-number `index` and remap every index-based reference from the old
 * sequence to the new one. References to bubbles that no longer exist are
 * dropped (or, for balloon attachments, fall back to the first bubble).
 */
export function remapIndexRefs(
  oldBubbles: BubbleSpec[],
  nextBubblesRaw: BubbleSpec[],
  balloons: BalloonSpec[]
): { balloons: BalloonSpec[]; bubbles: BubbleSpec[] } {
  const idByOldIndex = new Map<number, string>();
  oldBubbles.forEach((b, i) => idByOldIndex.set(i, b.id));
  const newIndexById = new Map<string, number>();
  nextBubblesRaw.forEach((b, i) => newIndexById.set(b.id, i));

  const mapIdx = (oldIdx: number | undefined): number | undefined => {
    if (oldIdx === undefined) return undefined;
    const id = idByOldIndex.get(oldIdx);
    if (!id) return undefined;
    return newIndexById.get(id);
  };

  const bubbles = nextBubblesRaw.map((b, i) => {
    const next: BubbleSpec = { ...b, index: i };
    if (b.lockToBubbleStart !== undefined) {
      const mapped = mapIdx(b.lockToBubbleStart);
      next.lockToBubbleStart = mapped !== undefined && mapped !== i ? mapped : undefined;
    }
    if (b.branchFrom) {
      const mapped = mapIdx(b.branchFrom.bubbleIndex);
      next.branchFrom = mapped !== undefined ? { ...b.branchFrom, bubbleIndex: mapped } : undefined;
    }
    return next;
  });

  const nextBalloons = balloons.map((bal) => {
    if (!bal.attachTo) return bal;
    const mapped = mapIdx(bal.attachTo.bubbleIndex);
    if (mapped !== undefined) return { ...bal, attachTo: { ...bal.attachTo, bubbleIndex: mapped } };
    return bubbles.length > 0
      ? { ...bal, attachTo: { bubbleIndex: 0, end: "end" as const } }
      : { ...bal, attachTo: undefined };
  });

  return { balloons: nextBalloons, bubbles };
}

export function insertBubbles(
  balloons: BalloonSpec[],
  bubbles: BubbleSpec[],
  at: number,
  toInsert: BubbleSpec[]
): DesignEdit {
  const insertAt = Math.max(0, Math.min(at, bubbles.length));
  const next = [...bubbles];
  next.splice(insertAt, 0, ...toInsert);
  const remapped = remapIndexRefs(bubbles, next, balloons);
  return { ...remapped, focusIndex: insertAt };
}

export function deleteBubbles(
  balloons: BalloonSpec[],
  bubbles: BubbleSpec[],
  indices: number[]
): DesignEdit {
  const drop = new Set(indices);
  const next = bubbles.filter((_, i) => !drop.has(i));
  const remapped = remapIndexRefs(bubbles, next, balloons);
  const first = Math.min(...indices);
  return { ...remapped, focusIndex: Math.max(0, Math.min(first, next.length - 1)) };
}

export function moveBubble(
  balloons: BalloonSpec[],
  bubbles: BubbleSpec[],
  from: number,
  to: number
): DesignEdit {
  if (to < 0 || to >= bubbles.length || from === to) {
    return { balloons, bubbles, focusIndex: from };
  }
  const next = [...bubbles];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  const remapped = remapIndexRefs(bubbles, next, balloons);
  return { ...remapped, focusIndex: to };
}

export type SplitMode =
  | { kind: "equal"; parts: number }
  | { kind: "at"; inches: number }
  | { kind: "lock_pair" }
  | { kind: "pinch_between" };

/**
 * Split one bubble into several along its length. Total length is preserved,
 * so the air budget does not change — only the number of twists does.
 *
 *  - equal:          N equal basic bubbles
 *  - at:             two bubbles, the first `inches` long (click-to-split)
 *  - lock_pair:      two equal bubbles both set to Lock Twist (ears / legs)
 *  - pinch_between:  two bubbles with a small locking pinch twist between them
 */
export function splitBubble(
  balloons: BalloonSpec[],
  bubbles: BubbleSpec[],
  index: number,
  mode: SplitMode
): DesignEdit | null {
  const src = bubbles[index];
  if (!src) return null;
  const total = src.lengthInches;
  const dia = src.diameterInches || 2;
  const minLen = 0.5;

  const parts: Array<{ length: number; twist: TwistType; label: string }> = [];
  const baseLabel = src.label.replace(/\s+\d+$/, "");

  switch (mode.kind) {
    case "equal": {
      const n = Math.max(2, Math.min(6, Math.round(mode.parts)));
      if (total < minLen * n) return null;
      const each = roundQuarter(total / n);
      for (let i = 0; i < n; i++) {
        const isLast = i === n - 1;
        parts.push({
          length: isLast ? roundQuarter(total - each * (n - 1)) : each,
          twist: "basic",
          label: `${baseLabel} ${i + 1}`,
        });
      }
      break;
    }
    case "at": {
      const a = roundQuarter(Math.max(minLen, Math.min(total - minLen, mode.inches)));
      const b = roundQuarter(total - a);
      if (a < minLen || b < minLen) return null;
      parts.push({ length: a, twist: "basic", label: `${baseLabel} 1` });
      parts.push({ length: b, twist: "basic", label: `${baseLabel} 2` });
      break;
    }
    case "lock_pair": {
      if (total < minLen * 2) return null;
      const each = roundQuarter(total / 2);
      parts.push({ length: each, twist: "lock", label: `${baseLabel} A` });
      parts.push({ length: roundQuarter(total - each), twist: "lock", label: `${baseLabel} B` });
      break;
    }
    case "pinch_between": {
      const pinch = roundQuarter(Math.max(0.5, dia * 0.55));
      const rest = total - pinch;
      if (rest < minLen * 2) return null;
      const a = roundQuarter(rest / 2);
      parts.push({ length: a, twist: "basic", label: `${baseLabel} 1` });
      parts.push({ length: pinch, twist: "pinch", label: `${baseLabel} Pinch Lock` });
      parts.push({ length: roundQuarter(rest - a), twist: "basic", label: `${baseLabel} 2` });
      break;
    }
  }

  const pieces: BubbleSpec[] = parts.map((p, i) => {
    const isFirst = i === 0;
    const isLast = i === parts.length - 1;
    const piece: BubbleSpec = {
      id: isFirst ? src.id : newBubbleId("b-split"),
      balloonId: src.balloonId,
      index: index + i,
      label: p.label,
      lengthInches: p.length,
      diameterInches: src.diameterInches,
      twistType: p.twist,
      color: src.color,
      ...twistFlags(p.twist),
      // The first piece keeps the original heading; later pieces continue straight.
      bend: isFirst ? src.bend : undefined,
      turn: isFirst ? src.turn : undefined,
      baseDir: isFirst ? src.baseDir : undefined,
      branchFrom: isFirst ? src.branchFrom : undefined,
      // A return-lock belongs to the far end, so it stays on the last piece.
      lockToBubbleStart: isLast ? src.lockToBubbleStart : undefined,
      positionOffset: isFirst ? src.positionOffset : undefined,
    };
    return piece;
  });

  const next = [...bubbles];
  next.splice(index, 1, ...pieces);
  const remapped = remapIndexRefs(bubbles, next, balloons);
  return { ...remapped, focusIndex: index };
}

export interface TwistTogetherResult extends DesignEdit {
  summary: string;
}

/**
 * Twist the joint before bubble `first` together with the joint after bubble
 * `last` (both on one balloon). Everything in between closes into a ring:
 *
 *  - 1 bubble    → a loop twist
 *  - 2 bubbles   → a folded 2-bubble lock pair (ears, legs)
 *  - 3+ bubbles  → the last bubble's far end locks back into the first
 *                  bubble's starting joint (closed loop lock)
 */
export function twistRange(
  balloons: BalloonSpec[],
  bubbles: BubbleSpec[],
  first: number,
  last: number
): TwistTogetherResult | { error: string } {
  if (first > last) [first, last] = [last, first];
  if (!bubbles[first] || !bubbles[last]) return { error: "Those bubbles no longer exist." };
  for (let i = first; i <= last; i++) {
    if (bubbles[i].balloonId !== bubbles[first].balloonId) {
      return {
        error: "Twist together works along one balloon. Attach a second balloon with “Add balloon” instead.",
      };
    }
  }
  const next = bubbles.map((b) => ({ ...b }));
  const count = last - first + 1;
  let summary = "";

  if (count === 1) {
    next[first] = { ...next[first], twistType: "loop", ...twistFlags("loop"), lockToBubbleStart: undefined };
    summary = `Folded “${bubbles[first].label}” into a loop twist.`;
  } else if (count === 2) {
    const a = next[first];
    const hasHeading = a.bend !== undefined || a.turn !== undefined || a.baseDir !== undefined;
    next[first] = {
      ...a,
      twistType: "lock",
      ...twistFlags("lock"),
      lockToBubbleStart: undefined,
      // Fold the pair out to the side so the rest of the balloon doesn't run through it
      bend: hasHeading ? a.bend : 70,
      turn: hasHeading ? a.turn : 10,
    };
    next[last] = { ...next[last], twistType: "lock", ...twistFlags("lock"), lockToBubbleStart: undefined };
    const avg = roundQuarter((next[first].lengthInches + next[last].lengthInches) / 2);
    summary = `Lock-twisted “${bubbles[first].label}” and “${bubbles[last].label}” together as a ${avg}″ pair.`;
  } else {
    // Fold the ring into a regular polygon so the bubbles don't lie on top of
    // each other: every bubble after the first turns by the exterior angle.
    const fold = Math.round((360 / count) * 10) / 10;
    for (let i = first; i <= last; i++) {
      if (next[i].twistType === "lock" || next[i].twistType === "bird_body") {
        next[i] = { ...next[i], twistType: "basic", ...twistFlags("basic") };
      }
      if (i !== last) next[i] = { ...next[i], lockToBubbleStart: undefined };
      const hasHeading = next[i].bend !== undefined || next[i].turn !== undefined || next[i].baseDir !== undefined;
      if (i > first && !hasHeading) next[i] = { ...next[i], bend: fold, turn: 0 };
    }
    next[last] = { ...next[last], lockToBubbleStart: first };
    summary = `Closed bubbles #${first + 1}–#${last + 1} into a locked ring (the joint before “${bubbles[first].label}” and the joint after “${bubbles[last].label}” twisted together).`;
  }

  return { balloons, bubbles: next, focusIndex: first, summary };
}

/**
 * "Twist these together" from a bubble selection: adjacent bubbles twist as a
 * group (2 → lock pair, 3+ → bird-body roll-through); a spread-out selection
 * closes everything from the first to the last into a ring.
 */
export function twistTogether(
  balloons: BalloonSpec[],
  bubbles: BubbleSpec[],
  indicesIn: number[]
): TwistTogetherResult | { error: string } {
  const indices = Array.from(new Set(indicesIn))
    .filter((i) => bubbles[i])
    .sort((a, b) => a - b);
  if (indices.length < 2) return { error: "Select at least two bubbles to twist together." };

  const adjacent = indices.every((v, k) => k === 0 || v === indices[k - 1] + 1);
  if (adjacent && indices.length >= 3) {
    const balloonIds = new Set(indices.map((i) => bubbles[i].balloonId));
    if (balloonIds.size > 1) return { error: "Twist together works along one balloon." };
    const next = bubbles.map((b) => ({ ...b }));
    indices.forEach((i) => {
      next[i] = { ...next[i], twistType: "bird_body", ...twistFlags("bird_body"), lockToBubbleStart: undefined };
    });
    return {
      balloons,
      bubbles: next,
      focusIndex: indices[0],
      summary: `Rolled ${indices.length} bubbles through as a bird-body bundle.`,
    };
  }
  return twistRange(balloons, bubbles, indices[0], indices[indices.length - 1]);
}

/** Undo a twist-together: unlock the selected bubbles back to basic twists. */
export function releaseTwists(
  balloons: BalloonSpec[],
  bubbles: BubbleSpec[],
  indices: number[]
): DesignEdit {
  const set = new Set(indices);
  const next = bubbles.map((b, i) =>
    set.has(i)
      ? { ...b, twistType: "basic" as TwistType, ...twistFlags("basic"), lockToBubbleStart: undefined }
      : b
  );
  return { balloons, bubbles: next, focusIndex: Math.min(...indices) };
}

export function equalizeLengths(
  balloons: BalloonSpec[],
  bubbles: BubbleSpec[],
  indices: number[]
): DesignEdit {
  const valid = indices.filter((i) => bubbles[i]);
  if (valid.length < 2) return { balloons, bubbles, focusIndex: valid[0] ?? 0 };
  const avg = roundQuarter(valid.reduce((s, i) => s + bubbles[i].lengthInches, 0) / valid.length);
  const set = new Set(valid);
  const next = bubbles.map((b, i) => (set.has(i) ? { ...b, lengthInches: avg } : b));
  return { balloons, bubbles: next, focusIndex: Math.min(...valid) };
}
