import { BalloonSpec, BubbleSpec, ComplexityLevel, FullDesign } from "@/types/balloon";
import { generateStepsFromSimulation } from "./stepGenerator";
import { fitTailForBubbles } from "./balloonAir";

function buildDesign(params: {
  id: string;
  title: string;
  description: string;
  category: string;
  complexity: ComplexityLevel;
  sourceType?: string;
  sourcePrompt?: string;
  balloons: BalloonSpec[];
  bubbles: BubbleSpec[];
  annotations?: string[];
  isPreset?: boolean;
}): FullDesign {
  const balloonColors = new Map(params.balloons.map((balloon) => [balloon.id, balloon.color]));
  // Physical rule: a twister balloon is one continuous piece of latex and therefore
  // has exactly one color. Every bubble made from it inherits that balloon color.
  const normalizedBubbles = params.bubbles.map((bubble, index) => ({
    ...bubble,
    index,
    color: balloonColors.get(bubble.balloonId) ?? bubble.color,
  }));
  // Inflate each balloon just enough for its bubbles (plus the air its twists
  // squeeze into the tail) so no long untwisted leftover trails off the model.
  const fittedBalloons = params.balloons.map((bal) => {
    const tail = fitTailForBubbles(bal, normalizedBubbles);
    return {
      ...bal,
      tailLengthInches: tail,
      tailFingers: Math.round((tail / 0.8) * 10) / 10,
      inflatedLengthInches: Math.round((60 - tail) * 4) / 4,
    };
  });
  return {
    id: params.id,
    title: params.title,
    description: params.description,
    category: params.category,
    complexity: params.complexity,
    sourceType: params.sourceType || "preset",
    sourcePrompt: params.sourcePrompt,
    balloonCount: fittedBalloons.length,
    bubbleCount: normalizedBubbles.length,
    balloons: fittedBalloons,
    bubbles: normalizedBubbles,
    steps: generateStepsFromSimulation(fittedBalloons, normalizedBubbles),
    annotations: params.annotations || [],
    isPreset: params.isPreset ?? params.sourceType === "preset",
  };
}

export const PRESET_DESIGNS: Record<
  string,
  Record<"beginner" | "intermediate" | "advanced", FullDesign>
> = {
  dog: {
    beginner: buildDesign({
      id: "dog-beginner",
      title: "Classic Party Puppy (1-Balloon)",
      description:
        "The iconic 1-balloon 260 busking puppy — snout, lock-twisted ears, neck, lock-twisted front & rear legs, torso, and curved tail. Every single twist is mechanically anchored.",
      category: "animals",
      complexity: "beginner",
      balloons: [
        {
          id: "bal-1",
          name: "Dog Body 260",
          size: "260",
          color: "#EA580C",
          colorName: "Mandarin Orange",
          inflatedLengthInches: 48,
          tailLengthInches: 12,
          tailFingers: 5,
          burpNote: "Burp 1 puff before tying to soften latex for the 3 lock-twist joints.",
          order: 1,
        },
      ],
      bubbles: [
        { id: "b-1", balloonId: "bal-1", index: 0, label: "Nose / Snout", lengthInches: 2.5, diameterInches: 2.0, twistType: "basic", color: "#EA580C", baseDir: [1, 0, 0] },
        { id: "b-2", balloonId: "bal-1", index: 1, label: "Left Ear", lengthInches: 3.25, diameterInches: 2.0, twistType: "lock", color: "#EA580C", bend: 68, turn: 14 },
        { id: "b-3", balloonId: "bal-1", index: 2, label: "Right Ear", lengthInches: 3.25, diameterInches: 2.0, twistType: "lock", color: "#EA580C" },
        { id: "b-4", balloonId: "bal-1", index: 3, label: "Neck", lengthInches: 2.5, diameterInches: 2.0, twistType: "basic", color: "#EA580C", bend: -58 },
        { id: "b-5", balloonId: "bal-1", index: 4, label: "Front Left Leg", lengthInches: 3.5, diameterInches: 2.0, twistType: "lock", color: "#EA580C", bend: -32, turn: 10 },
        { id: "b-6", balloonId: "bal-1", index: 5, label: "Front Right Leg", lengthInches: 3.5, diameterInches: 2.0, twistType: "lock", color: "#EA580C" },
        { id: "b-7", balloonId: "bal-1", index: 6, label: "Torso / Body", lengthInches: 4.5, diameterInches: 2.0, twistType: "basic", color: "#EA580C", bend: 58 },
        { id: "b-8", balloonId: "bal-1", index: 7, label: "Back Left Leg", lengthInches: 3.5, diameterInches: 2.0, twistType: "lock", color: "#EA580C", bend: -90, turn: 10 },
        { id: "b-9", balloonId: "bal-1", index: 8, label: "Back Right Leg", lengthInches: 3.5, diameterInches: 2.0, twistType: "lock", color: "#EA580C" },
        { id: "b-10", balloonId: "bal-1", index: 9, label: "Perky Tail", lengthInches: 3.5, diameterInches: 2.0, twistType: "s_hook", color: "#EA580C", bend: 62 },
      ],
      annotations: [
        "Try stretching Neck in 3D to turn the puppy into a Giraffe, Body for a Dachshund, or Ears for a Bunny!",
        "Try clicking '🖐️ Let Go' after removing an ear to watch how un-locked twists physically unravel.",
      ],
    }),

    intermediate: buildDesign({
      id: "dog-intermediate",
      title: "Playful Dachshund with Floppy Loop Ears & Toe-Twist Paws",
      description:
        "Deluxe 2-balloon wiener dog featuring forehead pinch, floppy hound loop ears, four sculpted toe-twist paws on folded legs, S-hook tail, and a 160 Ruby Red collar.",
      category: "animals",
      complexity: "intermediate",
      balloons: [
        {
          id: "bal-1",
          name: "Dachshund Body",
          size: "260",
          color: "#78350F",
          colorName: "Chocolate Brown",
          inflatedLengthInches: 48,
          tailLengthInches: 12,
          tailFingers: 5,
          burpNote: "Burp twice — toe twists and return leg locks need pliable latex.",
          order: 1,
        },
        {
          id: "bal-2",
          name: "Collar & Tag",
          size: "160",
          color: "#E11D48",
          colorName: "Ruby Red",
          inflatedLengthInches: 18,
          tailLengthInches: 42,
          tailFingers: 16,
          burpNote: "Inflate 18″ soft for collar loop and tag pinch.",
          order: 2,
          attachTo: { bubbleIndex: 4, end: "end" },
        },
      ],
      bubbles: [
        { id: "b-1", balloonId: "bal-1", index: 0, label: "Hound Snout", lengthInches: 3.25, diameterInches: 2.0, twistType: "basic", color: "#78350F", baseDir: [1, 0, 0] },
        { id: "b-2", balloonId: "bal-1", index: 1, label: "Forehead Pinch", lengthInches: 1.1, diameterInches: 1.7, twistType: "pinch", isPinch: true, color: "#78350F", baseDir: [-0.2, 1, 0] },
        { id: "b-3", balloonId: "bal-1", index: 2, label: "Left Floppy Ear", lengthInches: 4.5, diameterInches: 2.0, twistType: "loop", isLoop: true, color: "#78350F", baseDir: [0.3, -0.35, 0.89] },
        { id: "b-4", balloonId: "bal-1", index: 3, label: "Right Floppy Ear", lengthInches: 4.5, diameterInches: 2.0, twistType: "loop", isLoop: true, color: "#78350F", baseDir: [0.3, -0.35, -0.89] },
        { id: "b-5", balloonId: "bal-1", index: 4, label: "Neck", lengthInches: 2.0, diameterInches: 2.0, twistType: "basic", color: "#78350F", bend: -55 },
        { id: "b-6", balloonId: "bal-1", index: 5, label: "Front Left Leg", lengthInches: 2.75, diameterInches: 2.0, twistType: "basic", color: "#78350F", baseDir: [0, -1, 0] },
        { id: "b-7", balloonId: "bal-1", index: 6, label: "Front Left Paw", lengthInches: 0.9, diameterInches: 1.4, twistType: "toe", isPinch: true, color: "#78350F", baseDir: [-0.88, -0.12, 0.45] },
        { id: "b-8", balloonId: "bal-1", index: 7, label: "Front Right Paw", lengthInches: 0.9, diameterInches: 1.4, twistType: "toe", isPinch: true, color: "#78350F", baseDir: [-0.88, -0.12, -0.45] },
        { id: "b-9", balloonId: "bal-1", index: 8, label: "Front Right Leg", lengthInches: 2.75, diameterInches: 2.0, twistType: "lock", color: "#78350F", lockToBubbleStart: 5 },
        { id: "b-10", balloonId: "bal-1", index: 9, label: "Long Wiener Torso", lengthInches: 7.0, diameterInches: 2.0, twistType: "basic", color: "#78350F", baseDir: [1, 0, 0] },
        { id: "b-11", balloonId: "bal-1", index: 10, label: "Rear Left Leg", lengthInches: 2.75, diameterInches: 2.0, twistType: "basic", color: "#78350F", baseDir: [0, -1, 0] },
        { id: "b-12", balloonId: "bal-1", index: 11, label: "Rear Left Paw", lengthInches: 0.9, diameterInches: 1.4, twistType: "toe", isPinch: true, color: "#78350F", baseDir: [-0.88, -0.12, 0.45] },
        { id: "b-13", balloonId: "bal-1", index: 12, label: "Rear Right Paw", lengthInches: 0.9, diameterInches: 1.4, twistType: "toe", isPinch: true, color: "#78350F", baseDir: [-0.88, -0.12, -0.45] },
        { id: "b-14", balloonId: "bal-1", index: 13, label: "Rear Right Leg", lengthInches: 2.75, diameterInches: 2.0, twistType: "lock", color: "#78350F", lockToBubbleStart: 10 },
        { id: "b-15", balloonId: "bal-1", index: 14, label: "S-Curved Tail", lengthInches: 4.25, diameterInches: 1.8, twistType: "s_hook", color: "#78350F", baseDir: [0.52, 0.85, 0] },
        { id: "b-16", balloonId: "bal-2", index: 15, label: "Red Collar Ring", lengthInches: 3.25, diameterInches: 1.0, twistType: "loop", isLoop: true, color: "#E11D48", baseDir: [-0.68, 0.73, 0] },
        { id: "b-17", balloonId: "bal-2", index: 16, label: "Collar Tag Bead", lengthInches: 0.9, diameterInches: 1.1, twistType: "pinch", isPinch: true, color: "#FACC15", baseDir: [-0.85, -0.52, 0] },
      ],
      annotations: [
        "Notice how each pair of legs goes down, locks two toe-twist paws at the ankle, and folds right back up into the body joint!",
      ],
    }),

    advanced: buildDesign({
      id: "dog-advanced",
      title: "Deluxe Show Poodle with Apple Muzzle, Bird Body & Pom-Poms",
      description:
        "Exhibition 4-balloon poodle featuring a 360 Apple Twist muzzle, puffy loop ears, 3-bubble Bird Body roll-through ribcage, pom-pom ankle beads, tail pom-pom, and 160 Magenta crown bow.",
      category: "animals",
      complexity: "advanced",
      balloons: [
        { id: "bal-1", name: "Poodle Head (360)", size: "360", color: "#F8FAFC", colorName: "Snow White", inflatedLengthInches: 36, tailLengthInches: 24, tailFingers: 10, burpNote: "Deep burp on 360 for smooth Apple Twist muzzle.", order: 1 },
        { id: "bal-2", name: "Bird Body & Tail (260)", size: "260", color: "#F8FAFC", colorName: "Snow White", inflatedLengthInches: 46, tailLengthInches: 14, tailFingers: 6, burpNote: "Soft fill for 3-bubble roll-through chest.", order: 2, attachTo: { bubbleIndex: 4, end: "end" } },
        { id: "bal-3", name: "Legs & Pom-Poms (260)", size: "260", color: "#F8FAFC", colorName: "Snow White", inflatedLengthInches: 48, tailLengthInches: 12, tailFingers: 5, burpNote: "Burp well for ankle pom-pom pinches.", order: 3, attachTo: { bubbleIndex: 4, end: "end" } },
        { id: "bal-4", name: "Crown Ribbon Bow (160)", size: "160", color: "#DB2777", colorName: "Magenta Pink", inflatedLengthInches: 24, tailLengthInches: 36, tailFingers: 14, burpNote: "Soft fill for delicate bow loops.", order: 4, attachTo: { bubbleIndex: 1, end: "start" } },
      ],
      bubbles: [
        { id: "b-1", balloonId: "bal-1", index: 0, label: "Apple Twist Muzzle", lengthInches: 3.25, diameterInches: 2.8, twistType: "tulip", isTulip: true, color: "#F8FAFC", baseDir: [1, 0, 0] },
        { id: "b-2", balloonId: "bal-1", index: 1, label: "Crown Topknot Pinch", lengthInches: 1.5, diameterInches: 2.6, twistType: "pinch", isPinch: true, color: "#F8FAFC", baseDir: [-0.15, 1, 0] },
        { id: "b-3", balloonId: "bal-1", index: 2, label: "Left Poodle Ear Loop", lengthInches: 5.0, diameterInches: 2.4, twistType: "loop", isLoop: true, color: "#F8FAFC", baseDir: [0.25, -0.3, 0.92] },
        { id: "b-4", balloonId: "bal-1", index: 3, label: "Right Poodle Ear Loop", lengthInches: 5.0, diameterInches: 2.4, twistType: "loop", isLoop: true, color: "#F8FAFC", baseDir: [0.25, -0.3, -0.92] },
        { id: "b-5", balloonId: "bal-1", index: 4, label: "Apple Link Neck", lengthInches: 2.5, diameterInches: 2.4, twistType: "apple_link", color: "#F8FAFC", baseDir: [0.55, -0.83, 0] },
        { id: "b-6", balloonId: "bal-2", index: 5, label: "Chest Bird Rail 1", lengthInches: 5.0, diameterInches: 2.0, twistType: "bird_body", color: "#F8FAFC", baseDir: [1, 0.04, 0] },
        { id: "b-7", balloonId: "bal-2", index: 6, label: "Chest Bird Rail 2", lengthInches: 5.0, diameterInches: 2.0, twistType: "bird_body", color: "#F8FAFC" },
        { id: "b-8", balloonId: "bal-2", index: 7, label: "Chest Roll-Through Core", lengthInches: 5.0, diameterInches: 2.0, twistType: "bird_body", color: "#F8FAFC" },
        { id: "b-9", balloonId: "bal-2", index: 8, label: "Lumbar Hip Pinch", lengthInches: 1.25, diameterInches: 1.9, twistType: "pinch", isPinch: true, color: "#F8FAFC", baseDir: [0.2, 1, 0] },
        { id: "b-10", balloonId: "bal-2", index: 9, label: "Shaved Tail Stem", lengthInches: 3.75, diameterInches: 1.5, twistType: "basic", color: "#F8FAFC", baseDir: [0.5, 0.86, 0] },
        { id: "b-11", balloonId: "bal-2", index: 10, label: "Tail Tip Pom-Pom Bead", lengthInches: 1.5, diameterInches: 2.3, twistType: "cut_tail_bubbles", color: "#F8FAFC", baseDir: [0.5, 0.86, 0] },
        { id: "b-12", balloonId: "bal-3", index: 11, label: "Front Left Leg", lengthInches: 3.75, diameterInches: 1.8, twistType: "basic", color: "#F8FAFC", baseDir: [0, -1, 0] },
        { id: "b-13", balloonId: "bal-3", index: 12, label: "Front Left Pom-Pom", lengthInches: 1.2, diameterInches: 2.1, twistType: "toe", isPinch: true, color: "#F8FAFC", baseDir: [-0.85, -0.1, 0.5] },
        { id: "b-14", balloonId: "bal-3", index: 13, label: "Front Right Pom-Pom", lengthInches: 1.2, diameterInches: 2.1, twistType: "toe", isPinch: true, color: "#F8FAFC", baseDir: [-0.85, -0.1, -0.5] },
        { id: "b-15", balloonId: "bal-3", index: 14, label: "Front Right Leg", lengthInches: 3.75, diameterInches: 1.8, twistType: "lock", color: "#F8FAFC", lockToBubbleStart: 11 },
        { id: "b-16", balloonId: "bal-3", index: 15, label: "Rear Left Leg", lengthInches: 3.5, diameterInches: 1.8, twistType: "basic", color: "#F8FAFC", branchFrom: { bubbleIndex: 8, end: "start" }, baseDir: [0, -1, 0] },
        { id: "b-17", balloonId: "bal-3", index: 16, label: "Rear Left Pom-Pom", lengthInches: 1.2, diameterInches: 2.1, twistType: "toe", isPinch: true, color: "#F8FAFC", baseDir: [-0.85, -0.1, 0.5] },
        { id: "b-18", balloonId: "bal-3", index: 17, label: "Rear Right Pom-Pom", lengthInches: 1.2, diameterInches: 2.1, twistType: "toe", isPinch: true, color: "#F8FAFC", baseDir: [-0.85, -0.1, -0.5] },
        { id: "b-19", balloonId: "bal-3", index: 18, label: "Rear Right Leg", lengthInches: 3.5, diameterInches: 1.8, twistType: "lock", color: "#F8FAFC", lockToBubbleStart: 15 },
        { id: "b-20", balloonId: "bal-4", index: 19, label: "Bow Center Knot", lengthInches: 0.9, diameterInches: 1.1, twistType: "pinch", isPinch: true, color: "#DB2777", baseDir: [0, 1, 0.2] },
        { id: "b-21", balloonId: "bal-4", index: 20, label: "Left Ribbon Loop", lengthInches: 3.0, diameterInches: 1.0, twistType: "loop", isLoop: true, color: "#DB2777", baseDir: [-0.2, 0.65, 0.73] },
        { id: "b-22", balloonId: "bal-4", index: 21, label: "Right Ribbon Loop", lengthInches: 3.0, diameterInches: 1.0, twistType: "loop", isLoop: true, color: "#DB2777", baseDir: [-0.2, 0.65, -0.73] },
      ],
      annotations: [
        "Competition showpiece combining 360, 260, and 160 balloons with a 3-bubble Bird Body chest and cut-tail pom-pom rattle.",
      ],
    }),
  },

  sword: {
    beginner: buildDesign({
      id: "sword-beginner",
      title: "Pirate Cutlass (1-Balloon)",
      description:
        "30-second busking cutlass with a self-locking pinch pommel (so the handle never untwists!), dual guard loops, and a sweeping silver blade.",
      category: "weapons",
      complexity: "beginner",
      balloons: [
        {
          id: "bal-1",
          name: "Saber 260",
          size: "260",
          color: "#94A3B8",
          colorName: "Chrome Silver",
          inflatedLengthInches: 55,
          tailLengthInches: 5,
          tailFingers: 2,
          burpNote: "Leave only 2 fingers of tail so the blade stays tall and rigid.",
          order: 1,
        },
      ],
      bubbles: [
        { id: "b-1", balloonId: "bal-1", index: 0, label: "Pommel Pinch Bead", lengthInches: 1.25, diameterInches: 2.0, twistType: "pinch", isPinch: true, color: "#94A3B8", baseDir: [0, -1, 0] },
        { id: "b-2", balloonId: "bal-1", index: 1, label: "Handle Grip", lengthInches: 4.5, diameterInches: 2.0, twistType: "basic", color: "#94A3B8", baseDir: [0, 1, 0] },
        { id: "b-3", balloonId: "bal-1", index: 2, label: "Guard Loop Left", lengthInches: 6.0, diameterInches: 2.0, twistType: "loop", isLoop: true, color: "#94A3B8", baseDir: [-0.94, 0.34, 0] },
        { id: "b-4", balloonId: "bal-1", index: 3, label: "Guard Loop Right", lengthInches: 6.0, diameterInches: 2.0, twistType: "loop", isLoop: true, color: "#94A3B8", baseDir: [0.94, 0.34, 0] },
        { id: "b-5", balloonId: "bal-1", index: 4, label: "Cutlass Blade", lengthInches: 22.0, diameterInches: 2.0, twistType: "s_hook", color: "#94A3B8", baseDir: [0.06, 1, 0] },
      ],
      annotations: [
        "Pro tip check: try switching 'Pommel Pinch Bead' to 'Basic Twist' in 3D and click '🖐️ Let Go' — see why real twisters ALWAYS pinch-twist the pommel!",
      ],
    }),

    intermediate: buildDesign({
      id: "sword-intermediate",
      title: "Knight's Claymore with Double-Tube Crossguard & Apple Pommel",
      description:
        "Heroic 2-balloon broadsword featuring a golden Apple Twist pommel, pinch-locked grip, folded double-tube quillons with pinch finials, and a straight Chrome Silver blade.",
      category: "weapons",
      complexity: "intermediate",
      balloons: [
        { id: "bal-1", name: "Golden Hilt & Guard", size: "260", color: "#EAB308", colorName: "Chrome Gold", inflatedLengthInches: 42, tailLengthInches: 18, tailFingers: 7, burpNote: "Burp twice for Apple pommel and crossguard folds.", order: 1 },
        { id: "bal-2", name: "Claymore Blade", size: "260", color: "#94A3B8", colorName: "Chrome Silver", inflatedLengthInches: 54, tailLengthInches: 6, tailFingers: 3, burpNote: "Firm fill for rigid straight blade.", order: 2, attachTo: { bubbleIndex: 3, end: "start" } },
      ],
      bubbles: [
        { id: "b-1", balloonId: "bal-1", index: 0, label: "Apple Twist Pommel", lengthInches: 2.0, diameterInches: 2.2, twistType: "tulip", isTulip: true, color: "#EAB308", baseDir: [0, 1, 0] },
        { id: "b-2", balloonId: "bal-1", index: 1, label: "Pommel Lock Pinch", lengthInches: 1.0, diameterInches: 1.6, twistType: "pinch", isPinch: true, color: "#EAB308", baseDir: [0, 0.2, 1] },
        { id: "b-3", balloonId: "bal-1", index: 2, label: "Leather Hilt Grip", lengthInches: 4.5, diameterInches: 2.0, twistType: "basic", color: "#EAB308", baseDir: [0, 1, 0] },
        { id: "b-4", balloonId: "bal-1", index: 3, label: "Center Guard Pinch", lengthInches: 1.1, diameterInches: 1.8, twistType: "pinch", isPinch: true, color: "#EAB308", baseDir: [0, 0.2, 1] },
        { id: "b-5", balloonId: "bal-1", index: 4, label: "Left Quillon Out", lengthInches: 3.75, diameterInches: 1.9, twistType: "basic", color: "#EAB308", baseDir: [-1, 0.1, 0] },
        { id: "b-6", balloonId: "bal-1", index: 5, label: "Left Quillon Finial", lengthInches: 1.0, diameterInches: 1.6, twistType: "pinch", isPinch: true, color: "#EAB308", baseDir: [-0.6, 0.8, 0] },
        { id: "b-7", balloonId: "bal-1", index: 6, label: "Left Quillon Return", lengthInches: 3.75, diameterInches: 1.9, twistType: "lock", color: "#EAB308", lockToBubbleStart: 4 },
        { id: "b-8", balloonId: "bal-1", index: 7, label: "Right Quillon Out", lengthInches: 3.75, diameterInches: 1.9, twistType: "basic", color: "#EAB308", baseDir: [1, 0.1, 0] },
        { id: "b-9", balloonId: "bal-1", index: 8, label: "Right Quillon Finial", lengthInches: 1.0, diameterInches: 1.6, twistType: "pinch", isPinch: true, color: "#EAB308", baseDir: [0.6, 0.8, 0] },
        { id: "b-10", balloonId: "bal-1", index: 9, label: "Right Quillon Return", lengthInches: 3.75, diameterInches: 1.9, twistType: "lock", color: "#EAB308", lockToBubbleStart: 7 },
        { id: "b-11", balloonId: "bal-2", index: 10, label: "Ricasso Collar Pinch", lengthInches: 1.1, diameterInches: 1.8, twistType: "pinch", isPinch: true, color: "#94A3B8", baseDir: [0, 0.2, -1] },
        { id: "b-12", balloonId: "bal-2", index: 11, label: "Broadsword Blade", lengthInches: 24.0, diameterInches: 2.0, twistType: "basic", color: "#94A3B8", baseDir: [0, 1, 0] },
      ],
      annotations: ["Double-tube crossguard quillons stay straight and sturdy during play."],
    }),

    advanced: buildDesign({
      id: "sword-advanced",
      title: "Excalibur Royal Broadsword with 360 Blade & 160 Fuller Rails",
      description:
        "Show-stopping 3-balloon weapon combining a golden Apple Pommel & Spiral Knuckle Guard, a heavy 360 Silver central blade, and glowing Pale Blue 160 side-bubble fuller rails locked tip-to-guard.",
      category: "weapons",
      complexity: "advanced",
      balloons: [
        { id: "bal-1", name: "Royal Gold Hilt (260)", size: "260", color: "#EAB308", colorName: "Chrome Gold", inflatedLengthInches: 46, tailLengthInches: 14, tailFingers: 6, burpNote: "Soft fill for spiral knuckle guard and crown loops.", order: 1 },
        { id: "bal-2", name: "Heavy Central Blade (360)", size: "360", color: "#94A3B8", colorName: "Chrome Silver", inflatedLengthInches: 44, tailLengthInches: 16, tailFingers: 7, burpNote: "Even fill for massive broadsword spine.", order: 2, attachTo: { bubbleIndex: 3, end: "start" } },
        { id: "bal-3", name: "Glowing Fuller Rails (160)", size: "160", color: "#38BDF8", colorName: "Pale Blue", inflatedLengthInches: 52, tailLengthInches: 8, tailFingers: 4, burpNote: "Runs up left edge, pinches at tip, returns down right edge.", order: 3, attachTo: { bubbleIndex: 3, end: "start" } },
      ],
      bubbles: [
        { id: "b-1", balloonId: "bal-1", index: 0, label: "Golden Apple Pommel", lengthInches: 2.25, diameterInches: 2.2, twistType: "tulip", isTulip: true, color: "#EAB308", baseDir: [0, 1, 0] },
        { id: "b-2", balloonId: "bal-1", index: 1, label: "Pommel Gem Pinch", lengthInches: 1.0, diameterInches: 1.6, twistType: "pinch", isPinch: true, color: "#38BDF8", baseDir: [0, -0.3, 1] },
        { id: "b-3", balloonId: "bal-1", index: 2, label: "Royal Grip", lengthInches: 5.0, diameterInches: 2.0, twistType: "basic", color: "#EAB308", baseDir: [0, 1, 0] },
        { id: "b-4", balloonId: "bal-1", index: 3, label: "Crossguard Center Pinch", lengthInches: 1.2, diameterInches: 1.9, twistType: "pinch", isPinch: true, color: "#EAB308", baseDir: [0, 0.2, 1] },
        { id: "b-5", balloonId: "bal-1", index: 4, label: "Left Crown Guard Loop", lengthInches: 6.5, diameterInches: 2.0, twistType: "loop", isLoop: true, color: "#EAB308", baseDir: [-0.92, 0.38, 0] },
        { id: "b-6", balloonId: "bal-1", index: 5, label: "Right Crown Guard Loop", lengthInches: 6.5, diameterInches: 2.0, twistType: "loop", isLoop: true, color: "#EAB308", baseDir: [0.92, 0.38, 0] },
        { id: "b-7", balloonId: "bal-1", index: 6, label: "Spiral Knuckle Bow", lengthInches: 5.25, diameterInches: 1.5, twistType: "spiral", color: "#EAB308", branchFrom: { bubbleIndex: 1, end: "start" }, lockToBubbleStart: 3 },
        { id: "b-8", balloonId: "bal-2", index: 7, label: "Central 360 Blade", lengthInches: 22.0, diameterInches: 3.0, twistType: "basic", color: "#94A3B8", baseDir: [0, 1, 0] },
        { id: "b-9", balloonId: "bal-3", index: 8, label: "Left 160 Fuller Edge", lengthInches: 22.0, diameterInches: 1.0, twistType: "side_bubble", color: "#38BDF8", baseDir: [0, 1, 0] },
        { id: "b-10", balloonId: "bal-3", index: 9, label: "Sword Point Pinch Tip", lengthInches: 0.9, diameterInches: 1.1, twistType: "pinch", isPinch: true, color: "#38BDF8", baseDir: [0, 1, 0] },
        { id: "b-11", balloonId: "bal-3", index: 10, label: "Right 160 Fuller Edge", lengthInches: 22.0, diameterInches: 1.0, twistType: "lock", color: "#38BDF8", lockToBubbleStart: 8 },
      ],
      annotations: ["160 edge rails frame the 360 blade on both flanks and lock right back into the hilt!"],
    }),
  },

  flower: {
    beginner: buildDesign({
      id: "flower-beginner",
      title: "Spring Daisy (2-Balloons)",
      description:
        "Cheerful 5-petal loop blossom with a glowing yellow stamen pinch, emerald stem, and two opposing leaf loops.",
      category: "nature",
      complexity: "beginner",
      balloons: [
        { id: "bal-1", name: "Petal Blossom 260", size: "260", color: "#EC4899", colorName: "Magenta Pink", inflatedLengthInches: 50, tailLengthInches: 10, tailFingers: 4, burpNote: "Burp well so all 5 loop petals fold without popping.", order: 1 },
        { id: "bal-2", name: "Stem & Leaves 260", size: "260", color: "#16A34A", colorName: "Emerald Green", inflatedLengthInches: 46, tailLengthInches: 14, tailFingers: 6, burpNote: "Soft fill for stamen pinch and mid-stem leaf loops.", order: 2, attachTo: { bubbleIndex: 0, end: "start" } },
      ],
      bubbles: [
        { id: "b-1", balloonId: "bal-1", index: 0, label: "Petal 1", lengthInches: 5.5, diameterInches: 2.0, twistType: "loop", isLoop: true, color: "#EC4899" },
        { id: "b-2", balloonId: "bal-1", index: 1, label: "Petal 2", lengthInches: 5.5, diameterInches: 2.0, twistType: "loop", isLoop: true, color: "#EC4899" },
        { id: "b-3", balloonId: "bal-1", index: 2, label: "Petal 3", lengthInches: 5.5, diameterInches: 2.0, twistType: "loop", isLoop: true, color: "#EC4899" },
        { id: "b-4", balloonId: "bal-1", index: 3, label: "Petal 4", lengthInches: 5.5, diameterInches: 2.0, twistType: "loop", isLoop: true, color: "#EC4899" },
        { id: "b-5", balloonId: "bal-1", index: 4, label: "Petal 5", lengthInches: 5.5, diameterInches: 2.0, twistType: "loop", isLoop: true, color: "#EC4899" },
        { id: "b-6", balloonId: "bal-2", index: 5, label: "Center Stamen Bead", lengthInches: 1.5, diameterInches: 2.1, twistType: "pinch", isPinch: true, color: "#FACC15", baseDir: [0, 0, 1] },
        { id: "b-7", balloonId: "bal-2", index: 6, label: "Upper Stem", lengthInches: 5.5, diameterInches: 2.0, twistType: "basic", color: "#16A34A", baseDir: [0, -1, 0] },
        { id: "b-8", balloonId: "bal-2", index: 7, label: "Left Leaf Loop", lengthInches: 5.5, diameterInches: 2.0, twistType: "loop", isLoop: true, color: "#16A34A", baseDir: [-0.88, 0.45, 0] },
        { id: "b-9", balloonId: "bal-2", index: 8, label: "Right Leaf Loop", lengthInches: 5.5, diameterInches: 2.0, twistType: "loop", isLoop: true, color: "#16A34A", baseDir: [0.88, 0.45, 0] },
        { id: "b-10", balloonId: "bal-2", index: 9, label: "Lower Stem", lengthInches: 6.5, diameterInches: 2.0, twistType: "s_hook", color: "#16A34A", baseDir: [0.06, -1, 0] },
      ],
      annotations: ["Try adding a 6th Petal Loop in 3D — the rosette automatically re-fans to 60° symmetry!"],
    }),

    intermediate: buildDesign({
      id: "flower-intermediate",
      title: "Romantic Red Rose with Apple Bud Core & Sepal Calyx",
      description:
        "Sculpted 3-balloon rose with a recessed Apple Twist bud center, inner cupped petals, flared outer petals, double green calyx pinches, and leafed stem.",
      category: "nature",
      complexity: "intermediate",
      balloons: [
        { id: "bal-1", name: "Inner Rose Bud (260)", size: "260", color: "#E11D48", colorName: "Ruby Red", inflatedLengthInches: 42, tailLengthInches: 18, tailFingers: 7, order: 1 },
        { id: "bal-2", name: "Outer Rose Petals (260)", size: "260", color: "#FB7185", colorName: "Rose Crimson", inflatedLengthInches: 46, tailLengthInches: 14, tailFingers: 6, order: 2, attachTo: { bubbleIndex: 0, end: "end" } },
        { id: "bal-3", name: "Calyx & Stem (260)", size: "260", color: "#16A34A", colorName: "Emerald Green", inflatedLengthInches: 46, tailLengthInches: 14, tailFingers: 6, order: 3, attachTo: { bubbleIndex: 0, end: "end" } },
      ],
      bubbles: [
        { id: "b-1", balloonId: "bal-1", index: 0, label: "Apple Twist Rose Core", lengthInches: 2.75, diameterInches: 2.2, twistType: "tulip", isTulip: true, color: "#E11D48", baseDir: [0, -1, 0] },
        { id: "b-2", balloonId: "bal-1", index: 1, label: "Inner Bud Petal 1", lengthInches: 5.0, diameterInches: 2.0, twistType: "loop", isLoop: true, color: "#E11D48", baseDir: [0.55, 0.83, 0.1] },
        { id: "b-3", balloonId: "bal-1", index: 2, label: "Inner Bud Petal 2", lengthInches: 5.0, diameterInches: 2.0, twistType: "loop", isLoop: true, color: "#E11D48", baseDir: [-0.55, 0.83, 0.1] },
        { id: "b-4", balloonId: "bal-1", index: 3, label: "Inner Bud Petal 3", lengthInches: 5.0, diameterInches: 2.0, twistType: "loop", isLoop: true, color: "#E11D48", baseDir: [0, 0.85, -0.52] },
        { id: "b-5", balloonId: "bal-2", index: 4, label: "Outer Flare Petal 1", lengthInches: 6.25, diameterInches: 2.0, twistType: "loop", isLoop: true, color: "#FB7185", baseDir: [0.92, 0.35, 0.18] },
        { id: "b-6", balloonId: "bal-2", index: 5, label: "Outer Flare Petal 2", lengthInches: 6.25, diameterInches: 2.0, twistType: "loop", isLoop: true, color: "#FB7185", baseDir: [-0.92, 0.35, 0.18] },
        { id: "b-7", balloonId: "bal-2", index: 6, label: "Outer Flare Petal 3", lengthInches: 6.25, diameterInches: 2.0, twistType: "loop", isLoop: true, color: "#FB7185", baseDir: [0, 0.38, 0.92] },
        { id: "b-8", balloonId: "bal-2", index: 7, label: "Outer Flare Petal 4", lengthInches: 6.25, diameterInches: 2.0, twistType: "loop", isLoop: true, color: "#FB7185", baseDir: [0, 0.38, -0.92] },
        { id: "b-9", balloonId: "bal-3", index: 8, label: "Left Calyx Sepal", lengthInches: 1.25, diameterInches: 1.7, twistType: "pinch", isPinch: true, color: "#16A34A", baseDir: [-0.85, -0.45, 0.25] },
        { id: "b-10", balloonId: "bal-3", index: 9, label: "Right Calyx Sepal", lengthInches: 1.25, diameterInches: 1.7, twistType: "pinch", isPinch: true, color: "#16A34A", baseDir: [0.85, -0.45, -0.25] },
        { id: "b-11", balloonId: "bal-3", index: 10, label: "Upper Rose Stem", lengthInches: 6.0, diameterInches: 2.0, twistType: "basic", color: "#16A34A", baseDir: [0, -1, 0] },
        { id: "b-12", balloonId: "bal-3", index: 11, label: "Rose Leaf 1", lengthInches: 5.0, diameterInches: 2.0, twistType: "loop", isLoop: true, color: "#16A34A", baseDir: [-0.9, 0.42, 0] },
        { id: "b-13", balloonId: "bal-3", index: 12, label: "Rose Leaf 2", lengthInches: 5.0, diameterInches: 2.0, twistType: "loop", isLoop: true, color: "#16A34A", baseDir: [0.9, 0.42, 0] },
        { id: "b-14", balloonId: "bal-3", index: 13, label: "Lower Rose Stem", lengthInches: 7.0, diameterInches: 2.0, twistType: "s_hook", color: "#16A34A", baseDir: [0.05, -1, 0] },
      ],
      annotations: ["Layered inner crimson + outer rose loops frame the dimpled Apple Twist bud center."],
    }),

    advanced: buildDesign({
      id: "flower-advanced",
      title: "Botanical Show Orchid with 160 Spiral Tendrils & 360 Cane",
      description:
        "Gala centerpiece 4-balloon orchid combining Violet & Magenta wing petals, golden pollen pinch, twin 160 corkscrew tendrils, and an arched 360 Emerald cane stem.",
      category: "nature",
      complexity: "advanced",
      balloons: [
        { id: "bal-1", name: "Violet Throat & Sepals (260)", size: "260", color: "#7C3AED", colorName: "Purple Violet", inflatedLengthInches: 46, tailLengthInches: 14, tailFingers: 6, order: 1 },
        { id: "bal-2", name: "Magenta Wing Petals (260)", size: "260", color: "#DB2777", colorName: "Magenta Pink", inflatedLengthInches: 46, tailLengthInches: 14, tailFingers: 6, order: 2, attachTo: { bubbleIndex: 0, end: "end" } },
        { id: "bal-3", name: "Pollen & Spiral Tendrils (160)", size: "160", color: "#FACC15", colorName: "Canary Yellow", inflatedLengthInches: 40, tailLengthInches: 20, tailFingers: 8, order: 3, attachTo: { bubbleIndex: 0, end: "end" } },
        { id: "bal-4", name: "Arched Cane Stem (360)", size: "360", color: "#16A34A", colorName: "Emerald Green", inflatedLengthInches: 42, tailLengthInches: 18, tailFingers: 7, order: 4, attachTo: { bubbleIndex: 0, end: "end" } },
      ],
      bubbles: [
        { id: "b-1", balloonId: "bal-1", index: 0, label: "Apple Twist Labellum Lip", lengthInches: 3.0, diameterInches: 2.2, twistType: "tulip", isTulip: true, color: "#7C3AED", baseDir: [0, 0.1, -1] },
        { id: "b-2", balloonId: "bal-1", index: 1, label: "Dorsal Crown Sepal", lengthInches: 6.5, diameterInches: 2.0, twistType: "loop", isLoop: true, color: "#7C3AED", baseDir: [0, 1, -0.15] },
        { id: "b-3", balloonId: "bal-1", index: 2, label: "Lower Left Sepal", lengthInches: 5.5, diameterInches: 2.0, twistType: "loop", isLoop: true, color: "#7C3AED", baseDir: [-0.62, -0.75, 0.2] },
        { id: "b-4", balloonId: "bal-1", index: 3, label: "Lower Right Sepal", lengthInches: 5.5, diameterInches: 2.0, twistType: "loop", isLoop: true, color: "#7C3AED", baseDir: [0.62, -0.75, 0.2] },
        { id: "b-5", balloonId: "bal-2", index: 4, label: "Left Wing Petal", lengthInches: 7.0, diameterInches: 2.1, twistType: "loop", isLoop: true, color: "#DB2777", baseDir: [-0.95, 0.28, 0.12] },
        { id: "b-6", balloonId: "bal-2", index: 5, label: "Right Wing Petal", lengthInches: 7.0, diameterInches: 2.1, twistType: "loop", isLoop: true, color: "#DB2777", baseDir: [0.95, 0.28, 0.12] },
        { id: "b-7", balloonId: "bal-3", index: 6, label: "Golden Pollen Stamen", lengthInches: 1.2, diameterInches: 1.2, twistType: "pinch", isPinch: true, color: "#FACC15", baseDir: [0, 0.15, 1] },
        { id: "b-8", balloonId: "bal-3", index: 7, label: "Left Spiral Tendril", lengthInches: 7.5, diameterInches: 1.0, twistType: "spiral", color: "#FACC15", baseDir: [-0.7, -0.68, 0.2] },
        { id: "b-8p", balloonId: "bal-3", index: 8, label: "Tendril Tip Tie & Split", lengthInches: 0.75, diameterInches: 1.0, twistType: "pinch_pop", color: "#FACC15", baseDir: [-0.7, -0.68, 0.2] },
        { id: "b-9", balloonId: "bal-3", index: 9, label: "Right Spiral Tendril", lengthInches: 7.5, diameterInches: 1.0, twistType: "spiral", color: "#FACC15", branchFrom: { bubbleIndex: 0, end: "end" }, baseDir: [0.7, -0.68, 0.2] },
        { id: "b-10", balloonId: "bal-4", index: 9, label: "Calyx Anchor Pinch", lengthInches: 1.4, diameterInches: 2.5, twistType: "pinch", isPinch: true, color: "#16A34A", baseDir: [0, -0.2, -1] },
        { id: "b-11", balloonId: "bal-4", index: 10, label: "Arched 360 Cane Stem", lengthInches: 16.0, diameterInches: 2.8, twistType: "s_hook", color: "#16A34A", baseDir: [0.08, -1, -0.1] },
      ],
      annotations: ["Exhibition botanical sculpture using all three standard sizes: 160, 260, and 360."],
    }),
  },
};

/* ---------------- Smart Procedural Balloon Archetype Synthesizer ---------------- */

export function generateProceduralBalloonDesigns(
  prompt: string,
  detectedColors?: string[]
): Record<"beginner" | "intermediate" | "advanced", FullDesign> {
  const clean = prompt.toLowerCase().trim();
  const titleCased =
    prompt
      .trim()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ") || "Custom Sculpture";

  // Pick smart theme colors when user hasn't uploaded an image with custom colors
  const themeColors = (() => {
    if (detectedColors && detectedColors.length > 0) {
      return [
        detectedColors[0],
        detectedColors[1] || "#FACC15",
        detectedColors[2] || "#38BDF8",
      ];
    }
    if (/unicorn|pegasus|fairy/.test(clean)) return ["#F8FAFC", "#EC4899", "#FACC15"];
    if (/dragon|dino|rex|frog|turtle|gator/.test(clean)) return ["#16A34A", "#84CC16", "#FACC15"];
    if (/swan|flamingo|bird|parrot/.test(clean)) return ["#FB7185", "#F8FAFC", "#FACC15"];
    if (/butterfly|bee/.test(clean)) return ["#FACC15", "#7C3AED", "#1E293B"];
    if (/bear|teddy|monkey|reindeer/.test(clean)) return ["#92400E", "#FDBA74", "#E11D48"];
    if (/wand|star|crown|tiara/.test(clean)) return ["#EAB308", "#7C3AED", "#38BDF8"];
    if (/alien|octopus|squid|spider/.test(clean)) return ["#7C3AED", "#84CC16", "#38BDF8"];
    return ["#EA580C", "#FACC15", "#38BDF8"];
  })();

  const [c1, c2, c3] = themeColors;

  // Detect structural morphology from description
  const isWinged = /butterfly|swan|flamingo|bird|parrot|dragon|bat|bee|fairy|angel|plane/.test(clean);
  const isWandOrStaff = /wand|scepter|staff|trident|hammer|axe|guitar/.test(clean);
  const isRadialCreature = /octopus|squid|alien|spider|jellyfish|crown|hat/.test(clean);
  const isHornedOrTall = /unicorn|giraffe|llama|deer|horse|reindeer/.test(clean);
  const isRoundEared = /bear|teddy|mouse|koala|lion|cat|tiger|panda/.test(clean);

  /* --- Archetype 1: Winged / Avian / Butterfly / Dragon --- */
  if (isWinged) {
    return {
      beginner: buildDesign({
        id: `winged-${Date.now()}-beg`,
        title: `${titleCased} (1-Balloon Quick Twist)`,
        description: `Fast 1-balloon ${clean} featuring a curved head/neck, wide opposing loop wings, and tapered tail.`,
        category: "animals",
        complexity: "beginner",
        sourceType: "prompt",
        sourcePrompt: prompt,
        balloons: [{ id: "bal-1", name: `${titleCased} 260`, size: "260", color: c1, colorName: "Primary Latex", inflatedLengthInches: 50, tailLengthInches: 10, tailFingers: 4, order: 1 }],
        bubbles: [
          { id: "b-1", balloonId: "bal-1", index: 0, label: "Head & Beak", lengthInches: 2.5, diameterInches: 2.0, twistType: "basic", color: c1, baseDir: [-0.85, 0.52, 0] },
          { id: "b-2", balloonId: "bal-1", index: 1, label: "Crest Pinch", lengthInches: 1.0, diameterInches: 1.7, twistType: "pinch", isPinch: true, color: c1, baseDir: [0, 1, 0] },
          { id: "b-3", balloonId: "bal-1", index: 2, label: "Graceful S-Hook Neck", lengthInches: 5.5, diameterInches: 2.0, twistType: "s_hook", color: c1, baseDir: [0.45, -0.89, 0] },
          { id: "b-4", balloonId: "bal-1", index: 3, label: "Left Wing Loop", lengthInches: 8.5, diameterInches: 2.0, twistType: "loop", isLoop: true, color: c1, baseDir: [0.25, 0.55, 0.8] },
          { id: "b-5", balloonId: "bal-1", index: 4, label: "Right Wing Loop", lengthInches: 8.5, diameterInches: 2.0, twistType: "loop", isLoop: true, color: c1, baseDir: [0.25, 0.55, -0.8] },
          { id: "b-6", balloonId: "bal-1", index: 5, label: "Thorax / Body", lengthInches: 5.0, diameterInches: 2.0, twistType: "basic", color: c1, baseDir: [1, -0.1, 0] },
          { id: "b-7", balloonId: "bal-1", index: 6, label: "Tail Plume Pinch", lengthInches: 1.1, diameterInches: 1.8, twistType: "pinch", isPinch: true, color: c1, baseDir: [0.2, 1, 0] },
          { id: "b-8", balloonId: "bal-1", index: 7, label: "Sweeping Tail Plume", lengthInches: 4.5, diameterInches: 2.0, twistType: "s_hook", color: c1, baseDir: [0.8, 0.6, 0] },
        ],
      }),
      intermediate: buildDesign({
        id: `winged-${Date.now()}-int`,
        title: `${titleCased} (2-Balloon Bird-Body & Quad Wings)`,
        description: `Sculpted 2-balloon ${clean} with a 3-bubble Bird Body roll-through torso and four layered upper/lower wing loops.`,
        category: "animals",
        complexity: "intermediate",
        sourceType: "prompt",
        sourcePrompt: prompt,
        balloons: [
          { id: "bal-1", name: `${titleCased} Body`, size: "260", color: c1, colorName: "Body Latex", inflatedLengthInches: 48, tailLengthInches: 12, tailFingers: 5, order: 1 },
          { id: "bal-2", name: `Layered Wings`, size: "260", color: c2, colorName: "Wing Latex", inflatedLengthInches: 50, tailLengthInches: 10, tailFingers: 4, order: 2, attachTo: { bubbleIndex: 2, end: "end" } },
        ],
        bubbles: [
          { id: "b-1", balloonId: "bal-1", index: 0, label: "Sculpted Head", lengthInches: 2.5, diameterInches: 2.0, twistType: "tulip", isTulip: true, color: c1, baseDir: [1, 0, 0] },
          { id: "b-2", balloonId: "bal-1", index: 1, label: "Crown Pinch", lengthInches: 1.1, diameterInches: 1.7, twistType: "pinch", isPinch: true, color: c1, baseDir: [0, 1, 0] },
          { id: "b-3", balloonId: "bal-1", index: 2, label: "Arched Neck", lengthInches: 4.5, diameterInches: 2.0, twistType: "s_hook", color: c1, baseDir: [0.5, -0.86, 0] },
          { id: "b-4", balloonId: "bal-1", index: 3, label: "Bird Body Rail 1", lengthInches: 5.0, diameterInches: 2.0, twistType: "bird_body", color: c1, baseDir: [1, 0, 0] },
          { id: "b-5", balloonId: "bal-1", index: 4, label: "Bird Body Rail 2", lengthInches: 5.0, diameterInches: 2.0, twistType: "bird_body", color: c1 },
          { id: "b-6", balloonId: "bal-1", index: 5, label: "Bird Body Roll Center", lengthInches: 5.0, diameterInches: 2.0, twistType: "bird_body", color: c1 },
          { id: "b-7", balloonId: "bal-1", index: 6, label: "Tail Base Pinch", lengthInches: 1.1, diameterInches: 1.8, twistType: "pinch", isPinch: true, color: c1, baseDir: [0.2, 1, 0] },
          { id: "b-8", balloonId: "bal-1", index: 7, label: "Curved Tail", lengthInches: 5.0, diameterInches: 1.9, twistType: "s_hook", color: c1, baseDir: [0.78, 0.62, 0] },
          { id: "b-9", balloonId: "bal-2", index: 8, label: "Upper Left Wing", lengthInches: 8.0, diameterInches: 2.0, twistType: "loop", isLoop: true, color: c2, baseDir: [0.2, 0.72, 0.66] },
          { id: "b-10", balloonId: "bal-2", index: 9, label: "Upper Right Wing", lengthInches: 8.0, diameterInches: 2.0, twistType: "loop", isLoop: true, color: c2, baseDir: [0.2, 0.72, -0.66] },
          { id: "b-11", balloonId: "bal-2", index: 10, label: "Lower Left Wing", lengthInches: 6.0, diameterInches: 2.0, twistType: "loop", isLoop: true, color: c2, baseDir: [0.55, 0.1, 0.83] },
          { id: "b-12", balloonId: "bal-2", index: 11, label: "Lower Right Wing", lengthInches: 6.0, diameterInches: 2.0, twistType: "loop", isLoop: true, color: c2, baseDir: [0.55, 0.1, -0.83] },
        ],
      }),
      advanced: buildDesign({
        id: `winged-${Date.now()}-adv`,
        title: `${titleCased} (Masterpiece 360 + 260 + 160 Filigree)`,
        description: `Showpiece 3-balloon ${clean} with heavy 360 body, multi-tier 260 wings, and twin 160 spiral antennae / streamers.`,
        category: "animals",
        complexity: "advanced",
        sourceType: "prompt",
        sourcePrompt: prompt,
        balloons: [
          { id: "bal-1", name: `Heavy Core (360)`, size: "360", color: c1, colorName: "Core Latex", inflatedLengthInches: 46, tailLengthInches: 14, tailFingers: 6, order: 1 },
          { id: "bal-2", name: `Grand Wings (260)`, size: "260", color: c2, colorName: "Wing Latex", inflatedLengthInches: 52, tailLengthInches: 8, tailFingers: 4, order: 2, attachTo: { bubbleIndex: 2, end: "end" } },
          { id: "bal-3", name: `Spiral Filigree (160)`, size: "160", color: c3, colorName: "Filigree Latex", inflatedLengthInches: 38, tailLengthInches: 22, tailFingers: 9, order: 3, attachTo: { bubbleIndex: 1, end: "start" } },
        ],
        bubbles: [
          { id: "b-1", balloonId: "bal-1", index: 0, label: "Apple Twist Head", lengthInches: 3.0, diameterInches: 2.8, twistType: "tulip", isTulip: true, color: c1, baseDir: [1, 0, 0] },
          { id: "b-2", balloonId: "bal-1", index: 1, label: "Crown Pinch", lengthInches: 1.4, diameterInches: 2.4, twistType: "pinch", isPinch: true, color: c1, baseDir: [0, 1, 0] },
          { id: "b-3", balloonId: "bal-1", index: 2, label: "Sculpted S-Neck", lengthInches: 5.0, diameterInches: 2.6, twistType: "s_hook", color: c1, baseDir: [0.5, -0.86, 0] },
          { id: "b-4", balloonId: "bal-1", index: 3, label: "360 Bird Rail 1", lengthInches: 5.5, diameterInches: 2.6, twistType: "bird_body", color: c1, baseDir: [1, 0, 0] },
          { id: "b-5", balloonId: "bal-1", index: 4, label: "360 Bird Rail 2", lengthInches: 5.5, diameterInches: 2.6, twistType: "bird_body", color: c1 },
          { id: "b-6", balloonId: "bal-1", index: 5, label: "360 Roll-Through", lengthInches: 5.5, diameterInches: 2.6, twistType: "bird_body", color: c1 },
          { id: "b-7", balloonId: "bal-1", index: 6, label: "Tail Anchor Pinch", lengthInches: 1.4, diameterInches: 2.2, twistType: "pinch", isPinch: true, color: c1, baseDir: [0.2, 1, 0] },
          { id: "b-8", balloonId: "bal-1", index: 7, label: "Z-Bend Dragon Tail", lengthInches: 6.5, diameterInches: 2.4, twistType: "z_bend", color: c1, baseDir: [0.82, 0.55, 0] },
          { id: "b-9", balloonId: "bal-2", index: 8, label: "Forewing Left", lengthInches: 9.0, diameterInches: 2.0, twistType: "loop", isLoop: true, color: c2, baseDir: [0.15, 0.75, 0.64] },
          { id: "b-10", balloonId: "bal-2", index: 9, label: "Forewing Right", lengthInches: 9.0, diameterInches: 2.0, twistType: "loop", isLoop: true, color: c2, baseDir: [0.15, 0.75, -0.64] },
          { id: "b-11", balloonId: "bal-2", index: 10, label: "Hindwing Left", lengthInches: 6.5, diameterInches: 2.0, twistType: "loop", isLoop: true, color: c2, baseDir: [0.55, 0.1, 0.83] },
          { id: "b-12", balloonId: "bal-2", index: 11, label: "Hindwing Right", lengthInches: 6.5, diameterInches: 2.0, twistType: "loop", isLoop: true, color: c2, baseDir: [0.55, 0.1, -0.83] },
          { id: "b-13", balloonId: "bal-3", index: 12, label: "Left Spiral Plume", lengthInches: 5.5, diameterInches: 1.0, twistType: "spiral", color: c3, baseDir: [-0.45, 0.82, 0.35] },
          { id: "b-13p", balloonId: "bal-3", index: 13, label: "Plume Pinch-Pop Split", lengthInches: 0.75, diameterInches: 1.0, twistType: "pinch_pop", color: c3, baseDir: [-0.45, 0.82, 0.35] },
          { id: "b-14", balloonId: "bal-3", index: 14, label: "Right Spiral Plume", lengthInches: 5.5, diameterInches: 1.0, twistType: "spiral", color: c3, branchFrom: { bubbleIndex: 1, end: "start" }, baseDir: [-0.45, 0.82, -0.35] },
        ],
      }),
    };
  }

  /* --- Archetype 2: Magic Wand / Scepter / Trident --- */
  if (isWandOrStaff) {
    return {
      beginner: buildDesign({
        id: `wand-${Date.now()}-beg`,
        title: `${titleCased} (1-Balloon Star Wand)`,
        description: `Quick 1-balloon ${clean} with a pinch-locked handle, 4-loop star burst head, and finial bead.`,
        category: "objects",
        complexity: "beginner",
        sourceType: "prompt",
        sourcePrompt: prompt,
        balloons: [{ id: "bal-1", name: `${titleCased} 260`, size: "260", color: c1, colorName: "Gold Latex", inflatedLengthInches: 50, tailLengthInches: 10, tailFingers: 4, order: 1 }],
        bubbles: [
          { id: "b-1", balloonId: "bal-1", index: 0, label: "Pommel Pinch", lengthInches: 1.25, diameterInches: 2.0, twistType: "pinch", isPinch: true, color: c1, baseDir: [0, -1, 0] },
          { id: "b-2", balloonId: "bal-1", index: 1, label: "Wand Shaft", lengthInches: 12.0, diameterInches: 2.0, twistType: "basic", color: c1, baseDir: [0, 1, 0] },
          { id: "b-3", balloonId: "bal-1", index: 2, label: "Star Ray 1", lengthInches: 5.0, diameterInches: 2.0, twistType: "loop", isLoop: true, color: c1 },
          { id: "b-4", balloonId: "bal-1", index: 3, label: "Star Ray 2", lengthInches: 5.0, diameterInches: 2.0, twistType: "loop", isLoop: true, color: c1 },
          { id: "b-5", balloonId: "bal-1", index: 4, label: "Star Ray 3", lengthInches: 5.0, diameterInches: 2.0, twistType: "loop", isLoop: true, color: c1 },
          { id: "b-6", balloonId: "bal-1", index: 5, label: "Star Ray 4", lengthInches: 5.0, diameterInches: 2.0, twistType: "loop", isLoop: true, color: c1 },
        ],
      }),
      intermediate: buildDesign({
        id: `wand-${Date.now()}-int`,
        title: `${titleCased} (2-Balloon Spiral Ribbon Wand)`,
        description: `2-balloon ${clean} combining a 5-ray star blossom head with a contrasting spiral ribbon shaft.`,
        category: "objects",
        complexity: "intermediate",
        sourceType: "prompt",
        sourcePrompt: prompt,
        balloons: [
          { id: "bal-1", name: `Star Crown (260)`, size: "260", color: c1, colorName: "Star Latex", inflatedLengthInches: 48, tailLengthInches: 12, tailFingers: 5, order: 1 },
          { id: "bal-2", name: `Spiral Handle (260)`, size: "260", color: c2, colorName: "Ribbon Latex", inflatedLengthInches: 44, tailLengthInches: 16, tailFingers: 7, order: 2, attachTo: { bubbleIndex: 0, end: "start" } },
        ],
        bubbles: [
          { id: "b-1", balloonId: "bal-1", index: 0, label: "Crown Ray 1", lengthInches: 5.5, diameterInches: 2.0, twistType: "loop", isLoop: true, color: c1 },
          { id: "b-2", balloonId: "bal-1", index: 1, label: "Crown Ray 2", lengthInches: 5.5, diameterInches: 2.0, twistType: "loop", isLoop: true, color: c1 },
          { id: "b-3", balloonId: "bal-1", index: 2, label: "Crown Ray 3", lengthInches: 5.5, diameterInches: 2.0, twistType: "loop", isLoop: true, color: c1 },
          { id: "b-4", balloonId: "bal-1", index: 3, label: "Crown Ray 4", lengthInches: 5.5, diameterInches: 2.0, twistType: "loop", isLoop: true, color: c1 },
          { id: "b-5", balloonId: "bal-1", index: 4, label: "Crown Ray 5", lengthInches: 5.5, diameterInches: 2.0, twistType: "loop", isLoop: true, color: c1 },
          { id: "b-6", balloonId: "bal-2", index: 5, label: "Center Jewel Pinch", lengthInches: 1.4, diameterInches: 2.1, twistType: "pinch", isPinch: true, color: c3, baseDir: [0, 0, 1] },
          { id: "b-7", balloonId: "bal-2", index: 6, label: "Spiral Wand Handle", lengthInches: 13.0, diameterInches: 1.9, twistType: "spiral", color: c2, baseDir: [0, -1, 0] },
        ],
      }),
      advanced: buildDesign({
        id: `wand-${Date.now()}-adv`,
        title: `${titleCased} (Royal Scepter — 360 + 260 + 160 Streamers)`,
        description: `Showpiece 3-balloon ${clean} with 360 scepter shaft, 6-petal crown burst, and trailing 160 spiral streamers.`,
        category: "objects",
        complexity: "advanced",
        sourceType: "prompt",
        sourcePrompt: prompt,
        balloons: [
          { id: "bal-1", name: `Crown Burst (260)`, size: "260", color: c1, colorName: "Crown Latex", inflatedLengthInches: 52, tailLengthInches: 8, tailFingers: 4, order: 1 },
          { id: "bal-2", name: `Scepter Staff (360)`, size: "360", color: c2, colorName: "Staff Latex", inflatedLengthInches: 42, tailLengthInches: 18, tailFingers: 7, order: 2, attachTo: { bubbleIndex: 0, end: "start" } },
          { id: "bal-3", name: `Spiral Ribbons (160)`, size: "160", color: c3, colorName: "Streamer Latex", inflatedLengthInches: 40, tailLengthInches: 20, tailFingers: 8, order: 3, attachTo: { bubbleIndex: 0, end: "start" } },
        ],
        bubbles: [
          { id: "b-1", balloonId: "bal-1", index: 0, label: "Ray 1", lengthInches: 5.5, diameterInches: 2.0, twistType: "loop", isLoop: true, color: c1 },
          { id: "b-2", balloonId: "bal-1", index: 1, label: "Ray 2", lengthInches: 5.5, diameterInches: 2.0, twistType: "loop", isLoop: true, color: c1 },
          { id: "b-3", balloonId: "bal-1", index: 2, label: "Ray 3", lengthInches: 5.5, diameterInches: 2.0, twistType: "loop", isLoop: true, color: c1 },
          { id: "b-4", balloonId: "bal-1", index: 3, label: "Ray 4", lengthInches: 5.5, diameterInches: 2.0, twistType: "loop", isLoop: true, color: c1 },
          { id: "b-5", balloonId: "bal-1", index: 4, label: "Ray 5", lengthInches: 5.5, diameterInches: 2.0, twistType: "loop", isLoop: true, color: c1 },
          { id: "b-6", balloonId: "bal-1", index: 5, label: "Ray 6", lengthInches: 5.5, diameterInches: 2.0, twistType: "loop", isLoop: true, color: c1 },
          { id: "b-7", balloonId: "bal-2", index: 6, label: "Orb Jewel Pinch", lengthInches: 1.5, diameterInches: 2.6, twistType: "pinch", isPinch: true, color: c3, baseDir: [0, 0, 1] },
          { id: "b-8", balloonId: "bal-2", index: 7, label: "Heavy 360 Staff", lengthInches: 15.0, diameterInches: 2.8, twistType: "basic", color: c2, baseDir: [0, -1, 0] },
          { id: "b-9", balloonId: "bal-3", index: 8, label: "Left Ribbon Streamer", lengthInches: 8.5, diameterInches: 1.0, twistType: "spiral", color: c3, baseDir: [-0.42, -0.9, 0.15] },
          { id: "b-9p", balloonId: "bal-3", index: 9, label: "Ribbon Pinch-Pop Split", lengthInches: 0.75, diameterInches: 1.0, twistType: "pinch_pop", color: c3, baseDir: [-0.42, -0.9, 0.15] },
          { id: "b-10", balloonId: "bal-3", index: 10, label: "Right Ribbon Streamer", lengthInches: 8.5, diameterInches: 1.0, twistType: "spiral", color: c3, branchFrom: { bubbleIndex: 0, end: "start" }, baseDir: [0.42, -0.9, 0.15] },
        ],
      }),
    };
  }

  /* --- Archetype 3: Radial / Tentacled / Crown (Octopus, Alien, Spider, Crown) --- */
  if (isRadialCreature) {
    return {
      beginner: buildDesign({
        id: `radial-${Date.now()}-beg`,
        title: `${titleCased} (1-Balloon Quick Sculpt)`,
        description: `Fast 1-balloon ${clean} with dome head, pinch eyes, and four curly spiral tentacles/arches.`,
        category: "fantasy",
        complexity: "beginner",
        sourceType: "prompt",
        sourcePrompt: prompt,
        balloons: [{ id: "bal-1", name: `${titleCased} 260`, size: "260", color: c1, colorName: "Primary Latex", inflatedLengthInches: 50, tailLengthInches: 10, tailFingers: 4, order: 1 }],
        bubbles: [
          { id: "b-1", balloonId: "bal-1", index: 0, label: "Dome Head", lengthInches: 3.5, diameterInches: 2.2, twistType: "tulip", isTulip: true, color: c1, baseDir: [0, -1, 0] },
          { id: "b-2", balloonId: "bal-1", index: 1, label: "Left Eye Pinch", lengthInches: 1.2, diameterInches: 1.8, twistType: "pinch", isPinch: true, color: c2, baseDir: [-0.6, 0.2, 0.8] },
          { id: "b-3", balloonId: "bal-1", index: 2, label: "Right Eye Pinch", lengthInches: 1.2, diameterInches: 1.8, twistType: "pinch", isPinch: true, color: c2, baseDir: [0.6, 0.2, 0.8] },
          { id: "b-4", balloonId: "bal-1", index: 3, label: "Front Left Leg", lengthInches: 5.5, diameterInches: 2.0, twistType: "lock", color: c1, baseDir: [-0.65, -0.7, 0.3] },
          { id: "b-5", balloonId: "bal-1", index: 4, label: "Front Right Leg", lengthInches: 5.5, diameterInches: 2.0, twistType: "lock", color: c1 },
          { id: "b-6", balloonId: "bal-1", index: 5, label: "Rear Left Leg", lengthInches: 5.5, diameterInches: 2.0, twistType: "lock", color: c1, baseDir: [0.65, -0.7, 0.3] },
          { id: "b-7", balloonId: "bal-1", index: 6, label: "Rear Right Leg", lengthInches: 5.5, diameterInches: 2.0, twistType: "lock", color: c1 },
          { id: "b-8", balloonId: "bal-1", index: 7, label: "Top Antenna Spiral", lengthInches: 4.5, diameterInches: 1.8, twistType: "spiral", color: c3, baseDir: [0, 1, 0] },
        ],
      }),
      intermediate: buildDesign({
        id: `radial-${Date.now()}-int`,
        title: `${titleCased} (2-Balloon Bird-Body Dome & Spiral Tentacles)`,
        description: `Plump 3-bubble Bird Body dome with contrasting eyes and four corkscrew spiral tentacles.`,
        category: "fantasy",
        complexity: "intermediate",
        sourceType: "prompt",
        sourcePrompt: prompt,
        balloons: [
          { id: "bal-1", name: `Dome Head (260)`, size: "260", color: c1, colorName: "Dome Latex", inflatedLengthInches: 48, tailLengthInches: 12, tailFingers: 5, order: 1 },
          { id: "bal-2", name: `Spiral Tentacles (260)`, size: "260", color: c2, colorName: "Tentacle Latex", inflatedLengthInches: 50, tailLengthInches: 10, tailFingers: 4, order: 2, attachTo: { bubbleIndex: 2, end: "end" } },
        ],
        bubbles: [
          { id: "b-1", balloonId: "bal-1", index: 0, label: "Dome Rail 1", lengthInches: 4.5, diameterInches: 2.1, twistType: "bird_body", color: c1, baseDir: [0, -1, 0] },
          { id: "b-2", balloonId: "bal-1", index: 1, label: "Dome Rail 2", lengthInches: 4.5, diameterInches: 2.1, twistType: "bird_body", color: c1 },
          { id: "b-3", balloonId: "bal-1", index: 2, label: "Dome Roll Core", lengthInches: 4.5, diameterInches: 2.1, twistType: "bird_body", color: c1 },
          { id: "b-4", balloonId: "bal-1", index: 3, label: "Left Eye", lengthInches: 1.3, diameterInches: 2.0, twistType: "pinch", isPinch: true, color: "#F8FAFC", baseDir: [-0.55, 0.2, 0.8] },
          { id: "b-5", balloonId: "bal-1", index: 4, label: "Right Eye", lengthInches: 1.3, diameterInches: 2.0, twistType: "pinch", isPinch: true, color: "#F8FAFC", baseDir: [0.55, 0.2, 0.8] },
          { id: "b-6", balloonId: "bal-2", index: 5, label: "Spiral Tentacle 1", lengthInches: 6.5, diameterInches: 1.8, twistType: "spiral", color: c2, baseDir: [-0.7, -0.65, 0.3] },
          { id: "b-6p", balloonId: "bal-2", index: 6, label: "Tentacle 1 Suction Tip Split", lengthInches: 0.9, diameterInches: 1.5, twistType: "pinch_pop", color: c2, baseDir: [-0.7, -0.65, 0.3] },
          { id: "b-7", balloonId: "bal-2", index: 7, label: "Spiral Tentacle 2", lengthInches: 6.5, diameterInches: 1.8, twistType: "spiral", color: c2, branchFrom: { bubbleIndex: 2, end: "end" }, baseDir: [0.7, -0.65, 0.3] },
          { id: "b-7p", balloonId: "bal-2", index: 8, label: "Tentacle 2 Suction Tip Split", lengthInches: 0.9, diameterInches: 1.5, twistType: "pinch_pop", color: c2, baseDir: [0.7, -0.65, 0.3] },
          { id: "b-8", balloonId: "bal-2", index: 9, label: "Spiral Tentacle 3", lengthInches: 6.5, diameterInches: 1.8, twistType: "spiral", color: c2, branchFrom: { bubbleIndex: 2, end: "end" }, baseDir: [-0.65, -0.65, -0.4] },
          { id: "b-8p", balloonId: "bal-2", index: 10, label: "Tentacle 3 Suction Tip Split", lengthInches: 0.9, diameterInches: 1.5, twistType: "pinch_pop", color: c2, baseDir: [-0.65, -0.65, -0.4] },
          { id: "b-9", balloonId: "bal-2", index: 11, label: "Spiral Tentacle 4", lengthInches: 6.5, diameterInches: 1.8, twistType: "spiral", color: c2, branchFrom: { bubbleIndex: 2, end: "end" }, baseDir: [0.65, -0.65, -0.4] },
        ],
      }),
      advanced: buildDesign({
        id: `radial-${Date.now()}-adv`,
        title: `${titleCased} (Deluxe 360 Dome + 6 Spirals + 160 Antennae)`,
        description: `Showpiece multi-balloon ${clean} with heavy 360 Bird Body dome, 6 spiral tentacles, and twin 160 rattle antennae.`,
        category: "fantasy",
        complexity: "advanced",
        sourceType: "prompt",
        sourcePrompt: prompt,
        balloons: [
          { id: "bal-1", name: `360 Head Dome`, size: "360", color: c1, colorName: "Head Latex", inflatedLengthInches: 46, tailLengthInches: 14, tailFingers: 6, order: 1 },
          { id: "bal-2", name: `Front Tentacles (260)`, size: "260", color: c2, colorName: "Tentacle Latex", inflatedLengthInches: 46, tailLengthInches: 14, tailFingers: 6, order: 2, attachTo: { bubbleIndex: 2, end: "end" } },
          { id: "bal-3", name: `Rear Tentacles (260)`, size: "260", color: c2, colorName: "Tentacle Latex", inflatedLengthInches: 46, tailLengthInches: 14, tailFingers: 6, order: 3, attachTo: { bubbleIndex: 2, end: "end" } },
          { id: "bal-4", name: `Antennae (160)`, size: "160", color: c3, colorName: "Antenna Latex", inflatedLengthInches: 36, tailLengthInches: 24, tailFingers: 10, order: 4, attachTo: { bubbleIndex: 0, end: "start" } },
        ],
        bubbles: [
          { id: "b-1", balloonId: "bal-1", index: 0, label: "360 Dome Rail 1", lengthInches: 5.0, diameterInches: 2.8, twistType: "bird_body", color: c1, baseDir: [0, -1, 0] },
          { id: "b-2", balloonId: "bal-1", index: 1, label: "360 Dome Rail 2", lengthInches: 5.0, diameterInches: 2.8, twistType: "bird_body", color: c1 },
          { id: "b-3", balloonId: "bal-1", index: 2, label: "360 Dome Roll Core", lengthInches: 5.0, diameterInches: 2.8, twistType: "bird_body", color: c1 },
          { id: "b-4", balloonId: "bal-1", index: 3, label: "Left Eye Stalk", lengthInches: 1.5, diameterInches: 2.2, twistType: "pinch", isPinch: true, color: "#F8FAFC", baseDir: [-0.55, 0.25, 0.8] },
          { id: "b-5", balloonId: "bal-1", index: 4, label: "Right Eye Stalk", lengthInches: 1.5, diameterInches: 2.2, twistType: "pinch", isPinch: true, color: "#F8FAFC", baseDir: [0.55, 0.25, 0.8] },
          { id: "b-6", balloonId: "bal-2", index: 5, label: "Tentacle 1", lengthInches: 7.0, diameterInches: 1.9, twistType: "spiral", color: c2, baseDir: [-0.8, -0.58, 0.15] },
          { id: "b-6p", balloonId: "bal-2", index: 6, label: "Tentacle 1 Tip Split", lengthInches: 0.9, diameterInches: 1.5, twistType: "pinch_pop", color: c2, baseDir: [-0.8, -0.58, 0.15] },
          { id: "b-7", balloonId: "bal-2", index: 7, label: "Tentacle 2", lengthInches: 7.0, diameterInches: 1.9, twistType: "spiral", color: c2, branchFrom: { bubbleIndex: 2, end: "end" }, baseDir: [0.8, -0.58, 0.15] },
          { id: "b-7p", balloonId: "bal-2", index: 8, label: "Tentacle 2 Tip Split", lengthInches: 0.9, diameterInches: 1.5, twistType: "pinch_pop", color: c2, baseDir: [0.8, -0.58, 0.15] },
          { id: "b-8", balloonId: "bal-2", index: 9, label: "Tentacle 3", lengthInches: 7.0, diameterInches: 1.9, twistType: "spiral", color: c2, branchFrom: { bubbleIndex: 2, end: "end" }, baseDir: [-0.45, -0.62, 0.64] },
          { id: "b-9", balloonId: "bal-3", index: 10, label: "Tentacle 4", lengthInches: 7.0, diameterInches: 1.9, twistType: "spiral", color: c2, baseDir: [0.45, -0.62, 0.64] },
          { id: "b-9p", balloonId: "bal-3", index: 11, label: "Tentacle 4 Tip Split", lengthInches: 0.9, diameterInches: 1.5, twistType: "pinch_pop", color: c2, baseDir: [0.45, -0.62, 0.64] },
          { id: "b-10", balloonId: "bal-3", index: 12, label: "Tentacle 5", lengthInches: 7.0, diameterInches: 1.9, twistType: "spiral", color: c2, branchFrom: { bubbleIndex: 2, end: "end" }, baseDir: [-0.45, -0.62, -0.64] },
          { id: "b-10p", balloonId: "bal-3", index: 13, label: "Tentacle 5 Tip Split", lengthInches: 0.9, diameterInches: 1.5, twistType: "pinch_pop", color: c2, baseDir: [-0.45, -0.62, -0.64] },
          { id: "b-11", balloonId: "bal-3", index: 14, label: "Tentacle 6", lengthInches: 7.0, diameterInches: 1.9, twistType: "spiral", color: c2, branchFrom: { bubbleIndex: 2, end: "end" }, baseDir: [0.45, -0.62, -0.64] },
          { id: "b-12", balloonId: "bal-4", index: 15, label: "Left Antenna Stalk", lengthInches: 4.5, diameterInches: 1.0, twistType: "basic", color: c3, baseDir: [-0.45, 0.89, 0] },
          { id: "b-13", balloonId: "bal-4", index: 16, label: "Left Antenna Bobber", lengthInches: 1.1, diameterInches: 1.5, twistType: "cut_tail_bubbles", color: c3, baseDir: [-0.45, 0.89, 0] },
          { id: "b-14", balloonId: "bal-4", index: 17, label: "Right Antenna Stalk", lengthInches: 4.5, diameterInches: 1.0, twistType: "basic", color: c3, branchFrom: { bubbleIndex: 0, end: "start" }, baseDir: [0.45, 0.89, 0] },
          { id: "b-15", balloonId: "bal-4", index: 18, label: "Right Antenna Bobber", lengthInches: 1.1, diameterInches: 1.5, twistType: "cut_tail_bubbles", color: c3, baseDir: [0.45, 0.89, 0] },
        ],
      }),
    };
  }

  /* --- Default Tailored Quadruped / Character Archetype (Teddy Bear, Unicorn, Giraffe, Bunny, Dino, Custom) --- */
  const neckLen = isHornedOrTall ? 5.5 : isRoundEared ? 1.8 : 2.6;
  const earLen = /bunny|rabbit|pikachu|kangaroo/.test(clean) ? 6.0 : isRoundEared ? 3.5 : 3.25;
  const bodyLen = /dino|rex|gator/.test(clean) ? 5.5 : 4.5;
  const hasUnicornHorn = /unicorn|narwhal|rhino|triceratops/.test(clean);

  return {
    beginner: buildDesign({
      id: `custom-${Date.now()}-beg`,
      title: `${titleCased} (1-Balloon Quick Line Work)`,
      description: `Fast 1-balloon ${clean} built from standard 260 latex with tailored ${earLen}″ ears, ${neckLen}″ neck, and self-locking leg joints.`,
      category: "custom",
      complexity: "beginner",
      sourceType: "prompt",
      sourcePrompt: prompt,
      balloons: [
        { id: "bal-1", name: `Primary 260 (${titleCased})`, size: "260", color: c1, colorName: "Primary Latex", inflatedLengthInches: 50, tailLengthInches: 10, tailFingers: 4, order: 1 },
      ],
      bubbles: [
        { id: "b-1", balloonId: "bal-1", index: 0, label: `${titleCased} Muzzle`, lengthInches: 2.75, diameterInches: 2.0, twistType: "basic", color: c1, baseDir: [1, 0, 0] },
        ...(isRoundEared
          ? [
              { id: "b-2", balloonId: "bal-1", index: 1, label: "Left Round Ear Loop", lengthInches: earLen, diameterInches: 2.0, twistType: "loop" as const, isLoop: true, color: c1, baseDir: [-0.15, 0.82, 0.55] as [number, number, number] },
              { id: "b-3", balloonId: "bal-1", index: 2, label: "Right Round Ear Loop", lengthInches: earLen, diameterInches: 2.0, twistType: "loop" as const, isLoop: true, color: c1, baseDir: [-0.15, 0.82, -0.55] as [number, number, number] },
            ]
          : [
              { id: "b-2", balloonId: "bal-1", index: 1, label: "Left Ear", lengthInches: earLen, diameterInches: 2.0, twistType: "lock" as const, color: c1, bend: 72, turn: 14 },
              { id: "b-3", balloonId: "bal-1", index: 2, label: "Right Ear", lengthInches: earLen, diameterInches: 2.0, twistType: "lock" as const, color: c1 },
            ]),
        { id: "b-4", balloonId: "bal-1", index: 3, label: "Neck", lengthInches: neckLen, diameterInches: 2.0, twistType: "basic", color: c1, baseDir: [0.48, -0.88, 0] },
        { id: "b-5", balloonId: "bal-1", index: 4, label: "Front Left Leg", lengthInches: 3.5, diameterInches: 2.0, twistType: "lock", color: c1, baseDir: [0, -1, 0.12] },
        { id: "b-6", balloonId: "bal-1", index: 5, label: "Front Right Leg", lengthInches: 3.5, diameterInches: 2.0, twistType: "lock", color: c1 },
        { id: "b-7", balloonId: "bal-1", index: 6, label: "Torso / Body", lengthInches: bodyLen, diameterInches: 2.0, twistType: "basic", color: c1, baseDir: [1, 0.03, 0] },
        { id: "b-8", balloonId: "bal-1", index: 7, label: "Back Left Leg", lengthInches: 3.5, diameterInches: 2.0, twistType: "lock", color: c1, baseDir: [0, -1, 0.12] },
        { id: "b-9", balloonId: "bal-1", index: 8, label: "Back Right Leg", lengthInches: 3.5, diameterInches: 2.0, twistType: "lock", color: c1 },
        { id: "b-10", balloonId: "bal-1", index: 9, label: "Sculpted Tail", lengthInches: 3.75, diameterInches: 2.0, twistType: "s_hook", color: c1, baseDir: [0.55, 0.83, 0] },
      ],
    }),

    intermediate: buildDesign({
      id: `custom-${Date.now()}-int`,
      title: `${titleCased} (Deluxe 2-Balloon Sculpt)`,
      description: `Detailed 2-balloon ${clean} adding ${hasUnicornHorn ? "a golden spiral horn & flowing mane" : "contrasting accent ears/mane, cheek pinch, and toe-twist paws"}.`,
      category: "custom",
      complexity: "intermediate",
      sourceType: "prompt",
      sourcePrompt: prompt,
      balloons: [
        { id: "bal-1", name: `${titleCased} Body (260)`, size: "260", color: c1, colorName: "Primary Latex", inflatedLengthInches: 48, tailLengthInches: 12, tailFingers: 5, order: 1 },
        { id: "bal-2", name: `${titleCased} Accent (260)`, size: "260", color: c2, colorName: "Accent Latex", inflatedLengthInches: 44, tailLengthInches: 16, tailFingers: 7, order: 2, attachTo: { bubbleIndex: 1, end: "start" } },
      ],
      bubbles: [
        { id: "b-1", balloonId: "bal-1", index: 0, label: `${titleCased} Muzzle`, lengthInches: 3.0, diameterInches: 2.0, twistType: "tulip", isTulip: true, color: c1, baseDir: [1, 0, 0] },
        { id: "b-2", balloonId: "bal-1", index: 1, label: "Crown Cheek Pinch", lengthInches: 1.1, diameterInches: 1.8, twistType: "pinch", isPinch: true, color: c1, baseDir: [-0.2, 1, 0] },
        { id: "b-3", balloonId: "bal-1", index: 2, label: "Neck", lengthInches: neckLen, diameterInches: 2.0, twistType: "basic", color: c1, baseDir: [0.48, -0.88, 0] },
        { id: "b-4", balloonId: "bal-1", index: 3, label: "Front Left Leg", lengthInches: 3.5, diameterInches: 2.0, twistType: "basic", color: c1, baseDir: [0, -1, 0] },
        { id: "b-5", balloonId: "bal-1", index: 4, label: "Front Left Paw", lengthInches: 0.9, diameterInches: 1.4, twistType: "toe", isPinch: true, color: c1, baseDir: [-0.85, -0.1, 0.5] },
        { id: "b-6", balloonId: "bal-1", index: 5, label: "Front Right Paw", lengthInches: 0.9, diameterInches: 1.4, twistType: "toe", isPinch: true, color: c1, baseDir: [-0.85, -0.1, -0.5] },
        { id: "b-7", balloonId: "bal-1", index: 6, label: "Front Right Leg", lengthInches: 3.5, diameterInches: 2.0, twistType: "lock", color: c1, lockToBubbleStart: 3 },
        { id: "b-8", balloonId: "bal-1", index: 7, label: "Contoured Body", lengthInches: bodyLen + 0.5, diameterInches: 2.0, twistType: "basic", color: c1, baseDir: [1, 0.03, 0] },
        { id: "b-9", balloonId: "bal-1", index: 8, label: "Rear Left Leg", lengthInches: 3.5, diameterInches: 2.0, twistType: "basic", color: c1, baseDir: [0, -1, 0] },
        { id: "b-10", balloonId: "bal-1", index: 9, label: "Rear Left Paw", lengthInches: 0.9, diameterInches: 1.4, twistType: "toe", isPinch: true, color: c1, baseDir: [-0.85, -0.1, 0.5] },
        { id: "b-11", balloonId: "bal-1", index: 10, label: "Rear Right Paw", lengthInches: 0.9, diameterInches: 1.4, twistType: "toe", isPinch: true, color: c1, baseDir: [-0.85, -0.1, -0.5] },
        { id: "b-12", balloonId: "bal-1", index: 11, label: "Rear Right Leg", lengthInches: 3.5, diameterInches: 2.0, twistType: "lock", color: c1, lockToBubbleStart: 8 },
        { id: "b-13", balloonId: "bal-1", index: 12, label: "S-Curved Tail", lengthInches: 4.5, diameterInches: 1.9, twistType: "s_hook", color: c2, baseDir: [0.55, 0.83, 0] },
        { id: "b-14", balloonId: "bal-2", index: 13, label: "Left Accent Ear Loop", lengthInches: earLen + 0.75, diameterInches: 2.0, twistType: "loop", isLoop: true, color: c2, baseDir: [-0.1, 0.82, 0.56] },
        { id: "b-15", balloonId: "bal-2", index: 14, label: "Right Accent Ear Loop", lengthInches: earLen + 0.75, diameterInches: 2.0, twistType: "loop", isLoop: true, color: c2, baseDir: [-0.1, 0.82, -0.56] },
        ...(hasUnicornHorn
          ? [{ id: "b-16", balloonId: "bal-2", index: 15, label: "Golden Spiral Horn", lengthInches: 6.0, diameterInches: 1.6, twistType: "spiral" as const, color: c3, baseDir: [-0.62, 0.78, 0] as [number, number, number] }]
          : [{ id: "b-16", balloonId: "bal-2", index: 15, label: "Crest Mane Loop", lengthInches: 4.5, diameterInches: 1.9, twistType: "loop" as const, isLoop: true, color: c3, baseDir: [0.65, 0.76, 0] as [number, number, number] }]),
      ],
    }),

    advanced: buildDesign({
      id: `custom-${Date.now()}-adv`,
      title: `${titleCased} (Masterpiece 360 + Bird Body + 160 Filigree)`,
      description: `Exhibition 4-balloon ${clean} built with a 360 Apple Twist head, 3-bubble Bird Body torso, sculpted limbs, and 160 spiral detail.`,
      category: "custom",
      complexity: "advanced",
      sourceType: "prompt",
      sourcePrompt: prompt,
      balloons: [
        { id: "bal-1", name: `360 Head & Neck`, size: "360", color: c1, colorName: "Core Latex", inflatedLengthInches: 40, tailLengthInches: 20, tailFingers: 8, order: 1 },
        { id: "bal-2", name: `Bird Body Torso (260)`, size: "260", color: c1, colorName: "Body Latex", inflatedLengthInches: 46, tailLengthInches: 14, tailFingers: 6, order: 2, attachTo: { bubbleIndex: 2, end: "end" } },
        { id: "bal-3", name: `Sculpted Limbs (260)`, size: "260", color: c2, colorName: "Limb Latex", inflatedLengthInches: 48, tailLengthInches: 12, tailFingers: 5, order: 3, attachTo: { bubbleIndex: 2, end: "end" } },
        { id: "bal-4", name: `160 Spiral Details`, size: "160", color: c3, colorName: "Detail Latex", inflatedLengthInches: 38, tailLengthInches: 22, tailFingers: 9, order: 4, attachTo: { bubbleIndex: 1, end: "start" } },
      ],
      bubbles: [
        { id: "b-1", balloonId: "bal-1", index: 0, label: `360 Apple Muzzle`, lengthInches: 3.5, diameterInches: 2.8, twistType: "tulip", isTulip: true, color: c1, baseDir: [1, 0, 0] },
        { id: "b-2", balloonId: "bal-1", index: 1, label: "Crown Pinch", lengthInches: 1.4, diameterInches: 2.4, twistType: "pinch", isPinch: true, color: c1, baseDir: [-0.2, 1, 0] },
        { id: "b-3", balloonId: "bal-1", index: 2, label: "Sculpted Neck", lengthInches: neckLen, diameterInches: 2.5, twistType: "apple_link", color: c1, baseDir: [0.52, -0.85, 0] },
        { id: "b-4", balloonId: "bal-2", index: 3, label: "Bird Body Rail 1", lengthInches: bodyLen + 0.5, diameterInches: 2.0, twistType: "bird_body", color: c1, baseDir: [1, 0.02, 0] },
        { id: "b-5", balloonId: "bal-2", index: 4, label: "Bird Body Rail 2", lengthInches: bodyLen + 0.5, diameterInches: 2.0, twistType: "bird_body", color: c1 },
        { id: "b-6", balloonId: "bal-2", index: 5, label: "Bird Body Roll Core", lengthInches: bodyLen + 0.5, diameterInches: 2.0, twistType: "bird_body", color: c1 },
        { id: "b-7", balloonId: "bal-2", index: 6, label: "Hip Pinch Lock", lengthInches: 1.2, diameterInches: 1.9, twistType: "pinch", isPinch: true, color: c1, baseDir: [0.2, 1, 0] },
        { id: "b-8", balloonId: "bal-2", index: 7, label: "Show Tail Stem", lengthInches: 4.0, diameterInches: 1.8, twistType: "spiral", color: c2, baseDir: [0.55, 0.83, 0] },
        { id: "b-9", balloonId: "bal-2", index: 8, label: "Tail Tip Pom-Pom", lengthInches: 1.4, diameterInches: 2.2, twistType: "cut_tail_bubbles", color: c3, baseDir: [0.55, 0.83, 0] },
        { id: "b-10", balloonId: "bal-3", index: 9, label: "Front Left Leg", lengthInches: 3.75, diameterInches: 1.9, twistType: "basic", color: c2, baseDir: [0, -1, 0] },
        { id: "b-11", balloonId: "bal-3", index: 10, label: "Front Left Paw", lengthInches: 1.0, diameterInches: 1.5, twistType: "toe", isPinch: true, color: c2, baseDir: [-0.85, -0.1, 0.5] },
        { id: "b-12", balloonId: "bal-3", index: 11, label: "Front Right Paw", lengthInches: 1.0, diameterInches: 1.5, twistType: "toe", isPinch: true, color: c2, baseDir: [-0.85, -0.1, -0.5] },
        { id: "b-13", balloonId: "bal-3", index: 12, label: "Front Right Leg", lengthInches: 3.75, diameterInches: 1.9, twistType: "lock", color: c2, lockToBubbleStart: 9 },
        { id: "b-14", balloonId: "bal-3", index: 13, label: "Rear Left Leg", lengthInches: 3.5, diameterInches: 1.9, twistType: "basic", color: c2, branchFrom: { bubbleIndex: 6, end: "start" }, baseDir: [0, -1, 0] },
        { id: "b-15", balloonId: "bal-3", index: 14, label: "Rear Left Paw", lengthInches: 1.0, diameterInches: 1.5, twistType: "toe", isPinch: true, color: c2, baseDir: [-0.85, -0.1, 0.5] },
        { id: "b-16", balloonId: "bal-3", index: 15, label: "Rear Right Paw", lengthInches: 1.0, diameterInches: 1.5, twistType: "toe", isPinch: true, color: c2, baseDir: [-0.85, -0.1, -0.5] },
        { id: "b-17", balloonId: "bal-3", index: 16, label: "Rear Right Leg", lengthInches: 3.5, diameterInches: 1.9, twistType: "lock", color: c2, lockToBubbleStart: 13 },
        { id: "b-18", balloonId: "bal-4", index: 17, label: "Left Ear Loop", lengthInches: earLen + 1.0, diameterInches: 1.2, twistType: "loop", isLoop: true, color: c3, baseDir: [-0.1, 0.82, 0.56] },
        { id: "b-19", balloonId: "bal-4", index: 18, label: "Right Ear Loop", lengthInches: earLen + 1.0, diameterInches: 1.2, twistType: "loop", isLoop: true, color: c3, baseDir: [-0.1, 0.82, -0.56] },
        { id: "b-20", balloonId: "bal-4", index: 19, label: "160 Spiral Crest / Horn", lengthInches: 5.5, diameterInches: 1.0, twistType: "spiral", color: c3, baseDir: [-0.6, 0.8, 0] },
      ],
    }),
  };
}

export function findOrGenerateDesigns(
  queryOrPreset: string,
  detectedColors?: string[]
): Record<"beginner" | "intermediate" | "advanced", FullDesign> {
  const normalized = queryOrPreset.toLowerCase().trim();

  if (/\b(dog|puppy|poodle|dachshund|wiener)\b/.test(normalized) && !detectedColors?.length) {
    return PRESET_DESIGNS.dog;
  }
  if (/\b(sword|saber|blade|cutlass|claymore|excalibur)\b/.test(normalized) && !detectedColors?.length) {
    return PRESET_DESIGNS.sword;
  }
  if (/\b(flower|rose|daisy|orchid|tulip)\b/.test(normalized) && !detectedColors?.length) {
    return PRESET_DESIGNS.flower;
  }

  return generateProceduralBalloonDesigns(queryOrPreset, detectedColors);
}
