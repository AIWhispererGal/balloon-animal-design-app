"use client";

import React, { useState } from "react";
import { BalloonSize, BalloonSpec, BubbleSpec, TwistType } from "@/types/balloon";
import { TWISTER_COLORS, TWIST_ENCYCLOPEDIA } from "@/lib/balloonConstants";
import { TailAllowanceMeter } from "./TailAllowanceMeter";

interface BalloonDesignEditorProps {
  balloons: BalloonSpec[];
  bubbles: BubbleSpec[];
  selectedBubbleIndex: number | null;
  onSelectBubble: (index: number) => void;
  onUpdateBubble: (index: number, updated: Partial<BubbleSpec>) => void;
  onAddBubble: (balloonId?: string) => void;
  onDeleteBubble: (index: number) => void;
  onMoveBubble: (index: number, direction: "up" | "down") => void;
  onAddBalloon: (size: BalloonSize, colorHex: string, colorName: string) => void;
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
  onSelectBubble,
  onUpdateBubble,
  onAddBubble,
  onDeleteBubble,
  onMoveBubble,
  onAddBalloon,
  onDeleteBalloon,
  onUpdateBalloon,
  onOpenTwistModal,
  onStartBlankSlate,
  className = "",
}) => {
  const [activeTab, setActiveTab] = useState<"bubbles" | "balloons" | "tail_meters">("bubbles");
  const [showColorPickerForBubble, setShowColorPickerForBubble] = useState<number | null>(null);

  const selectedBubble =
    selectedBubbleIndex !== null && selectedBubbleIndex < bubbles.length
      ? bubbles[selectedBubbleIndex]
      : bubbles[0] || null;
  const selectedBalloon = selectedBubble
    ? balloons.find((balloon) => balloon.id === selectedBubble.balloonId)
    : undefined;

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden ${className}`}>
      {/* Top Header & Tab Controls */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/80">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab("bubbles")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === "bubbles"
                ? "bg-amber-500 text-slate-950 shadow"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            🫧 Bubbles ({bubbles.length})
          </button>
          <button
            onClick={() => setActiveTab("balloons")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === "balloons"
                ? "bg-amber-500 text-slate-950 shadow"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            🎈 Balloons ({balloons.length})
          </button>
          <button
            onClick={() => setActiveTab("tail_meters")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === "tail_meters"
                ? "bg-amber-500 text-slate-950 shadow"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            📏 Tail Meters
          </button>
        </div>

        {onStartBlankSlate && (
          <button
            onClick={onStartBlankSlate}
            className="text-[11px] px-2.5 py-1 rounded bg-slate-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-slate-700 transition"
            title="Start from scratch with an empty balloon"
          >
            ✨ Blank Slate
          </button>
        )}
      </div>

      {/* TAB 1: BUBBLES LIST & INSPECTOR */}
      {activeTab === "bubbles" && (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-[460px]">
          {/* Left Bubble Sequence List */}
          <div className="w-full md:w-5/12 border-r border-slate-800 overflow-y-auto p-2.5 space-y-1.5 bg-slate-950/40 max-h-[500px]">
            <div className="flex items-center justify-between px-1.5 py-1 text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Bubble Sequence</span>
              <button
                onClick={() => onAddBubble(selectedBubble?.balloonId || balloons[0]?.id)}
                className="text-amber-400 hover:text-amber-300 font-bold text-xs flex items-center gap-1"
              >
                <span>+</span> Add Bubble
              </button>
            </div>

            {bubbles.map((b, idx) => {
              const isSelected = selectedBubbleIndex === idx;
              return (
                <div
                  key={b.id || idx}
                  onClick={() => onSelectBubble(idx)}
                  className={`p-2 rounded-lg cursor-pointer transition border text-xs flex items-center justify-between gap-2 ${
                    isSelected
                      ? "bg-amber-500/20 border-amber-500/70 text-white font-medium shadow-sm"
                      : "bg-slate-900 border-slate-800/80 text-slate-300 hover:bg-slate-800/70"
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center font-mono text-[10px] text-slate-400 shrink-0">
                      {idx + 1}
                    </span>
                    <div
                      className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                      style={{ backgroundColor: b.color }}
                    />
                    <div className="truncate">
                      <div className="font-semibold truncate">{b.label}</div>
                      <div className="text-[10px] text-slate-400">
                        {b.lengthInches}&quot; • {TWIST_ENCYCLOPEDIA[b.twistType]?.name || b.twistType}
                      </div>
                    </div>
                  </div>

                  {/* Ordering Arrows */}
                  <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onMoveBubble(idx, "up")}
                      disabled={idx === 0}
                      className="p-1 text-slate-400 hover:text-white disabled:opacity-20"
                      title="Move Up"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => onMoveBubble(idx, "down")}
                      disabled={idx === bubbles.length - 1}
                      className="p-1 text-slate-400 hover:text-white disabled:opacity-20"
                      title="Move Down"
                    >
                      ▼
                    </button>
                    <button
                      onClick={() => onDeleteBubble(idx)}
                      disabled={bubbles.length <= 1}
                      className="p-1 text-rose-400 hover:text-rose-300 disabled:opacity-20"
                      title="Delete Bubble"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Bubble Property Inspector */}
          <div className="w-full md:w-7/12 p-4 space-y-4 overflow-y-auto max-h-[500px] bg-slate-900">
            {selectedBubble ? (
              <>
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">
                      Bubble #{(selectedBubbleIndex ?? 0) + 1}
                    </span>
                    <h4 className="font-bold text-white text-sm">Configure Parameters</h4>
                  </div>
                  {onOpenTwistModal && (
                    <button
                      onClick={() => onOpenTwistModal(selectedBubble.twistType)}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                    >
                      <span>ℹ️</span> Twist Guide
                    </button>
                  )}
                </div>

                {/* Bubble Label */}
                <div>
                  <label className="block text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-1">
                    Bubble Label / Anatomical Part
                  </label>
                  <input
                    type="text"
                    value={selectedBubble.label}
                    onChange={(e) =>
                      onUpdateBubble(selectedBubbleIndex ?? 0, { label: e.target.value })
                    }
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Twist Type Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                      Twist Technique
                    </label>
                    <span className="text-[10px] text-amber-400 font-mono">
                      Air Cost: +{TWIST_ENCYCLOPEDIA[selectedBubble.twistType]?.tailAirCostInches || 0.4}&quot; tail
                    </span>
                  </div>
                  <select
                    value={selectedBubble.twistType}
                    onChange={(e) => {
                      const newType = e.target.value as TwistType;
                      onUpdateBubble(selectedBubbleIndex ?? 0, {
                        twistType: newType,
                        isLoop: newType === "loop",
                        isPinch: newType === "pinch" || newType === "toe",
                        isTulip: newType === "tulip" || newType === "tulip_chain",
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-amber-500"
                  >
                    {Object.values(TWIST_ENCYCLOPEDIA).map((tw) => (
                      <option key={tw.type} value={tw.type}>
                        {tw.name} ({tw.difficulty})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Bubble Length Slider & Number Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                      Length: <span className="text-white font-mono">{selectedBubble.lengthInches}&quot;</span> (
                      {Math.round((selectedBubble.lengthInches / 0.8) * 10) / 10} fingers)
                    </label>
                    <input
                      type="number"
                      min={0.5}
                      max={35}
                      step={0.5}
                      value={selectedBubble.lengthInches}
                      onChange={(e) =>
                        onUpdateBubble(selectedBubbleIndex ?? 0, {
                          lengthInches: parseFloat(e.target.value) || 1,
                        })
                      }
                      className="w-16 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-xs text-right font-mono text-amber-400"
                    />
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={25}
                    step={0.5}
                    value={selectedBubble.lengthInches}
                    onChange={(e) =>
                      onUpdateBubble(selectedBubbleIndex ?? 0, {
                        lengthInches: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                    <span>0.5&quot; (Pinch)</span>
                    <span>3&quot; (Snout/Paw)</span>
                    <span>6&quot; (Body/Loop)</span>
                    <span>25&quot; (Sword Blade)</span>
                  </div>
                </div>

                {/* Balloon Assignment */}
                <div>
                  <label className="block text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-1">
                    Assigned Balloon
                  </label>
                  <select
                    value={selectedBubble.balloonId}
                    onChange={(e) => {
                      const newBal = balloons.find((bal) => bal.id === e.target.value);
                      onUpdateBubble(selectedBubbleIndex ?? 0, {
                        balloonId: e.target.value,
                        color: newBal?.color || selectedBubble.color,
                        diameterInches:
                          newBal?.size === "160" ? 1.0 : newBal?.size === "360" ? 3.0 : 2.0,
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    {balloons.map((bal, bIdx) => (
                      <option key={bal.id} value={bal.id}>
                        Balloon #{bIdx + 1}: {bal.size} {bal.colorName} ({bal.name})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Physical color rule: color belongs to the whole balloon, never one bubble */}
                <div className="rounded-xl border border-cyan-800/50 bg-cyan-950/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-6 w-6 shrink-0 rounded-full border-2 border-white/30"
                        style={{ backgroundColor: selectedBalloon?.color ?? selectedBubble.color }}
                      />
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                          One Color Per Physical Balloon
                        </div>
                        <div className="text-[11px] text-slate-400">
                          This bubble inherits {selectedBalloon?.colorName ?? "its latex color"} from {selectedBalloon?.name ?? "its assigned balloon"}. All bubbles on that balloon must match.
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab("balloons")}
                      className="shrink-0 rounded-lg border border-cyan-600/50 bg-cyan-500/15 px-2.5 py-1.5 text-[11px] font-bold text-cyan-300 transition hover:bg-cyan-500 hover:text-slate-950"
                    >
                      Edit Balloon Color
                    </button>
                  </div>
                </div>

                {/* 3D direction controls: bend / turn rotate this bubble (and the
                    chain after it); nudge shifts only this bubble's geometry */}
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
                  <div className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                    <span>3D Direction — Bend / Turn / Nudge</span>
                    {selectedBubble.poseStart ? (
                      <button
                        onClick={() =>
                          onUpdateBubble(selectedBubbleIndex ?? 0, {
                            poseStart: undefined,
                            poseDir: undefined,
                          })
                        }
                        className="text-[10px] text-cyan-400 hover:text-amber-300 font-normal underline"
                        title="This bubble is hand-placed by a preset pose. Unpin it to drive it purely with bend/turn chain controls."
                      >
                        📐 pose-placed — unpin
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-normal">chain-driven</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400">Bend (+ up · − down)</span>
                      <input
                        type="range"
                        min={-150}
                        max={150}
                        step={5}
                        value={selectedBubble.bend ?? 0}
                        onChange={(e) =>
                          onUpdateBubble(selectedBubbleIndex ?? 0, {
                            bend: parseInt(e.target.value),
                            angleX: undefined,
                          })
                        }
                        className="w-full accent-amber-500"
                      />
                      <span className="text-[10px] font-mono text-slate-400">{selectedBubble.bend ?? 0}°</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400">Turn (+ left · − right)</span>
                      <input
                        type="range"
                        min={-150}
                        max={150}
                        step={5}
                        value={selectedBubble.turn ?? 0}
                        onChange={(e) =>
                          onUpdateBubble(selectedBubbleIndex ?? 0, {
                            turn: parseInt(e.target.value),
                            angleY: undefined,
                          })
                        }
                        className="w-full accent-amber-500"
                      />
                      <span className="text-[10px] font-mono text-slate-400">{selectedBubble.turn ?? 0}°</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {(["↔ side", "↕ height", "⤢ depth"] as const).map((label, axis) => (
                      <div key={label}>
                        <span className="text-[10px] text-slate-400">Nudge {label}</span>
                        <input
                          type="range"
                          min={-3}
                          max={3}
                          step={0.25}
                          value={(selectedBubble.positionOffset ?? [0, 0, 0])[axis]}
                          onChange={(e) => {
                            const next: [number, number, number] = [
                              ...(selectedBubble.positionOffset ?? [0, 0, 0]),
                            ] as [number, number, number];
                            next[axis] = parseFloat(e.target.value);
                            onUpdateBubble(selectedBubbleIndex ?? 0, { positionOffset: next });
                          }}
                          className="w-full accent-cyan-500"
                        />
                        <span className="text-[10px] font-mono text-slate-400">
                          {(selectedBubble.positionOffset ?? [0, 0, 0])[axis]}″
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Bend/Turn rotate this bubble and the rest of its balloon follows. Lock pairs fold
                    back to their joint automatically; loops &amp; pinches stay on their joint.
                  </p>
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                Select a bubble to inspect and configure.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: BALLOONS MANAGEMENT */}
      {activeTab === "balloons" && (
        <div className="p-4 space-y-4 min-h-[460px] overflow-y-auto">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-white text-sm">Twister Balloons in this Sculpture</h4>
              <p className="text-xs text-slate-400">
                Standard industry twister sizes: 160 (delicate), 260 (standard workhorse), 360 (heavy)
              </p>
            </div>
            <button
              onClick={() => onAddBalloon("260", "#2563EB", "Royal Blue")}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow transition flex items-center gap-1"
            >
              <span>+ Add Balloon</span>
            </button>
          </div>

          <div className="space-y-3">
            {balloons.map((bal, idx) => (
              <div
                key={bal.id}
                className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-6 h-6 rounded-full border border-white/20 shadow-md"
                      style={{ backgroundColor: bal.color }}
                    />
                    <div>
                      <input
                        type="text"
                        value={bal.name}
                        onChange={(e) => onUpdateBalloon(bal.id, { name: e.target.value })}
                        className="bg-transparent text-white font-bold text-sm focus:outline-none focus:border-b border-amber-500"
                      />
                      <div className="text-[11px] text-slate-400">{bal.colorName}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Size Selector: 160, 260, 360 */}
                    <div className="flex rounded-lg overflow-hidden border border-slate-700 bg-slate-900">
                      {(["160", "260", "360"] as BalloonSize[]).map((sz) => (
                        <button
                          key={sz}
                          onClick={() => onUpdateBalloon(bal.id, { size: sz })}
                          className={`px-2.5 py-1 text-xs font-mono font-bold transition ${
                            bal.size === sz
                              ? "bg-amber-500 text-slate-950"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          {sz}
                        </button>
                      ))}
                    </div>

                    {balloons.length > 1 && (
                      <button
                        onClick={() => onDeleteBalloon(bal.id)}
                        className="p-1.5 rounded-lg bg-rose-950/40 text-rose-400 hover:bg-rose-900/60 text-xs transition"
                        title="Remove Balloon"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>

                {/* Inflation & Tail Settings */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                      Initial Uninflated Tail (Fingers / Inches)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={25}
                        value={bal.tailFingers ?? 5}
                        onChange={(e) =>
                          onUpdateBalloon(bal.id, {
                            tailFingers: parseInt(e.target.value) || 5,
                            tailLengthInches: (parseInt(e.target.value) || 5) * 0.8,
                          })
                        }
                        className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-amber-400 font-mono text-center font-bold"
                      />
                      <span className="text-slate-400">fingers ({bal.tailLengthInches ?? 4}&quot;)</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                      Burp Note
                    </label>
                    <input
                      type="text"
                      value={bal.burpNote || "Burp slightly before tying."}
                      onChange={(e) => onUpdateBalloon(bal.id, { burpNote: e.target.value })}
                      className="w-full px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-xs text-white"
                    />
                  </div>
                </div>

                {/* Color Palette for this balloon */}
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                    Select Balloon Color
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {TWISTER_COLORS.map((c) => (
                      <button
                        key={c.name}
                        onClick={() =>
                          onUpdateBalloon(bal.id, { color: c.hex, colorName: c.name })
                        }
                        className={`w-6 h-6 rounded-full border-2 transition transform hover:scale-110 ${
                          bal.color.toLowerCase() === c.hex.toLowerCase()
                            ? "border-white ring-2 ring-amber-400"
                            : "border-transparent"
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: TAIL GAUGES & PRESSURE METERS */}
      {activeTab === "tail_meters" && (
        <div className="p-4 space-y-4 min-h-[460px] overflow-y-auto">
          <div>
            <h4 className="font-bold text-white text-sm">Balloon Tail &amp; Pressure Telemetry</h4>
            <p className="text-xs text-slate-400">
              Live physics calculations measuring air displacement into uninflated tails
            </p>
          </div>

          <div className="space-y-3">
            {balloons.map((bal) => (
              <TailAllowanceMeter key={bal.id} balloon={bal} bubbles={bubbles} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
