"use client";

import React, { useEffect, useRef, useState } from "react";
import { BalloonSpec, BubbleSpec, StepSpec } from "@/types/balloon";
import { TWIST_ENCYCLOPEDIA } from "@/lib/balloonConstants";
import { getStepVisibility } from "@/lib/balloonLayout";
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
 * Playback controls rendered directly beneath the 3D viewport. In
 * "Step-by-Step Build" mode the 3D model shows only the bubbles formed so
 * far (plus the still-un-twisted remainder of each balloon trailing from
 * the last joint). In "Final Shape" mode it shows the finished sculpture.
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

  const remainingInches = balloons.map((bal) => ({
    bal,
    inches: bubbles
      .filter((b, i) => b.balloonId === bal.id && !vis.formed.has(i))
      .reduce((s, b) => s + (b.lengthInches || 0), 0),
  }));

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
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-3">
      {/* Mode toggle + playback transport */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg overflow-hidden border border-slate-700 bg-slate-950">
          <button
            onClick={() => onBuildModeChange("step")}
            className={`px-3 py-1.5 text-xs font-bold transition ${
              buildMode === "step"
                ? "bg-amber-500 text-slate-950"
                : "text-slate-400 hover:text-white"
            }`}
            title="Show the sculpture being built one step at a time in 3D"
          >
            🪜 Step-by-Step Build
          </button>
          <button
            onClick={() => {
              setPlaying(false);
              onBuildModeChange("final");
            }}
            className={`px-3 py-1.5 text-xs font-bold transition ${
              buildMode === "final"
                ? "bg-emerald-500 text-slate-950"
                : "text-slate-400 hover:text-white"
            }`}
            title="Show the finished balloon shape"
          >
            ★ Final Shape
          </button>
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => goTo(0)}
            disabled={currentStepIndex === 0}
            className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs disabled:opacity-30 transition"
            title="Back to inflated balloon (Step 1)"
          >
            ⏮
          </button>
          <button
            onClick={() => goTo(currentStepIndex - 1)}
            disabled={currentStepIndex === 0}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold disabled:opacity-30 transition"
            title="Previous step"
          >
            ◀ Prev
          </button>
          <button
            onClick={handlePlay}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition shadow ${
              playing
                ? "bg-rose-500 hover:bg-rose-400 text-white"
                : "bg-amber-500 hover:bg-amber-400 text-slate-950"
            }`}
            title={playing ? "Pause the build animation" : "Play the whole build in 3D"}
          >
            {playing ? "⏸ Pause" : "▶ Play Build"}
          </button>
          <button
            onClick={() => goTo(currentStepIndex + 1)}
            disabled={currentStepIndex >= lastIndex}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold disabled:opacity-30 transition"
            title="Next step"
          >
            Next ▶
          </button>
          <button
            onClick={() => goTo(lastIndex)}
            disabled={currentStepIndex >= lastIndex}
            className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs disabled:opacity-30 transition"
            title="Jump to finished sculpture"
          >
            ⏭
          </button>
        </div>
      </div>

      {/* Step scrubber */}
      <div>
        <input
          type="range"
          min={0}
          max={lastIndex}
          step={1}
          value={currentStepIndex}
          onChange={(e) => goTo(parseInt(e.target.value))}
          className="w-full accent-amber-500 cursor-pointer"
          title="Scrub through the build steps"
        />
        <div className="flex justify-between text-[10px] text-slate-500 -mt-0.5">
          <span>🎈 Inflated balloon</span>
          <span className="font-mono text-slate-400">
            Step {currentStepIndex + 1} of {steps.length} · {vis.formed.size}/{bubbles.length} bubbles formed
          </span>
          <span>★ Finished shape</span>
        </div>
      </div>

      {/* Current step summary (mirrors the 3D state above) */}
      {step && buildMode === "step" && (
        <div className="bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-2 text-xs space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-white">{step.title}</span>
            {twist && (
              <span className="px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/60 text-[10px] font-semibold">
                🔄 {twist.name}
              </span>
            )}
            <span className="text-amber-300 font-mono text-[11px]">{step.measurementText}</span>
          </div>
          <p className="text-slate-400 leading-relaxed line-clamp-2">{step.description}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
            {remainingInches.map(({ bal, inches }) =>
              vis.introducedBalloons.has(bal.id) ? (
                <span key={bal.id} className="flex items-center gap-1">
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-white/20"
                    style={{ backgroundColor: bal.color }}
                  />
                  {bal.size}:{" "}
                  {inches > 0.05 ? (
                    <>
                      <strong className="text-slate-300">{inches.toFixed(1)}″</strong> still un-twisted
                    </>
                  ) : (
                    <span className="text-emerald-400">fully twisted ✓</span>
                  )}
                </span>
              ) : null
            )}
            <span className="text-amber-400/80">🟡 glowing = forming in this step</span>
          </div>
        </div>
      )}

      {/* Viewer display toggles */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mr-1">
          3D overlays:
        </span>
        <button
          onClick={onToggleLabels}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${
            showLabels
              ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
              : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
          }`}
          title="Number each bubble in 3D to match the instructions"
        >
          🔢 Bubble numbers
        </button>
        <button
          onClick={onToggleGhost}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${
            showGhost
              ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
              : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
          }`}
          title="Preview the next three construction steps: next is strongest, farther steps fade"
        >
          👻 Next-step forecast
        </button>
      </div>
    </div>
  );
};
