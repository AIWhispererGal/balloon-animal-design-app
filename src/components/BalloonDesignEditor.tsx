"use client";

import React, { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Info,
  Link2,
  Plus,
  Sparkles,
  Trash2,
  Unlink,
} from "lucide-react";
import { BalloonSize, BalloonSpec, BubbleSpec, TwistType } from "@/types/balloon";
import { TWIST_ENCYCLOPEDIA } from "@/lib/balloonConstants";
import { SplitMode, twistFlags } from "@/lib/designEdits";
import { AddBalloonPopover, AddBalloonRequest } from "./AddBalloonPopover";
import { ColorPicker } from "./ColorPicker";
import { SplitMenu } from "./SplitMenu";

interface BalloonDesignEditorProps {
  balloons: BalloonSpec[];
  bubbles: BubbleSpec[];
  selectedBubbleIndex: number | null;
  selectedBubbleIndices: number[];
  activeBalloonId: string | null;
  onSetActiveBalloon: (id: string | null) => void;
  onSelectBubble: (index: number, additive?: boolean) => void;
  onUpdateBubble: (index: number, updated: Partial<BubbleSpec>) => void;
  onAddBubble: (balloonId?: string) => void;
  onDeleteBubble: (index: number) => void;
  onMoveBubble: (index: number, direction: "up" | "down") => void;
  onSplitBubble: (index: number, mode: SplitMode) => void;
  onTwistTogether: (indices: number[]) => void;
  onAddBalloon: (req: AddBalloonRequest) => void;
  onDeleteBalloon: (balloonId: string) => void;
  onUpdateBalloon: (balloonId: string, updated: Partial<BalloonSpec>) => void;
  onOpenTwistModal?: (twistType?: TwistType) => void;
  onStartBlankSlate?: () => void;
  className?: string;
}

export const BalloonDesignEditor: React.FC<BalloonDesignEditorProps> = ({
  balloons,
  bubbles,
  selectedBubbleIndex,
  selectedBubbleIndices,
  activeBalloonId,
  onSetActiveBalloon,
  onSelectBubble,
  onUpdateBubble,
  onAddBubble,
  onDeleteBubble,
  onMoveBubble,
  onSplitBubble,
  onTwistTogether,
  onAddBalloon,
  onDeleteBalloon,
  onUpdateBalloon,
  onOpenTwistModal,
  onStartBlankSlate,
  className = "",
}) => {
  const [activeTab, setActiveTab] = useState<"bubbles" | "balloons">("bubbles");

  const selectedBubble =
    selectedBubbleIndex !== null && selectedBubbleIndex < bubbles.length
      ? bubbles[selectedBubbleIndex]
      : null;
  const selIdx = selectedBubbleIndex ?? 0;
  const selectedBalloon = selectedBubble
    ? balloons.find((balloon) => balloon.id === selectedBubble.balloonId)
    : balloons.find((b) => b.id === activeBalloonId) ?? balloons[0];
  const multi = selectedBubbleIndices.length > 1;
  const sortedSel = [...selectedBubbleIndices].sort((a, b) => a - b);
  const adjacent = sortedSel.every((v, k) => k === 0 || v === sortedSel[k - 1] + 1);
  const usedColors = balloons.map((b) => b.color);

  return (
    <div className={`panel flex flex-col overflow-hidden ${className}`}>
      <div className="panel-header">
        <div className="seg">
          <button
            onClick={() => setActiveTab("bubbles")}
            className={`seg-item ${activeTab === "bubbles" ? "seg-item-active" : ""}`}
          >
            Bubbles · {bubbles.length}
          </button>
          <button
            onClick={() => setActiveTab("balloons")}
            className={`seg-item ${activeTab === "balloons" ? "seg-item-active" : ""}`}
          >
            Balloons · {balloons.length}
          </button>
        </div>
        {onStartBlankSlate && (
          <button onClick={onStartBlankSlate} className="btn btn-ghost btn-xs" title="Start over with one empty balloon">
            <Sparkles className="h-3.5 w-3.5" /> Blank slate
          </button>
        )}
      </div>

      {/* ---------------- Bubbles ---------------- */}
      {activeTab === "bubbles" && (
        <div className="flex min-h-[460px] flex-col">
          {/* Sequence list */}
          <div className="w-full space-y-1 border-b border-slate-800 bg-slate-950/40 p-2.5">
            <div className="flex items-center justify-between px-1 pb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sequence</span>
              <button
                onClick={() => onAddBubble(selectedBubble?.balloonId ?? activeBalloonId ?? balloons[0]?.id)}
                className="btn btn-ghost btn-xs text-amber-300"
              >
                <Plus className="h-3.5 w-3.5" /> Bubble
              </button>
            </div>
            <p className="px-1 pb-1 text-[11px] text-slate-500">Shift-click to select several.</p>

            {bubbles.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-700 p-3 text-center text-xs text-slate-500">
                No bubbles yet. Add one here or from the palette in the 3D view.
              </div>
            )}

            <div className="max-h-[260px] space-y-1 overflow-y-auto scrollbar-thin">
              {bubbles.map((b, idx) => {
                const isPrimary = selectedBubbleIndex === idx;
                const isMulti = !isPrimary && selectedBubbleIndices.includes(idx);
                return (
                  <div
                    key={b.id || idx}
                    onClick={(e) => onSelectBubble(idx, e.shiftKey || e.metaKey || e.ctrlKey)}
                    className={`list-row ${isPrimary ? "list-row-active" : isMulti ? "list-row-multi" : ""}`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-800 font-mono text-[10px] text-slate-400">
                        {idx + 1}
                      </span>
                      <span className="h-3 w-3 shrink-0 rounded-full border border-white/20" style={{ backgroundColor: b.color }} />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{b.label}</div>
                        <div className="truncate text-[11px] text-slate-500">
                          {b.lengthInches}″ · {TWIST_ENCYCLOPEDIA[b.twistType]?.name || b.twistType}
                          {b.lockToBubbleStart !== undefined ? ` · locks into #${b.lockToBubbleStart + 1}` : ""}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => onMoveBubble(idx, "up")} disabled={idx === 0} className="btn btn-ghost btn-icon h-6 w-6" title="Move earlier">
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button onClick={() => onMoveBubble(idx, "down")} disabled={idx === bubbles.length - 1} className="btn btn-ghost btn-icon h-6 w-6" title="Move later">
                        <ArrowDown className="h-3 w-3" />
                      </button>
                      <button onClick={() => onDeleteBubble(idx)} className="btn btn-ghost btn-icon h-6 w-6 text-rose-300" title="Delete bubble">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Inspector */}
          <div className="w-full space-y-4 p-4">
            {multi && (
              <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-3 text-xs text-cyan-100">
                <div className="mb-2 font-semibold">
                  {selectedBubbleIndices.length} bubbles selected (
                  {sortedSel.map((i) => `#${i + 1}`).join(", ")})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => onTwistTogether(sortedSel)} className="btn btn-primary btn-xs">
                    <Link2 className="h-3.5 w-3.5" />
                    {adjacent
                      ? sortedSel.length === 2
                        ? "Twist together (lock pair)"
                        : `Roll ${sortedSel.length} through (bird body)`
                      : `Lock #${sortedSel[sortedSel.length - 1] + 1} back into #${sortedSel[0] + 1}`}
                  </button>
                </div>
              </div>
            )}

            {selectedBubble ? (
              <>
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="chip chip-accent">Bubble #{selIdx + 1}</span>
                    <h4 className="text-sm font-semibold text-white">{selectedBubble.label}</h4>
                  </div>
                  {onOpenTwistModal && (
                    <button onClick={() => onOpenTwistModal(selectedBubble.twistType)} className="btn btn-ghost btn-xs">
                      <Info className="h-3.5 w-3.5" /> Twist guide
                    </button>
                  )}
                </div>

                <div>
                  <label className="label">Label</label>
                  <input
                    type="text"
                    value={selectedBubble.label}
                    onChange={(e) => onUpdateBubble(selIdx, { label: e.target.value })}
                    className="input"
                  />
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="label mb-0">Twist</label>
                    <span className="font-mono text-[11px] text-slate-500">
                      squeezes {TWIST_ENCYCLOPEDIA[selectedBubble.twistType]?.tailAirCostInches ?? 0.4}″ into the tail
                    </span>
                  </div>
                  <select
                    value={selectedBubble.twistType}
                    onChange={(e) => {
                      const t = e.target.value as TwistType;
                      onUpdateBubble(selIdx, { twistType: t, ...twistFlags(t) });
                    }}
                    className="select w-full"
                  >
                    {Object.values(TWIST_ENCYCLOPEDIA).map((tw) => (
                      <option key={tw.type} value={tw.type}>
                        {tw.name} · {tw.difficulty}
                      </option>
                    ))}
                  </select>
                  {selectedBubble.lockToBubbleStart !== undefined && (
                    <div className="mt-1.5 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-300">
                      <span>End locks back into the joint before #{selectedBubble.lockToBubbleStart + 1}</span>
                      <button
                        onClick={() => onUpdateBubble(selIdx, { lockToBubbleStart: undefined })}
                        className="btn btn-ghost btn-xs"
                      >
                        <Unlink className="h-3 w-3" /> Unlock
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="label mb-0">
                      Length <span className="font-mono text-white">{selectedBubble.lengthInches}″</span>
                      <span className="ml-1 normal-case tracking-normal text-slate-500">
                        ({Math.round((selectedBubble.lengthInches / 0.8) * 10) / 10} fingers)
                      </span>
                    </label>
                    <input
                      type="number"
                      min={0.5}
                      max={35}
                      step={0.25}
                      value={selectedBubble.lengthInches}
                      onChange={(e) => onUpdateBubble(selIdx, { lengthInches: parseFloat(e.target.value) || 1 })}
                      className="input input-sm w-20 text-right font-mono"
                    />
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={25}
                    step={0.25}
                    value={selectedBubble.lengthInches}
                    onChange={(e) => onUpdateBubble(selIdx, { lengthInches: parseFloat(e.target.value) })}
                    className="range"
                  />
                </div>

                <div>
                  <label className="label">Split this bubble</label>
                  <SplitMenu bubble={selectedBubble} onSplit={(mode) => onSplitBubble(selIdx, mode)} inline />
                </div>

                <div>
                  <label className="label">Balloon</label>
                  <select
                    value={selectedBubble.balloonId}
                    onChange={(e) => {
                      const newBal = balloons.find((bal) => bal.id === e.target.value);
                      onUpdateBubble(selIdx, {
                        balloonId: e.target.value,
                        color: newBal?.color || selectedBubble.color,
                        diameterInches: newBal?.size === "160" ? 1.0 : newBal?.size === "360" ? 3.0 : 2.0,
                      });
                    }}
                    className="select w-full"
                  >
                    {balloons.map((bal, bIdx) => (
                      <option key={bal.id} value={bal.id}>
                        #{bIdx + 1} · {bal.size} {bal.colorName} ({bal.name})
                      </option>
                    ))}
                  </select>
                  {selectedBalloon && (
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950 p-2">
                      <span className="text-[11px] text-slate-400">
                        One piece of latex, so color applies to the whole balloon.
                      </span>
                      <ColorPicker
                        size="sm"
                        align="right"
                        value={selectedBalloon.color}
                        valueName={selectedBalloon.colorName}
                        onChange={(hex, name) => onUpdateBalloon(selectedBalloon.id, { color: hex, colorName: name })}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                    <span>Direction</span>
                    {selectedBubble.poseStart ? (
                      <button
                        onClick={() => onUpdateBubble(selIdx, { poseStart: undefined, poseDir: undefined })}
                        className="btn btn-ghost btn-xs"
                        title="This bubble is hand-placed by a preset pose. Unpin it to drive it with bend/turn."
                      >
                        pose-placed · unpin
                      </button>
                    ) : (
                      <span className="text-[11px] font-normal text-slate-500">follows the chain</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <Slider
                      label="Bend"
                      hint="+ up · − down"
                      value={selectedBubble.bend ?? 0}
                      min={-150}
                      max={150}
                      step={5}
                      unit="°"
                      onChange={(v) => onUpdateBubble(selIdx, { bend: v, angleX: undefined })}
                    />
                    <Slider
                      label="Turn"
                      hint="+ left · − right"
                      value={selectedBubble.turn ?? 0}
                      min={-150}
                      max={150}
                      step={5}
                      unit="°"
                      onChange={(v) => onUpdateBubble(selIdx, { turn: v, angleY: undefined })}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {(["side", "height", "depth"] as const).map((label, axis) => (
                      <Slider
                        key={label}
                        label={`Nudge ${label}`}
                        value={(selectedBubble.positionOffset ?? [0, 0, 0])[axis]}
                        min={-3}
                        max={3}
                        step={0.25}
                        unit="″"
                        onChange={(v) => {
                          const next: [number, number, number] = [
                            ...(selectedBubble.positionOffset ?? [0, 0, 0]),
                          ] as [number, number, number];
                          next[axis] = v;
                          onUpdateBubble(selIdx, { positionOffset: next });
                        }}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Bend and turn rotate this bubble and everything after it on the same balloon. Lock
                    pairs fold back to their joint on their own.
                  </p>
                </div>
              </>
            ) : (
              <div className="flex h-full min-h-[200px] items-center justify-center text-xs text-slate-500">
                Select a bubble to inspect it.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- Balloons ---------------- */}
      {activeTab === "balloons" && (
        <div className="min-h-[460px] space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-white">Balloons in this sculpture</h4>
              <p className="text-xs text-slate-400">
                160 is delicate, 260 is the standard workhorse, 360 is chunky. New bubbles go on the
                active balloon.
              </p>
            </div>
            <AddBalloonPopover
              bubbles={bubbles}
              selectedBubbleIndex={selectedBubbleIndex}
              usedColors={usedColors}
              onAdd={onAddBalloon}
              align="right"
            />
          </div>

          <div className="space-y-2.5">
            {balloons.map((bal, idx) => {
              const count = bubbles.filter((b) => b.balloonId === bal.id).length;
              const isActive = activeBalloonId === bal.id;
              return (
                <div
                  key={bal.id}
                  className={`space-y-3 rounded-xl border bg-slate-950 p-3.5 ${
                    isActive ? "border-amber-400/50" : "border-slate-800"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="h-5 w-5 shrink-0 rounded-full border border-white/20" style={{ backgroundColor: bal.color }} />
                      <div className="min-w-0">
                        <input
                          type="text"
                          value={bal.name}
                          onChange={(e) => onUpdateBalloon(bal.id, { name: e.target.value })}
                          className="w-full bg-transparent text-sm font-semibold text-white focus:outline-none"
                        />
                        <div className="text-[11px] text-slate-500">
                          #{idx + 1} · {bal.colorName} · {count} bubble{count !== 1 ? "s" : ""}
                          {bal.attachTo ? ` · tied into bubble #${bal.attachTo.bubbleIndex + 1}` : ""}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onSetActiveBalloon(bal.id)}
                        className={`btn btn-xs ${isActive ? "btn-active" : "btn-ghost"}`}
                        title="New bubbles are added to the active balloon"
                      >
                        {isActive ? "Active" : "Make active"}
                      </button>
                      <div className="seg">
                        {(["160", "260", "360"] as BalloonSize[]).map((sz) => (
                          <button
                            key={sz}
                            onClick={() => onUpdateBalloon(bal.id, { size: sz })}
                            className={`seg-item font-mono ${bal.size === sz ? "seg-item-active" : ""}`}
                          >
                            {sz}
                          </button>
                        ))}
                      </div>
                      {balloons.length > 1 && (
                        <button onClick={() => onDeleteBalloon(bal.id)} className="btn btn-ghost btn-icon text-rose-300" title="Remove balloon and its bubbles">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
                    <div>
                      <label className="label">Color</label>
                      <ColorPicker
                        size="sm"
                        value={bal.color}
                        valueName={bal.colorName}
                        onChange={(hex, name) => onUpdateBalloon(bal.id, { color: hex, colorName: name })}
                      />
                    </div>
                    <div>
                      <label className="label">Uninflated tail</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={30}
                          step={0.5}
                          value={bal.tailFingers ?? 5}
                          onChange={(e) => {
                            const f = Math.max(0.5, parseFloat(e.target.value) || 5);
                            onUpdateBalloon(bal.id, {
                              tailFingers: f,
                              tailLengthInches: Math.round(f * 0.8 * 10) / 10,
                            });
                          }}
                          className="input input-sm w-16 text-center font-mono"
                        />
                        <span className="text-slate-400">fingers · {bal.tailLengthInches ?? 4}″</span>
                      </div>
                    </div>
                    <div>
                      <label className="label">Burp note</label>
                      <input
                        type="text"
                        value={bal.burpNote || ""}
                        placeholder="Burp slightly before tying."
                        onChange={(e) => onUpdateBalloon(bal.id, { burpNote: e.target.value })}
                        className="input input-sm"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const Slider: React.FC<{
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}> = ({ label, hint, value, min, max, step, unit, onChange }) => (
  <div>
    <div className="flex justify-between text-[11px]">
      <span className="text-slate-400">
        {label}
        {hint && <span className="ml-1 text-slate-600">{hint}</span>}
      </span>
      <span className="font-mono text-slate-300">
        {value}
        {unit}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="range"
    />
  </div>
);
