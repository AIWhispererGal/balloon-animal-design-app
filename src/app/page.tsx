"use client";

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  ComplexityLevel,
  FullDesign,
  BubbleSpec,
  StepSpec,
  BalloonSpec,
  BalloonSize,
  StabilityAutoFix,
} from "@/types/balloon";
import { PRESET_DESIGNS } from "@/lib/balloonPresets";
import {
  generateStepsFromSimulation,
  createBlankSlateDesign,
} from "@/lib/stepGenerator";
import {
  computeBalloonLayout,
  applyStabilityAutoFix,
  autoStabilizeSculpture,
  defaultDiameterForSize,
} from "@/lib/balloonLayout";
import {
  ThreeBalloonViewer,
  ThreeBalloonViewerRef,
  BuildViewMode,
  AddTwistPresetKind,
} from "@/components/ThreeBalloonViewer";
import { StepPlaybackBar } from "@/components/StepPlaybackBar";
import { PromptImageConverter } from "@/components/PromptImageConverter";
import { ComplexityTierSelector } from "@/components/ComplexityTierSelector";
import { InstructionStepDeck } from "@/components/InstructionStepDeck";
import { BalloonDesignEditor } from "@/components/BalloonDesignEditor";
import { TwistEncyclopediaModal } from "@/components/TwistEncyclopediaModal";
import { ExportCardModal } from "@/components/ExportCardModal";
import { TailAllowanceMeter } from "@/components/TailAllowanceMeter";

export default function BalloonAppPage() {
  const [designTierMap, setDesignTierMap] = useState<Record<ComplexityLevel, FullDesign>>(
    PRESET_DESIGNS.dog
  );
  const [activeComplexity, setActiveComplexity] = useState<ComplexityLevel>("beginner");
  const [currentStepIndex, setCurrentStepIndex] = useState(
    () => PRESET_DESIGNS.dog.beginner.steps.length - 1
  );
  const [selectedBubbleIndex, setSelectedBubbleIndex] = useState<number>(0);
  const [buildMode, setBuildMode] = useState<BuildViewMode>("step");
  const [showLabels, setShowLabels] = useState(true);
  const [showGhost, setShowGhost] = useState(false);

  const [rightPanelTab, setRightPanelTab] = useState<
    "instructions" | "cad_editor" | "telemetry"
  >("instructions");

  const [isEncyclopediaOpen, setIsEncyclopediaOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [capturedPngUrl, setCapturedPngUrl] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const viewerRef = useRef<ThreeBalloonViewerRef>(null);

  const currentDesign = designTierMap[activeComplexity] || PRESET_DESIGNS.dog.beginner;

  const liveSim = useMemo(
    () => computeBalloonLayout(currentDesign.balloons, currentDesign.bubbles),
    [currentDesign.balloons, currentDesign.bubbles]
  );

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
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

  /** Central atomic commit: ALWAYS regenerates steps directly from the 3D simulation! */
  const commitDesignState = useCallback(
    (
      nextBalloons: BalloonSpec[],
      nextBubblesRaw: BubbleSpec[],
      focusBubbleIdx?: number,
      jumpToFocusStep = false
    ) => {
      const balloonColors = new Map(nextBalloons.map((balloon) => [balloon.id, balloon.color]));
      const nextBubbles = nextBubblesRaw.map((bubble, index) => ({
        ...bubble,
        index,
        color: balloonColors.get(bubble.balloonId) ?? bubble.color,
      }));
      const nextSteps = generateStepsFromSimulation(
        nextBalloons,
        nextBubbles,
        currentDesign.steps
      );
      const updatedDesign: FullDesign = {
        ...currentDesign,
        balloons: nextBalloons,
        balloonCount: nextBalloons.length,
        bubbles: nextBubbles,
        bubbleCount: nextBubbles.length,
        steps: nextSteps,
      };
      setDesignTierMap((prev) => ({ ...prev, [activeComplexity]: updatedDesign }));

      const targetBubble =
        focusBubbleIdx !== undefined
          ? Math.max(0, Math.min(focusBubbleIdx, nextBubbles.length - 1))
          : Math.min(selectedBubbleIndex, nextBubbles.length - 1);
      setSelectedBubbleIndex(targetBubble);

      if (jumpToFocusStep && buildMode === "step") {
        setCurrentStepIndex(stepIndexForBubble(updatedDesign, targetBubble));
      } else {
        setCurrentStepIndex((prev) => Math.max(0, Math.min(prev, nextSteps.length - 1)));
      }
      return updatedDesign;
    },
    [activeComplexity, buildMode, currentDesign, selectedBubbleIndex, stepIndexForBubble]
  );

  const handleSelectBubble = useCallback(
    (idx: number) => {
      setSelectedBubbleIndex(idx);
      if (buildMode === "step") {
        setCurrentStepIndex((prev) => {
          // Ensure selected bubble is visible in step mode (never ahead of current step)
          const needed = stepIndexForBubble(currentDesign, idx);
          return prev < needed ? needed : needed;
        });
      }
    },
    [buildMode, currentDesign, stepIndexForBubble]
  );

  const handleSelectStep = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(idx, currentDesign.steps.length - 1));
      setBuildMode("step");
      setCurrentStepIndex(clamped);
      const first = currentDesign.steps[clamped]?.bubbleIndices[0];
      if (first !== undefined) setSelectedBubbleIndex(first);
    },
    [currentDesign]
  );

  const handleDesignsGenerated = (
    newDesigns: Record<ComplexityLevel, FullDesign>,
    promptOrLabel: string
  ) => {
    setDesignTierMap(newDesigns);
    setBuildMode("step");
    setCurrentStepIndex(Math.max(0, newDesigns[activeComplexity].steps.length - 1));
    setSelectedBubbleIndex(0);
    showToast(`Generated 3 tiers for "${promptOrLabel}" — scrub steps or press ▶ Play Build!`);
  };

  const handleStartBlankSlate = () => {
    const blankDesigns = createBlankSlateDesign();
    setDesignTierMap(blankDesigns);
    setActiveComplexity("beginner");
    setBuildMode("step");
    setCurrentStepIndex(Math.max(0, blankDesigns.beginner.steps.length - 1));
    setSelectedBubbleIndex(0);
    showToast(
      "Blank Slate ready! Click or drag twists inside the 3D viewport to build from scratch."
    );
  };

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
          if (updated.color !== undefined) {
            updatedBubbles[partnerIdx].color = updated.color;
          }
        }
      }

      const structural = "twistType" in updated || "balloonId" in updated;
      commitDesignState(currentDesign.balloons, updatedBubbles, index, structural);
    },
    [commitDesignState, currentDesign.balloons, currentDesign.bubbles, liveSim.layouts]
  );

  /** Add any twist formation right inside the 3D viewport (single bubble, 2-lock pair, 3-roll bird body, etc.)! */
  const handleAddTwistPreset = useCallback(
    (preset: AddTwistPresetKind, afterBubbleIndex?: number) => {
      const insertAt =
        afterBubbleIndex !== undefined
          ? Math.min(Math.max(-1, afterBubbleIndex) + 1, currentDesign.bubbles.length)
          : currentDesign.bubbles.length;
      const refBubble =
        currentDesign.bubbles[Math.max(0, insertAt - 1)] || currentDesign.bubbles[0];
      const bal =
        currentDesign.balloons.find((b) => b.id === refBubble?.balloonId) ||
        currentDesign.balloons[0];
      const diam = refBubble?.diameterInches || defaultDiameterForSize(bal.size);
      const col = refBubble?.color || bal.color;
      const uid = () => `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      let toInsert: BubbleSpec[] = [];
      switch (preset) {
        case "lock_pair":
          toInsert = [
            {
              id: uid(),
              balloonId: bal.id,
              index: 0,
              label: "Lock Bubble A",
              lengthInches: 3.25,
              diameterInches: diam,
              twistType: "lock",
              color: col,
              bend: 65,
              turn: 12,
            },
            {
              id: uid(),
              balloonId: bal.id,
              index: 0,
              label: "Lock Bubble B",
              lengthInches: 3.25,
              diameterInches: diam,
              twistType: "lock",
              color: col,
            },
          ];
          break;
        case "bird_body":
          toInsert = [
            {
              id: uid(),
              balloonId: bal.id,
              index: 0,
              label: "Bird Rail 1",
              lengthInches: 4.5,
              diameterInches: diam,
              twistType: "bird_body",
              color: col,
            },
            {
              id: uid(),
              balloonId: bal.id,
              index: 0,
              label: "Bird Rail 2",
              lengthInches: 4.5,
              diameterInches: diam,
              twistType: "bird_body",
              color: col,
            },
            {
              id: uid(),
              balloonId: bal.id,
              index: 0,
              label: "Bird Roll Center",
              lengthInches: 4.5,
              diameterInches: diam,
              twistType: "bird_body",
              color: col,
            },
          ];
          break;
        case "tulip":
          toInsert = [
            {
              id: uid(),
              balloonId: bal.id,
              index: 0,
              label: "Tulip / Apple Bubble",
              lengthInches: 2.5,
              diameterInches: diam,
              twistType: "tulip",
              isTulip: true,
              color: col,
            },
            {
              id: uid(),
              balloonId: bal.id,
              index: 0,
              label: "Tulip Lock Pinch",
              lengthInches: 1.0,
              diameterInches: diam,
              twistType: "pinch",
              isPinch: true,
              color: col,
            },
          ];
          break;
        case "pinch":
          toInsert = [
            {
              id: uid(),
              balloonId: bal.id,
              index: 0,
              label: "Pinch Twist",
              lengthInches: 1.1,
              diameterInches: diam,
              twistType: "pinch",
              isPinch: true,
              color: col,
            },
          ];
          break;
        case "toe":
          toInsert = [
            {
              id: uid(),
              balloonId: bal.id,
              index: 0,
              label: "Toe Twist Paw",
              lengthInches: 0.9,
              diameterInches: Math.max(0.9, diam * 0.75),
              twistType: "toe",
              isPinch: true,
              color: col,
            },
          ];
          break;
        case "loop":
          toInsert = [
            {
              id: uid(),
              balloonId: bal.id,
              index: 0,
              label: "Loop Petal",
              lengthInches: 5.0,
              diameterInches: diam,
              twistType: "loop",
              isLoop: true,
              color: col,
            },
          ];
          break;
        case "spiral":
          toInsert = [
            {
              id: uid(),
              balloonId: bal.id,
              index: 0,
              label: "Spiral Coil",
              lengthInches: 5.5,
              diameterInches: diam,
              twistType: "spiral",
              color: col,
            },
          ];
          break;
        case "s_hook":
          toInsert = [
            {
              id: uid(),
              balloonId: bal.id,
              index: 0,
              label: "S-Hook Curve",
              lengthInches: 4.5,
              diameterInches: diam,
              twistType: "s_hook",
              color: col,
              bend: 45,
            },
          ];
          break;
        case "z_bend":
          toInsert = [
            {
              id: uid(),
              balloonId: bal.id,
              index: 0,
              label: "Z-Bend Segment",
              lengthInches: 5.0,
              diameterInches: diam,
              twistType: "z_bend",
              color: col,
            },
          ];
          break;
        case "side_bubble":
          toInsert = [
            {
              id: uid(),
              balloonId: bal.id,
              index: 0,
              label: "Side Bubble",
              lengthInches: 4.5,
              diameterInches: diam,
              twistType: "side_bubble",
              color: col,
            },
          ];
          break;
        case "cut_tail_bubbles":
          toInsert = [
            {
              id: uid(),
              balloonId: bal.id,
              index: 0,
              label: "Pom-Pom Tip Bead",
              lengthInches: 1.25,
              diameterInches: diam * 1.1,
              twistType: "cut_tail_bubbles",
              color: col,
            },
          ];
          break;
        default:
          toInsert = [
            {
              id: uid(),
              balloonId: bal.id,
              index: 0,
              label: `Bubble ${insertAt + 1}`,
              lengthInches: 3.0,
              diameterInches: diam,
              twistType: "basic",
              color: col,
            },
          ];
      }

      const idMap = new Map<number, string>();
      currentDesign.bubbles.forEach((b, i) => idMap.set(i, b.id));

      const nextBubbles = [...currentDesign.bubbles];
      nextBubbles.splice(insertAt, 0, ...toInsert);

      // Remap any index anchors (`lockToBubbleStart`, `branchFrom`, `attachTo`) safely across insertions
      const newIndexById = new Map<string, number>();
      nextBubbles.forEach((b, i) => newIndexById.set(b.id, i));
      nextBubbles.forEach((b) => {
        if (b.lockToBubbleStart !== undefined) {
          const refId = idMap.get(b.lockToBubbleStart);
          if (refId && newIndexById.has(refId)) b.lockToBubbleStart = newIndexById.get(refId);
        }
        if (b.branchFrom) {
          const refId = idMap.get(b.branchFrom.bubbleIndex);
          if (refId && newIndexById.has(refId)) {
            b.branchFrom = { ...b.branchFrom, bubbleIndex: newIndexById.get(refId)! };
          }
        }
      });
      const nextBalloons = currentDesign.balloons.map((bl) => {
        if (!bl.attachTo) return bl;
        const refId = idMap.get(bl.attachTo.bubbleIndex);
        return refId && newIndexById.has(refId)
          ? { ...bl, attachTo: { ...bl.attachTo, bubbleIndex: newIndexById.get(refId)! } }
          : bl;
      });

      commitDesignState(nextBalloons, nextBubbles, insertAt, true);
      showToast(`Added ${preset.replace(/_/g, " ")} — step instructions updated automatically!`);
    },
    [commitDesignState, currentDesign.balloons, currentDesign.bubbles, showToast]
  );

  const handleDuplicateBubble = useCallback(
    (index: number) => {
      const src = currentDesign.bubbles[index];
      if (!src) return;
      const clone: BubbleSpec = {
        ...src,
        id: `b-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        label: `${src.label} (copy)`,
        lockToBubbleStart: undefined,
      };
      const nextBubbles = [...currentDesign.bubbles];
      nextBubbles.splice(index + 1, 0, clone);
      commitDesignState(currentDesign.balloons, nextBubbles, index + 1, true);
      showToast(`Duplicated "${src.label}"`);
    },
    [commitDesignState, currentDesign.balloons, currentDesign.bubbles, showToast]
  );

  const handleAddBubble = (balloonId?: string) => {
    const assignedBal =
      currentDesign.balloons.find((b) => b.id === balloonId) || currentDesign.balloons[0];
    const newBubble: BubbleSpec = {
      id: `b-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      balloonId: assignedBal.id,
      index: currentDesign.bubbles.length,
      label: `Bubble ${currentDesign.bubbles.length + 1}`,
      lengthInches: 3.0,
      diameterInches: defaultDiameterForSize(assignedBal.size),
      twistType: "basic",
      color: assignedBal.color,
    };
    commitDesignState(
      currentDesign.balloons,
      [...currentDesign.bubbles, newBubble],
      currentDesign.bubbles.length,
      true
    );
    showToast("Added bubble — steps updated!");
  };

  const handleDeleteBubble = useCallback(
    (index: number) => {
      if (currentDesign.bubbles.length <= 1) return;
      const removedId = currentDesign.bubbles[index]?.id;
      const idByOldIndex = new Map<number, string>();
      currentDesign.bubbles.forEach((b, i) => idByOldIndex.set(i, b.id));

      const nextBubbles = currentDesign.bubbles
        .filter((_, i) => i !== index)
        .map((b) => ({ ...b }));
      const newIdxById = new Map<string, number>();
      nextBubbles.forEach((b, i) => newIdxById.set(b.id, i));

      nextBubbles.forEach((b) => {
        if (b.lockToBubbleStart !== undefined) {
          const refId = idByOldIndex.get(b.lockToBubbleStart);
          b.lockToBubbleStart =
            refId && refId !== removedId ? newIdxById.get(refId) : undefined;
        }
        if (b.branchFrom) {
          const refId = idByOldIndex.get(b.branchFrom.bubbleIndex);
          b.branchFrom =
            refId && refId !== removedId && newIdxById.has(refId)
              ? { ...b.branchFrom, bubbleIndex: newIdxById.get(refId)! }
              : undefined;
        }
      });

      const nextBalloons = currentDesign.balloons.map((bl) => {
        if (!bl.attachTo) return bl;
        const refId = idByOldIndex.get(bl.attachTo.bubbleIndex);
        return {
          ...bl,
          attachTo:
            refId && refId !== removedId && newIdxById.has(refId)
              ? { ...bl.attachTo, bubbleIndex: newIdxById.get(refId)! }
              : { bubbleIndex: 0, end: "end" as const },
        };
      });

      commitDesignState(nextBalloons, nextBubbles, Math.max(0, index - 1), true);
      showToast("Removed bubble — stability & step instructions recalculated!");
    },
    [commitDesignState, currentDesign.balloons, currentDesign.bubbles, showToast]
  );

  const handleMoveBubble = (index: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= currentDesign.bubbles.length) return;
    const list = [...currentDesign.bubbles];
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;
    commitDesignState(currentDesign.balloons, list, targetIdx, true);
  };

  const handleAddBalloon = (size: BalloonSize, colorHex: string, colorName: string) => {
    const anchorIdx = Math.max(
      0,
      Math.min(selectedBubbleIndex, currentDesign.bubbles.length - 1)
    );
    const newBalId = `bal-${Date.now()}`;
    const newBal: BalloonSpec = {
      id: newBalId,
      name: `Accent ${size} Balloon`,
      size,
      color: colorHex,
      colorName,
      inflatedLengthInches: 46,
      tailLengthInches: 14,
      tailFingers: 6,
      burpNote: "Burp 1 puff before tying into joint.",
      order: currentDesign.balloons.length + 1,
      attachTo: { bubbleIndex: anchorIdx, end: "end" },
    };
    const starterBubble: BubbleSpec = {
      id: `b-${Date.now()}-newbal`,
      balloonId: newBalId,
      index: currentDesign.bubbles.length,
      label: `${size} Accent Loop`,
      lengthInches: size === "160" ? 3.5 : 4.5,
      diameterInches: defaultDiameterForSize(size),
      twistType: "loop",
      isLoop: true,
      color: colorHex,
    };
    commitDesignState(
      [...currentDesign.balloons, newBal],
      [...currentDesign.bubbles, starterBubble],
      currentDesign.bubbles.length,
      true
    );
    showToast(`Attached ${size} ${colorName} balloon at Bubble #${anchorIdx + 1}!`);
  };

  const handleDeleteBalloon = (balloonId: string) => {
    if (currentDesign.balloons.length <= 1) return;
    const updatedBalloons = currentDesign.balloons.filter((b) => b.id !== balloonId);
    const fallbackBal = updatedBalloons[0];
    const updatedBubbles = currentDesign.bubbles.map((b) =>
      b.balloonId === balloonId
        ? { ...b, balloonId: fallbackBal.id, color: fallbackBal.color }
        : b
    );
    commitDesignState(updatedBalloons, updatedBubbles, 0, true);
    showToast("Removed balloon & reassigned its bubbles");
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
        diameterInches: updated.size
          ? defaultDiameterForSize(updated.size)
          : b.diameterInches,
      };
    });
    commitDesignState(updatedBalloons, updatedBubbles, selectedBubbleIndex, false);
  };

  const handleApplyAutoFix = useCallback(
    (fix: StabilityAutoFix) => {
      const res = applyStabilityAutoFix(currentDesign.balloons, currentDesign.bubbles, fix);
      commitDesignState(res.balloons, res.bubbles, selectedBubbleIndex, false);
      showToast("🔧 Applied stability lock — step instructions synced!");
    },
    [commitDesignState, currentDesign.balloons, currentDesign.bubbles, selectedBubbleIndex, showToast]
  );

  const handleAutoStabilizeAll = useCallback(() => {
    const res = autoStabilizeSculpture(currentDesign.balloons, currentDesign.bubbles);
    commitDesignState(res.balloons, res.bubbles, selectedBubbleIndex, false);
    showToast(
      res.appliedCount > 0
        ? `✅ Locked ${res.appliedCount} unstable seam${res.appliedCount > 1 ? "s" : ""}! Sculpture holds shape hands-free.`
        : "✅ Sculpture is already 100% mechanically locked!"
    );
  }, [commitDesignState, currentDesign.balloons, currentDesign.bubbles, selectedBubbleIndex, showToast]);

  const handleUpdateStep = (index: number, updated: Partial<StepSpec>) => {
    const updatedSteps = [...currentDesign.steps];
    updatedSteps[index] = { ...updatedSteps[index], ...updated };
    setDesignTierMap((prev) => ({
      ...prev,
      [activeComplexity]: {
        ...currentDesign,
        steps: updatedSteps,
      },
    }));
    showToast("Saved step note!");
  };

  // Keyboard shortcuts for snappy 3D sculpting (`Delete` removes bubble, `[` / `]` steps build)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        handleDeleteBubble(selectedBubbleIndex);
      } else if (e.key === "[") {
        handleSelectStep(currentStepIndex - 1);
      } else if (e.key === "]") {
        handleSelectStep(currentStepIndex + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentStepIndex, handleDeleteBubble, handleSelectStep, selectedBubbleIndex]);

  const handleCapturePng = () => {
    setBuildMode("final");
    showToast("Rendering clean high-res 3D Latex PNG…");
    setTimeout(() => {
      if (viewerRef.current) {
        const dataUrl = viewerRef.current.exportPng({ title: currentDesign.title });
        setCapturedPngUrl(dataUrl);
        setIsExportModalOpen(true);
      }
    }, 350);
  };

  const handleSaveToDatabase = async () => {
    try {
      showToast("Saving design to database...");
      const res = await fetch("/api/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: currentDesign.id,
          title: currentDesign.title,
          description: currentDesign.description,
          category: currentDesign.category,
          complexity: currentDesign.complexity,
          balloons: currentDesign.balloons,
          bubbles: currentDesign.bubbles,
          steps: currentDesign.steps,
          annotations: currentDesign.annotations,
          sourceType: currentDesign.sourceType,
          sourcePrompt: currentDesign.sourcePrompt,
        }),
      });

      if (res.ok) {
        showToast("✅ Design saved to database!");
      } else {
        showToast("Error saving design to database.");
      }
    } catch {
      showToast("Failed to connect to database API.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-slate-950 font-bold px-4 py-2 rounded-xl shadow-2xl border border-amber-300 flex items-center gap-2 text-xs sm:text-sm">
          <span>🎈</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 py-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-500 flex items-center justify-center text-xl shadow-lg ring-2 ring-white/10">
            🎈
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-wide text-white">TwistCraft Studio</h1>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                3D Latex Physics &amp; Step Compiler
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Sculpt directly inside the 3D Smooth Latex Simulation (160 / 260 / 360) · Live untwist physics · Auto-compiled step instructions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsEncyclopediaOpen(true)}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5"
          >
            <span>📖</span>
            <span>Twist Encyclopedia</span>
          </button>

          <button
            onClick={handleStartBlankSlate}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 text-xs font-semibold border border-amber-500/30 transition flex items-center gap-1.5"
          >
            <span>✨</span>
            <span>Blank Slate</span>
          </button>

          <button
            onClick={handleSaveToDatabase}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5"
          >
            <span>💾</span>
            <span>Save</span>
          </button>

          <button
            onClick={handleCapturePng}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 shadow-lg"
          >
            <span>📸</span>
            <span>Export Nice PNG</span>
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto p-4 md:p-6 space-y-6">
        {/* 1. Item / Image -> 3 Balloon Tiers Converter */}
        <PromptImageConverter
          onDesignsGenerated={handleDesignsGenerated}
          onStartBlankSlate={handleStartBlankSlate}
        />

        {/* 2. Three Complexity Tiers */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Three Complexity Levels (Judged by Bubbles &amp; Balloons)
            </h2>
            <span className="text-xs text-slate-400 font-mono">
              Active Tier: <strong className="text-amber-400 capitalize">{activeComplexity}</strong> ·{" "}
              {currentDesign.bubbles.length} bubbles · {currentDesign.balloons.length} balloon
              {currentDesign.balloons.length !== 1 ? "s" : ""} · {currentDesign.steps.length} steps
            </span>
          </div>
          <ComplexityTierSelector
            designs={designTierMap}
            activeComplexity={activeComplexity}
            onSelectComplexity={(c) => {
              setActiveComplexity(c);
              setBuildMode("step");
              setCurrentStepIndex(Math.max(0, designTierMap[c].steps.length - 1));
              setSelectedBubbleIndex(0);
            }}
          />
        </div>

        {/* 3. Side-by-Side Interactive 3D Smooth Latex Studio + Synchronized Step Instructions */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: 3D Smooth Latex Simulation with built-in drag handles, drag-drop twist palette & physics */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-xl space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg shrink-0">🎈</span>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-white truncate">{currentDesign.title}</h3>
                    <div className="text-[11px] text-slate-400">
                      Drag <span className="text-cyan-400 font-semibold">cyan cone</span> to resize length ·{" "}
                      <span className="text-pink-400 font-semibold">pink dot</span> for diameter ·{" "}
                      <span className="text-amber-400 font-semibold">gold gem</span> to bend/turn · drag twist chips onto any bubble!
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleCapturePng}
                  className="text-xs px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition font-bold shrink-0"
                >
                  📸 Snapshot PNG
                </button>
              </div>

              <div className="w-full h-[585px]">
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
                  onSelectBubble={handleSelectBubble}
                  onUpdateBubble={handleUpdateBubble}
                  onAddTwistPreset={handleAddTwistPreset}
                  onDeleteBubble={handleDeleteBubble}
                  onDuplicateBubble={handleDuplicateBubble}
                  onAddBalloon={handleAddBalloon}
                  onUpdateBalloon={handleUpdateBalloon}
                  onApplyAutoFix={handleApplyAutoFix}
                  onAutoStabilizeAll={handleAutoStabilizeAll}
                  showLabels={showLabels}
                  onToggleLabels={() => setShowLabels((v) => !v)}
                  showGhost={showGhost}
                  onToggleGhost={() => setShowGhost((v) => !v)}
                />
              </div>
            </div>

            {/* Step Build Playback Transport */}
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

          {/* RIGHT: Auto-Compiled Step Instructions + Sequence CAD + Stability & Tail Physics */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between bg-slate-900 p-1.5 rounded-xl border border-slate-800 gap-1">
              <div className="flex flex-wrap items-center gap-1">
                <button
                  onClick={() => setRightPanelTab("instructions")}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    rightPanelTab === "instructions"
                      ? "bg-amber-500 text-slate-950 shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <span>🪜</span>
                  <span>Step Instructions ({currentDesign.steps.length})</span>
                </button>

                <button
                  onClick={() => setRightPanelTab("cad_editor")}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    rightPanelTab === "cad_editor"
                      ? "bg-amber-500 text-slate-950 shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <span>🛠️</span>
                  <span>Sequence &amp; Balloons</span>
                </button>

                <button
                  onClick={() => setRightPanelTab("telemetry")}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    rightPanelTab === "telemetry"
                      ? "bg-amber-500 text-slate-950 shadow"
                      : !liveSim.stability.isStable
                      ? "bg-rose-950/70 text-rose-300 border border-rose-500/40"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <span>{liveSim.stability.isStable ? "⚖️" : "⚠️"}</span>
                  <span>
                    Stability &amp; Tail
                    {!liveSim.stability.isStable ? ` (${liveSim.stability.untwistCount})` : ""}
                  </span>
                </button>
              </div>
            </div>

            {rightPanelTab === "instructions" && (
              <InstructionStepDeck
                steps={currentDesign.steps}
                balloons={currentDesign.balloons}
                bubbles={currentDesign.bubbles}
                currentStepIndex={currentStepIndex}
                onSelectStep={handleSelectStep}
                onSelectBubble={handleSelectBubble}
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
                onSelectBubble={handleSelectBubble}
                onUpdateBubble={(idx, upd) => handleUpdateBubble(idx, upd, false)}
                onAddBubble={handleAddBubble}
                onDeleteBubble={handleDeleteBubble}
                onMoveBubble={handleMoveBubble}
                onAddBalloon={handleAddBalloon}
                onDeleteBalloon={handleDeleteBalloon}
                onUpdateBalloon={handleUpdateBalloon}
                onOpenTwistModal={() => setIsEncyclopediaOpen(true)}
                onStartBlankSlate={handleStartBlankSlate}
              />
            )}

            {rightPanelTab === "telemetry" && (
              <div className="space-y-4">
                {/* Physical Twist Stability Rules Audit Panel */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-sm text-white">
                        Twist Stability &amp; Untwist Physics Audit
                      </h3>
                      <p className="text-xs text-slate-400">
                        Checks every seam for self-locking mechanics (Lock Pairs, Pinch/Toe Twists, Loops, 3-Bubble Bird Bodies, Apple Links &amp; Tied Knots).
                      </p>
                    </div>
                    {!liveSim.stability.isStable && (
                      <button
                        onClick={handleAutoStabilizeAll}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow shrink-0"
                      >
                        🔧 Lock All ({liveSim.stability.issues.length})
                      </button>
                    )}
                  </div>

                  {liveSim.stability.issues.length === 0 ? (
                    <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-3.5 text-xs text-emerald-200 flex items-center gap-3">
                      <span className="text-2xl">🔒</span>
                      <div>
                        <div className="font-bold text-emerald-300">
                          100% Mechanically Stable ({liveSim.stability.lockedJoints}/{liveSim.stability.totalJoints} joints anchored)
                        </div>
                        <div className="text-emerald-200/80 mt-0.5">
                          No twists will spin open or unravel when you release your hands. Click &ldquo;🖐️ Test Let Go&rdquo; in the 3D viewport to verify!
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {liveSim.stability.issues.map((issue) => (
                        <div
                          key={issue.id}
                          className={`rounded-xl p-3 border text-xs space-y-1.5 ${
                            issue.severity === "will_untwist"
                              ? "bg-rose-950/35 border-rose-500/50 text-rose-100"
                              : "bg-amber-950/30 border-amber-500/40 text-amber-100"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold">
                              {issue.severity === "will_untwist" ? "⚠️ " : "⚡ "}
                              {issue.title}
                            </span>
                            <button
                              onClick={() => handleApplyAutoFix(issue.fix)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] shrink-0 transition"
                            >
                              🔧 {issue.fixLabel}
                            </button>
                          </div>
                          <p className="text-[11px] opacity-85">{issue.explanation}</p>
                          <p className="text-[11px] font-semibold text-amber-300">
                            When hands release: {issue.whatHappensWhenReleased}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Balloon Tail Capacity Gauges */}
                {currentDesign.balloons.map((bal) => (
                  <TailAllowanceMeter
                    key={bal.id}
                    balloon={bal}
                    bubbles={currentDesign.bubbles}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="mt-auto border-t border-slate-900 bg-slate-950/80 px-6 py-5 text-center text-xs text-slate-500">
        <div className="flex flex-wrap items-center justify-center gap-4 mb-1">
          <span>Standard Twister Sizes: 160, 260, 360</span>
          <span>•</span>
          <span>17 Twist Formations</span>
          <span>•</span>
          <span>Real Twist Stability &amp; Untwist Physics</span>
          <span>•</span>
          <span>1:1 Simulation-Compiled Step Instructions</span>
        </div>
        <p>TwistCraft Studio © 2026.</p>
      </footer>

      <TwistEncyclopediaModal
        isOpen={isEncyclopediaOpen}
        onClose={() => setIsEncyclopediaOpen(false)}
        onSelectTwist={(t) => {
          handleUpdateBubble(selectedBubbleIndex, {
            twistType: t,
            isLoop: t === "loop",
            isPinch: t === "pinch" || t === "toe",
            isTulip: t === "tulip" || t === "tulip_chain",
          });
          showToast(`Changed Bubble #${selectedBubbleIndex + 1} to ${t} twist!`);
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
