export type BalloonSize = "160" | "260" | "360";

export type TwistType =
  | "basic"
  | "lock"
  | "pinch" // also known as ear twist
  | "loop"
  | "toe"
  | "tulip" // apple twist
  | "tulip_chain"
  | "apple_link"
  | "bird_body" // rolling bubbles / 3-bubble roll through
  | "pinch_pop"
  | "s_hook"
  | "z_bend"
  | "spiral"
  | "tension"
  | "side_bubble"
  | "cut_tail"
  | "cut_tail_bubbles";

export type ComplexityLevel = "beginner" | "intermediate" | "advanced";

export interface JointAnchorRef {
  bubbleIndex: number;
  end: "start" | "end";
}

export interface BalloonSpec {
  id: string;
  name: string;
  size: BalloonSize;
  color: string; // hex code
  colorName: string;
  /** Manufacturer, when the balloon was picked from the shopping catalog */
  brand?: string;
  /** Catalog pack this balloon is bought as (links the design to the shopping recipe) */
  catalogItemId?: string;
  inflatedLengthInches: number; // e.g. 48"
  tailLengthInches: number; // e.g. 12" (approx 4-6 fingers)
  tailFingers?: number; // e.g. 5 fingers
  burpNote?: string;
  order: number;
  /** Where this balloon's nozzle knot ties into an existing joint on an earlier balloon */
  attachTo?: JointAnchorRef;
  /** Free-standing balloons only: hand-placed shift in inches [x, y, z] from the automatic spot */
  offset?: [number, number, number];
}

export interface BubbleSpec {
  id: string;
  balloonId: string;
  index: number;
  label: string; // e.g. "Snout", "Head", "Ear 1", "Ear 2", "Neck", "Leg 1", "Paw"
  lengthInches: number; // e.g. 2.5
  lengthFingers?: number; // e.g. 3 fingers
  diameterInches: number; // 1.0, 2.0, 3.0 based on balloon size or squished
  twistType: TwistType;
  color: string;

  // --- Kinematic 3D Topology & Direction Controls (single source of truth) ---
  /** Optional base world heading before applying user bend/turn (never detaches joint position!) */
  baseDir?: [number, number, number];
  /** Relative pitch angle in degrees (+ bends upward, - bends downward) */
  bend?: number;
  /** Relative yaw angle in degrees (+ turns left, - turns right) */
  turn?: number;
  /** Optional index of an earlier bubble whose START joint this bubble's far end locks back into */
  lockToBubbleStart?: number;
  /**
   * Optional joint (on any balloon, laid out earlier) that this bubble's far end is twisted
   * into. The two joints become one, and a joint shared by two chains counts as locked.
   */
  lockToJoint?: JointAnchorRef;
  /** Optional existing joint where this bubble originates (for multi-balloon wraps/leaves along a stem) */
  branchFrom?: JointAnchorRef;

  // Legacy fields retained for DB/JSON backwards compatibility
  poseStart?: [number, number, number];
  poseDir?: [number, number, number];
  angleX?: number;
  angleY?: number;
  angleZ?: number;
  curvature?: number;
  isLoop?: boolean;
  isPinch?: boolean;
  isTulip?: boolean;
  isPop?: boolean;
  lockGroupWith?: number[];
  /** Visual fine nudge in inches (shifts geometry only) */
  positionOffset?: [number, number, number];
}

export type StepJointAction = "inflate" | "attach_balloon" | "hold" | "lock" | "finish";

export interface StepSpec {
  stepNumber: number;
  /** Stable identifier so custom designer annotations persist across edits */
  stepId?: string;
  title: string;
  description: string;
  twistType: TwistType;
  balloonId: string;
  balloonColor: string;
  balloonSize: BalloonSize;
  bubbleIndices: number[]; // bubbles formed in this step
  bubbleLabels: string[];
  measurementText: string; // e.g. '2.5" (3.1 fingers) Snout'
  /** Remaining inflated untwisted balloon length after this step (inches) */
  remainingInflatedInches?: number;
  tailRemainingInches: number;
  tailRemainingFingers: number;
  /** Physical hand-state at the end of this step */
  jointAction?: StepJointAction;
  /** Explanation of whether you must keep holding the twist or can safely release your hands */
  handStateNote?: string;
  /** Non-empty if the step leaves an unstable twist in the finished sculpture */
  stabilityWarning?: string;
  tips: string;
  warning?: string;
  annotation?: string;
  diagramSvgType?: string;
}

export type StabilityAutoFix =
  | {
      kind: "insert_pinch";
      afterBubbleIndex: number;
      balloonId: string;
      color: string;
      diameterInches: number;
      label: string;
    }
  | {
      kind: "add_lock_partner";
      bubbleIndex: number;
    }
  | {
      kind: "convert_twist";
      bubbleIndex: number;
      newTwist: TwistType;
      newLengthInches?: number;
    }
  | {
      kind: "equalize_pair";
      bubbleIndices: number[];
      targetLengthInches: number;
    }
  | {
      kind: "complete_bird_body";
      lastBubbleIndex: number;
      countToAdd: number;
    }
  | {
      kind: "resize_bubble";
      bubbleIndex: number;
      newLengthInches: number;
    }
  | {
      kind: "adjust_balloon_tail";
      balloonId: string;
      newTailInches: number;
    };

export interface StabilityIssue {
  id: string;
  severity: "will_untwist" | "warning";
  title: string;
  explanation: string;
  /** Consequence in real latex physics when hands let go */
  whatHappensWhenReleased: string;
  bubbleIndices: number[];
  jointPosition?: [number, number, number]; // scene units
  fixLabel: string;
  fix: StabilityAutoFix;
}

export interface StabilityReport {
  isStable: boolean;
  untwistCount: number;
  warningCount: number;
  totalJoints: number;
  lockedJoints: number;
  issues: StabilityIssue[];
}

export interface FullDesign {
  id: string;
  title: string;
  description: string;
  category: string;
  complexity: ComplexityLevel;
  sourceType?: string;
  sourcePrompt?: string;
  bubbleCount: number;
  balloonCount: number;
  balloons: BalloonSpec[];
  bubbles: BubbleSpec[];
  steps: StepSpec[];
  annotations?: string[];
  /** Whole-sculpture orientation in degrees [pitch, yaw, roll], applied in the viewer */
  orientation?: [number, number, number];
  isPreset?: boolean;
  createdAt?: string;
}

export interface TwistInfo {
  type: TwistType;
  name: string;
  aka?: string;
  description: string;
  tailAirCostInches: number;
  difficulty: "Easy" | "Medium" | "Advanced";
  commonUse: string;
  proTip: string;
  selfLocking?: boolean;
  diagramPath?: string;
}
