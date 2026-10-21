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
 * "Twist these together": the real-world move of bringing two or more twist
 * joints to the same point and twisting them as one.
 *
 *  - 2 adjacent bubbles    → a folded 2-bubble Lock Twist (ears, legs)
 *  - 3+ adjacent bubbles   → a Bird Body roll-through bundle
 *  - 2+ non-adjacent       → the last bubble's far end locks back into the
 *                            first bubble's starting joint (closed loop lock)
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

  const balloonIds = new Set(indices.map((i) => bubbles[i].balloonId));
  if (balloonIds.size > 1) {
    return {
      error: "Twist together works on bubbles of the same balloon. Attach a second balloon with “Add balloon” instead.",
    };
  }

  const adjacent = indices.every((v, k) => k === 0 || v === indices[k - 1] + 1);
  const next = bubbles.map((b) => ({ ...b }));
  let summary = "";

  if (adjacent && indices.length === 2) {
    indices.forEach((i) => {
      next[i] = { ...next[i], twistType: "lock", ...twistFlags("lock"), lockToBubbleStart: undefined };
    });
    const avg = roundQuarter((next[indices[0]].lengthInches + next[indices[1]].lengthInches) / 2);
    summary = `Lock-twisted “${bubbles[indices[0]].label}” and “${bubbles[indices[1]].label}” together as a ${avg}″ pair.`;
  } else if (adjacent) {
    indices.forEach((i) => {
      next[i] = { ...next[i], twistType: "bird_body", ...twistFlags("bird_body"), lockToBubbleStart: undefined };
    });
    summary = `Rolled ${indices.length} bubbles through as a bird-body bundle.`;
  } else {
    const first = indices[0];
    const last = indices[indices.length - 1];
    next[last] = { ...next[last], lockToBubbleStart: first };
    if (next[last].twistType === "lock" || next[last].twistType === "bird_body") {
      next[last] = { ...next[last], twistType: "basic", ...twistFlags("basic") };
    }
    summary = `Locked the end of “${bubbles[last].label}” back into the joint before “${bubbles[first].label}”.`;
  }

  return { balloons, bubbles: next, focusIndex: indices[0], summary };
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
