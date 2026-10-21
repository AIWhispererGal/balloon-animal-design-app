"use client";

import React, { useState } from "react";
import { BalloonSpec, BubbleSpec, StepSpec, TwistType } from "@/types/balloon";
import { StepVisualDiagram } from "./StepVisualDiagram";
import { TWIST_ENCYCLOPEDIA } from "@/lib/balloonConstants";

interface InstructionStepDeckProps {
  steps: StepSpec[];
  balloons: BalloonSpec[];
  bubbles?: BubbleSpec[];
  currentStepIndex: number;
  onSelectStep: (index: number) => void;
  onSelectBubble?: (bubbleIndex: number) => void;
  onUpdateStep: (index: number, updated: Partial<StepSpec>) => void;
  onAddStep?: () => void;
  onDeleteStep?: (index: number) => void;
  onOpenTwistInfo?: (twistType: TwistType) => void;
  onExportInstructions?: () => void;
}

export const InstructionStepDeck: React.FC<InstructionStepDeckProps> = ({
  steps,
  balloons,
  bubbles = [],
  currentStepIndex,
  onSelectStep,
  onSelectBubble,
  onUpdateStep,
  onAddStep,
  onDeleteStep,
  onOpenTwistInfo,
  onExportInstructions,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAnnotation, setEditAnnotation] = useState("");
  const [editTips, setEditTips] = useState("");

  const currentStep = steps[currentStepIndex] || steps[0];

  const handleStartEdit = () => {
    if (!currentStep) return;
    setEditTitle(currentStep.title);
    setEditDescription(currentStep.description);
    setEditAnnotation(currentStep.annotation || "");
    setEditTips(currentStep.tips || "");
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    onUpdateStep(currentStepIndex, {
      title: editTitle,
      description: editDescription,
      annotation: editAnnotation,
      tips: editTips,
    });
    setIsEditing(false);
  };

  const twistInfo = currentStep ? TWIST_ENCYCLOPEDIA[currentStep.twistType] : null;

  const actionPill = (() => {
    if (!currentStep) return null;
    if (currentStep.stabilityWarning) {
      return {
        text: "⚠️ Unanchored — Untwists!",
        cls: "bg-rose-500/20 text-rose-300 border-rose-500/40",
      };
    }
    switch (currentStep.jointAction) {
      case "hold":
        return {
          text: "✋ Keep Holding Seam",
          cls: "bg-amber-500/20 text-amber-300 border-amber-500/40",
        };
      case "lock":
        return {
          text: "🔒 Self-Locking Joint",
          cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
        };
      case "attach_balloon":
        return {
          text: "🪢 Tie Balloon Into Joint",
          cls: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
        };
      case "inflate":
        return {
          text: "🎈 Inflate & Burp",
          cls: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40",
        };
      default:
        return {
          text: "✨ Locked & Complete",
          cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
        };
    }
  })();

  return (
    <div className="space-y-4">
      {/* Bill of Materials (BOM) & Inflation Guide Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">📋</span>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                Materials &amp; Inflation Specifications
              </h3>
              <p className="text-[11px] text-slate-400">
                100% synced live from the 3D Smooth Latex Simulation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-amber-400 font-semibold font-mono">
              {balloons.length} Balloon{balloons.length !== 1 ? "s" : ""} · {bubbles.length} Bubbles
            </span>
            {onExportInstructions && (
              <button
                onClick={onExportInstructions}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-amber-300 border border-amber-500/30 transition"
              >
                🖨️ Sheet / PNG
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {balloons.map((bal, idx) => {
            const countOnBal = bubbles.filter((b) => b.balloonId === bal.id).length;
            const totalIn = bubbles
              .filter((b) => b.balloonId === bal.id)
              .reduce((s, b) => s + (b.lengthInches || 0), 0);
            return (
              <div
                key={bal.id || idx}
                className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-4 h-4 rounded-full border border-white/20 shrink-0 shadow-sm"
                    style={{ backgroundColor: bal.color }}
                  />
                  <div>
                    <div className="font-semibold text-white">
                      {bal.size} {bal.colorName || "Twister"}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {bal.name} · {countOnBal} bubble{countOnBal !== 1 ? "s" : ""} ({totalIn.toFixed(1)}″)
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-amber-400 font-bold">
                    Leave {bal.tailFingers ?? 5} fingers ({bal.tailLengthInches ?? 4}″) tail
                  </div>
                  <div className="text-[10px] text-slate-500">Burp before tying</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Navigator Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {steps.map((st, idx) => (
          <button
            key={st.stepId || idx}
            onClick={() => {
              setIsEditing(false);
              onSelectStep(idx);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition border flex items-center gap-1 ${
              currentStepIndex === idx
                ? "bg-amber-500 border-amber-400 text-slate-950 shadow-md font-bold"
                : st.stabilityWarning
                ? "bg-rose-950/60 border-rose-500/60 text-rose-300 hover:bg-rose-900/60"
                : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800"
            }`}
          >
            {st.stabilityWarning ? <span>⚠️</span> : st.jointAction === "hold" ? <span>✋</span> : null}
            <span>Step {idx + 1}</span>
          </button>
        ))}

        {onAddStep && (
          <button
            onClick={onAddStep}
            className="px-2.5 py-1.5 rounded-lg text-xs bg-slate-900 hover:bg-slate-800 border border-dashed border-slate-700 text-slate-400 hover:text-white transition"
            title="Add Custom Twisting Step"
          >
            + Add Step
          </button>
        )}
      </div>

      {/* Active Step Detailed Card */}
      {currentStep && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
          {/* Step Header */}
          <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  Step {currentStepIndex + 1} of {steps.length}
                </span>

                {twistInfo && (
                  <button
                    onClick={() => onOpenTwistInfo && onOpenTwistInfo(currentStep.twistType)}
                    className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-800/50 flex items-center gap-1 transition"
                    title="Click to inspect twist technique reference"
                  >
                    <span>🔄 {twistInfo.name}</span>
                    <span className="text-[10px] text-cyan-500">ℹ️</span>
                  </button>
                )}

                {actionPill && (
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${actionPill.cls}`}>
                    {actionPill.text}
                  </span>
                )}

                <span className="text-xs text-slate-400 font-mono">
                  {currentStep.balloonSize} Twister
                </span>
              </div>

              {!isEditing ? (
                <h4 className="text-lg font-bold text-white mt-1.5">{currentStep.title}</h4>
              ) : (
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full mt-1.5 px-3 py-1.5 bg-slate-950 border border-amber-500 rounded text-white text-base font-bold"
                />
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!isEditing ? (
                <button
                  onClick={handleStartEdit}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition flex items-center gap-1.5 border border-slate-700"
                >
                  <span>✏️</span>
                  <span>Annotate</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleSaveEdit}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs transition"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {onDeleteStep && steps.length > 1 && (
                <button
                  onClick={() => onDeleteStep(currentStepIndex)}
                  className="p-1.5 rounded-lg bg-rose-950/30 hover:bg-rose-900/50 text-rose-400 text-xs transition border border-rose-900/40"
                  title="Delete this step"
                >
                  🗑️
                </button>
              )}
            </div>
          </div>

          {/* Live 2D CAD Diagram Synced Directly from 3D Simulation */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              <span>Simulated Step Diagram (Matches 3D Viewport 1:1)</span>
              {currentStep.bubbleIndices.length > 0 && onSelectBubble && (
                <div className="flex items-center gap-1 normal-case">
                  {currentStep.bubbleIndices.map((bi) => (
                    <button
                      key={bi}
                      onClick={() => onSelectBubble(bi)}
                      className="px-2 py-0.5 rounded bg-cyan-950/80 hover:bg-cyan-500 hover:text-slate-950 text-cyan-300 text-[10px] font-mono border border-cyan-800/60 transition"
                      title="Select this bubble in the 3D viewport to resize/bend it"
                    >
                      Select #{bi + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <StepVisualDiagram
              twistType={currentStep.twistType}
              diagramType={currentStep.diagramSvgType}
              balloonColor={currentStep.balloonColor || "#EA580C"}
              balloonSize={currentStep.balloonSize || "260"}
              bubbleLabels={currentStep.bubbleLabels}
              tailRemainingInches={currentStep.tailRemainingInches}
              balloons={balloons}
              bubbles={bubbles}
              steps={steps}
              stepIndex={currentStepIndex}
              className="h-48"
            />
          </div>

          {/* Hand-Hold / Stability Physics Callout */}
          {(currentStep.stabilityWarning || currentStep.handStateNote) && (
            <div
              className={`rounded-xl p-3 text-xs font-medium border ${
                currentStep.stabilityWarning
                  ? "bg-rose-950/40 border-rose-500/50 text-rose-200"
                  : currentStep.jointAction === "hold"
                  ? "bg-amber-950/35 border-amber-500/40 text-amber-200"
                  : "bg-cyan-950/25 border-cyan-700/40 text-cyan-200"
              }`}
            >
              {currentStep.stabilityWarning || currentStep.handStateNote}
            </div>
          )}

          {/* Step Action Description */}
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Step Instructions
            </div>
            {!isEditing ? (
              <p className="text-sm text-slate-200 leading-relaxed bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                {currentStep.description}
              </p>
            ) : (
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                className="w-full p-3 bg-slate-950 border border-amber-500 rounded-xl text-white text-sm"
              />
            )}
          </div>

          {/* Measurement, Untwisted Inflated Left, & Tail Gauge Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400">Bubble Measurement:</span>
              <div className="font-mono font-bold text-amber-300 mt-0.5">
                {currentStep.measurementText || "Standard bubble"}
              </div>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400">Untwisted Tube Left:</span>
              <div className="font-mono font-bold text-emerald-300 mt-0.5">
                {currentStep.remainingInflatedInches !== undefined
                  ? currentStep.remainingInflatedInches > 0.05
                    ? `${currentStep.remainingInflatedInches}″ remaining`
                    : "Fully twisted ✓"
                  : "—"}
              </div>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400">Uninflated Tail Left:</span>
              <div className="font-mono font-bold text-cyan-300 mt-0.5">
                ~{currentStep.tailRemainingFingers ?? 4} fingers ({currentStep.tailRemainingInches?.toFixed(1) ?? 3.5}″)
              </div>
            </div>
          </div>

          {/* Twister Pro Tip */}
          <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-xl p-3 text-xs text-emerald-300 flex items-start gap-2">
            <span className="text-base shrink-0">💡</span>
            <div className="flex-1">
              <strong>Twister Pro Tip: </strong>
              {!isEditing ? (
                <span>{currentStep.tips || "Maintain consistent bubble pressure across twists."}</span>
              ) : (
                <input
                  type="text"
                  value={editTips}
                  onChange={(e) => setEditTips(e.target.value)}
                  className="w-full mt-1 px-2 py-1 bg-slate-950 border border-emerald-500 rounded text-white text-xs"
                />
              )}
            </div>
          </div>

          {/* Designer Annotation Box */}
          <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-3.5 text-xs">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-400">
                <span>📝</span>
                <span>Designer&apos;s Custom Annotation &amp; Performance Notes</span>
              </div>
              {!isEditing && (
                <button
                  onClick={handleStartEdit}
                  className="text-[11px] text-amber-300 hover:underline"
                >
                  Edit Note
                </button>
              )}
            </div>

            {!isEditing ? (
              <p className="text-slate-300 italic">
                {currentStep.annotation ||
                  "No custom annotation yet. Click 'Annotate' to add busking tips, kid patter, or reinforcement notes (preserved automatically when resizing bubbles!)."}
              </p>
            ) : (
              <textarea
                value={editAnnotation}
                onChange={(e) => setEditAnnotation(e.target.value)}
                placeholder="Add custom notes (e.g. squeak balloon, party humor, twist reinforcement)..."
                rows={2}
                className="w-full mt-1 p-2 bg-slate-950 border border-amber-500 rounded-lg text-white text-xs"
              />
            )}
          </div>

          {/* Prev / Next */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => onSelectStep(Math.max(0, currentStepIndex - 1))}
              disabled={currentStepIndex === 0}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                currentStepIndex === 0
                  ? "bg-slate-800/50 text-slate-500 cursor-not-allowed"
                  : "bg-slate-800 hover:bg-slate-700 text-white"
              }`}
            >
              <span>←</span>
              <span>Previous Step</span>
            </button>

            <span className="text-xs text-slate-400 font-mono">
              Step {currentStepIndex + 1} of {steps.length}
            </span>

            <button
              onClick={() => onSelectStep(Math.min(steps.length - 1, currentStepIndex + 1))}
              disabled={currentStepIndex === steps.length - 1}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                currentStepIndex === steps.length - 1
                  ? "bg-slate-800/50 text-slate-500 cursor-not-allowed"
                  : "bg-amber-500 hover:bg-amber-400 text-slate-950"
              }`}
            >
              <span>Next Step</span>
              <span>→</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
