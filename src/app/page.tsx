"use client";

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  BookOpen,
  Camera,
  Download,
  FileDown,
  Layers,
  ListOrdered,
  Plus,
  Save,
  Scale,
  Wrench,
} from "lucide-react";
import {
  ComplexityLevel,
  FullDesign,
  BubbleSpec,
  StepSpec,
  BalloonSpec,
  StabilityAutoFix,
} from "@/types/balloon";
import { PRESET_DESIGNS } from "@/lib/balloonPresets";
import { generateStepsFromSimulation, createBlankSlateDesign } from "@/lib/stepGenerator";
import {
  computeBalloonLayout,
  applyStabilityAutoFix,
  autoStabilizeSculpture,
  defaultDiameterForSize,
  getStepVisibility,
} from "@/lib/balloonLayout";
import { computeAirBudget, defaultTailInches } from "@/lib/balloonAir";
import {
  SplitMode,
  deleteBubbles,
  equalizeLengths,
  insertBubbles,
  moveBubble,
  newBubbleId,
  releaseTwists,
  splitBubble,
  twistFlags,
  twistTogether,
} from "@/lib/designEdits";
import {
  ThreeBalloonViewer,
  ThreeBalloonViewerRef,
  BuildViewMode,
  AddTwistPresetKind,
} from "@/components/ThreeBalloonViewer";
import { StepPlaybackBar } from "@/components/StepPlaybackBar";
import { ComplexityTierSelector } from "@/components/ComplexityTierSelector";
import { InstructionStepDeck } from "@/components/InstructionStepDeck";
import { BalloonDesignEditor } from "@/components/BalloonDesignEditor";
import { TwistEncyclopediaModal } from "@/components/TwistEncyclopediaModal";
import { ExportCardModal } from "@/components/ExportCardModal";
import { TailAllowanceMeter } from "@/components/TailAllowanceMeter";
import { NewDesignModal } from "@/components/NewDesignModal";
import {
  SavedProject,
  SavedProjectSummary,
  deleteProject,
  downloadProjectJson,
  listProjects,
  loadProject,
  makeProject,
  readProjectFile,
  saveProject,
} from "@/lib/designStorage";
import { AddBalloonRequest } from "@/components/AddBalloonPopover";

export default function BalloonAppPage() {
  const [designTierMap, setDesignTierMap] = useState<Record<ComplexityLevel, FullDesign>>(
    PRESET_DESIGNS.dog
  );
  const [activeComplexity, setActiveComplexity] = useState<ComplexityLevel>("beginner");
  const [currentStepIndex, setCurrentStepIndex] = useState(
    () => PRESET_DESIGNS.dog.beginner.steps.length - 1
  );
  /** Ordered multi-selection; the last entry is the primary (inspected) bubble */
  const [selectedIndices, setSelectedIndices] = useState<number[]>([0]);
  /** Balloon that receives new bubbles when nothing is selected (blank slate) */
  const [activeBalloonId, setActiveBalloonId] = useState<string | null>(null);
  const [buildMode, setBuildMode] = useState<BuildViewMode>("step");
  const [showLabels, setShowLabels] = useState(true);
  const [showGhost, setShowGhost] = useState(false);

  const [rightPanelTab, setRightPanelTab] = useState<"instructions" | "cad_editor" | "telemetry">(
    "instructions"
  );

  const [isNewDesignOpen, setIsNewDesignOpen] = useState(false);
  /** Identity of the saved project this session was opened from (null = unsaved) */
  const [projectId, setProjectId] = useState<string | null>(null);
  const [savedProjects, setSavedProjects] = useState<SavedProjectSummary[]>([]);
  const [isEncyclopediaOpen, setIsEncyclopediaOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [capturedPngUrl, setCapturedPngUrl] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const viewerRef = useRef<ThreeBalloonViewerRef>(null);

  const currentDesign = designTierMap[activeComplexity] || PRESET_DESIGNS.dog.beginner;
  const bubbleCount = currentDesign.bubbles.length;
  const selectedBubbleIndex =
    bubbleCount === 0
      ? null
      : Math.max(0, Math.min(selectedIndices[selectedIndices.length - 1] ?? 0, bubbleCount - 1));
  const validSelection = useMemo(
    () => selectedIndices.filter((i) => i >= 0 && i < bubbleCount),
    [selectedIndices, bubbleCount]
  );

  const liveSim = useMemo(
    () => computeBalloonLayout(currentDesign.balloons, currentDesign.bubbles),
    [currentDesign.balloons, currentDesign.bubbles]
  );

  const stepVisibility = useMemo(
    () =>
      buildMode === "step"
        ? getStepVisibility(
            currentDesign.steps,
            currentDesign.bubbles,
            currentDesign.balloons,
            currentStepIndex
          )
        : null,
    [buildMode, currentDesign.steps, currentDesign.bubbles, currentDesign.balloons, currentStepIndex]
  );

  const airByBalloon = useMemo(
    () =>
      currentDesign.balloons.map((bal) => ({
        balloon: bal,
        air: computeAirBudget(bal, currentDesign.bubbles, stepVisibility?.formed ?? null),
      })),
    [currentDesign.balloons, currentDesign.bubbles, stepVisibility]
  );

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(null), 3200);
  }, []);

  /** Find the step that forms `bubbleIdx` so 3D clicks & step instructions stay in lock-step. */
  const stepIndexForBubble = useCallback((design: FullDesign, bubbleIdx: number) => {
    let found = design.steps.findIndex((st) => st.bubbleIndices.includes(bubbleIdx));
    if (found === -1) {
      found = design.steps.findIndex(
        (st) => st.bubbleIndices.length > 0 && Math.max(...st.bubbleIndices) >= bubbleIdx
      );
    }
    return found === -1 ? Math.max(0, design.steps.length - 1) : found;
  }, []);

  /** Central atomic commit: ALWAYS regenerates steps directly from the 3D simulation. */
  const commitDesignState = useCallback(
    (
      nextBalloons: BalloonSpec[],
      nextBubblesRaw: BubbleSpec[],
      focus?: number | number[],
      jumpToFocusStep = false
    ) => {
      const balloonColors = new Map(nextBalloons.map((balloon) => [balloon.id, balloon.color]));
      const nextBubbles = nextBubblesRaw.map((bubble, index) => ({
        ...bubble,
        index,
        color: balloonColors.get(bubble.balloonId) ?? bubble.color,
      }));
      const nextSteps = generateStepsFromSimulation(nextBalloons, nextBubbles, currentDesign.steps);
      const updatedDesign: FullDesign = {
        ...currentDesign,
        balloons: nextBalloons,
        balloonCount: nextBalloons.length,
        bubbles: nextBubbles,
        bubbleCount: nextBubbles.length,
        steps: nextSteps,
      };
      setDesignTierMap((prev) => ({ ...prev, [activeComplexity]: updatedDesign }));

      const clamp = (i: number) => Math.max(0, Math.min(i, nextBubbles.length - 1));
      let nextSelection: number[];
      if (Array.isArray(focus)) nextSelection = Array.from(new Set(focus.map(clamp)));
      else if (focus !== undefined) nextSelection = [clamp(focus)];
      else nextSelection = validSelection.length ? validSelection.map(clamp) : [0];
      if (nextBubbles.length === 0) nextSelection = [];
      setSelectedIndices(nextSelection);

      const target = nextSelection[nextSelection.length - 1];
      if (jumpToFocusStep && buildMode === "step" && target !== undefined) {
        setCurrentStepIndex(stepIndexForBubble(updatedDesign, target));
      } else {
        setCurrentStepIndex((prev) => Math.max(0, Math.min(prev, nextSteps.length - 1)));
      }
      return updatedDesign;
    },
    [activeComplexity, buildMode, currentDesign, validSelection, stepIndexForBubble]
  );

  /* ---------------- selection ---------------- */

  const handleSelectBubble = useCallback(
    (idx: number, additive = false) => {
      if (idx < 0 || idx >= currentDesign.bubbles.length) return;
      setSelectedIndices((prev) => {
        if (!additive) return [idx];
        const without = prev.filter((i) => i !== idx);
        // Toggle off if already selected (but never leave the set empty)
        if (without.length !== prev.length) return without.length ? without : [idx];
        return [...without, idx];
      });
      if (buildMode === "step") {
        setCurrentStepIndex(stepIndexForBubble(currentDesign, idx));
      }
    },
    [buildMode, currentDesign, stepIndexForBubble]
  );

  const handleSelectMany = useCallback((indices: number[]) => {
    setSelectedIndices(indices.length ? indices : [0]);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedIndices((prev) => (prev.length ? [prev[prev.length - 1]] : []));
  }, []);

  const handleSelectStep = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(idx, currentDesign.steps.length - 1));
      setBuildMode("step");
      setCurrentStepIndex(clamped);
      const first = currentDesign.steps[clamped]?.bubbleIndices[0];
      if (first !== undefined) setSelectedIndices([first]);
    },
    [currentDesign]
  );

  /* ---------------- design lifecycle ---------------- */

  const handleDesignsGenerated = (
    newDesigns: Record<ComplexityLevel, FullDesign>,
    promptOrLabel: string
  ) => {
    setDesignTierMap(newDesigns);
    setProjectId(null);
    setBuildMode("step");
    setCurrentStepIndex(Math.max(0, newDesigns[activeComplexity].steps.length - 1));
    setSelectedIndices([0]);
    setActiveBalloonId(null);
    showToast(`Generated three tiers for “${promptOrLabel}”. Scrub the steps or press Play.`);
  };

  const handleStartBlankSlate = () => {
    const blankDesigns = createBlankSlateDesign();
    setDesignTierMap(blankDesigns);
    setProjectId(null);
    setActiveComplexity("beginner");
    setBuildMode("step");
    setCurrentStepIndex(0);
    setSelectedIndices([]);
    setActiveBalloonId(blankDesigns.beginner.balloons[0]?.id ?? null);
    setRightPanelTab("cad_editor");
    showToast("Blank balloon ready. Pick a twist from the palette to make your first bubble.");
  };

  /* ---------------- bubble edits ---------------- */

  /** Update a bubble (with optional Lock-Pair partner sync during 3D drag resizing). */
  const handleUpdateBubble = useCallback(
    (index: number, updated: Partial<BubbleSpec>, syncPartner = false) => {
      const updatedBubbles = currentDesign.bubbles.map((b) => ({ ...b }));
      if (!updatedBubbles[index]) return;
      updatedBubbles[index] = { ...updatedBubbles[index], ...updated };

      if (syncPartner) {
        const partnerIdx = liveSim.layouts[index]?.partnerIndex;
        if (partnerIdx !== undefined && updatedBubbles[partnerIdx]) {
          if (updated.lengthInches !== undefined) {
            updatedBubbles[partnerIdx].lengthInches = updated.lengthInches;
          }
          if (updated.diameterInches !== undefined) {
            updatedBubbles[partnerIdx].diameterInches = updated.diameterInches;
          }
        }
      }

      const structural = "twistType" in updated || "balloonId" in updated;
      commitDesignState(currentDesign.balloons, updatedBubbles, index, structural);
    },
    [commitDesignState, currentDesign.balloons, currentDesign.bubbles, liveSim.layouts]
  );

  /** Add any twist formation (single bubble, 2-lock pair, 3-roll bird body, …) after a bubble. */
  const handleAddTwistPreset = useCallback(
    (preset: AddTwistPresetKind, afterBubbleIndex?: number, balloonId?: string) => {
      const { balloons, bubbles } = currentDesign;
      const targetBalloonId =
        balloonId ??
        (afterBubbleIndex !== undefined ? bubbles[afterBubbleIndex]?.balloonId : undefined) ??
        activeBalloonId ??
        bubbles[bubbles.length - 1]?.balloonId ??
        balloons[0]?.id;
      const bal = balloons.find((b) => b.id === targetBalloonId) || balloons[0];
      if (!bal) return;

      // Insert after the given bubble, or after the last bubble of the target balloon
      let insertAt: number;
      if (afterBubbleIndex !== undefined && bubbles[afterBubbleIndex]) {
        insertAt = afterBubbleIndex + 1;
      } else {
        let lastOnBal = -1;
        bubbles.forEach((b, i) => {
          if (b.balloonId === bal.id) lastOnBal = i;
        });
        insertAt = lastOnBal === -1 ? bubbles.length : lastOnBal + 1;
      }
      const refBubble = bubbles[insertAt - 1]?.balloonId === bal.id ? bubbles[insertAt - 1] : undefined;
      const diam = refBubble?.diameterInches || defaultDiameterForSize(bal.size);
      const col = bal.color;

      const mk = (
        label: string,
        lengthInches: number,
        twistType: BubbleSpec["twistType"],
        extra: Partial<BubbleSpec> = {}
      ): BubbleSpec => ({
        id: newBubbleId(),
        balloonId: bal.id,
        index: 0,
        label,
        lengthInches,
        diameterInches: diam,
        twistType,
        color: col,
        ...twistFlags(twistType),
        ...extra,
      });

      let toInsert: BubbleSpec[];
      switch (preset) {
        case "lock_pair":
          toInsert = [
            mk("Lock Bubble A", 3.25, "lock", { bend: 65, turn: 12 }),
            mk("Lock Bubble B", 3.25, "lock"),
          ];
          break;
        case "bird_body":
          toInsert = [
            mk("Bird Rail 1", 4.5, "bird_body"),
            mk("Bird Rail 2", 4.5, "bird_body"),
            mk("Bird Roll Center", 4.5, "bird_body"),
          ];
          break;
        case "tulip":
          toInsert = [mk("Tulip / Apple Bubble", 2.5, "tulip"), mk("Tulip Lock Pinch", 1.0, "pinch")];
          break;
        case "pinch":
          toInsert = [mk("Pinch Twist", 1.1, "pinch")];
          break;
        case "toe":
          toInsert = [mk("Toe Twist Paw", 0.9, "toe", { diameterInches: Math.max(0.9, diam * 0.75) })];
          break;
        case "loop":
          toInsert = [mk("Loop Petal", 5.0, "loop")];
          break;
        case "spiral":
          toInsert = [mk("Spiral Coil", 5.5, "spiral")];
          break;
        case "s_hook":
          toInsert = [mk("S-Hook Curve", 4.5, "s_hook", { bend: 45 })];
          break;
        case "z_bend":
          toInsert = [mk("Z-Bend Segment", 5.0, "z_bend")];
          break;
        case "side_bubble":
          toInsert = [mk("Side Bubble", 4.5, "side_bubble")];
          break;
        case "cut_tail_bubbles":
          toInsert = [mk("Pom-Pom Tip Bead", 1.25, "cut_tail_bubbles", { diameterInches: diam * 1.1 })];
          break;
        default:
          toInsert = [mk(`Bubble ${insertAt + 1}`, 3.0, "basic")];
      }

      const res = insertBubbles(balloons, bubbles, insertAt, toInsert);
      commitDesignState(res.balloons, res.bubbles, res.focusIndex, true);
      setActiveBalloonId(bal.id);
      showToast(`Added ${preset.replace(/_/g, " ")} to ${bal.name}.`);
    },
    [activeBalloonId, commitDesignState, currentDesign, showToast]
  );

  const handleDuplicateBubble = useCallback(
    (index: number) => {
      const src = currentDesign.bubbles[index];
      if (!src) return;
      const clone: BubbleSpec = {
        ...src,
        id: newBubbleId(),
        label: `${src.label} (copy)`,
        lockToBubbleStart: undefined,
      };
      const res = insertBubbles(currentDesign.balloons, currentDesign.bubbles, index + 1, [clone]);
      commitDesignState(res.balloons, res.bubbles, res.focusIndex, true);
      showToast(`Duplicated “${src.label}”.`);
    },
    [commitDesignState, currentDesign.balloons, currentDesign.bubbles, showToast]
  );

  const handleDeleteBubble = useCallback(
    (index: number) => {
      const indices = validSelection.includes(index) && validSelection.length > 1 ? validSelection : [index];
      if (indices.some((i) => !currentDesign.bubbles[i])) return;
      const res = deleteBubbles(currentDesign.balloons, currentDesign.bubbles, indices);
      commitDesignState(res.balloons, res.bubbles, res.focusIndex, true);
      showToast(
        indices.length > 1
          ? `Removed ${indices.length} bubbles. Stability and steps recalculated.`
          : "Removed bubble. Stability and steps recalculated."
      );
    },
    [commitDesignState, currentDesign.balloons, currentDesign.bubbles, showToast, validSelection]
  );

  const handleMoveBubble = (index: number, direction: "up" | "down") => {
    const res = moveBubble(
      currentDesign.balloons,
      currentDesign.bubbles,
      index,
      direction === "up" ? index - 1 : index + 1
    );
    commitDesignState(res.balloons, res.bubbles, res.focusIndex, true);
  };

  const handleSplitBubble = useCallback(
    (index: number, mode: SplitMode) => {
      const res = splitBubble(currentDesign.balloons, currentDesign.bubbles, index, mode);
      if (!res) {
        showToast("That bubble is too short to split. Each piece needs at least ½″.");
        return;
      }
      const added = res.bubbles.length - currentDesign.bubbles.length;
      const focus = Array.from({ length: added + 1 }, (_, k) => res.focusIndex + k);
      commitDesignState(res.balloons, res.bubbles, focus, true);
      const what =
        mode.kind === "lock_pair"
          ? "a folded lock pair"
          : mode.kind === "pinch_between"
          ? "two bubbles with a pinch lock between"
          : mode.kind === "at"
          ? `two bubbles at ${mode.inches}″`
          : `${mode.parts} equal bubbles`;
      showToast(`Split into ${what}. Total length unchanged.`);
    },
    [commitDesignState, currentDesign.balloons, currentDesign.bubbles, showToast]
  );

  const handleTwistTogether = useCallback(
    (indices: number[]) => {
      const res = twistTogether(currentDesign.balloons, currentDesign.bubbles, indices);
      if ("error" in res) {
        showToast(res.error);
        return;
      }
      commitDesignState(res.balloons, res.bubbles, indices, true);
      showToast(res.summary);
    },
    [commitDesignState, currentDesign.balloons, currentDesign.bubbles, showToast]
  );

  const handleReleaseTwists = useCallback(
    (indices: number[]) => {
      const res = releaseTwists(currentDesign.balloons, currentDesign.bubbles, indices);
      commitDesignState(res.balloons, res.bubbles, indices, true);
      showToast("Unlocked back to plain twists.");
    },
    [commitDesignState, currentDesign.balloons, currentDesign.bubbles, showToast]
  );

  const handleEqualizeLengths = useCallback(
    (indices: number[]) => {
      const res = equalizeLengths(currentDesign.balloons, currentDesign.bubbles, indices);
      commitDesignState(res.balloons, res.bubbles, indices, false);
      showToast("Lengths equalized.");
    },
    [commitDesignState, currentDesign.balloons, currentDesign.bubbles, showToast]
  );

  /* ---------------- balloons ---------------- */

  const handleAddBalloon = (req: AddBalloonRequest) => {
    const newBalId = `bal-${Date.now().toString(36)}`;
    // Standard finger count for the size plus two fingers of headroom for twists
    const tail = Math.round((defaultTailInches(req.size) + 1.6) * 4) / 4;
    const newBal: BalloonSpec = {
      id: newBalId,
      name: `${req.colorName} ${req.size}`,
      size: req.size,
      color: req.colorHex,
      colorName: req.colorName,
      inflatedLengthInches: 60 - tail,
      tailLengthInches: tail,
      tailFingers: Math.round((tail / 0.8) * 10) / 10,
      burpNote: req.attachTo ? "Burp one puff before tying into the joint." : "Burp one puff before tying.",
      order: currentDesign.balloons.length + 1,
      attachTo: req.attachTo ?? undefined,
    };
    const nextBalloons = [...currentDesign.balloons, newBal];
    let nextBubbles = currentDesign.bubbles;
    if (req.withStarterBubble) {
      const starter: BubbleSpec = {
        id: newBubbleId(),
        balloonId: newBalId,
        index: currentDesign.bubbles.length,
        label: `${req.colorName} Bubble 1`,
        lengthInches: req.size === "160" ? 2.5 : 3.0,
        diameterInches: defaultDiameterForSize(req.size),
        twistType: "basic",
        color: req.colorHex,
      };
      nextBubbles = [...currentDesign.bubbles, starter];
    }
    commitDesignState(nextBalloons, nextBubbles, req.withStarterBubble ? nextBubbles.length - 1 : undefined, true);
    setActiveBalloonId(newBalId);
    showToast(
      req.attachTo
        ? `Added ${req.size} ${req.colorName}, tied into bubble #${req.attachTo.bubbleIndex + 1}.`
        : `Added a free-standing ${req.size} ${req.colorName}.`
    );
  };

  const handleDeleteBalloon = (balloonId: string) => {
    if (currentDesign.balloons.length <= 1) return;
    const updatedBalloons = currentDesign.balloons.filter((b) => b.id !== balloonId);
    const toDrop = currentDesign.bubbles.map((b, i) => (b.balloonId === balloonId ? i : -1)).filter((i) => i >= 0);
    const res = deleteBubbles(updatedBalloons, currentDesign.bubbles, toDrop);
    commitDesignState(res.balloons, res.bubbles, 0, true);
    if (activeBalloonId === balloonId) setActiveBalloonId(updatedBalloons[0]?.id ?? null);
    showToast(toDrop.length ? `Removed balloon and its ${toDrop.length} bubbles.` : "Removed balloon.");
  };

  const handleUpdateBalloon = (balloonId: string, updated: Partial<BalloonSpec>) => {
    const updatedBalloons = currentDesign.balloons.map((b) =>
      b.id === balloonId ? { ...b, ...updated } : b
    );
    const updatedBubbles = currentDesign.bubbles.map((b) => {
      if (b.balloonId !== balloonId) return b;
      return {
        ...b,
        color: updated.color || b.color,
        diameterInches: updated.size ? defaultDiameterForSize(updated.size) : b.diameterInches,
      };
    });
    commitDesignState(updatedBalloons, updatedBubbles, undefined, false);
  };

  /* ---------------- stability ---------------- */

  const handleApplyAutoFix = useCallback(
    (fix: StabilityAutoFix) => {
      const res = applyStabilityAutoFix(currentDesign.balloons, currentDesign.bubbles, fix);
      commitDesignState(res.balloons, res.bubbles, undefined, false);
      showToast("Applied the fix. Steps updated.");
    },
    [commitDesignState, currentDesign.balloons, currentDesign.bubbles, showToast]
  );

  const handleAutoStabilizeAll = useCallback(() => {
    const res = autoStabilizeSculpture(currentDesign.balloons, currentDesign.bubbles);
    commitDesignState(res.balloons, res.bubbles, undefined, false);
    showToast(
      res.appliedCount > 0
        ? `Locked ${res.appliedCount} unstable seam${res.appliedCount > 1 ? "s" : ""}. The sculpture now holds hands-free.`
        : "The sculpture is already fully locked."
    );
  }, [commitDesignState, currentDesign.balloons, currentDesign.bubbles, showToast]);

  const handleUpdateStep = (index: number, updated: Partial<StepSpec>) => {
    const updatedSteps = [...currentDesign.steps];
    updatedSteps[index] = { ...updatedSteps[index], ...updated };
    setDesignTierMap((prev) => ({
      ...prev,
      [activeComplexity]: { ...currentDesign, steps: updatedSteps },
    }));
    showToast("Saved step note.");
  };

  /* ---------------- keyboard ---------------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedBubbleIndex !== null) {
        e.preventDefault();
        handleDeleteBubble(selectedBubbleIndex);
      } else if (e.key === "[") {
        handleSelectStep(currentStepIndex - 1);
      } else if (e.key === "]") {
        handleSelectStep(currentStepIndex + 1);
      } else if (e.key === "Escape") {
        handleClearSelection();
      } else if ((e.key === "a" || e.key === "A") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSelectMany(currentDesign.bubbles.map((_, i) => i));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    currentDesign.bubbles,
    currentStepIndex,
    handleClearSelection,
    handleDeleteBubble,
    handleSelectMany,
    handleSelectStep,
    selectedBubbleIndex,
  ]);

  /* ---------------- export / save ---------------- */

  const handleCapturePng = () => {
    setBuildMode("final");
    showToast("Rendering a clean high-res PNG…");
    setTimeout(() => {
      if (viewerRef.current) {
        const dataUrl = viewerRef.current.exportPng({ title: currentDesign.title });
        setCapturedPngUrl(dataUrl);
        setIsExportModalOpen(true);
      }
    }, 350);
  };

  /* ---------------- save / open (browser storage + JSON files) ---------------- */

  const refreshLibrary = useCallback(() => setSavedProjects(listProjects()), []);

  const handleSave = () => {
    const project = makeProject(designTierMap, activeComplexity, projectId ?? undefined, currentDesign.title);
    if (saveProject(project)) {
      setProjectId(project.id);
      refreshLibrary();
      showToast(`Saved “${project.title}” in this browser.`);
    } else {
      showToast("Could not save: browser storage is unavailable or full. Download the design as a file instead.");
    }
  };

  const handleDownloadJson = () => {
    downloadProjectJson(makeProject(designTierMap, activeComplexity, projectId ?? undefined, currentDesign.title));
    showToast("Design file downloaded.");
  };

  const applyProject = useCallback((project: SavedProject) => {
    setDesignTierMap(project.tiers);
    setActiveComplexity(project.activeComplexity);
    setProjectId(project.id);
    setBuildMode("step");
    const d = project.tiers[project.activeComplexity];
    setCurrentStepIndex(Math.max(0, d.steps.length - 1));
    setSelectedIndices(d.bubbles.length ? [0] : []);
    setActiveBalloonId(d.balloons[0]?.id ?? null);
  }, []);

  const handleOpenProject = (id: string) => {
    const project = loadProject(id);
    if (!project) {
      showToast("That design is no longer in this browser.");
      refreshLibrary();
      return;
    }
    applyProject(project);
    setIsNewDesignOpen(false);
    showToast(`Opened “${project.title}”.`);
  };

  const handleDeleteProject = (id: string) => {
    deleteProject(id);
    if (projectId === id) setProjectId(null);
    refreshLibrary();
  };

  const handleImportFile = async (file: File) => {
    try {
      const project = await readProjectFile(file);
      applyProject(project);
      setIsNewDesignOpen(false);
      showToast(`Imported “${project.title}”. Press Save to keep it in this browser.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not read that file.");
    }
  };

  const openNewDesign = () => {
    refreshLibrary();
    setIsNewDesignOpen(true);
  };

  // Ctrl/Cmd+S saves to the browser
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const untwistCount = liveSim.stability.untwistCount;
  const worstAir = airByBalloon.find((a) => a.air.status === "over_budget" || a.air.status === "pop_risk");

  return (
    <div className="flex min-h-screen flex-col text-slate-100 selection:bg-amber-400 selection:text-slate-950">
      {toastMessage && (
        <div className="hud fixed left-1/2 top-4 z-50 -translate-x-1/2 border-amber-400/40 px-4 py-2 text-sm font-medium text-amber-100">
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-2.5 md:px-6">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-300 via-rose-400 to-indigo-500 shadow ring-1 ring-white/10" />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-white">TwistCraft Studio</div>
              <div className="text-[11px] text-slate-500">Balloon twisting CAD</div>
            </div>
          </div>

          <div className="mx-2 hidden h-6 w-px bg-slate-800 md:block" />

          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">{currentDesign.title}</div>
              <div className="truncate text-[11px] text-slate-500">
                {bubbleCount} bubble{bubbleCount !== 1 ? "s" : ""} · {currentDesign.balloons.length} balloon
                {currentDesign.balloons.length !== 1 ? "s" : ""} · {currentDesign.steps.length} steps
              </div>
            </div>
            <ComplexityTierSelector
              designs={designTierMap}
              activeComplexity={activeComplexity}
              onSelectComplexity={(c) => {
                setActiveComplexity(c);
                setBuildMode("step");
                setCurrentStepIndex(Math.max(0, designTierMap[c].steps.length - 1));
                setSelectedIndices(designTierMap[c].bubbles.length ? [0] : []);
                setActiveBalloonId(designTierMap[c].balloons[0]?.id ?? null);
              }}
            />
          </div>

          <div className="flex items-center gap-1.5">
            <button onClick={openNewDesign} className="btn btn-primary">
              <Plus className="h-3.5 w-3.5" /> New / open
            </button>
            <button onClick={() => setIsEncyclopediaOpen(true)} className="btn btn-ghost" title="Twist encyclopedia">
              <BookOpen className="h-4 w-4" />
              <span className="hidden lg:inline">Twists</span>
            </button>
            <button onClick={handleSave} className="btn btn-ghost" title="Save in this browser (Ctrl/Cmd+S)">
              <Save className="h-4 w-4" />
              <span className="hidden lg:inline">Save</span>
            </button>
            <button onClick={handleDownloadJson} className="btn btn-ghost" title="Download the design as a file you can import on any device">
              <FileDown className="h-4 w-4" />
              <span className="hidden lg:inline">File</span>
            </button>
            <button onClick={handleCapturePng} className="btn btn-secondary" title="Export PNG & instruction card">
              <Download className="h-4 w-4" />
              <span className="hidden lg:inline">Export</span>
            </button>
          </div>
        </div>
      </header>

      {/* Workspace */}
      <main className="mx-auto w-full max-w-[1600px] flex-1 p-4 md:p-6">
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
          {/* Viewer */}
          <div className="space-y-4 xl:col-span-8">
            <div className="panel overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {untwistCount > 0 ? (
                    <span className="chip chip-danger">{untwistCount} twist{untwistCount > 1 ? "s" : ""} will unravel</span>
                  ) : (
                    <span className="chip chip-ok">Stable · {liveSim.stability.lockedJoints}/{liveSim.stability.totalJoints} joints locked</span>
                  )}
                  {worstAir ? (
                    <span className="chip chip-danger">
                      {worstAir.balloon.name}: {worstAir.air.status === "over_budget" ? "out of balloon" : "pop risk"}
                    </span>
                  ) : (
                    airByBalloon.map(({ balloon, air }) => (
                      <span key={balloon.id} className="chip chip-muted" title={air.statusMessage}>
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: balloon.color }} />
                        tail {air.tailRemainingInches}″ · {air.untwistedInches}″ untwisted
                      </span>
                    ))
                  )}
                </div>
                <button onClick={handleCapturePng} className="btn btn-ghost btn-xs">
                  <Camera className="h-3.5 w-3.5" /> Snapshot
                </button>
              </div>

              <div className="h-[600px] w-full">
                <ThreeBalloonViewer
                  ref={viewerRef}
                  balloons={currentDesign.balloons}
                  bubbles={currentDesign.bubbles}
                  steps={currentDesign.steps}
                  currentStepIndex={currentStepIndex}
                  buildMode={buildMode}
                  onBuildModeChange={setBuildMode}
                  onSelectStep={handleSelectStep}
                  selectedBubbleIndex={selectedBubbleIndex}
                  selectedBubbleIndices={validSelection}
                  onSelectBubble={handleSelectBubble}
                  onClearSelection={handleClearSelection}
                  onUpdateBubble={handleUpdateBubble}
                  onAddTwistPreset={handleAddTwistPreset}
                  onDeleteBubble={handleDeleteBubble}
                  onDuplicateBubble={handleDuplicateBubble}
                  onSplitBubble={handleSplitBubble}
                  onTwistTogether={handleTwistTogether}
                  onReleaseTwists={handleReleaseTwists}
                  onEqualizeLengths={handleEqualizeLengths}
                  onAddBalloon={handleAddBalloon}
                  onUpdateBalloon={handleUpdateBalloon}
                  activeBalloonId={activeBalloonId}
                  onSetActiveBalloon={setActiveBalloonId}
                  onApplyAutoFix={handleApplyAutoFix}
                  onAutoStabilizeAll={handleAutoStabilizeAll}
                  showLabels={showLabels}
                  onToggleLabels={() => setShowLabels((v) => !v)}
                  showGhost={showGhost}
                  onToggleGhost={() => setShowGhost((v) => !v)}
                  className="h-full w-full"
                />
              </div>
            </div>

            <StepPlaybackBar
              steps={currentDesign.steps}
              bubbles={currentDesign.bubbles}
              balloons={currentDesign.balloons}
              currentStepIndex={currentStepIndex}
              onSelectStep={handleSelectStep}
              buildMode={buildMode}
              onBuildModeChange={setBuildMode}
              showLabels={showLabels}
              onToggleLabels={() => setShowLabels((v) => !v)}
              showGhost={showGhost}
              onToggleGhost={() => setShowGhost((v) => !v)}
            />
          </div>

          {/* Side panel */}
          <div className="space-y-3 xl:col-span-4">
            <div className="panel flex items-center gap-1 p-1">
              <button
                onClick={() => setRightPanelTab("instructions")}
                className={`tab ${rightPanelTab === "instructions" ? "tab-active" : ""}`}
              >
                <ListOrdered className="h-4 w-4" /> Steps
                <span className="chip chip-muted ml-0.5 px-1.5">{currentDesign.steps.length}</span>
              </button>
              <button
                onClick={() => setRightPanelTab("cad_editor")}
                className={`tab ${rightPanelTab === "cad_editor" ? "tab-active" : ""}`}
              >
                <Layers className="h-4 w-4" /> Build
              </button>
              <button
                onClick={() => setRightPanelTab("telemetry")}
                className={`tab ${rightPanelTab === "telemetry" ? "tab-active" : ""} ${
                  untwistCount > 0 && rightPanelTab !== "telemetry" ? "text-rose-300" : ""
                }`}
              >
                <Scale className="h-4 w-4" /> Stability &amp; air
                {untwistCount > 0 && <span className="chip chip-danger ml-0.5 px-1.5">{untwistCount}</span>}
              </button>
            </div>

            {rightPanelTab === "instructions" && (
              <InstructionStepDeck
                steps={currentDesign.steps}
                balloons={currentDesign.balloons}
                bubbles={currentDesign.bubbles}
                currentStepIndex={currentStepIndex}
                onSelectStep={handleSelectStep}
                onSelectBubble={(i) => handleSelectBubble(i)}
                onUpdateStep={handleUpdateStep}
                onOpenTwistInfo={() => setIsEncyclopediaOpen(true)}
                onExportInstructions={handleCapturePng}
              />
            )}

            {rightPanelTab === "cad_editor" && (
              <BalloonDesignEditor
                balloons={currentDesign.balloons}
                bubbles={currentDesign.bubbles}
                selectedBubbleIndex={selectedBubbleIndex}
                selectedBubbleIndices={validSelection}
                activeBalloonId={activeBalloonId}
                onSetActiveBalloon={setActiveBalloonId}
                onSelectBubble={handleSelectBubble}
                onUpdateBubble={(idx, upd) => handleUpdateBubble(idx, upd, false)}
                onAddBubble={(balloonId) => handleAddTwistPreset("basic", undefined, balloonId)}
                onDeleteBubble={handleDeleteBubble}
                onMoveBubble={handleMoveBubble}
                onSplitBubble={handleSplitBubble}
                onTwistTogether={handleTwistTogether}
                onAddBalloon={handleAddBalloon}
                onDeleteBalloon={handleDeleteBalloon}
                onUpdateBalloon={handleUpdateBalloon}
                onOpenTwistModal={() => setIsEncyclopediaOpen(true)}
                onStartBlankSlate={handleStartBlankSlate}
              />
            )}

            {rightPanelTab === "telemetry" && (
              <div className="space-y-3">
                <div className="panel p-4">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <h3 className="panel-title">Twist stability</h3>
                      <p className="panel-sub">
                        Every seam is checked for a self-locking mechanism: lock pairs, pinch and toe
                        twists, loops, bird bodies, apple links and tied knots.
                      </p>
                    </div>
                    {!liveSim.stability.isStable && (
                      <button onClick={handleAutoStabilizeAll} className="btn btn-success shrink-0">
                        <Wrench className="h-3.5 w-3.5" /> Lock all
                      </button>
                    )}
                  </div>

                  {liveSim.stability.issues.length === 0 ? (
                    <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3.5 text-xs text-emerald-100">
                      <div className="font-semibold text-emerald-200">
                        Fully locked: {liveSim.stability.lockedJoints}/{liveSim.stability.totalJoints} joints anchored
                      </div>
                      <div className="mt-0.5 text-emerald-200/80">
                        Nothing will spin open when you let go. Use “Let go” in the viewport to see it hold.
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {liveSim.stability.issues.map((issue) => (
                        <div
                          key={issue.id}
                          className={`space-y-1 rounded-xl border p-3 text-xs ${
                            issue.severity === "will_untwist"
                              ? "border-rose-400/30 bg-rose-400/10 text-rose-100"
                              : "border-amber-400/30 bg-amber-400/10 text-amber-100"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold">{issue.title}</span>
                            <button
                              onClick={() => handleApplyAutoFix(issue.fix)}
                              className="btn btn-success btn-xs shrink-0"
                            >
                              {issue.fixLabel}
                            </button>
                          </div>
                          <p className="opacity-85">{issue.explanation}</p>
                          <p className="font-medium opacity-90">When released: {issue.whatHappensWhenReleased}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="panel p-4">
                  <h3 className="panel-title">Air budget</h3>
                  <p className="panel-sub mb-3">
                    Each bubble uses up inflated balloon. Each twist squeezes air forward into the
                    uninflated tail, so the tail shrinks as you build.
                    {stepVisibility ? " Showing the state at the current step." : ""}
                  </p>
                  <div className="space-y-3">
                    {currentDesign.balloons.map((bal) => (
                      <TailAllowanceMeter
                        key={bal.id}
                        balloon={bal}
                        bubbles={currentDesign.bubbles}
                        formed={stepVisibility?.formed ?? null}
                        onUpdateBalloon={handleUpdateBalloon}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-900 px-6 py-4 text-center text-xs text-slate-600">
        TwistCraft Studio · 160 / 260 / 360 twisters · 17 twist formations · simulation-compiled instructions
      </footer>

      <NewDesignModal
        isOpen={isNewDesignOpen}
        onClose={() => setIsNewDesignOpen(false)}
        onDesignsGenerated={handleDesignsGenerated}
        onStartBlankSlate={handleStartBlankSlate}
        projects={savedProjects}
        onOpenProject={handleOpenProject}
        onDeleteProject={handleDeleteProject}
        onImportFile={handleImportFile}
      />

      <TwistEncyclopediaModal
        isOpen={isEncyclopediaOpen}
        onClose={() => setIsEncyclopediaOpen(false)}
        onSelectTwist={(t) => {
          if (selectedBubbleIndex === null) return;
          handleUpdateBubble(selectedBubbleIndex, { twistType: t, ...twistFlags(t) });
          showToast(`Bubble #${selectedBubbleIndex + 1} is now a ${t.replace(/_/g, " ")} twist.`);
        }}
      />

      <ExportCardModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        design={currentDesign}
        pngDataUrl={capturedPngUrl}
      />
    </div>
  );
}
