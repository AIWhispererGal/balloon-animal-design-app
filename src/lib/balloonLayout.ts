import {
  BalloonSpec,
  BubbleSpec,
  JointAnchorRef,
  StabilityAutoFix,
  StabilityIssue,
  StabilityReport,
  StepSpec,
} from "@/types/balloon";
import { computeAirBudget, fitTailForBubbles } from "./balloonAir";

/**
 * Unified 3D Kinematic Topology & Physical Stability Engine
 * =========================================================
 * SINGLE SOURCE OF TRUTH for:
 *   1. Exact 3D joint positions, orientations, lateral pairing & fold geometry
 *   2. Real balloon twist stability rules (what holds vs. what untwists naturally)
 *   3. "Let Go" hands-free physical relaxation simulation
 *   4. Step-by-step build states & exact step instruction generation
 *
 * Coordinate convention (design space, inches; scaled by UNIT for Three.js):
 *   +X = forward-to-rear spine axis, +Y = up, +Z = left side of sculpture.
 */

export type Vec3 = [number, number, number];

export const UNIT = 0.5; // Three.js scene units per physical inch

const WORLD_UP: Vec3 = [0, 1, 0];

/* ---------------- pure vector math helpers ---------------- */

export const vAdd = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const vSub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const vScale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const vLerp = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
export const vDot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const vCross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const vLen = (a: Vec3): number => Math.sqrt(vDot(a, a)) || 0;
export const vDist = (a: Vec3, b: Vec3): number => vLen(vSub(a, b));
export const vNorm = (a: Vec3, fallback: Vec3 = [1, 0, 0]): Vec3 => {
  const l = vLen(a);
  return l > 1e-6 ? vScale(a, 1 / l) : fallback;
};

/** Rodrigues rotation of vector v around axis by angleDeg degrees. */
export function vRotate(v: Vec3, axisIn: Vec3, angleDeg: number): Vec3 {
  if (!angleDeg) return vNorm(v);
  const axis = vNorm(axisIn, [0, 0, 1]);
  const t = (angleDeg * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return vNorm(
    vAdd(
      vAdd(vScale(v, c), vScale(vCross(axis, v), s)),
      vScale(axis, vDot(axis, v) * (1 - c))
    ),
    v
  );
}

/** `v` with its component along unit vector `dir` removed (not normalised). */
const vRejectFrom = (v: Vec3, dir: Vec3): Vec3 => vSub(v, vScale(dir, vDot(v, dir)));

/**
 * Stable orthonormal frame around `dir`: `side` lies horizontal when possible.
 * A vertical (or nearly vertical) heading has no horizontal perpendicular, so
 * there `side` comes from `fallbackSide` (the lateral of the chain feeding this
 * heading, when the caller has one) instead of being arbitrary.
 */
export function frameFor(dirIn: Vec3, fallbackSide?: Vec3): { side: Vec3; up: Vec3 } {
  const dir = vNorm(dirIn);
  // side = WORLD_UP x dir so for dir = +X (1,0,0), side = -Z and up = +Y
  let side = vCross(WORLD_UP, dir);
  if (vLen(side) < 0.05) {
    const fromHint = fallbackSide ? vRejectFrom(fallbackSide, dir) : ([0, 0, 0] as Vec3);
    side = vLen(fromHint) > 0.2 ? fromHint : [0, 0, 1];
  }
  side = vNorm(side, [0, 0, 1]);
  const up = vNorm(vCross(dir, side), WORLD_UP);
  return { side, up };
}

/**
 * Frame around `dir` whose `side` is the parent's lateral `hintSide` carried along
 * (parallel transport): the closest unit vector to `hintSide` that is perpendicular
 * to `dir`. This is the lateral a twister folds a pair of legs or ears across: the
 * pair sits side by side relative to the body it hangs from, however steeply the
 * limbs point. Falls back to the horizontal frame when the hint is (nearly)
 * parallel to `dir`.
 */
export function transportFrame(dirIn: Vec3, hintSide: Vec3 | undefined): { side: Vec3; up: Vec3 } {
  const dir = vNorm(dirIn);
  const projected = hintSide ? vRejectFrom(hintSide, dir) : ([0, 0, 0] as Vec3);
  if (vLen(projected) < 0.2) return frameFor(dir, hintSide);
  const side = vNorm(projected);
  const up = vNorm(vCross(dir, side), WORLD_UP);
  return { side, up };
}

export const roundQuarter = (v: number): number => Math.round(v * 4) / 4;

/**
 * Apply the whole-sculpture orientation (degrees [pitch, yaw, roll]) to a point,
 * exactly as the 3D viewer rotates its pivot (Three.js XYZ Euler: roll about Z
 * first, then yaw about Y, then pitch about X). Step diagrams use this so they
 * show the sculpture the same way up as the design view.
 */
export function rotateByOrientation(p: Vec3, orientation: [number, number, number] | undefined): Vec3 {
  if (!orientation || (!orientation[0] && !orientation[1] && !orientation[2])) return p;
  let v: Vec3 = p;
  const [pitch, yaw, roll] = orientation;
  const rot = (q: Vec3, axis: Vec3, deg: number): Vec3 => {
    if (!deg) return q;
    const t = (deg * Math.PI) / 180;
    const c = Math.cos(t);
    const s = Math.sin(t);
    return vAdd(vAdd(vScale(q, c), vScale(vCross(axis, q), s)), vScale(axis, vDot(axis, q) * (1 - c)));
  };
  v = rot(v, [0, 0, 1], roll);
  v = rot(v, [0, 1, 0], yaw);
  v = rot(v, [1, 0, 0], pitch);
  return v;
}

/* ---------------- layout & joint types ---------------- */

export type BubbleKind =
  | "capsule"
  | "loop"
  | "pinch"
  | "tulip"
  | "bird_rail"
  | "spiral"
  | "bent"
  | "bead";

export interface JointNode {
  id: number;
  pos: Vec3; // canonical joint position in scene units
  lockReasons: string[];
  balloonIds: Set<string>;
  bubbleIndices: number[];
  isLocked: boolean;
}

export interface BubbleLayout {
  index: number;
  bubble: BubbleSpec;
  kind: BubbleKind;
  /** Physical joint IDs before/after this bubble */
  startJointId: number;
  endJointId: number;
  /** Canonical joint coordinates (un-offset) */
  jointStart: Vec3;
  jointEnd: Vec3;
  /** Rendered geometry start / end / midpoint in scene units */
  start: Vec3;
  end: Vec3;
  mid: Vec3;
  /** Centerline control points when bowed/folded (e.g. bird_rail, side_bubble, loop) */
  bowOut?: Vec3;
  /** Partner tip when this bubble starts a 2-bubble folded lock pair (draws smooth U-crease!) */
  foldBridgeTo?: Vec3;
  /** Partner index when paired symmetrically (lock pair or double pinch) */
  partnerIndex?: number;
  /** Unit direction the bubble points */
  dir: Vec3;
  /** Incoming reference direction BEFORE this bubble's `bend`/`turn` were applied */
  incomingDir: Vec3;
  side: Vec3;
  up: Vec3;
  lengthUnits: number;
  radiusUnits: number;
  /** Where the NEXT bubble on this balloon starts (canonical joint, scene units) */
  chainEnd: Vec3;
  /** Chain heading after this bubble */
  chainDir: Vec3;
  /** True when the seam at the end of this bubble is unanchored & untwists if released */
  endSeamWillUntwist?: boolean;
  /** True when rendered in collapsed/unraveled state during "Let Go" physics test */
  unraveledInRelease?: boolean;
}

export interface BalloonChainInfo {
  balloonId: string;
  startPos: Vec3;
  startDir: Vec3;
  radiusUnits: number;
  color: string;
  attachedJointLabel?: string;
  /** True when the balloon has no bubbles yet (rendered as one untwisted tube) */
  isEmpty?: boolean;
}

export interface BalloonLayoutResult {
  layouts: BubbleLayout[];
  chains: Map<string, BalloonChainInfo>;
  joints: JointNode[];
  stability: StabilityReport;
}

export interface LayoutOptions {
  /** When true, un-anchored twists physically unravel in the returned 3D geometry! */
  releasedHands?: boolean;
  /** Internal: disables the free-standing look-ahead when laying out one balloon on its own */
  __noLookAhead?: boolean;
}

export function radiusForDiameter(diameterInches: number | undefined): number {
  return Math.max(0.16, (diameterInches || 2.0) * 0.28);
}

export function defaultDiameterForSize(size: string | undefined): number {
  if (size === "160") return 1.0;
  if (size === "360") return 3.0;
  return 2.0;
}

function classifyKind(b: BubbleSpec): BubbleKind {
  if (b.twistType === "loop" || b.isLoop) return "loop";
  if (b.twistType === "pinch" || b.twistType === "toe" || b.isPinch) return "pinch";
  if (
    b.twistType === "tulip" ||
    b.twistType === "tulip_chain" ||
    b.twistType === "apple_link" ||
    b.isTulip
  ) {
    return "tulip";
  }
  if (b.twistType === "bird_body") return "bird_rail";
  if (b.twistType === "spiral") return "spiral";
  if (b.twistType === "s_hook" || b.twistType === "z_bend") return "bent";
  if (b.twistType === "cut_tail_bubbles" || b.twistType === "cut_tail") return "bead";
  return "capsule";
}

function inferInitialDir(b: BubbleSpec): Vec3 {
  if (b.baseDir) return vNorm(b.baseDir);
  const l = b.label.toLowerCase();
  if (/blade|pommel|handle|grip|sword|horn|wand|cane/.test(l)) return [0, 1, 0];
  if (/stem|stalk/.test(l)) return [0, -1, 0];
  return [1, 0, 0];
}

/* ---------------- main solver ---------------- */

export function computeBalloonLayout(
  balloons: BalloonSpec[],
  bubbles: BubbleSpec[],
  options: LayoutOptions = {}
): BalloonLayoutResult {
  const joints: JointNode[] = [];
  const chains = new Map<string, BalloonChainInfo>();

  const findOrCreateJoint = (pos: Vec3, balloonId: string, bubbleIdx: number): JointNode => {
    for (const j of joints) {
      if (vDist(j.pos, pos) < 0.09) {
        j.balloonIds.add(balloonId);
        if (bubbleIdx >= 0 && !j.bubbleIndices.includes(bubbleIdx)) {
          j.bubbleIndices.push(bubbleIdx);
        }
        return j;
      }
    }
    const created: JointNode = {
      id: joints.length,
      pos: [...pos] as Vec3,
      lockReasons: [],
      balloonIds: new Set([balloonId]),
      bubbleIndices: bubbleIdx >= 0 ? [bubbleIdx] : [],
      isLocked: false,
    };
    joints.push(created);
    return created;
  };

  interface ChainCursor {
    pos: Vec3;
    dir: Vec3;
    /** Lateral of the chain at `dir`, carried along the balloon (pairs fold across it) */
    side: Vec3;
    pinchCountAtPos: number;
    sideCountAtPos: number;
  }

  const cursors = new Map<string, ChainCursor>();
  let primaryCursor: ChainCursor | null = null;
  let primaryStart: Vec3 = [0, 0, 0];
  const rawLayouts: BubbleLayout[] = new Array(bubbles.length);
  // Free-standing balloons (no tie-in joint) are stacked under everything laid out so far,
  // each one spaced by its own real extent so legs and loops never overlap the neighbour.
  let freeStandingFloor: number | null = null;
  const laidOutMinY = (): number => {
    let minY = Infinity;
    rawLayouts.forEach((l) => {
      if (!l) return;
      minY = Math.min(minY, l.start[1] - l.radiusUnits, l.end[1] - l.radiusUnits, l.mid[1] - l.radiusUnits);
    });
    chains.forEach((c) => {
      minY = Math.min(minY, c.startPos[1] - c.radiusUnits);
    });
    return Number.isFinite(minY) ? minY : 0;
  };
  const freeStandingOffset = (bal: BalloonSpec | undefined, radiusUnits: number): Vec3 => {
    // Height of this balloon above its own start, from a private layout of just its bubbles
    let riseAbove = radiusUnits;
    let span = radiusUnits * 2;
    if (bal && !options.__noLookAhead) {
      const own = bubbles.filter((b) => b.balloonId === bal.id).map((b) => ({ ...b, lockToJoint: undefined, branchFrom: undefined }));
      if (own.length > 0) {
        const sub = computeBalloonLayout([{ ...bal, attachTo: undefined, offset: undefined }], own, { __noLookAhead: true });
        const start = sub.chains.get(bal.id)?.startPos ?? [0, 0, 0];
        let maxY = -Infinity;
        let minY = Infinity;
        sub.layouts.forEach((l) => {
          maxY = Math.max(maxY, l.start[1] + l.radiusUnits, l.end[1] + l.radiusUnits, l.mid[1] + l.radiusUnits);
          minY = Math.min(minY, l.start[1] - l.radiusUnits, l.end[1] - l.radiusUnits, l.mid[1] - l.radiusUnits);
        });
        if (Number.isFinite(maxY)) {
          riseAbove = maxY - start[1];
          span = maxY - minY;
        }
      }
    }
    const floor = freeStandingFloor ?? laidOutMinY();
    const gap = 0.6;
    const y = floor - gap - riseAbove;
    freeStandingFloor = y - (span - riseAbove);
    const user = bal?.offset ? vScale(bal.offset, UNIT) : ([0, 0, 0] as Vec3);
    return vAdd([0, y - primaryStart[1], 0], user);
  };

  // Pre-scan per-balloon sequences so multi-bubble structures (2-bubble lock pair,
  // 3-bubble bird body, multi-petal loop rosettes, double pinches) know their exact peers!
  const indicesByBalloon = new Map<string, number[]>();
  bubbles.forEach((b, idx) => {
    const arr = indicesByBalloon.get(b.balloonId) || [];
    arr.push(idx);
    indicesByBalloon.set(b.balloonId, arr);
  });

  // Identify canonical pairs & groups along each balloon
  const lockPairRole = new Map<number, { role: "out" | "return"; partner: number }>();
  const birdGroupInfo = new Map<number, { groupIndices: number[]; slot: number }>();
  const loopGroupInfo = new Map<number, { groupIndices: number[]; slot: number }>();

  indicesByBalloon.forEach((seq) => {
    let k = 0;
    while (k < seq.length) {
      const idx = seq[k];
      const b = bubbles[idx];
      if (
        b.twistType === "lock" &&
        b.lockToBubbleStart === undefined &&
        !b.branchFrom &&
        k + 1 < seq.length &&
        bubbles[seq[k + 1]].twistType === "lock" &&
        bubbles[seq[k + 1]].lockToBubbleStart === undefined &&
        !bubbles[seq[k + 1]].branchFrom
      ) {
        lockPairRole.set(idx, { role: "out", partner: seq[k + 1] });
        lockPairRole.set(seq[k + 1], { role: "return", partner: idx });
        k += 2;
        continue;
      }
      if (b.twistType === "bird_body") {
        const grp = [idx];
        let m = k + 1;
        while (m < seq.length && bubbles[seq[m]].twistType === "bird_body") {
          grp.push(seq[m]);
          m++;
        }
        grp.forEach((gi, slot) => birdGroupInfo.set(gi, { groupIndices: grp, slot }));
        k = m;
        continue;
      }
      if ((b.twistType === "loop" || b.isLoop) && !b.branchFrom) {
        const grp = [idx];
        let m = k + 1;
        while (
          m < seq.length &&
          (bubbles[seq[m]].twistType === "loop" || bubbles[seq[m]].isLoop) &&
          !bubbles[seq[m]].branchFrom
        ) {
          grp.push(seq[m]);
          m++;
        }
        grp.forEach((gi, slot) => loopGroupInfo.set(gi, { groupIndices: grp, slot }));
        k = m;
        continue;
      }
      k++;
    }
  });

  const resolveAnchor = (ref: JointAnchorRef | undefined): { pos: Vec3; label: string } | null => {
    if (!ref) return null;
    const target = rawLayouts[ref.bubbleIndex];
    if (!target) return null;
    const pos = ref.end === "start" ? target.jointStart : target.jointEnd;
    return {
      pos: [...pos] as Vec3,
      label: `${bubbles[ref.bubbleIndex]?.label || `Bubble #${ref.bubbleIndex + 1}`} (${ref.end} joint)`,
    };
  };

  const getCursor = (b: BubbleSpec, bubbleIdx: number): ChainCursor => {
    const existing = cursors.get(b.balloonId);
    if (existing) return existing;

    const bal = balloons.find((x) => x.id === b.balloonId);
    const anchor = resolveAnchor(b.branchFrom ?? bal?.attachTo);

    let pos: Vec3 = [0, 0, 0];
    let dir: Vec3 = inferInitialDir(b);
    if (anchor) {
      pos = anchor.pos;
    } else if (primaryCursor) {
      pos = vAdd(primaryStart, freeStandingOffset(bal, radiusForDiameter(defaultDiameterForSize(bal?.size))));
      // A free-standing balloon with a joint twisted into another balloon is
      // moved as a whole so that joint lands on its partner without stretching.
      const own = indicesByBalloon.get(b.balloonId) ?? [];
      const linkIdx = own.find((bi) => bubbles[bi].lockToJoint && rawLayouts[bubbles[bi].lockToJoint!.bubbleIndex]);
      if (linkIdx !== undefined && !options.__noLookAhead) {
        const target = resolveAnchor(bubbles[linkIdx].lockToJoint);
        if (target) {
          const localBubbles = own.map((bi) => ({ ...bubbles[bi], lockToJoint: undefined, branchFrom: undefined }));
          const localBal = bal ? [{ ...bal, attachTo: undefined }] : [];
          const sub = computeBalloonLayout(localBal, localBubbles, { __noLookAhead: true });
          const localEnd = sub.layouts[own.indexOf(linkIdx)]?.jointEnd;
          const localStart = sub.chains.get(b.balloonId)?.startPos ?? [0, 0, 0];
          if (localEnd) {
            pos = vAdd(target.pos, vSub(localStart, localEnd));
            dir = sub.chains.get(b.balloonId)?.startDir ?? dir;
          }
        }
      }
    }

    const cur: ChainCursor = {
      pos,
      dir,
      side: frameFor(dir).side,
      pinchCountAtPos: 0,
      sideCountAtPos: 0,
    };
    cursors.set(b.balloonId, cur);
    if (!primaryCursor) {
      primaryCursor = cur;
      primaryStart = [...pos] as Vec3;
    }

    const startJoint = findOrCreateJoint(pos, b.balloonId, bubbleIdx);
    // Tying a secondary balloon's nozzle around an existing joint knots it tight!
    if (anchor || startJoint.balloonIds.size > 1) {
      if (!startJoint.lockReasons.includes("Tied multi-balloon knot")) {
        startJoint.lockReasons.push("Tied multi-balloon knot");
      }
    }

    chains.set(b.balloonId, {
      balloonId: b.balloonId,
      startPos: [...pos] as Vec3,
      startDir: [...dir] as Vec3,
      radiusUnits: radiusForDiameter(defaultDiameterForSize(bal?.size)),
      color: bal?.color || b.color,
      attachedJointLabel: anchor?.label,
    });
    return cur;
  };

  // Track bird-body start/end per group so all rails converge cleanly at the exact two joints
  const activeBirdSpan = new Map<
    number,
    { startPos: Vec3; endPos: Vec3; axisDir: Vec3; preHeading: Vec3 }
  >();
  // Track lock-pair start/end so out + return sit side-by-side cleanly with zero overlap
  const activeLockSpan = new Map<
    number,
    { baseJointPos: Vec3; tipJointPos: Vec3; outDir: Vec3; sideVec: Vec3; preHeading: Vec3 }
  >();

  bubbles.forEach((b, index) => {
    const cur = getCursor(b, index);
    if (b.branchFrom) {
      const jumped = resolveAnchor(b.branchFrom);
      if (jumped) {
        cur.pos = jumped.pos;
        cur.pinchCountAtPos = 0;
        const j = findOrCreateJoint(cur.pos, b.balloonId, index);
        if (!j.lockReasons.includes("Wrapped into joint")) {
          j.lockReasons.push("Wrapped into joint");
        }
      }
    }

    const kind = classifyKind(b);
    const len = Math.max(0.25, (b.lengthInches || 2.0) * UNIT);
    const radius = radiusForDiameter(b.diameterInches);
    const incomingDir: Vec3 = b.baseDir ? vNorm(b.baseDir) : ([...cur.dir] as Vec3);
    // Lateral of the heading this bubble branches from (what a pair folds across)
    const incomingSide: Vec3 = transportFrame(incomingDir, cur.side).side;

    const applyBendTurn = (base: Vec3): Vec3 => {
      let d = vNorm(base);
      const bendDeg = b.bend ?? 0;
      const turnDeg = b.turn ?? 0;
      if (bendDeg || turnDeg) {
        const f = frameFor(d, incomingSide);
        if (bendDeg) d = vRotate(d, f.side, bendDeg);
        if (turnDeg) d = vRotate(d, f.up, turnDeg);
      }
      return d;
    };

    const lockInfo = lockPairRole.get(index);
    const birdInfo = birdGroupInfo.get(index);
    const loopInfo = loopGroupInfo.get(index);

    let jointStart: Vec3 = [...cur.pos] as Vec3;
    let jointEnd: Vec3 = [...cur.pos] as Vec3;
    let start: Vec3 = [...cur.pos] as Vec3;
    let end: Vec3 = [...cur.pos] as Vec3;
    let mid: Vec3 = [...cur.pos] as Vec3;
    let dir: Vec3 = applyBendTurn(incomingDir);
    let bowOut: Vec3 | undefined;
    let foldBridgeTo: Vec3 | undefined;
    let partnerIndex: number | undefined;
    let chainEnd: Vec3 = [...cur.pos] as Vec3;
    let chainDir: Vec3 = [...dir] as Vec3;
    /** Lateral used to place this bubble when it is one of a folded pair */
    let pairSide: Vec3 | undefined;

    /* ---- 1. 2-Bubble Folded Lock Pair ---- */
    if (lockInfo) {
      partnerIndex = lockInfo.partner;
      if (lockInfo.role === "out") {
        const preHeading: Vec3 = [...cur.dir] as Vec3;
        dir = applyBendTurn(incomingDir);
        // The two tubes sit side by side ACROSS the body they hang from, so the
        // separation is the parent's lateral carried through the bend/turn, never
        // a fresh horizontal guess (which swings along the spine for a steep limb).
        const f = transportFrame(dir, incomingSide);
        pairSide = f.side;
        const sep = radius * 0.68;
        jointStart = [...cur.pos] as Vec3;
        jointEnd = vAdd(jointStart, vScale(dir, len));
        start = vAdd(jointStart, vScale(f.side, sep));
        end = vAdd(jointEnd, vScale(f.side, sep));
        mid = vLerp(start, end, 0.5);
        // Bridge target is the partner tube's matching end at -sep so the renderer draws a glossy 180° latex elbow!
        foldBridgeTo = vAdd(jointEnd, vScale(f.side, -sep));
        chainEnd = jointEnd;
        chainDir = dir;
        activeLockSpan.set(lockInfo.partner, {
          baseJointPos: jointStart,
          tipJointPos: jointEnd,
          outDir: dir,
          sideVec: f.side,
          preHeading,
        });
      } else {
        const span = activeLockSpan.get(index)!;
        const sep = radius * 0.68;
        pairSide = vScale(span.sideVec, -1);
        jointStart = span.tipJointPos;
        jointEnd = span.baseJointPos;
        // Return tube runs from tip back toward base along -outDir on the opposite lateral side (-sideVec)
        dir = vScale(span.outDir, -1);
        start = vAdd(span.tipJointPos, vScale(span.sideVec, -sep));
        // Respect actual lengthInches of Bubble B so unequal lengths visibly overhang!
        end = vAdd(start, vScale(dir, len));
        mid = vLerp(start, end, 0.5);
        chainEnd = [...span.baseJointPos] as Vec3;
        chainDir = [...span.preHeading] as Vec3;
      }
    } else if (b.lockToBubbleStart !== undefined && rawLayouts[b.lockToBubbleStart]) {
      /* ---- 2. Closed Loop Return into an Earlier Joint (e.g. Limb + Toe Paws + Return Leg!) ---- */
      const targetLayout = rawLayouts[b.lockToBubbleStart];
      jointStart = [...cur.pos] as Vec3;
      jointEnd = [...targetLayout.jointStart] as Vec3;
      const chord = vSub(jointEnd, jointStart);
      const chordDir = vNorm(chord, applyBendTurn(incomingDir));
      // Lateral of the body at the joint the leg returns to, so both legs stand astride it
      const f = transportFrame(chordDir, targetLayout.side);
      pairSide = f.side;
      // Offset opposite side from the outgoing leg so Left & Right legs stand visibly side-by-side!
      const lateral = vScale(f.side, radius * 0.72);
      // Also shift outgoing twin subtly if collinear so both legs stand symmetrically astride the spine!
      if (
        targetLayout.kind === "capsule" &&
        Math.abs(vDot(targetLayout.dir, chordDir)) > 0.9
      ) {
        const outLat = vScale(f.side, radius * 0.72);
        targetLayout.start = vAdd(targetLayout.start, outLat);
        targetLayout.end = vAdd(targetLayout.end, outLat);
        targetLayout.mid = vAdd(targetLayout.mid, outLat);
      }
      dir = chordDir;
      start = vAdd(jointStart, lateral);
      end = vAdd(jointEnd, lateral);
      mid = vLerp(start, end, 0.5);
      chainEnd = [...jointEnd] as Vec3;
      chainDir = [...targetLayout.incomingDir] as Vec3;
      partnerIndex = b.lockToBubbleStart;
    } else if (
      b.lockToJoint &&
      kind !== "loop" &&
      kind !== "pinch" &&
      rawLayouts[b.lockToJoint.bubbleIndex]
    ) {
      /* ---- 2b. Joint twisted into another joint (any balloon): the two joints become one ---- */
      const target = resolveAnchor(b.lockToJoint)!;
      jointStart = [...cur.pos] as Vec3;
      jointEnd = [...target.pos] as Vec3;
      const chord = vSub(jointEnd, jointStart);
      dir = vNorm(chord, applyBendTurn(incomingDir));
      start = [...jointStart] as Vec3;
      end = [...jointEnd] as Vec3;
      mid = vLerp(start, end, 0.5);
      chainEnd = [...jointEnd] as Vec3;
      chainDir = dir;
    } else if (birdInfo) {
      /* ---- 3. Bird Body (3-Bubble Roll-Through Bundle) ---- */
      const firstIdx = birdInfo.groupIndices[0];
      let span = activeBirdSpan.get(firstIdx);
      if (!span) {
        const axisDir = applyBendTurn(incomingDir);
        span = {
          startPos: [...cur.pos] as Vec3,
          endPos: vAdd(cur.pos, vScale(axisDir, len)),
          axisDir,
          preHeading: [...cur.dir] as Vec3,
        };
        activeBirdSpan.set(firstIdx, span);
      }
      const bf = frameFor(span.axisDir);
      const totalRails = Math.max(3, birdInfo.groupIndices.length);
      const angleRad = ((birdInfo.slot * 2 * Math.PI) / totalRails) + Math.PI / 6;
      const radial = vAdd(
        vScale(bf.side, Math.cos(angleRad) * radius * 1.08),
        vScale(bf.up, Math.sin(angleRad) * radius * 1.08)
      );
      const forward = birdInfo.slot % 2 === 0;
      jointStart = forward ? span.startPos : span.endPos;
      jointEnd = forward ? span.endPos : span.startPos;
      start = [...jointStart] as Vec3;
      end = [...jointEnd] as Vec3;
      dir = forward ? span.axisDir : vScale(span.axisDir, -1);
      mid = vAdd(vLerp(start, end, 0.5), radial);
      bowOut = radial;
      // After the last rail: even number of bubbles returns to startPos; odd (3!) exits at endPos!
      const isLast = birdInfo.slot === birdInfo.groupIndices.length - 1;
      if (isLast) {
        chainEnd = birdInfo.groupIndices.length % 2 === 1 ? span.endPos : span.startPos;
        chainDir = span.axisDir;
      } else {
        chainEnd = jointEnd;
        chainDir = span.axisDir;
      }
    } else if (kind === "loop") {
      /* ---- 4. Teardrop Loop Twist (Single petal / floppy ear / guard loop / rosette) ---- */
      jointStart = [...cur.pos] as Vec3;
      jointEnd = [...cur.pos] as Vec3;
      const hasCustomAngle = b.baseDir !== undefined || b.bend !== undefined || b.turn !== undefined;
      if (hasCustomAngle) {
        dir = applyBendTurn(incomingDir);
      } else if (loopInfo && loopInfo.groupIndices.length >= 3) {
        // 3+ loops at one joint automatically bloom into a 360° flower rosette!
        const n = loopInfo.groupIndices.length;
        const deg = (loopInfo.slot * 360) / n;
        dir = vRotate([0, 1, 0], [0, 0, 1], deg);
      } else if (loopInfo && loopInfo.groupIndices.length === 2) {
        // 2 consecutive loops oppose cleanly left/right around the spine!
        const f = frameFor(cur.dir);
        dir = loopInfo.slot === 0 ? f.side : vScale(f.side, -1);
      } else {
        const f = frameFor(cur.dir);
        dir = f.side;
      }
      const reach = Math.max(radius * 2.1, len * 0.44);
      start = [...jointStart] as Vec3;
      end = vAdd(jointStart, vScale(dir, reach));
      mid = vAdd(jointStart, vScale(dir, reach * 0.58));
      chainEnd = [...jointStart] as Vec3;
      chainDir = [...cur.dir] as Vec3;
    } else if (kind === "pinch") {
      /* ---- 5. Pinch Twist / Ear Twist / Toe Twist ---- */
      jointStart = [...cur.pos] as Vec3;
      jointEnd = [...cur.pos] as Vec3;
      const hasCustomAngle = b.baseDir !== undefined || b.bend !== undefined || b.turn !== undefined;
      if (hasCustomAngle) {
        dir = applyBendTurn(incomingDir);
      } else {
        const f = frameFor(cur.dir);
        // Alternate opposite sides when double-pinch-twisting at the same joint!
        dir =
          cur.pinchCountAtPos % 2 === 0
            ? vNorm(vAdd(f.up, vScale(f.side, 0.25)))
            : vNorm(vAdd(vScale(f.up, -1), vScale(f.side, -0.25)));
      }
      cur.pinchCountAtPos += 1;
      start = [...jointStart] as Vec3;
      end = vAdd(jointStart, vScale(dir, Math.max(radius * 1.75, len * 0.85)));
      mid = vAdd(jointStart, vScale(dir, radius * 0.95));
      chainEnd = [...jointStart] as Vec3;
      chainDir = [...cur.dir] as Vec3;
    } else if (b.twistType === "side_bubble") {
      /* ---- 6. Flank / Side Bubble ---- */
      dir = applyBendTurn(incomingDir);
      const f = frameFor(dir);
      const sign = cur.sideCountAtPos % 2 === 0 ? 1 : -1;
      cur.sideCountAtPos += 1;
      jointStart = [...cur.pos] as Vec3;
      jointEnd = vAdd(jointStart, vScale(dir, len));
      const flank = vScale(f.side, sign * radius * 1.45);
      start = [...jointStart] as Vec3;
      end = [...jointEnd] as Vec3;
      mid = vAdd(vLerp(start, end, 0.5), flank);
      bowOut = flank;
      chainEnd = [...jointEnd] as Vec3;
      chainDir = dir;
    } else if (kind === "tulip") {
      /* ---- 7. Tulip / Apple Twist / Apple Link ---- */
      dir = applyBendTurn(incomingDir);
      const advance = Math.max(len * 0.85, radius * 2.1);
      jointStart = [...cur.pos] as Vec3;
      jointEnd = vAdd(jointStart, vScale(dir, advance));
      start = [...jointStart] as Vec3;
      end = [...jointEnd] as Vec3;
      mid = vLerp(start, end, 0.5);
      chainEnd = [...jointEnd] as Vec3;
      chainDir = dir;
    } else {
      /* ---- 8. Standard Sausage Bubble / S-Hook / Z-Bend / Spiral / Cut-Tail Bead ---- */
      dir = applyBendTurn(incomingDir);
      jointStart = [...cur.pos] as Vec3;
      jointEnd = vAdd(jointStart, vScale(dir, len));
      start = [...jointStart] as Vec3;
      end = [...jointEnd] as Vec3;
      mid = vLerp(start, end, 0.5);
      chainEnd = [...jointEnd] as Vec3;
      chainDir = dir;
    }

    const startJoint = findOrCreateJoint(jointStart, b.balloonId, index);
    const endJoint = findOrCreateJoint(jointEnd, b.balloonId, index);

    // Record mechanical self-locking contributions on joints
    const dIn = b.diameterInches || 2.0;
    if (lockInfo && lockInfo.role === "return") {
      const bOut = bubbles[lockInfo.partner];
      endJoint.lockReasons.push("2-Bubble Lock Twist");
      const ratio =
        Math.max(bOut.lengthInches, b.lengthInches) /
        Math.max(0.25, Math.min(bOut.lengthInches, b.lengthInches));
      if (ratio <= 1.55) {
        startJoint.lockReasons.push("Balanced 180° Lock Fold Crease");
      }
    }
    if (b.lockToBubbleStart !== undefined && rawLayouts[b.lockToBubbleStart]) {
      endJoint.lockReasons.push("Closed Loop Lock Twist");
      const partnerLen = bubbles[b.lockToBubbleStart].lengthInches;
      const ratio =
        Math.max(partnerLen, b.lengthInches) /
        Math.max(0.25, Math.min(partnerLen, b.lengthInches));
      if (ratio <= 1.55) {
        startJoint.lockReasons.push("Symmetric Fold Return");
      }
    }
    if (b.lockToJoint && rawLayouts[b.lockToJoint.bubbleIndex]) {
      // Two twists stuck together hold each other: that counts as a lock.
      if (!endJoint.lockReasons.includes("Twisted into joint")) endJoint.lockReasons.push("Twisted into joint");
    }
    if (kind === "pinch" && b.lengthInches <= 2.5 * dIn) {
      startJoint.lockReasons.push(
        b.twistType === "toe" ? "Toe Twist Friction Lock" : "Pinch Twist Friction Lock"
      );
    }
    if (kind === "loop" && b.lengthInches >= 1.25 * dIn) {
      startJoint.lockReasons.push("Loop Twist Base Lock");
    }
    if (birdInfo && birdInfo.slot === birdInfo.groupIndices.length - 1 && birdInfo.groupIndices.length >= 3) {
      const firstLayout = rawLayouts[birdInfo.groupIndices[0]];
      if (firstLayout) {
        joints[firstLayout.startJointId].lockReasons.push("3-Bubble Bird Body Roll-Through");
        joints[firstLayout.endJointId].lockReasons.push("3-Bubble Bird Body Roll-Through");
      }
      startJoint.lockReasons.push("3-Bubble Bird Body Roll-Through");
      endJoint.lockReasons.push("3-Bubble Bird Body Roll-Through");
    }
    if (b.twistType === "apple_link") {
      startJoint.lockReasons.push("Apple Link Anchor");
      endJoint.lockReasons.push("Apple Link Anchor");
    }
    if (
      b.twistType === "cut_tail" ||
      b.twistType === "cut_tail_bubbles" ||
      b.twistType === "pinch_pop"
    ) {
      startJoint.lockReasons.push("Tied Off Knot");
      endJoint.lockReasons.push("Tied Off Knot");
    }

    if (b.positionOffset) {
      const off = vScale(b.positionOffset, UNIT);
      start = vAdd(start, off);
      end = vAdd(end, off);
      mid = vAdd(mid, off);
    }

    const { side, up } = pairSide ? transportFrame(dir, pairSide) : frameFor(dir, incomingSide);

    rawLayouts[index] = {
      index,
      bubble: b,
      kind,
      startJointId: startJoint.id,
      endJointId: endJoint.id,
      jointStart,
      jointEnd,
      start,
      end,
      mid,
      bowOut,
      foldBridgeTo,
      partnerIndex,
      dir,
      incomingDir,
      side,
      up,
      lengthUnits: len,
      radiusUnits: radius,
      chainEnd,
      chainDir,
    };

    const movedJoint = vDist(cur.pos, chainEnd) > 0.08;
    cur.pos = chainEnd;
    cur.side = transportFrame(chainDir, cur.side).side;
    cur.dir = chainDir;
    if (movedJoint) {
      cur.pinchCountAtPos = 0;
      cur.sideCountAtPos = 0;
    }
  });

  // Finalize joint lock flags (also locking joints where 2+ distinct balloons tie together)
  joints.forEach((j) => {
    if (j.balloonIds.size >= 2 && !j.lockReasons.includes("Multi-balloon tie junction")) {
      j.lockReasons.push("Multi-balloon tie junction");
    }
    j.isLocked = j.lockReasons.length > 0;
  });

  /* ---------------- full physical stability analysis ---------------- */
  const issues: StabilityIssue[] = [];
  const reportedBubbleSpecial = new Set<number>();

  // 1. Bubble-level twist mechanics rules
  bubbles.forEach((b, idx) => {
    const lay = rawLayouts[idx];
    if (!lay) return;
    const dIn = b.diameterInches || 2.0;

    // 1a. Orphan single `lock` bubble
    if (b.twistType === "lock" && !lockPairRole.has(idx) && b.lockToBubbleStart === undefined) {
      reportedBubbleSpecial.add(idx);
      lay.endSeamWillUntwist = true;
      issues.push({
        id: `orphan-lock-${idx}`,
        severity: "will_untwist",
        title: `Incomplete Lock Twist on "${b.label}"`,
        explanation: `"${b.label}" is set to Lock Twist alone, without a partner lock bubble folded alongside it.`,
        whatHappensWhenReleased: `A single bubble has nothing to lock around — it immediately spins open when you release your grip!`,
        bubbleIndices: [idx],
        jointPosition: lay.jointEnd,
        fixLabel: `+ Add Partner Lock Bubble`,
        fix: { kind: "add_lock_partner", bubbleIndex: idx },
      });
    }

    // 1b. Asymmetric lock pair
    const lp = lockPairRole.get(idx);
    if (lp && lp.role === "out") {
      const b2 = bubbles[lp.partner];
      const hi = Math.max(b.lengthInches, b2.lengthInches);
      const lo = Math.max(0.25, Math.min(b.lengthInches, b2.lengthInches));
      if (hi / lo > 1.55) {
        reportedBubbleSpecial.add(idx);
        reportedBubbleSpecial.add(lp.partner);
        lay.endSeamWillUntwist = true;
        issues.push({
          id: `asym-lock-${idx}`,
          severity: "will_untwist",
          title: `Unequal Lock Pair: "${b.label}" (${b.lengthInches}″) vs "${b2.label}" (${b2.lengthInches}″)`,
          explanation: `Lock twists stay together because two equal-length tubes pull evenly against the 180° fold.`,
          whatHappensWhenReleased: `The longer ${hi}″ bubble bows sideways, slips through the twist, and pops the lock open!`,
          bubbleIndices: [idx, lp.partner],
          jointPosition: lay.jointEnd,
          fixLabel: `Equalize Pair to ${roundQuarter((b.lengthInches + b2.lengthInches) / 2)}″`,
          fix: {
            kind: "equalize_pair",
            bubbleIndices: [idx, lp.partner],
            targetLengthInches: roundQuarter((b.lengthInches + b2.lengthInches) / 2),
          },
        });
      }
    }

    // 1c. Incomplete Bird Body (< 3 rails)
    const bg = birdGroupInfo.get(idx);
    if (bg && bg.slot === 0 && bg.groupIndices.length < 3) {
      bg.groupIndices.forEach((gi) => reportedBubbleSpecial.add(gi));
      const lastGi = bg.groupIndices[bg.groupIndices.length - 1];
      rawLayouts[lastGi].endSeamWillUntwist = true;
      const missing = 3 - bg.groupIndices.length;
      issues.push({
        id: `bird-incomplete-${idx}`,
        severity: "will_untwist",
        title: `Incomplete Bird Body (${bg.groupIndices.length}/3 bubbles)`,
        explanation: `A Bird Body (3-Bubble Roll-Through) requires 3 parallel rails so the 3rd bubble rolls through between the first two.`,
        whatHappensWhenReleased: `With only ${bg.groupIndices.length} bubble${bg.groupIndices.length > 1 ? "s" : ""}, nothing locks the roll-through — the bundle unravels!`,
        bubbleIndices: bg.groupIndices,
        jointPosition: rawLayouts[lastGi].jointEnd,
        fixLabel: `+ Complete 3-Bubble Bird Body (+${missing})`,
        fix: {
          kind: "complete_bird_body",
          lastBubbleIndex: lastGi,
          countToAdd: missing,
        },
      });
    }

    // 1d. Unanchored Tulip / Apple Twist
    if (b.twistType === "tulip" || b.twistType === "tulip_chain") {
      const backJoint = joints[lay.endJointId];
      if (!backJoint.isLocked) {
        reportedBubbleSpecial.add(idx);
        lay.endSeamWillUntwist = true;
        issues.push({
          id: `tulip-unanchored-${idx}`,
          severity: "will_untwist",
          title: `Unanchored Tulip / Apple Twist ("${b.label}")`,
          explanation: `A Tulip twist pushes the knot inside the balloon, which must be locked at its back neck.`,
          whatHappensWhenReleased: `Air pressure immediately spits the inverted knot back out and flattens "${b.label}"!`,
          bubbleIndices: [idx],
          jointPosition: lay.jointEnd,
          fixLabel: `+ Lock Back Neck with Pinch Twist`,
          fix: {
            kind: "insert_pinch",
            afterBubbleIndex: idx,
            balloonId: b.balloonId,
            color: b.color,
            diameterInches: dIn,
            label: `${b.label} Lock Pinch`,
          },
        });
      }
    }

    // 1e. Oversized Pinch Twist
    if ((b.twistType === "pinch" || b.twistType === "toe") && b.lengthInches > 2.5 * dIn) {
      issues.push({
        id: `oversized-pinch-${idx}`,
        severity: "warning",
        title: `Pinch Twist Too Long ("${b.label}" is ${b.lengthInches}″)`,
        explanation: `Pinch twists grip by tight latex friction across a compact ${roundQuarter(dIn * 0.6)}″–${roundQuarter(dIn * 1.2)}″ bubble.`,
        whatHappensWhenReleased: `At ${b.lengthInches}″, the halves bow apart into a loose loop instead of holding crisp 90° tension.`,
        bubbleIndices: [idx],
        jointPosition: lay.jointStart,
        fixLabel: `Convert to Loop Twist`,
        fix: { kind: "convert_twist", bubbleIndex: idx, newTwist: "loop" },
      });
    }

    // 1f. Loop Twist too tiny to fold
    if ((b.twistType === "loop" || b.isLoop) && b.lengthInches < 1.25 * dIn) {
      reportedBubbleSpecial.add(idx);
      lay.endSeamWillUntwist = true;
      issues.push({
        id: `tiny-loop-${idx}`,
        severity: "will_untwist",
        title: `Loop Too Short to Fold ("${b.label}" is ${b.lengthInches}″)`,
        explanation: `A ${dIn}″ balloon cannot fold cleanly into a ${b.lengthInches}″ loop.`,
        whatHappensWhenReleased: `The loop pops straight open out of the base twist (or bursts from pinch stress)!`,
        bubbleIndices: [idx],
        jointPosition: lay.jointStart,
        fixLabel: `Convert to Pinch Twist`,
        fix: {
          kind: "convert_twist",
          bubbleIndex: idx,
          newTwist: "pinch",
          newLengthInches: Math.max(0.8, roundQuarter(dIn * 0.6)),
        },
      });
    }

    // 1g. Unwedged Tension Twist
    if (b.twistType === "tension") {
      const sJ = joints[lay.startJointId];
      const eJ = joints[lay.endJointId];
      if (!sJ.isLocked && !eJ.isLocked) {
        reportedBubbleSpecial.add(idx);
        lay.endSeamWillUntwist = true;
        issues.push({
          id: `tension-unwedged-${idx}`,
          severity: "will_untwist",
          title: `Un-wedged Tension Bubble ("${b.label}")`,
          explanation: `A Tension Twist has no knot — it relies on clasping pressure from locked loops or pinch joints.`,
          whatHappensWhenReleased: `"${b.label}" slips right out and unravels!`,
          bubbleIndices: [idx],
          jointPosition: lay.jointEnd,
          fixLabel: `+ Add Anchor Pinch Twist`,
          fix: {
            kind: "insert_pinch",
            afterBubbleIndex: idx,
            balloonId: b.balloonId,
            color: b.color,
            diameterInches: dIn,
            label: `Tension Anchor Pinch`,
          },
        });
      }
    }
  });

  // 2. Seam-level untwist theorem across every balloon chain
  indicesByBalloon.forEach((seq, balloonId) => {
    const bal = balloons.find((x) => x.id === balloonId);
    let consecutiveHeldSeamRun = 0;
    let runStartBubble = seq[0];

    for (let p = 0; p < seq.length; p++) {
      const idx = seq[p];
      const b = bubbles[idx];
      const lay = rawLayouts[idx];
      const endJoint = joints[lay.endJointId];
      const isZeroLengthSelfLock =
        (lay.kind === "pinch" || lay.kind === "loop") && endJoint.isLocked;

      if (p < seq.length - 1) {
        const nextIdx = seq[p + 1];
        const bNext = bubbles[nextIdx];
        if (!isZeroLengthSelfLock) {
          if (!endJoint.isLocked) {
            consecutiveHeldSeamRun += 1;
            if (!reportedBubbleSpecial.has(idx)) {
              lay.endSeamWillUntwist = true;
              issues.push({
                id: `seam-untwist-${idx}-${nextIdx}`,
                severity: "will_untwist",
                title: `Twist Will Unravel Between "${b.label}" & "${bNext.label}"`,
                explanation: `The twist between "${b.label}" (${b.lengthInches}″) and "${bNext.label}" (${bNext.lengthInches}″) has no Lock Twist, Pinch Twist, or Loop anchoring it.`,
                whatHappensWhenReleased: `As soon as you let go, torsional latex tension spins the seam open and merges both into one ${roundQuarter(
                  b.lengthInches + bNext.lengthInches
                )}″ bubble!`,
                bubbleIndices: [idx, nextIdx],
                jointPosition: lay.jointEnd,
                fixLabel: `+ Insert Pinch Twist Lock`,
                fix: {
                  kind: "insert_pinch",
                  afterBubbleIndex: idx,
                  balloonId: b.balloonId,
                  color: b.color,
                  diameterInches: b.diameterInches || 2.0,
                  label: `${b.label} Pinch Lock`,
                },
              });
            }
          } else {
            if (consecutiveHeldSeamRun >= 4) {
              issues.push({
                id: `three-hand-${runStartBubble}-${idx}`,
                severity: "warning",
                title: `Hard to Hold (${consecutiveHeldSeamRun} Un-locked Seams Before Locking)`,
                explanation: `You must keep ${consecutiveHeldSeamRun} twists pinched in one hand simultaneously before this lock secures them.`,
                whatHappensWhenReleased: `Easy to drop an earlier twist mid-build unless an intermediate Pinch Twist lets you reset your grip.`,
                bubbleIndices: [runStartBubble, idx],
                jointPosition: lay.jointEnd,
                fixLabel: `+ Add Mid-Chain Pinch Twist`,
                fix: {
                  kind: "insert_pinch",
                  afterBubbleIndex: runStartBubble,
                  balloonId: b.balloonId,
                  color: b.color,
                  diameterInches: b.diameterInches || 2.0,
                  label: `Grip Reset Pinch`,
                },
              });
            }
            consecutiveHeldSeamRun = 0;
            runStartBubble = nextIdx;
          }
        }
      } else {
        // Single lone unlocked bubble with open balloon air remaining
        const startJoint = joints[lay.startJointId];
        const inflatedCapacity = bal?.inflatedLengthInches ?? 48;
        if (
          seq.length === 1 &&
          !startJoint.isLocked &&
          !endJoint.isLocked &&
          !reportedBubbleSpecial.has(idx) &&
          b.lengthInches < inflatedCapacity * 0.65
        ) {
          lay.endSeamWillUntwist = true;
          issues.push({
            id: `lone-bubble-${idx}`,
            severity: "will_untwist",
            title: `"${b.label}" Will Untwist Into the Balloon`,
            explanation: `A single ${b.lengthInches}″ twist on an open ${inflatedCapacity}″ balloon has nothing preventing rotation.`,
            whatHappensWhenReleased: `Let go of "${b.label}" and it spins 3 turns backward right back into one straight sausage!`,
            bubbleIndices: [idx],
            jointPosition: lay.jointEnd,
            fixLabel: `+ Lock Seam with Pinch Twist`,
            fix: {
              kind: "insert_pinch",
              afterBubbleIndex: idx,
              balloonId: b.balloonId,
              color: b.color,
              diameterInches: b.diameterInches || 2.0,
              label: `Locking Pinch Twist`,
            },
          });
        }
      }
    }

    // 3. Balloon air budget: over-inflation pop risk & running out of balloon
    if (bal) {
      const air = computeAirBudget(bal, bubbles);
      if (air.status === "pop_risk") {
        issues.push({
          id: `pop-risk-${bal.id}`,
          severity: "warning",
          title: `Pop Risk on ${bal.name} (${air.twistShiftInches}″ of ${air.initialTailInches}″ tail squeezed away)`,
          explanation: `Each twist pushes air into the uninflated tail. With ${air.tailRemainingInches}″ left, the final twists will be rock hard.`,
          whatHappensWhenReleased: `The last bubbles are very likely to pop while you twist them.`,
          bubbleIndices: [seq[seq.length - 1]],
          fixLabel: `Leave a longer tail (${roundQuarter(air.initialTailInches + 4)}″)`,
          fix: {
            kind: "adjust_balloon_tail",
            balloonId: bal.id,
            newTailInches: roundQuarter(air.initialTailInches + 4),
          },
        });
      } else if (air.untwistedInches >= 8 && seq.length > 0) {
        const fitted = fitTailForBubbles(bal, bubbles);
        issues.push({
          id: `leftover-${bal.id}`,
          severity: "warning",
          title: `${air.untwistedInches}″ of ${bal.name} left untwisted`,
          explanation: `You inflate to ${air.inflatedInches}″ but the bubbles only use ${air.bubbleInches}″. The rest trails off the last joint as a limp tube.`,
          whatHappensWhenReleased: `Nothing unravels, but the sculpture drags a ${air.untwistedInches}″ leftover. Inflate less or add bubbles.`,
          bubbleIndices: [seq[seq.length - 1]],
          fixLabel: `Inflate just enough (${fitted}″ tail)`,
          fix: { kind: "adjust_balloon_tail", balloonId: bal.id, newTailInches: fitted },
        });
      } else if (air.status === "over_budget") {
        const newTail = Math.max(2, roundQuarter(air.initialTailInches - air.overBudgetInches - 1));
        issues.push({
          id: `over-budget-${bal.id}`,
          severity: "warning",
          title: `Out of balloon on ${bal.name} (${air.bubbleInches}″ of bubbles, ${air.inflatedInches}″ inflated)`,
          explanation: `The bubbles need ${air.overBudgetInches}″ more inflated balloon than a ${air.initialTailInches}″ tail leaves.`,
          whatHappensWhenReleased: `You run out of balloon before the last ${air.overBudgetInches}″ of bubbles.`,
          bubbleIndices: [seq[seq.length - 1]],
          fixLabel: `Inflate further (${newTail}″ tail)`,
          fix: {
            kind: "adjust_balloon_tail",
            balloonId: bal.id,
            newTailInches: newTail,
          },
        });
      }
    }
  });

  // Balloons with no bubbles yet (blank slate / freshly added) still need a chain
  // so the viewer can draw the inflated, untwisted balloon and its tail.
  balloons.forEach((bal) => {
    if (chains.has(bal.id)) return;
    const anchor = resolveAnchor(bal.attachTo);
    const radiusUnits = radiusForDiameter(defaultDiameterForSize(bal.size));
    const pos: Vec3 = anchor
      ? anchor.pos
      : primaryCursor
      ? vAdd(primaryStart, freeStandingOffset(bal, radiusUnits))
      : [0, 0, 0];
    const dir: Vec3 = anchor ? [0, 1, 0] : [1, 0, 0];
    if (!primaryCursor) primaryStart = [...pos] as Vec3;
    chains.set(bal.id, {
      balloonId: bal.id,
      startPos: pos,
      startDir: dir,
      radiusUnits,
      color: bal.color,
      attachedJointLabel: anchor?.label,
      isEmpty: true,
    });
  });

  /* ---------------- "Let Go" Physical Release Relaxation ---------------- */
  if (options.releasedHands) {
    // Re-solve each balloon with all un-anchored twists physically unraveled:
    // contiguous bubbles joined by unlocked seams merge into straight coaxial tubes!
    indicesByBalloon.forEach((seq) => {
      let r = 0;
      while (r < seq.length) {
        const startIdx = seq[r];
        let endPtr = r;
        while (endPtr < seq.length - 1 && rawLayouts[seq[endPtr]].endSeamWillUntwist) {
          endPtr++;
        }
        const singleUnraveled = rawLayouts[startIdx].endSeamWillUntwist && endPtr === r;
        if (endPtr > r || singleUnraveled) {
          const anchorPos = [...rawLayouts[startIdx].jointStart] as Vec3;
          const straightDir = [...rawLayouts[startIdx].incomingDir] as Vec3;
          const f = frameFor(straightDir);
          let cursor = anchorPos;
          for (let q = r; q <= endPtr; q++) {
            const bi = seq[q];
            const lay = rawLayouts[bi];
            const segLen = Math.max(0.3, bubbles[bi].lengthInches * UNIT);
            const nextPos = vAdd(cursor, vScale(straightDir, segLen));
            lay.kind = "capsule";
            lay.start = [...cursor] as Vec3;
            lay.end = [...nextPos] as Vec3;
            lay.mid = vLerp(lay.start, lay.end, 0.5);
            lay.dir = straightDir;
            lay.side = f.side;
            lay.up = f.up;
            lay.bowOut = undefined;
            lay.foldBridgeTo = undefined;
            lay.chainEnd = [...nextPos] as Vec3;
            lay.chainDir = straightDir;
            lay.unraveledInRelease = true;
            cursor = nextPos;
          }
          // Shift any downstream segments on the same balloon by the delta where this run ended!
          const oldEnd = rawLayouts[seq[endPtr]].jointEnd;
          const shift = vSub(cursor, oldEnd);
          for (let after = endPtr + 1; after < seq.length; after++) {
            const al = rawLayouts[seq[after]];
            al.start = vAdd(al.start, shift);
            al.end = vAdd(al.end, shift);
            al.mid = vAdd(al.mid, shift);
            al.jointStart = vAdd(al.jointStart, shift);
            al.jointEnd = vAdd(al.jointEnd, shift);
            al.chainEnd = vAdd(al.chainEnd, shift);
            if (al.foldBridgeTo) al.foldBridgeTo = vAdd(al.foldBridgeTo, shift);
          }
          r = endPtr + 1;
          continue;
        }
        r++;
      }
    });
  }

  const untwistCount = issues.filter((i) => i.severity === "will_untwist").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  const stability: StabilityReport = {
    isStable: untwistCount === 0,
    untwistCount,
    warningCount,
    totalJoints: joints.length,
    lockedJoints: joints.filter((j) => j.isLocked).length,
    issues,
  };

  return {
    layouts: rawLayouts,
    chains,
    joints,
    stability,
  };
}

/* ---------------- 1-Click Auto-Fix Engine ---------------- */

export function applyStabilityAutoFix(
  balloons: BalloonSpec[],
  bubbles: BubbleSpec[],
  fix: StabilityAutoFix
): { balloons: BalloonSpec[]; bubbles: BubbleSpec[] } {
  const nextBalloons = balloons.map((b) => ({ ...b }));
  const nextBubbles = bubbles.map((b) => ({ ...b }));

  switch (fix.kind) {
    case "insert_pinch": {
      const pinch: BubbleSpec = {
        id: `b-pinch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        balloonId: fix.balloonId,
        index: fix.afterBubbleIndex + 1,
        label: fix.label,
        lengthInches: roundQuarter(Math.max(0.8, fix.diameterInches * 0.55)),
        diameterInches: fix.diameterInches,
        twistType: "pinch",
        isPinch: true,
        color: fix.color,
      };
      nextBubbles.splice(fix.afterBubbleIndex + 1, 0, pinch);
      break;
    }
    case "add_lock_partner": {
      const src = nextBubbles[fix.bubbleIndex];
      if (src) {
        const partner: BubbleSpec = {
          id: `b-lock-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          balloonId: src.balloonId,
          index: fix.bubbleIndex + 1,
          label: `${src.label} Partner`,
          lengthInches: src.lengthInches,
          diameterInches: src.diameterInches,
          twistType: "lock",
          color: src.color,
        };
        nextBubbles.splice(fix.bubbleIndex + 1, 0, partner);
      }
      break;
    }
    case "convert_twist": {
      const target = nextBubbles[fix.bubbleIndex];
      if (target) {
        target.twistType = fix.newTwist;
        target.isLoop = fix.newTwist === "loop";
        target.isPinch = fix.newTwist === "pinch" || fix.newTwist === "toe";
        target.isTulip = fix.newTwist === "tulip" || fix.newTwist === "tulip_chain";
        if (fix.newLengthInches !== undefined) {
          target.lengthInches = fix.newLengthInches;
        }
      }
      break;
    }
    case "equalize_pair": {
      fix.bubbleIndices.forEach((bi) => {
        if (nextBubbles[bi]) nextBubbles[bi].lengthInches = fix.targetLengthInches;
      });
      break;
    }
    case "complete_bird_body": {
      const src = nextBubbles[fix.lastBubbleIndex];
      if (src) {
        const toInsert: BubbleSpec[] = [];
        for (let i = 0; i < fix.countToAdd; i++) {
          toInsert.push({
            id: `b-bird-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 5)}`,
            balloonId: src.balloonId,
            index: fix.lastBubbleIndex + 1 + i,
            label: i === fix.countToAdd - 1 ? `Bird Body Roll-Through` : `Bird Body Rail`,
            lengthInches: src.lengthInches,
            diameterInches: src.diameterInches,
            twistType: "bird_body",
            color: src.color,
          });
        }
        nextBubbles.splice(fix.lastBubbleIndex + 1, 0, ...toInsert);
      }
      break;
    }
    case "resize_bubble": {
      if (nextBubbles[fix.bubbleIndex]) {
        nextBubbles[fix.bubbleIndex].lengthInches = fix.newLengthInches;
      }
      break;
    }
    case "adjust_balloon_tail": {
      const bal = nextBalloons.find((x) => x.id === fix.balloonId);
      if (bal) {
        bal.tailLengthInches = fix.newTailInches;
        bal.tailFingers = Math.round((fix.newTailInches / 0.8) * 10) / 10;
      }
      break;
    }
  }

  // Re-normalize indices & remap any `lockToBubbleStart` / `branchFrom` references if inserted!
  const idOrder = new Map<string, number>();
  nextBubbles.forEach((b, i) => {
    idOrder.set(b.id, i);
  });
  // Map old bubble index -> new bubble index via original bubble IDs
  const oldToNew = new Map<number, number>();
  bubbles.forEach((orig, oldIdx) => {
    const mapped = idOrder.get(orig.id);
    if (mapped !== undefined) oldToNew.set(oldIdx, mapped);
  });
  nextBubbles.forEach((b, i) => {
    b.index = i;
    if (b.lockToBubbleStart !== undefined && oldToNew.has(b.lockToBubbleStart)) {
      b.lockToBubbleStart = oldToNew.get(b.lockToBubbleStart);
    }
    if (b.branchFrom && oldToNew.has(b.branchFrom.bubbleIndex)) {
      b.branchFrom = {
        ...b.branchFrom,
        bubbleIndex: oldToNew.get(b.branchFrom.bubbleIndex)!,
      };
    }
    if (b.lockToJoint && oldToNew.has(b.lockToJoint.bubbleIndex)) {
      b.lockToJoint = {
        ...b.lockToJoint,
        bubbleIndex: oldToNew.get(b.lockToJoint.bubbleIndex)!,
      };
    }
  });
  nextBalloons.forEach((bal) => {
    if (bal.attachTo && oldToNew.has(bal.attachTo.bubbleIndex)) {
      bal.attachTo = {
        ...bal.attachTo,
        bubbleIndex: oldToNew.get(bal.attachTo.bubbleIndex)!,
      };
    }
  });

  return { balloons: nextBalloons, bubbles: nextBubbles };
}

/** Auto-resolve all untwist & physical stability issues until the sculpture is completely stable. */
export function autoStabilizeSculpture(
  balloons: BalloonSpec[],
  bubbles: BubbleSpec[]
): { balloons: BalloonSpec[]; bubbles: BubbleSpec[]; appliedCount: number } {
  let curBalloons = balloons;
  let curBubbles = bubbles;
  let appliedCount = 0;

  for (let guard = 0; guard < 12; guard++) {
    const { stability } = computeBalloonLayout(curBalloons, curBubbles);
    const nextIssue =
      stability.issues.find((i) => i.severity === "will_untwist") ||
      stability.issues[0];
    if (!nextIssue) break;
    const res = applyStabilityAutoFix(curBalloons, curBubbles, nextIssue.fix);
    curBalloons = res.balloons;
    curBubbles = res.bubbles;
    appliedCount += 1;
  }

  return { balloons: curBalloons, bubbles: curBubbles, appliedCount };
}

/* ---------------- step-by-step build visibility ---------------- */

export interface StepVisibility {
  formed: Set<number>;
  active: Set<number>;
  introducedBalloons: Set<string>;
}

/**
 * Exact set of formed bubbles, active current-step bubbles, and introduced balloons
 * at step `stepIndex` — shared 1-to-1 by BOTH the 3D Smooth Latex Simulation AND
 * the Step Visual Diagram & Instruction Deck!
 */
export function getStepVisibility(
  steps: StepSpec[],
  bubbles: BubbleSpec[],
  balloons: BalloonSpec[],
  stepIndex: number
): StepVisibility {
  const formed = new Set<number>();
  const introduced = new Set<string>();

  const clamped = Math.max(0, Math.min(stepIndex, steps.length - 1));
  for (let i = 0; i <= clamped; i++) {
    const st = steps[i];
    if (!st) continue;
    if (st.balloonId) introduced.add(st.balloonId);
    (st.bubbleIndices || []).forEach((bi) => {
      if (bi >= 0 && bi < bubbles.length) formed.add(bi);
    });
  }

  if (introduced.size === 0 && balloons[0]) introduced.add(balloons[0].id);

  const active = new Set<number>(steps[clamped]?.bubbleIndices || []);
  return { formed, active, introducedBalloons: introduced };
}
