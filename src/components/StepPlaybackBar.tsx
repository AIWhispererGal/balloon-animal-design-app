"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Ghost, Hash, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { BalloonSpec, BubbleSpec, StepSpec } from "@/types/balloon";
import { TWIST_ENCYCLOPEDIA } from "@/lib/balloonConstants";
import { getStepVisibility } from "@/lib/balloonLayout";
import { computeAirBudget } from "@/lib/balloonAir";
import type { BuildViewMode } from "./ThreeBalloonViewer";

interface StepPlaybackBarProps {
  steps: StepSpec[];
  bubbles: BubbleSpec[];
  balloons: BalloonSpec[];
  currentStepIndex: number;
  onSelectStep: (index: number) => void;
  buildMode: BuildViewMode;
  onBuildModeChange: (mode: BuildViewMode) => void;
  showLabels: boolean;
  onToggleLabels: () => void;
  showGhost: boolean;
  onToggleGhost: () => void;
}

/**
 * Playback transport beneath the 3D viewport. In step mode the model shows
 * only the bubbles formed so far plus the untwisted remainder and shrinking
 * tail of each balloon; final mode shows the finished sculpture.
 */
export const StepPlaybackBar: React.FC<StepPlaybackBarProps> = ({
  steps,
  bubbles,
  balloons,
  currentStepIndex,
  onSelectStep,
  buildMode,
  onBuildModeChange,
  showLabels,
  onToggleLabels,
  showGhost,
  onToggleGhost,
}) => {
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const lastIndex = Math.max(0, steps.length - 1);
  const step = steps[currentStepIndex];
  const twist = step ? TWIST_ENCYCLOPEDIA[step.twistType] : null;
  const vis = getStepVisibility(steps, bubbles, balloons, currentStepIndex);

  useEffect(() => {
    if (!playing) return;
    timerRef.current = setInterval(() => {
      if (currentStepIndex >= lastIndex) {
        setPlaying(false);
        return;
      }
      onSelectStep(currentStepIndex + 1);
    }, 2000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing, currentStepIndex, lastIndex, onSelectStep]);

  const handlePlay = () => {
    onBuildModeChange("step");
    if (currentStepIndex >= lastIndex) onSelectStep(0);
    setPlaying((p) => !p);
  };

  const goTo = (i: number) => {
    setPlaying(false);
    onBuildModeChange("step");
    onSelectStep(Math.max(0, Math.min(lastIndex, i)));
  };

  return (
    <div className="panel space-y-3 p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="seg">
          <button
            onClick={() => onBuildModeChange("step")}
            className={`seg-item ${buildMode === "step" ? "seg-item-active" : ""}`}
            title="Show the sculpture being built one step at a time"
          >
            Step by step
          </button>
          <button
            onClick={() => {
              setPlaying(false);
              onBuildModeChange("final");
            }}
            className={`seg-item ${buildMode === "final" ? "seg-item-active" : ""}`}
            title="Show the finished balloon shape"
          >
            Final shape
          </button>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => goTo(0)} disabled={currentStepIndex === 0} className="btn btn-ghost btn-icon" title="First step">
            <SkipBack className="h-4 w-4" />
          </button>
          <button onClick={() => goTo(currentStepIndex - 1)} disabled={currentStepIndex === 0} className="btn btn-ghost btn-icon" title="Previous step ( [ )">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={handlePlay} className={`btn ${playing ? "btn-danger" : "btn-primary"} min-w-[96px]`} title={playing ? "Pause" : "Play the whole build"}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {playing ? "Pause" : "Play build"}
          </button>
          <button onClick={() => goTo(currentStepIndex + 1)} disabled={currentStepIndex >= lastIndex} className="btn btn-ghost btn-icon" title="Next step ( ] )">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button onClick={() => goTo(lastIndex)} disabled={currentStepIndex >= lastIndex} className="btn btn-ghost btn-icon" title="Finished sculpture">
            <SkipForward className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div>
        <input
          type="range"
          min={0}
          max={lastIndex}
          step={1}
          value={currentStepIndex}
          onChange={(e) => goTo(parseInt(e.target.value))}
          className="range"
          title="Scrub through the build steps"
        />
        <div className="-mt-0.5 flex justify-between text-[11px] text-slate-500">
          <span>Inflated balloon</span>
          <span className="font-mono text-slate-400">
            Step {currentStepIndex + 1} of {steps.length} · {vis.formed.size}/{bubbles.length} bubbles formed
          </span>
          <span>Finished shape</span>
        </div>
      </div>

      {step && buildMode === "step" && (
        <div className="space-y-1 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-white">{step.title}</span>
            {twist && <span className="chip chip-info">{twist.name}</span>}
            <span className="font-mono text-[11px] text-amber-200">{step.measurementText}</span>
          </div>
          <p className="line-clamp-2 leading-relaxed text-slate-400">{step.description}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
            {balloons.map((bal) => {
              if (!vis.introducedBalloons.has(bal.id)) return null;
              const air = computeAirBudget(bal, bubbles, vis.formed);
              return (
                <span key={bal.id} className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full border border-white/20" style={{ backgroundColor: bal.color }} />
                  {bal.size}: <strong className="text-slate-300">{air.untwistedInches}″</strong> untwisted ·{" "}
                  <strong className={air.status === "pop_risk" || air.status === "over_budget" ? "text-rose-300" : "text-slate-300"}>
                    {air.tailRemainingInches}″
                  </strong>{" "}
                  tail
                </span>
              );
            })}
            <span className="text-amber-300/80">glowing = forming in this step</span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          <Eye className="h-3.5 w-3.5" /> Overlays
        </span>
        <button onClick={onToggleLabels} className={`btn btn-xs ${showLabels ? "btn-active" : "btn-secondary"}`} title="Number each bubble in 3D to match the instructions">
          <Hash className="h-3.5 w-3.5" /> Bubble numbers
        </button>
        <button onClick={onToggleGhost} className={`btn btn-xs ${showGhost ? "btn-active" : "btn-secondary"}`} title="Preview the next three construction steps">
          <Ghost className="h-3.5 w-3.5" /> Next-step preview
        </button>
      </div>
    </div>
  );
};
