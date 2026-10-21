import { BalloonSpec, BubbleSpec, StepJointAction, StepSpec } from "@/types/balloon";
import { TWIST_ENCYCLOPEDIA, inchesToFingers } from "./balloonConstants";
import { computeAirBudget } from "./balloonAir";
import { BubbleLayout, JointNode, computeBalloonLayout, roundQuarter } from "./balloonLayout";

/** Human-readable 3D orientation phrase derived directly from the simulated 3D vector! */
function describeOrientation3D(lay: BubbleLayout): string {
  const [dx, dy, dz] = lay.dir;
  if (dy > 0.82) return "pointing straight upward";
  if (dy < -0.82) return "pointing straight downward";
  if (dy > 0.42) return Math.abs(dz) > 0.35 ? "angled upward and outward" : "angled upward";
  if (dy < -0.42) return Math.abs(dz) > 0.35 ? "angled downward and outward" : "angled downward";
  if (Math.abs(dz) > 0.72) return dz > 0 ? "extending out to the left side" : "extending out to the right side";
  return "extending horizontally along the main spine";
}

function preserveUserEdits(generated: StepSpec[], previous?: StepSpec[]): StepSpec[] {
  if (!previous || previous.length === 0) return generated;
  const byStepId = new Map<string, StepSpec>();
  previous.forEach((st) => {
    if (st.stepId) byStepId.set(st.stepId, st);
  });
  return generated.map((step) => {
    const prev = step.stepId ? byStepId.get(step.stepId) : undefined;
    if (!prev) return step;
    return {
      ...step,
      annotation: prev.annotation ?? step.annotation,
    };
  });
}

/**
 * Generates 100% simulation-accurate Step Instructions directly from the
 * 3D Smooth Latex Simulation & Stability Engine (`computeBalloonLayout`).
 *
 * Every balloon inflation, attachment joint, bubble length, finger count,
 * 3D orientation, remaining un-twisted latex length, remaining tail allowance,
 * hand-hold requirement, and untwist warning is derived directly from the live model.
 */
export function generateStepsFromSimulation(
  balloons: BalloonSpec[],
  bubbles: BubbleSpec[],
  previousSteps?: StepSpec[]
): StepSpec[] {
  if (!balloons || balloons.length === 0) return [];
  const { layouts, chains, joints } = computeBalloonLayout(balloons, bubbles);
  const steps: StepSpec[] = [];

  // Per-balloon air budget (60" latex): bubbles consume inflated length, twists
  // squeeze air into the tail. Recomputed from the formed set at every step so
  // the "remaining tail" numbers are exact for that moment of the build.
  const formedSoFar = new Set<number>();
  const airAt = (bal: BalloonSpec) => computeAirBudget(bal, bubbles, formedSoFar);

  const introducedBalloons = new Set<string>();

  // Helper: check if a joint is already locked by bubbles in `formedSoFar`
  const isJointLockedAtStep = (joint: JointNode): boolean => {
    // Check if any already-formed bubble locks this joint
    let lockPairReturns = 0;
    let birdCount = 0;
    const balloonsHere = new Set<string>();

    formedSoFar.forEach((bi) => {
      const lay = layouts[bi];
      const b = bubbles[bi];
      if (!lay || !b) return;
      const touchesStart = lay.startJointId === joint.id;
      const touchesEnd = lay.endJointId === joint.id;
      if (!touchesStart && !touchesEnd) return;
      balloonsHere.add(b.balloonId);

      const dIn = b.diameterInches || 2.0;
      if ((lay.kind === "pinch") && b.lengthInches <= 2.5 * dIn && touchesStart) {
        lockPairReturns += 1;
      }
      if (lay.kind === "loop" && b.lengthInches >= 1.25 * dIn && touchesStart) {
        lockPairReturns += 1;
      }
      if (b.twistType === "lock" && lay.partnerIndex !== undefined && lay.partnerIndex < bi) {
        // Return half of a 2-bubble lock pair or closed loop return!
        lockPairReturns += 1;
      }
      if (b.twistType === "bird_body") {
        birdCount += 1;
      }
      if (
        b.twistType === "apple_link" ||
        b.twistType === "cut_tail" ||
        b.twistType === "cut_tail_bubbles" ||
        b.twistType === "pinch_pop"
      ) {
        lockPairReturns += 1;
      }
    });

    return lockPairReturns > 0 || birdCount >= 3 || balloonsHere.size >= 2;
  };

  const emitBalloonIntroStep = (bal: BalloonSpec, isPrimary: boolean) => {
    introducedBalloons.add(bal.id);
    const air = airAt(bal);
    const chain = chains.get(bal.id);
    const tailIn = air.initialTailInches;
    const tailFing = inchesToFingers(tailIn);
    const totalBubbleInches = roundQuarter(
      bubbles.filter((b) => b.balloonId === bal.id).reduce((s, b) => s + (b.lengthInches || 0), 0)
    );

    if (isPrimary) {
      steps.push({
        stepNumber: steps.length + 1,
        stepId: `inflate:${bal.id}`,
        title: `Inflate & Burp ${bal.size} ${bal.colorName} (${bal.name})`,
        description: `Inflate the ${bal.size} ${bal.colorName} twister to about ${air.inflatedInches}″, leaving a ${tailFing}-finger (${tailIn}″) uninflated tail (${totalBubbleInches}″ of bubbles will be formed on this balloon). ${
          bal.burpNote || "Release a small puff of air (burp) before tying the nozzle knot so twists stay soft and pliable."
        }`,
        twistType: "basic",
        balloonId: bal.id,
        balloonColor: bal.color,
        balloonSize: bal.size,
        bubbleIndices: [],
        bubbleLabels: [`Inflate ${bal.size} ${bal.colorName}`],
        measurementText: `Leave ${tailFing} fingers (${tailIn}″) uninflated tail`,
        remainingInflatedInches: air.untwistedInches,
        tailRemainingInches: tailIn,
        tailRemainingFingers: tailFing,
        jointAction: "inflate",
        handStateNote: `🎈 Tied nozzle knot ready — start twisting from the nozzle end so air pushes smoothly toward the ${tailIn}″ tail.`,
        tips: `Always twist every bubble in the same rotational direction and work from the tied nozzle toward the uninflated tail.`,
        diagramSvgType: "balloon_inflated",
      });
    } else {
      const attachWhere = chain?.attachedJointLabel || "the active lock joint on the sculpture";
      steps.push({
        stepNumber: steps.length + 1,
        stepId: `inflate:${bal.id}`,
        title: `Inflate & Attach ${bal.size} ${bal.colorName} (${bal.name})`,
        description: `Inflate the ${bal.size} ${bal.colorName} balloon to about ${air.inflatedInches}″, leaving a ${tailFing}-finger (${tailIn}″) uninflated tail, burp slightly, and tie off. Wrap and twist its nozzle knot directly into ${attachWhere}.`,
        twistType: "basic",
        balloonId: bal.id,
        balloonColor: bal.color,
        balloonSize: bal.size,
        bubbleIndices: [],
        bubbleLabels: [`Attach ${bal.size} ${bal.colorName}`],
        measurementText: `Leave ${tailFing} fingers (${tailIn}″) tail · Tie into ${attachWhere}`,
        remainingInflatedInches: air.untwistedInches,
        tailRemainingInches: tailIn,
        tailRemainingFingers: tailFing,
        jointAction: "attach_balloon",
        handStateNote: `🔒 Wrapping the tied nozzle into ${attachWhere} mechanically anchors this balloon — safe to let go.`,
        tips: `Pull the nozzle knot snug through the existing joint 1–2 wraps so there is zero gap between balloons.`,
        diagramSvgType: "balloon_inflated",
      });
    }
  };

  if (bubbles.length === 0) {
    balloons.forEach((bal, i) => emitBalloonIntroStep(bal, i === 0));
    return preserveUserEdits(steps, previousSteps);
  }

  let idx = 0;
  while (idx < bubbles.length) {
    const b = bubbles[idx];
    const lay = layouts[idx];
    const bal = balloons.find((x) => x.id === b.balloonId) || balloons[0];

    // Emit inflation / tie-in step the exact moment this balloon enters the build!
    if (!introducedBalloons.has(bal.id)) {
      emitBalloonIntroStep(bal, introducedBalloons.size === 0);
    }

    // Determine exact topological step group starting at `idx`:
    let groupIndices: number[] = [idx];

    // Group A: 2-bubble Lock Pair (`out` + `return` on same balloon)
    if (
      b.twistType === "lock" &&
      lay?.foldBridgeTo !== undefined &&
      idx + 1 < bubbles.length &&
      bubbles[idx + 1].balloonId === b.balloonId &&
      bubbles[idx + 1].twistType === "lock"
    ) {
      groupIndices = [idx, idx + 1];
    }
    // Group B: Consecutive Bird Body rails on same balloon
    else if (b.twistType === "bird_body") {
      let j = idx + 1;
      while (
        j < bubbles.length &&
        bubbles[j].balloonId === b.balloonId &&
        bubbles[j].twistType === "bird_body"
      ) {
        groupIndices.push(j);
        j++;
      }
    }
    // Group C: Multi-petal Loop cluster sharing the exact same joint on the same balloon
    else if (lay?.kind === "loop") {
      let j = idx + 1;
      while (
        j < bubbles.length &&
        bubbles[j].balloonId === b.balloonId &&
        layouts[j]?.kind === "loop" &&
        layouts[j]?.startJointId === lay.startJointId
      ) {
        groupIndices.push(j);
        j++;
      }
    }
    // Group D: Double Pinch / Dual Toe Twists sharing the exact same joint on the same balloon
    else if (lay?.kind === "pinch") {
      let j = idx + 1;
      while (
        j < bubbles.length &&
        bubbles[j].balloonId === b.balloonId &&
        layouts[j]?.kind === "pinch" &&
        layouts[j]?.startJointId === lay.startJointId
      ) {
        groupIndices.push(j);
        j++;
      }
    }

    // Mark formed, then read the exact air state at this moment of the build
    groupIndices.forEach((gi) => formedSoFar.add(gi));
    const air = airAt(bal);
    const remInflated = air.untwistedInches;
    const remTail = air.tailRemainingInches;
    const remTailFingers = air.tailRemainingFingers;

    const lastGi = groupIndices[groupIndices.length - 1];
    const lastLay = layouts[lastGi];
    const endJoint = joints[lastLay.endJointId];
    const lockedNow = isJointLockedAtStep(endJoint);
    const hasMoreOnSameBalloon = bubbles.slice(lastGi + 1).some((nb) => nb.balloonId === bal.id);
    const anyWillUntwist = groupIndices.some((gi) => layouts[gi]?.endSeamWillUntwist);

    let jointAction: StepJointAction = "lock";
    let handStateNote = `🔒 Joint mechanically locked — safe to let go with both hands!`;
    let stabilityWarning: string | undefined;

    let airWarning: string | undefined;
    if (air.status === "over_budget") {
      airWarning = `Out of balloon: these bubbles need ${air.overBudgetInches}″ more than you inflated. Inflate further (shorter tail) or shorten earlier bubbles.`;
    } else if (air.status === "pop_risk") {
      airWarning = `Pop risk: only ${air.tailRemainingInches}″ of tail left — the air squeezed forward by every twist has nowhere to go.`;
    }

    if (anyWillUntwist) {
      jointAction = "hold";
      stabilityWarning = `⚠️ UNSTABLE TWIST: Nothing mechanically anchors this seam in the finished sculpture — if you let go, it untwists naturally! Add a Pinch Twist or Lock Pair to secure it.`;
      handStateNote = `⚠️ Unanchored twist — will spin open when released unless locked!`;
    } else if (!hasMoreOnSameBalloon && lockedNow) {
      jointAction = "finish";
      handStateNote = `✨ Balloon complete & mechanically locked — holds its 3D shape hands-free!`;
    } else if (!hasMoreOnSameBalloon && !lockedNow) {
      jointAction = "finish";
      handStateNote = `✨ Final segment shaped from the locked joint to the balloon tip — holds hands-free!`;
    } else if (!lockedNow) {
      jointAction = "hold";
      handStateNote = `✋ Hold this twist between your fingers — do NOT release yet! The next locking twist secures this joint permanently.`;
    } else {
      const reason = endJoint.lockReasons[0] || "Self-locking twist";
      jointAction = "lock";
      handStateNote = `🔒 Locked (${reason}) — you can safely let go of all previous twists!`;
    }

    // Craft crystal-clear title, description & measurement text directly from the 3D geometry
    const orientPhrase = describeOrientation3D(lay);
    const stepKey = `twist:${groupIndices.map((gi) => bubbles[gi].id).join(",")}`;
    let title = "";
    let description = "";
    let measurementText = "";
    let diagramType = "basic_twist";
    let twistType = b.twistType;

    if (groupIndices.length === 2 && b.twistType === "lock" && lay.foldBridgeTo !== undefined) {
      const b1 = bubbles[groupIndices[0]];
      const b2 = bubbles[groupIndices[1]];
      title = `Lock Twist: ${b1.label} & ${b2.label}`;
      description = `Twist a ${b1.lengthInches}″ (${inchesToFingers(b1.lengthInches)}-finger) bubble for ${b1.label}, then a matching ${b2.lengthInches}″ (${inchesToFingers(b2.lengthInches)}-finger) bubble for ${b2.label}. Fold both bubbles side-by-side (${orientPhrase}), pull slightly outward to reduce latex friction, and twist their shared base 3 full revolutions to lock.`;
      measurementText = `${b1.lengthInches}″ + ${b2.lengthInches}″ lock pair (${inchesToFingers(b1.lengthInches)} fingers each)`;
      diagramType = "lock_twist";
      twistType = "lock";
    } else if (b.twistType === "bird_body") {
      const labels = groupIndices.map((gi) => bubbles[gi].label).join(", ");
      const lens = groupIndices.map((gi) => `${bubbles[gi].lengthInches}″`).join(" + ");
      title =
        groupIndices.length >= 3
          ? `${groupIndices.length}-Bubble Bird Body Roll-Through`
          : `Incomplete Bird Body (${groupIndices.length}/3 Rails)`;
      description =
        groupIndices.length >= 3
          ? `Twist ${groupIndices.length} parallel bubbles (${lens} — ${labels}) between the front and rear joints (${orientPhrase}). Gently push and roll the last bubble straight through the gap between the first two until all ${groupIndices.length} lock into a sturdy 3D bundle.`
          : `Twist ${groupIndices.length} bubble${groupIndices.length > 1 ? "s" : ""} (${lens} — ${labels}). Note: add ${
              3 - groupIndices.length
            } more bird-body rail${3 - groupIndices.length > 1 ? "s" : ""} to complete the self-locking roll-through!`;
      measurementText = `${lens} roll-through bundle`;
      diagramType = "bird_body";
      twistType = "bird_body";
    } else if (lay.kind === "loop" && groupIndices.length >= 2) {
      const count = groupIndices.length;
      const lens = groupIndices.map((gi) => `${bubbles[gi].lengthInches}″`);
      const uniform = new Set(lens).size === 1;
      title =
        count >= 3
          ? `Fold ${count} Loop Petals (${groupIndices.map((g) => bubbles[g].label).slice(0, 2).join(", ")}…)`
          : `Fold Dual Loops: ${bubbles[groupIndices[0]].label} & ${bubbles[groupIndices[1]].label}`;
      description =
        count >= 3
          ? `At the current joint, fold ${count} teardrop loop twists (${
              uniform ? `${lens[0]} each` : lens.join(", ")
            }), twisting each loop's base firmly into the same central joint and fanning them evenly around ${Math.round(
              360 / count
            )}° apart.`
          : `Fold a ${bubbles[groupIndices[0]].lengthInches}″ loop twist for ${bubbles[groupIndices[0]].label}, then fold a ${bubbles[groupIndices[1]].lengthInches}″ opposing loop twist for ${bubbles[groupIndices[1]].label}, locking both bases into the same joint.`;
      measurementText = uniform ? `${count} × ${lens[0]} loop twists` : lens.join(" + ") + " loops";
      diagramType = "loop_twist";
      twistType = "loop";
    } else if (lay.kind === "pinch" && groupIndices.length >= 2) {
      const b1 = bubbles[groupIndices[0]];
      const b2 = bubbles[groupIndices[1]];
      const labelKind = b1.twistType === "toe" ? "Toe Twists" : "Double Pinch Twist";
      title = `${labelKind}: ${b1.label} & ${b2.label}`;
      description = `Twist a ${b1.lengthInches}″ bubble and pinch-twist it (pull slightly up and spin 180°–360°), then twist a second ${b2.lengthInches}″ pinch twist on the opposite side of the same joint to lock the angle cleanly with zero wobble.`;
      measurementText = `${b1.lengthInches}″ + ${b2.lengthInches}″ opposing pinch twists`;
      diagramType = b1.twistType === "toe" ? "toe_twist" : "pinch_twist";
      twistType = b1.twistType;
    } else if (b.lockToBubbleStart !== undefined && bubbles[b.lockToBubbleStart]) {
      const targetBubble = bubbles[b.lockToBubbleStart];
      title = `Fold & Lock ${b.label} Into ${targetBubble.label} Joint`;
      description = `Measure a ${b.lengthInches}″ (${inchesToFingers(
        b.lengthInches
      )}-finger) bubble for ${b.label} (${orientPhrase}), bring the twist straight back to the base joint of ${targetBubble.label}, and twist 3 full revolutions around that joint to close and lock the loop.`;
      measurementText = `${b.lengthInches}″ (${inchesToFingers(b.lengthInches)} fingers) return lock`;
      diagramType = "lock_twist";
      twistType = "lock";
    } else {
      const tInfo = TWIST_ENCYCLOPEDIA[b.twistType] || TWIST_ENCYCLOPEDIA.basic;
      const fingers = inchesToFingers(b.lengthInches);
      title = `${tInfo.name}: ${b.label}`;
      if (lay.kind === "pinch") {
        description = `Twist a small ${b.lengthInches}″ (${fingers}-finger) bubble for ${b.label}. Pull the bubble gently away from the main joint to reduce friction and rotate it one full turn on its own axis to create a self-locking ${tInfo.name.toLowerCase()}.`;
        diagramType = b.twistType === "toe" ? "toe_twist" : "pinch_twist";
      } else if (lay.kind === "loop") {
        description = `Measure a ${b.lengthInches}″ (${fingers}-finger) section for ${b.label}, fold it into a smooth teardrop loop (${orientPhrase}), and twist both ends together 3 times at the base joint.`;
        diagramType = "loop_twist";
      } else if (b.twistType === "tulip" || b.twistType === "tulip_chain") {
        description = `Push the knot deep into the ${b.lengthInches}″ bubble with your index finger for ${b.label}, pinch the knot through the outside latex with your other hand, withdraw your finger carefully, and twist 3 full turns behind the knot.`;
        diagramType = "tulip_twist";
      } else if (b.twistType === "apple_link") {
        description = `Twist a ${b.lengthInches}″ (${fingers}-finger) section for ${b.label} (${orientPhrase}) and lock it directly into the recessed Apple Twist knot for a hidden high-strength joint.`;
        diagramType = "apple_link";
      } else if (b.twistType === "spiral") {
        description = `Coil ${b.lengthInches}″ (${fingers} fingers) of ${bal.name} snugly around a pump barrel or finger for ${b.label} (${orientPhrase}) so the latex sets in a crisp corkscrew spiral.`;
        diagramType = "spiral_twist";
      } else if (b.twistType === "s_hook") {
        description = `Shape a ${b.lengthInches}″ (${fingers}-finger) bubble for ${b.label} (${orientPhrase}), warming and curving the latex between your palms into a smooth S-contour.`;
        diagramType = "basic_twist";
      } else if (b.twistType === "z_bend") {
        description = `Accordion-fold a ${b.lengthInches}″ (${fingers}-finger) bubble for ${b.label} (${orientPhrase}) into a sharp Z-bend and squeeze firmly for 5 seconds so the creases hold.`;
        diagramType = "basic_twist";
      } else if (b.twistType === "cut_tail_bubbles") {
        description = `Squeeze a ${b.lengthInches}″ bead bubble for ${b.label} at the tip, snip/release excess air from the spacer, and tie off securely for a clean pom-pom finish.`;
        diagramType = "cut_tail_bubbles";
      } else if (b.twistType === "cut_tail") {
        description = `Release remaining air after ${b.label}, tie a tight knot right against the joint, and trim excess latex neatly.`;
        diagramType = "cut_tail";
      } else {
        description = `Measure ${b.lengthInches}″ (${fingers} fingers) along ${bal.name} for ${b.label} (${orientPhrase}) and twist 3–4 revolutions in the same direction.`;
        diagramType = "basic_twist";
      }
      measurementText = `${b.lengthInches}″ (${fingers} fingers) · ${b.label}`;
    }

    const primaryTwistInfo = TWIST_ENCYCLOPEDIA[twistType] || TWIST_ENCYCLOPEDIA.basic;

    steps.push({
      stepNumber: steps.length + 1,
      stepId: stepKey,
      title,
      description,
      twistType,
      balloonId: bal.id,
      balloonColor: b.color || bal.color,
      balloonSize: bal.size,
      bubbleIndices: groupIndices,
      bubbleLabels: groupIndices.map((gi) => bubbles[gi].label),
      measurementText,
      remainingInflatedInches: remInflated,
      tailRemainingInches: remTail,
      tailRemainingFingers: remTailFingers,
      jointAction,
      handStateNote,
      stabilityWarning,
      tips: primaryTwistInfo.proTip,
      warning: airWarning,
      diagramSvgType: diagramType,
    });

    idx = groupIndices[groupIndices.length - 1] + 1;
  }

  // Balloons added but not yet twisted still get their inflate / attach step
  balloons.forEach((bal) => {
    if (!introducedBalloons.has(bal.id)) emitBalloonIntroStep(bal, introducedBalloons.size === 0);
  });

  return preserveUserEdits(steps, previousSteps);
}

// Backwards-compatible exports used across the app
export const generateStepsFromBubbles = generateStepsFromSimulation;

export function refreshStepMeasurements(
  steps: StepSpec[],
  bubbles: BubbleSpec[],
  balloons?: BalloonSpec[]
): StepSpec[] {
  if (balloons && balloons.length > 0) {
    return generateStepsFromSimulation(balloons, bubbles, steps);
  }
  return steps;
}

export function createBlankSlateDesign(): Record<"beginner" | "intermediate" | "advanced", any> {
  const mkDesign = (
    complexity: "beginner" | "intermediate" | "advanced",
    title: string,
    balloons: BalloonSpec[],
    bubbles: BubbleSpec[]
  ) => ({
    id: `blank-slate-${complexity}-${Date.now()}`,
    title,
    description:
      "True blank-slate workspace — add, delete, resize, bend, or drop new twists directly inside the 3D Smooth Latex Simulation and watch every step instruction & stability rule update live!",
    category: "custom",
    complexity,
    sourceType: "scratch",
    balloonCount: balloons.length,
    bubbleCount: bubbles.length,
    balloons,
    bubbles,
    steps: generateStepsFromSimulation(balloons, bubbles),
    annotations: [
      "Tip: Click or drag any twist chip in the 3D viewport to add twists, drag handles on the selected bubble to resize or bend it, and click 'Let Go' to test whether your twists hold or unravel!",
    ],
  });

  const baseBalloon: BalloonSpec = {
    id: "bal-scratch-1",
    name: "Main 260 Twister",
    size: "260",
    color: "#E11D48",
    colorName: "Ruby Red",
    inflatedLengthInches: 48,
    tailLengthInches: 12,
    tailFingers: 5,
    burpNote: "Burp 1 puff before tying so twists stay soft and pliable.",
    order: 1,
  };

  // Truly blank workspace: 1 balloon, 0 bubbles.
  // The user starts from scratch by dragging twists onto the empty balloon.
  const emptyBubbles: BubbleSpec[] = [];

  return {
    beginner: mkDesign("beginner", "Custom Sculpture (Blank Slate)", [baseBalloon], emptyBubbles),
    intermediate: mkDesign(
      "intermediate",
      "Custom Multi-Balloon Sculpture (Blank Slate)",
      [
        { ...baseBalloon },
        {
          id: "bal-scratch-2",
          name: "Accent 260 Twister",
          size: "260",
          color: "#FACC15",
          colorName: "Canary Yellow",
          inflatedLengthInches: 44,
          tailLengthInches: 16,
          tailFingers: 7,
          burpNote: "Burp well for loops and locks.",
          order: 2,
          attachTo: { bubbleIndex: 0, end: "end" },
        },
      ],
      []
    ),
    advanced: mkDesign(
      "advanced",
      "Custom Masterpiece Sculpture (Blank Slate)",
      [
        { ...baseBalloon, size: "360", name: "Heavy 360 Core" },
        {
          id: "bal-scratch-2",
          name: "Sculpting 260",
          size: "260",
          color: "#38BDF8",
          colorName: "Pale Blue",
          inflatedLengthInches: 46,
          tailLengthInches: 14,
          tailFingers: 6,
          order: 2,
          attachTo: { bubbleIndex: 0, end: "end" },
        },
        {
          id: "bal-scratch-3",
          name: "Detail 160",
          size: "160",
          color: "#FACC15",
          colorName: "Canary Yellow",
          inflatedLengthInches: 40,
          tailLengthInches: 20,
          tailFingers: 8,
          order: 3,
          attachTo: { bubbleIndex: 0, end: "end" },
        },
      ],
      []
    ),
  };
}
