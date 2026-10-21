"use client";

import React, { useState } from "react";
import { ArrowLeft, ArrowRight, Info, Lightbulb, Pencil, Printer, ShoppingCart, StickyNote, Trash2 } from "lucide-react";
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
  /** Open the shopping page with this design's balloons as a recipe */
  onShopDesign?: () => void;
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
  onShopDesign,
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
    if (currentStep.stabilityWarning) return { text: "Unanchored — will untwist", cls: "chip-danger" };
    switch (currentStep.jointAction) {
      case "hold":
        return { text: "Keep holding this seam", cls: "chip-accent" };
      case "lock":
        return { text: "Self-locking joint", cls: "chip-ok" };
      case "attach_balloon":
        return { text: "Tie balloon into joint", cls: "chip-info" };
      case "inflate":
        return { text: "Inflate & burp", cls: "chip-info" };
      default:
        return { text: "Locked & complete", cls: "chip-ok" };
    }
  })();

  return (
    <div className="space-y-3">
      {/* Materials */}
      <div className="panel p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h3 className="panel-title">Materials &amp; inflation</h3>
            <p className="panel-sub">
              {balloons.length} balloon{balloons.length !== 1 ? "s" : ""} · {bubbles.length} bubbles
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {onShopDesign && (
              <button onClick={onShopDesign} className="btn btn-secondary btn-xs" title="Price these balloons and plan packs">
                <ShoppingCart className="h-3.5 w-3.5" /> Shop
              </button>
            )}
            {onExportInstructions && (
              <button onClick={onExportInstructions} className="btn btn-secondary btn-xs">
                <Printer className="h-3.5 w-3.5" /> Sheet / PNG
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {balloons.map((bal, idx) => {
            const onBal = bubbles.filter((b) => b.balloonId === bal.id);
            const totalIn = onBal.reduce((s, b) => s + (b.lengthInches || 0), 0);
            return (
              <div
                key={bal.id || idx}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/20" style={{ backgroundColor: bal.color }} />
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-white">
                      {bal.size} {bal.colorName || "Twister"}
                    </div>
                    <div className="truncate text-[11px] text-slate-500">
                      {bal.name} · {onBal.length} bubble{onBal.length !== 1 ? "s" : ""} · {totalIn.toFixed(1)}″
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-amber-200">
                    {bal.tailFingers ?? 5} fingers ({bal.tailLengthInches ?? 4}″) tail
                  </div>
                  <div className="text-[11px] text-slate-500">burp before tying</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {steps.map((st, idx) => (
          <button
            key={st.stepId || idx}
            onClick={() => {
              setIsEditing(false);
              onSelectStep(idx);
            }}
            className={`btn btn-xs shrink-0 whitespace-nowrap ${
              currentStepIndex === idx ? "btn-primary" : st.stabilityWarning ? "btn-danger" : "btn-secondary"
            }`}
            title={st.title}
          >
            {idx + 1}
            {st.jointAction === "hold" && currentStepIndex !== idx ? <span className="opacity-60">· hold</span> : null}
          </button>
        ))}
        {onAddStep && (
          <button onClick={onAddStep} className="btn btn-ghost btn-xs shrink-0 border border-dashed border-slate-700">
            + Step
          </button>
        )}
      </div>

      {/* Current step */}
      {currentStep && (
        <div className="panel space-y-4 p-4">
          <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="chip chip-accent">
                  Step {currentStepIndex + 1} of {steps.length}
                </span>
                {twistInfo && (
                  <button
                    onClick={() => onOpenTwistInfo && onOpenTwistInfo(currentStep.twistType)}
                    className="chip chip-info hover:bg-cyan-400/20"
                    title="Open the twist guide"
                  >
                    {twistInfo.name} <Info className="h-3 w-3" />
                  </button>
                )}
                {actionPill && <span className={`chip ${actionPill.cls}`}>{actionPill.text}</span>}
                <span className="font-mono text-[11px] text-slate-500">{currentStep.balloonSize}</span>
              </div>
              {!isEditing ? (
                <h4 className="mt-2 text-base font-semibold text-white">{currentStep.title}</h4>
              ) : (
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="input mt-2 font-semibold"
                />
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {!isEditing ? (
                <button onClick={handleStartEdit} className="btn btn-secondary btn-xs">
                  <Pencil className="h-3.5 w-3.5" /> Annotate
                </button>
              ) : (
                <>
                  <button onClick={handleSaveEdit} className="btn btn-success btn-xs">
                    Save
                  </button>
                  <button onClick={() => setIsEditing(false)} className="btn btn-ghost btn-xs">
                    Cancel
                  </button>
                </>
              )}
              {onDeleteStep && steps.length > 1 && (
                <button onClick={() => onDeleteStep(currentStepIndex)} className="btn btn-ghost btn-icon text-rose-300" title="Delete this step">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Diagram */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="label mb-0">Step diagram</span>
              {currentStep.bubbleIndices.length > 0 && onSelectBubble && (
                <div className="flex items-center gap-1">
                  {currentStep.bubbleIndices.map((bi) => (
                    <button
                      key={bi}
                      onClick={() => onSelectBubble(bi)}
                      className="btn btn-ghost btn-xs font-mono text-cyan-300"
                      title="Select this bubble in the 3D view"
                    >
                      #{bi + 1}
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

          {(currentStep.stabilityWarning || currentStep.handStateNote) && (
            <div
              className={`rounded-xl border p-3 text-xs font-medium ${
                currentStep.stabilityWarning
                  ? "border-rose-400/30 bg-rose-400/10 text-rose-100"
                  : currentStep.jointAction === "hold"
                  ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
                  : "border-cyan-400/30 bg-cyan-400/10 text-cyan-100"
              }`}
            >
              {(currentStep.stabilityWarning || currentStep.handStateNote || "").replace(/^[^\w]+/, "")}
            </div>
          )}

          {currentStep.warning && (
            <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-xs font-medium text-rose-100">
              {currentStep.warning}
            </div>
          )}

          <div>
            <div className="label">Instructions</div>
            {!isEditing ? (
              <p className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 text-sm leading-relaxed text-slate-200">
                {currentStep.description}
              </p>
            ) : (
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                className="input"
              />
            )}
          </div>

          <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5">
              <div className="text-[11px] text-slate-500">Measurement</div>
              <div className="mt-0.5 font-mono font-semibold text-amber-200">
                {currentStep.measurementText || "Standard bubble"}
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5">
              <div className="text-[11px] text-slate-500">Untwisted balloon left</div>
              <div className="mt-0.5 font-mono font-semibold text-emerald-200">
                {currentStep.remainingInflatedInches !== undefined
                  ? currentStep.remainingInflatedInches > 0.05
                    ? `${currentStep.remainingInflatedInches}″`
                    : "Fully twisted"
                  : "—"}
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5">
              <div className="text-[11px] text-slate-500">Uninflated tail left</div>
              <div className="mt-0.5 font-mono font-semibold text-cyan-200">
                {currentStep.tailRemainingInches?.toFixed(1) ?? "—"}″ · {currentStep.tailRemainingFingers ?? "—"} fingers
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-xs text-emerald-100">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            <div className="flex-1">
              <strong>Pro tip: </strong>
              {!isEditing ? (
                <span>{currentStep.tips || "Keep bubble pressure consistent across twists."}</span>
              ) : (
                <input type="text" value={editTips} onChange={(e) => setEditTips(e.target.value)} className="input input-sm mt-1" />
              )}
            </div>
          </div>

          <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs">
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-amber-200">
                <StickyNote className="h-3.5 w-3.5" /> Your notes
              </div>
              {!isEditing && (
                <button onClick={handleStartEdit} className="text-[11px] text-amber-200 hover:underline">
                  Edit
                </button>
              )}
            </div>
            {!isEditing ? (
              <p className="italic text-slate-400">
                {currentStep.annotation ||
                  "No notes yet. Add busking tips, kid patter or reinforcement notes; they stick to this step when you resize bubbles."}
              </p>
            ) : (
              <textarea
                value={editAnnotation}
                onChange={(e) => setEditAnnotation(e.target.value)}
                placeholder="Add notes for this step…"
                rows={2}
                className="input input-sm mt-1"
              />
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => onSelectStep(Math.max(0, currentStepIndex - 1))}
              disabled={currentStepIndex === 0}
              className="btn btn-secondary"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Previous
            </button>
            <span className="font-mono text-xs text-slate-500">
              {currentStepIndex + 1} / {steps.length}
            </span>
            <button
              onClick={() => onSelectStep(Math.min(steps.length - 1, currentStepIndex + 1))}
              disabled={currentStepIndex === steps.length - 1}
              className="btn btn-primary"
            >
              Next <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
