import { BalloonSize, TwistInfo, TwistType } from "@/types/balloon";

export interface ColorOption {
  name: string;
  hex: string;
  category: "Standard" | "Fashion" | "Metallic" | "Pastel";
}

export const TWISTER_COLORS: ColorOption[] = [
  // Standard Classics
  { name: "Ruby Red", hex: "#E11D48", category: "Standard" },
  { name: "Mandarin Orange", hex: "#EA580C", category: "Standard" },
  { name: "Canary Yellow", hex: "#FACC15", category: "Standard" },
  { name: "Lime Green", hex: "#84CC16", category: "Standard" },
  { name: "Emerald Green", hex: "#16A34A", category: "Standard" },
  { name: "Pale Blue", hex: "#38BDF8", category: "Standard" },
  { name: "Royal Blue", hex: "#2563EB", category: "Standard" },
  { name: "Purple Violet", hex: "#7C3AED", category: "Standard" },
  { name: "Magenta Pink", hex: "#DB2777", category: "Standard" },
  { name: "Onyx Black", hex: "#1E293B", category: "Standard" },
  { name: "Snow White", hex: "#F8FAFC", category: "Standard" },
  { name: "Chocolate Brown", hex: "#78350F", category: "Standard" },
  
  // Fashion / Pastel / Metallics
  { name: "Chrome Gold", hex: "#EAB308", category: "Metallic" },
  { name: "Chrome Silver", hex: "#94A3B8", category: "Metallic" },
  { name: "Chrome Rose Gold", hex: "#F472B6", category: "Metallic" },
  { name: "Blush / Skin Tone", hex: "#FDBA74", category: "Fashion" },
  { name: "Lavender Pastel", hex: "#C084FC", category: "Pastel" },
  { name: "Mint Pastel", hex: "#6EE7B7", category: "Pastel" },
  { name: "Teal Turquoise", hex: "#0D9488", category: "Fashion" },
  { name: "Periwinkle", hex: "#818CF8", category: "Fashion" },
];

export const BALLOON_SIZE_DETAILS: Record<
  BalloonSize,
  {
    name: string;
    diameterInches: number;
    totalLengthInches: number;
    description: string;
    bestFor: string;
    standardTailFingers: number;
  }
> = {
  "160": {
    name: "160 Twister",
    diameterInches: 1.0,
    totalLengthInches: 60,
    description: "1 inch diameter by 60 inches long. Sleek, delicate, pliable.",
    bestFor: "Delicate details, fairy wings, intricate weaving, claws, crowns, small teeth.",
    standardTailFingers: 6,
  },
  "260": {
    name: "260 Classic Twister",
    diameterInches: 2.0,
    totalLengthInches: 60,
    description: "2 inches diameter by 60 inches long. The universal industry workhorse.",
    bestFor: "Standard balloon animals, swords, dogs, flowers, multi-balloon figures.",
    standardTailFingers: 5,
  },
  "360": {
    name: "360 Heavy Twister",
    diameterInches: 3.0,
    totalLengthInches: 60,
    description: "3 inches diameter by 60 inches long. Chunky, high-volume, bold presence.",
    bestFor: "Heads, muscular bodies, dinosaur torsos, massive swords, cartoon characters.",
    standardTailFingers: 6,
  },
};

export const TWIST_ENCYCLOPEDIA: Record<TwistType, TwistInfo> = {
  basic: {
    type: "basic",
    name: "Basic Twist",
    aka: "Simple Bubble Twist",
    description: "Twist the balloon 3 to 4 full revolutions to create a distinct bubble. Must be held firmly with fingers until locked by subsequent twists.",
    tailAirCostInches: 0.4,
    difficulty: "Easy",
    commonUse: "Snouts, necks, body sections, spacers between joints.",
    proTip: "Always rotate consecutive twists in the exact same direction to prevent previously made twists from unraveling.",
  },
  lock: {
    type: "lock",
    name: "Lock Twist",
    aka: "Puppy Ear / Leg Lock",
    description: "Fold two consecutive bubbles side-by-side, pull them slightly away from the base bubble to relieve friction, and twist them together 3 times.",
    tailAirCostInches: 0.7,
    difficulty: "Easy",
    commonUse: "Dog ears, front and rear legs, flower petal pairs.",
    proTip: "Pull gently outward while twisting so the friction doesn't pop the latex at the joint.",
  },
  pinch: {
    type: "pinch",
    name: "Pinch Twist",
    aka: "Ear Twist / Friction Lock",
    description: "Take a small round bubble (1-inch), fold it back against the seam, lift it outward, and twist it 180-360 degrees on its own axis.",
    tailAirCostInches: 0.8,
    difficulty: "Medium",
    commonUse: "Cheeks, bear ears, changing the angle of a joint by 90°, securing loops.",
    proTip: "Pull the bubble UP away from the balloon before twisting. Squeeze gently before twisting to make it soft and pliable.",
  },
  loop: {
    type: "loop",
    name: "Loop Twist",
    aka: "Fold Twist",
    description: "Fold a single long section of the balloon into a teardrop loop and twist the ends together at the base.",
    tailAirCostInches: 0.9,
    difficulty: "Easy",
    commonUse: "Sword hilt guards, flower petals, wings, elephant trunk bends.",
    proTip: "Squeeze the air forward into the fold before locking so the loop has consistent tension.",
  },
  toe: {
    type: "toe",
    name: "Toe Twist",
    aka: "Paw / Claws Pinch",
    description: "A tiny pinch twist (0.5 to 0.75 inches) positioned at the bottom junction of animal paws or feet.",
    tailAirCostInches: 0.5,
    difficulty: "Medium",
    commonUse: "Dog paws, cat toes, frog feet, dinosaur claws.",
    proTip: "Burp the balloon thoroughly so the tiny bubble has minimal pressure before pinching.",
  },
  tulip: {
    type: "tulip",
    name: "Tulip / Apple Twist",
    aka: "Apple Twist / Core Inversion",
    description: "Push the tied nozzle knot deep into the balloon cylinder with your index finger. Grab the knot through the outside latex with the other hand, withdraw your finger, and twist the balloon around the knot.",
    tailAirCostInches: 1.6,
    difficulty: "Advanced",
    commonUse: "Apple centers, nozzle-free cartoon animal noses, flower stamens, hat attachments.",
    proTip: "Moisten your index finger slightly so it slides out cleanly without dragging the latex inside-out.",
  },
  tulip_chain: {
    type: "tulip_chain",
    name: "Tulip / Apple Twist Chains",
    aka: "Multi-Core Chain",
    description: "A sequence of two or more linked apple twists created consecutively along a balloon section, giving an articulated, dimpled chain texture.",
    tailAirCostInches: 2.8,
    difficulty: "Advanced",
    commonUse: "Caterpillar segments, articulated robot arms, fancy flower stalks.",
    proTip: "Leave plenty of tail allowance, as internal core displacements significantly compress the remaining air.",
  },
  apple_link: {
    type: "apple_link",
    name: "Apple Link",
    aka: "Nozzle Anchor Link",
    description: "Tying or locking a second balloon's knot directly into the recessed knot of an apple twist, creating an invisible, ultra-strong multi-balloon junction.",
    tailAirCostInches: 1.5,
    difficulty: "Advanced",
    commonUse: "Multi-balloon hats, attaching heads to bodies seamlessly, arm sockets.",
    proTip: "Ensure the anchor balloon is burped so the joint does not burst under tensile load.",
  },
  bird_body: {
    type: "bird_body",
    name: "Bird Body (Rolling Bubbles)",
    aka: "3-Bubble Roll-Through",
    description: "Create three parallel bubbles arranged in a triangular prism. Take one outer bubble and gently push/roll it through the center between the other two until it locks firmly.",
    tailAirCostInches: 1.4,
    difficulty: "Medium",
    commonUse: "Parrot and swan bodies, teddy bear torsos, sturdy vehicle bases.",
    proTip: "Make the middle bubble slightly longer than the outer two for smooth rolling without extreme friction.",
  },
  pinch_pop: {
    type: "pinch_pop",
    name: "Pinch-Pop Series",
    aka: "Sacrificial Bubble Release",
    description: "Insert a small sacrificial bubble between two sections, tie off the surrounding knots securely, and carefully snip/pop the middle bubble to separate sections cleanly.",
    tailAirCostInches: 1.0,
    difficulty: "Advanced",
    commonUse: "Dividing a single balloon into separate arms, wings, or floating eyes without starting a new balloon.",
    proTip: "Double-twist both sides and wrap the knot around twice before puncturing the discard bubble.",
  },
  s_hook: {
    type: "s_hook",
    name: "S-Hook Twist",
    aka: "Thermal S-Bend",
    description: "Warm the latex with your hands or friction, bend the balloon into an 'S' contour, and hold for 10 seconds. The latex memory sets in a graceful curved swan neck.",
    tailAirCostInches: 0.3,
    difficulty: "Medium",
    commonUse: "Swan necks, flamingo curves, dragon tails, guitar bodies.",
    proTip: "Rubbing the balloon quickly against your pant leg or warm palm creates friction heat that molds the shape permanently.",
  },
  z_bend: {
    type: "z_bend",
    name: "Z-Bend",
    aka: "Accordion Zig-Zag Bend",
    description: "Accordion-fold a long bubble into 3 equal lengths (Z-shape) and squeeze firmly in the palm to create permanent sharp angles without individual twists.",
    tailAirCostInches: 0.5,
    difficulty: "Medium",
    commonUse: "Lightning bolts, dinosaur spines, superhero capes, spider legs.",
    proTip: "Apply uniform pressure across the folds for 5 seconds to lock the crease.",
  },
  spiral: {
    type: "spiral",
    name: "Spiral Twist",
    aka: "Corkscrew Twist",
    description: "Wrap an uninflated or softened balloon around a cylindrical balloon pump or your arm, hold the coils snugly, and inflate while maintaining the coiled shape.",
    tailAirCostInches: 1.2,
    difficulty: "Medium",
    commonUse: "Unicorn horns, pig tails, curly wizard wands, candy cane spirals.",
    proTip: "Inflate slowly while holding the coil tight against the pump nozzle.",
  },
  tension: {
    type: "tension",
    name: "Tension Twist",
    aka: "Friction Wedge",
    description: "Wedging a bubble between two existing locked bubbles so friction and compressive tension hold it rigidly in place without an actual mechanical twist.",
    tailAirCostInches: 0.5,
    difficulty: "Medium",
    commonUse: "Beaks tucked between cheeks, eyes seated on crowns, motorcycle handlebars.",
    proTip: "Ensure the receiving bubbles are firm enough to provide positive clasping pressure.",
  },
  side_bubble: {
    type: "side_bubble",
    name: "Side Bubbles",
    aka: "Flank Rails / Rib Twists",
    description: "Bubbles attached along the side rails of a main spine or body to give 3-dimensional width and realistic contouring.",
    tailAirCostInches: 0.8,
    difficulty: "Medium",
    commonUse: "Airplane wings, motorcycle wheels, basket weaves, dragon ribs.",
    proTip: "Keep bubble lengths symmetric on both sides for balanced alignment.",
  },
  cut_tail: {
    type: "cut_tail",
    name: "Cut Tails",
    aka: "Deflate & Tie-Off",
    description: "Puncturing the uninflated tail or excess bubble, releasing residual air, tying off tightly, and trimming cleanly with safety cutters.",
    tailAirCostInches: 0.0,
    difficulty: "Easy",
    commonUse: "Finishing animal sculptures with neat flush rumps, cleaning up multi-balloon junctions.",
    proTip: "Always tie the knot before trimming the excess latex, leaving at least 1/4 inch beyond the knot.",
  },
  cut_tail_bubbles: {
    type: "cut_tail_bubbles",
    name: "Cut Tails with Tiny Bubbles",
    aka: "Tail Bead Rattles",
    description: "Forming 1 or 2 pea-sized bubbles at the very tip of an otherwise deflated or trimmed tail, creating playful sensory rattles or decorative accents.",
    tailAirCostInches: 0.6,
    difficulty: "Medium",
    commonUse: "Poodle pom-pom tails, antenna bobbers, rattle eyes, wand finials.",
    proTip: "Squeeze the air into the tip bubble before puncturing the neck portion between the body and the bead.",
  },
};

export function inchesToFingers(inches: number): number {
  return Math.round((inches / 0.8) * 10) / 10;
}

export function fingersToInches(fingers: number): number {
  return Math.round(fingers * 0.8 * 10) / 10;
}

export interface TailAnalysis {
  balloonId: string;
  totalLengthInches: number;
  inflatedLengthInches: number;
  bubblesAirConsumedInches: number;
  twistsAirDisplacedInches: number;
  totalAirDemandInches: number;
  tailRemainingInches: number;
  tailRemainingFingers: number;
  status: "safe" | "tight" | "pop_risk" | "underfilled";
  statusMessage: string;
}

export function calculateBalloonTail(
  balloon: {
    id: string;
    size: BalloonSize;
    inflatedLengthInches?: number;
    tailLengthInches?: number;
  },
  bubbles: Array<{
    balloonId: string;
    lengthInches: number;
    twistType: TwistType;
  }>
): TailAnalysis {
  const totalLength = 60; // Standard 60" twister
  const balloonBubbles = bubbles.filter((b) => b.balloonId === balloon.id);

  let bubblesAirConsumed = 0;
  let twistsAirDisplaced = 0;

  for (const bubble of balloonBubbles) {
    bubblesAirConsumed += bubble.lengthInches;
    const twistInfo = TWIST_ENCYCLOPEDIA[bubble.twistType] || TWIST_ENCYCLOPEDIA.basic;
    twistsAirDisplaced += twistInfo.tailAirCostInches;
  }

  const totalDemand = bubblesAirConsumed + twistsAirDisplaced;
  const initialTail = balloon.tailLengthInches ?? Math.max(8, twistsAirDisplaced + 2);
  const initialInflated = Math.max(10, totalLength - initialTail);

  // Physical model: the initial tail is the uninflated section.
  // Each twist displaces air into the tail, consuming some of it.
  // Remaining tail = initial tail - twist air displacement.
  const tailRemaining = Math.max(0, initialTail - twistsAirDisplaced);
  const tailFingers = Math.round((tailRemaining / 0.8) * 10) / 10;

  let status: "safe" | "tight" | "pop_risk" | "underfilled" = "safe";
  let statusMessage = "Tail length is optimal for tension and locks.";

  if (totalDemand > 58) {
    status = "pop_risk";
    statusMessage = "POP RISK! Air demand exceeds balloon capacity. Lengthen tail or shrink bubbles.";
  } else if (tailRemaining < 2.0) {
    status = "tight";
    statusMessage = "High pressure! Balloon will be very tight. Squeeze/burp gently before final twists.";
  } else if (tailRemaining > 20) {
    status = "underfilled";
    statusMessage = "Ample tail remaining. Good for adding more detail or decorative tail bead.";
  } else {
    status = "safe";
    statusMessage = `Safe! Leaving approximately ${tailFingers} fingers (${tailRemaining.toFixed(1)}") of uninflated tail.`;
  }

  return {
    balloonId: balloon.id,
    totalLengthInches: totalLength,
    inflatedLengthInches: initialInflated,
    bubblesAirConsumedInches: Math.round(bubblesAirConsumed * 10) / 10,
    twistsAirDisplacedInches: Math.round(twistsAirDisplaced * 10) / 10,
    totalAirDemandInches: Math.round(totalDemand * 10) / 10,
    tailRemainingInches: Math.round(tailRemaining * 10) / 10,
    tailRemainingFingers: tailFingers,
    status,
    statusMessage,
  };
}
