import { BalloonSize, BalloonSpec, BubbleSpec, TwistType } from "@/types/balloon";
import { BALLOON_SIZE_DETAILS, TWIST_ENCYCLOPEDIA, inchesToFingers } from "./balloonConstants";

/**
 * Single source of truth for the air budget of one twister balloon.
 *
 * Physical model (60" of latex):
 *   - The balloon is inflated to `inflatedInches`, leaving `initialTailInches`
 *     of uninflated latex at the tip.
 *   - Every bubble consumes its length from the inflated section.
 *   - Every twist squeezes a little air forward into the tail
 *     (`tailAirCostInches`), so the uninflated tail shrinks as you work.
 *
 * `formed` restricts the calculation to the bubbles already twisted at the
 * current build step; omit it for the finished sculpture.
 */
export type AirStatus = "safe" | "underfilled" | "tight" | "pop_risk" | "over_budget";

export interface AirBudget {
  balloonId: string;
  totalLatexInches: number;
  /** Uninflated tail the twister leaves when inflating */
  initialTailInches: number;
  /** Inflated length before any twisting */
  inflatedInches: number;
  /** Inches of inflated balloon used up by formed bubbles */
  bubbleInches: number;
  /** Inches of tail consumed by air squeezed forward from twists */
  twistShiftInches: number;
  /** Inflated, still untwisted balloon between the last joint and the tail */
  untwistedInches: number;
  /** Uninflated tail left right now */
  tailRemainingInches: number;
  tailRemainingFingers: number;
  /** How far over the inflated length the bubbles run (0 when fine) */
  overBudgetInches: number;
  formedCount: number;
  totalCount: number;
  status: AirStatus;
  statusMessage: string;
}

export function defaultTailInches(size: BalloonSize | string | undefined): number {
  const fingers = BALLOON_SIZE_DETAILS[(size as BalloonSize) || "260"]?.standardTailFingers ?? 5;
  return Math.round(fingers * 0.8 * 10) / 10;
}

export function twistAirCost(twistType: TwistType | undefined): number {
  return TWIST_ENCYCLOPEDIA[twistType ?? "basic"]?.tailAirCostInches ?? 0.4;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

export function computeAirBudget(
  balloon: Pick<BalloonSpec, "id" | "size"> & Partial<Pick<BalloonSpec, "tailLengthInches">>,
  bubbles: Array<Pick<BubbleSpec, "balloonId" | "lengthInches" | "twistType">>,
  formed?: ReadonlySet<number> | null
): AirBudget {
  const total = 60;
  const initialTail = Math.max(0, balloon.tailLengthInches ?? defaultTailInches(balloon.size));
  const inflated = Math.max(0, total - initialTail);

  let bubbleInches = 0;
  let twistShift = 0;
  let formedCount = 0;
  let totalCount = 0;
  bubbles.forEach((b, idx) => {
    if (b.balloonId !== balloon.id) return;
    totalCount += 1;
    if (formed && !formed.has(idx)) return;
    formedCount += 1;
    bubbleInches += b.lengthInches || 0;
    twistShift += twistAirCost(b.twistType);
  });

  const untwisted = inflated - bubbleInches;
  const tailRemaining = initialTail - twistShift;
  const overBudget = Math.max(0, -untwisted);

  let status: AirStatus = "safe";
  let statusMessage = "";
  const tailF = inchesToFingers(Math.max(0, tailRemaining));
  if (overBudget > 0) {
    status = "over_budget";
    statusMessage = `Bubbles need ${round1(overBudget)}″ more balloon than you inflated. Inflate further (shorter tail) or shorten bubbles.`;
  } else if (tailRemaining <= 0.5) {
    status = "pop_risk";
    statusMessage = `Pop risk! Twists have squeezed almost all air into the tail. Leave a longer tail when inflating.`;
  } else if (tailRemaining < 2) {
    status = "tight";
    statusMessage = `Tight. Only ${round1(tailRemaining)}″ of tail left — burp before the final twists.`;
  } else if (tailRemaining > 20) {
    status = "underfilled";
    statusMessage = `Plenty of tail (${round1(tailRemaining)}″). Room for more detail or a decorative tip.`;
  } else {
    status = "safe";
    statusMessage = `${tailF} fingers (${round1(tailRemaining)}″) of tail remain — comfortable pressure.`;
  }

  return {
    balloonId: balloon.id,
    totalLatexInches: total,
    initialTailInches: round1(initialTail),
    inflatedInches: round1(inflated),
    bubbleInches: round1(bubbleInches),
    twistShiftInches: round1(twistShift),
    untwistedInches: round1(Math.max(0, untwisted)),
    tailRemainingInches: round1(Math.max(0, tailRemaining)),
    tailRemainingFingers: tailF,
    overBudgetInches: round1(overBudget),
    formedCount,
    totalCount,
    status,
    statusMessage,
  };
}

/**
 * The uninflated tail a twister should leave so the inflated section just
 * covers the bubbles (plus a little slack) while still having room for the
 * air every twist squeezes forward. Returns inches, rounded to a quarter.
 */
export function fitTailForBubbles(
  balloon: Pick<BalloonSpec, "id" | "size">,
  bubbles: Array<Pick<BubbleSpec, "balloonId" | "lengthInches" | "twistType">>,
  slackInches = 1.5
): number {
  let bubbleInches = 0;
  let twistShift = 0;
  bubbles.forEach((b) => {
    if (b.balloonId !== balloon.id) return;
    bubbleInches += b.lengthInches || 0;
    twistShift += twistAirCost(b.twistType);
  });
  const forInflation = 60 - bubbleInches - slackInches;
  const forTwists = twistShift + 2.5;
  const tail = Math.max(forTwists, forInflation, defaultTailInches(balloon.size) * 0.5);
  return Math.round(Math.min(42, tail) * 4) / 4;
}
