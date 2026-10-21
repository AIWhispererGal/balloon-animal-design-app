"use client";

import React from "react";
import { BalloonSpec, BubbleSpec, TwistType } from "@/types/balloon";
import { TWISTER_COLORS, TWIST_ENCYCLOPEDIA } from "@/lib/balloonConstants";

interface BubbleQuickControlsProps {
  balloons: BalloonSpec[];
  bubbles: BubbleSpec[];
  selectedIndex: number;
  onSelectBubble: (index: number) => void;
  onUpdateBubble: (index: number, updated: Partial<BubbleSpec>) => void;
  onInsertBubbleAfter: (index: number) => void;
  onDuplicateBubble: (index: number) => void;
  onDeleteBubble: (index: number) => void;
  onOpenEditor: () => void;
}

const QUICK_TWISTS: Array<{ type: TwistType; short: string }> = [
  { type: "basic", short: "Basic" },
  { type: "lock", short: "Lock" },
  { type: "pinch", short: "Pinch/Ear" },
  { type: "loop", short: "Loop" },
  { type: "toe", short: "Toe" },
  { type: "tulip", short: "Apple" },
  { type: "bird_body", short: "Bird Body" },
  { type: "spiral", short: "Spiral" },
  { type: "s_hook", short: "S-Hook" },
];

/**
 * Compact twist/shape controls for the currently selected bubble, rendered
 * directly under the 3D viewport so every change is immediately visible in
 * the smooth-latex simulation. The full CAD editor (balloons tab) remains
 * available for bulk work.
 */
export const BubbleQuickControls: React.FC<BubbleQuickControlsProps> = ({
  balloons,
  bubbles,
  selectedIndex,
  onSelectBubble,
  onUpdateBubble,
  onInsertBubbleAfter,
  onDuplicateBubble,
  onDeleteBubble,
  onOpenEditor,
}) => {
  const b = bubbles[selectedIndex];
  if (!b) return null;
  const balloon = balloons.find((x) => x.id === b.balloonId);
  const twistInfo = TWIST_ENCYCLOPEDIA[b.twistType];
  const nudge: [number, number, number] = b.positionOffset ?? [0, 0, 0];

  const setTwist = (t: TwistType) =>
    onUpdateBubble(selectedIndex, {
      twistType: t,
      isLoop: t === "loop",
      isPinch: t === "pinch" || t === "toe",
      isTulip: t === "tulip" || t === "tulip_chain",
    });

  const setNudge = (axis: 0 | 1 | 2, v: number) => {
    const next: [number, number, number] = [...nudge];
    next[axis] = v;
    onUpdateBubble(selectedIndex, { positionOffset: next });
  };

  const sliderRow = (
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    unit: string,
    onChange: (v: number) => void,
    hint?: string
  ) => (
    <div>
      <div className="flex justify-between text-[11px]">
        <span className="text-slate-400 font-semibold">
          {label} {hint && <span className="text-slate-600 font-normal">· {hint}</span>}
        </span>
        <span className="font-mono text-amber-300">
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
        className="w-full accent-amber-500 cursor-pointer h-1.5"
      />
    </div>
  );

  return (
    <div className="bg-slate-900 border border-cyan-900/50 rounded-xl p-3.5 space-y-3">
      {/* header: which bubble, nav, actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
          BUBBLE #{selectedIndex + 1}
        </span>
        <input
          type="text"
          value={b.label}
          onChange={(e) => onUpdateBubble(selectedIndex, { label: e.target.value })}
          className="flex-1 min-w-[120px] px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-semibold text-white focus:outline-none focus:border-cyan-500"
          title="Bubble name — keywords like Leg / Stem / Blade / Tail also guide auto-layout"
        />
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => onSelectBubble(Math.max(0, selectedIndex - 1))}
            disabled={selectedIndex === 0}
            className="px-2 py-1 rounded bg-slate-800 text-slate-300 text-xs disabled:opacity-30 hover:bg-slate-700"
            title="Previous bubble"
          >
            ◀
          </button>
          <button
            onClick={() => onSelectBubble(Math.min(bubbles.length - 1, selectedIndex + 1))}
            disabled={selectedIndex >= bubbles.length - 1}
            className="px-2 py-1 rounded bg-slate-800 text-slate-300 text-xs disabled:opacity-30 hover:bg-slate-700"
            title="Next bubble"
          >
            ▶
          </button>
        </div>
      </div>

      <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
        <span className="flex items-center gap-1">
          <span
            className="w-3 h-3 rounded-full border border-white/20"
            style={{ backgroundColor: balloon?.color || b.color }}
          />
          {balloon ? `${balloon.size} ${balloon.colorName}` : "—"}
        </span>
        <span>·</span>
        <span>
          {twistInfo?.name} · tail air cost +{twistInfo?.tailAirCostInches}″
        </span>
        {b.poseStart && (
          <>
            <span>·</span>
            <span className="text-cyan-400">📐 pose-placed</span>
            <button
              onClick={() =>
                onUpdateBubble(selectedIndex, { poseStart: undefined, poseDir: undefined })
              }
              className="text-slate-400 hover:text-amber-300 underline"
              title="Remove the hand-placed pose so this bubble follows the chain (bend/turn take over)"
            >
              unpin pose
            </button>
          </>
        )}
      </div>

      {/* twist type quick buttons + full select */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
          Twist formation
        </div>
        <div className="flex flex-wrap gap-1">
          {QUICK_TWISTS.map((t) => (
            <button
              key={t.type}
              onClick={() => setTwist(t.type)}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition ${
                b.twistType === t.type
                  ? "bg-amber-500 border-amber-400 text-slate-950"
                  : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600"
              }`}
              title={TWIST_ENCYCLOPEDIA[t.type].description}
            >
              {t.short}
            </button>
          ))}
          <select
            value={b.twistType}
            onChange={(e) => setTwist(e.target.value as TwistType)}
            className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300"
            title="All 17 twist formations"
          >
            {Object.values(TWIST_ENCYCLOPEDIA).map((tw) => (
              <option key={tw.type} value={tw.type}>
                {tw.name}
              </option>
            ))}
          </select>
        </div>
        <p className="text-[10px] text-slate-500 mt-1 leading-snug">
          {b.twistType === "lock" &&
            "Lock pairs fold back to their starting joint — set Lock on two consecutive bubbles (ears/legs)."}
          {b.twistType === "loop" &&
            "Loop rings sit on the current joint and the chain continues from the same joint. Consecutive loops fan out."}
          {(b.twistType === "pinch" || b.twistType === "toe") &&
            "Pinch/toe bubbles protrude at the joint without advancing the chain."}
          {b.twistType === "bird_body" &&
            "Set Bird Body on 3 consecutive bubbles — they bundle in parallel between the same two joints."}
        </p>
      </div>

      {/* size + direction sliders */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {sliderRow(
          "Length",
          b.lengthInches,
          0.5,
          24,
          0.25,
          "″",
          (v) => onUpdateBubble(selectedIndex, { lengthInches: v }),
          `${Math.round((b.lengthInches / 0.8) * 10) / 10} fingers`
        )}
        {sliderRow(
          "Diameter",
          b.diameterInches,
          0.75,
          3.25,
          0.25,
          "″",
          (v) => onUpdateBubble(selectedIndex, { diameterInches: v })
        )}
        {sliderRow(
          "Bend",
          b.bend ?? 0,
          -150,
          150,
          5,
          "°",
          (v) => onUpdateBubble(selectedIndex, { bend: v, angleX: undefined }),
          "+ up · − down"
        )}
        {sliderRow(
          "Turn",
          b.turn ?? 0,
          -150,
          150,
          5,
          "°",
          (v) => onUpdateBubble(selectedIndex, { turn: v, angleY: undefined }),
          "+ left · − right"
        )}
      </div>
      <p className="text-[10px] text-slate-600 -mt-1">
        Bend/Turn rotate this bubble — and everything after it on the same balloon follows the new heading.
      </p>

      {/* nudge + color */}
      <div className="grid grid-cols-3 gap-x-3">
        {sliderRow("Nudge ↔", nudge[0], -3, 3, 0.25, "″", (v) => setNudge(0, v))}
        {sliderRow("Nudge ↕", nudge[1], -3, 3, 0.25, "″", (v) => setNudge(1, v))}
        {sliderRow("Nudge ⤢", nudge[2], -3, 3, 0.25, "″", (v) => setNudge(2, v))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Color</span>
        <div className="flex flex-wrap gap-1">
          {TWISTER_COLORS.slice(0, 14).map((c) => (
            <button
              key={c.name}
              onClick={() => onUpdateBubble(selectedIndex, { color: c.hex })}
              className={`w-5 h-5 rounded-full border-2 transition hover:scale-110 ${
                b.color.toLowerCase() === c.hex.toLowerCase()
                  ? "border-white ring-1 ring-cyan-400"
                  : "border-transparent"
              }`}
              style={{ backgroundColor: c.hex }}
              title={c.name}
            />
          ))}
        </div>
      </div>

      {/* structural actions */}
      <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-800">
        <button
          onClick={() => onInsertBubbleAfter(selectedIndex)}
          className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold transition"
          title="Insert a new bubble right after this one (it becomes the next step in 3D)"
        >
          ＋ Add bubble after
        </button>
        <button
          onClick={() => onDuplicateBubble(selectedIndex)}
          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition"
          title="Duplicate this bubble"
        >
          ⧉ Duplicate
        </button>
        <button
          onClick={() => onDeleteBubble(selectedIndex)}
          disabled={bubbles.length <= 1}
          className="px-2.5 py-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 text-[11px] font-semibold transition disabled:opacity-30"
          title="Delete this bubble"
        >
          🗑 Delete
        </button>
        {(b.bend || b.turn || nudge.some((n) => n !== 0)) && (
          <button
            onClick={() =>
              onUpdateBubble(selectedIndex, {
                bend: 0,
                turn: 0,
                positionOffset: [0, 0, 0],
              })
            }
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition"
            title="Reset bend, turn and nudge to zero"
          >
            ⟲ Reset pose
          </button>
        )}
        <button
          onClick={onOpenEditor}
          className="ml-auto text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold"
          title="Open the full CAD editor (balloons, ordering, tail meters)"
        >
          Full CAD editor →
        </button>
      </div>
    </div>
  );
};
