"use client";

import React, { useState } from "react";
import { TWIST_ENCYCLOPEDIA } from "@/lib/balloonConstants";
import { TwistType } from "@/types/balloon";
import { StepVisualDiagram } from "./StepVisualDiagram";

interface TwistEncyclopediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTwist?: (twistType: TwistType) => void;
}

export const TwistEncyclopediaModal: React.FC<TwistEncyclopediaModalProps> = ({
  isOpen,
  onClose,
  onSelectTwist,
}) => {
  const [selectedType, setSelectedType] = useState<TwistType>("lock");
  const [searchFilter, setSearchFilter] = useState("");

  if (!isOpen) return null;

  const twistList = Object.values(TWIST_ENCYCLOPEDIA);
  const filtered = twistList.filter(
    (t) =>
      t.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      t.aka?.toLowerCase().includes(searchFilter.toLowerCase()) ||
      t.commonUse.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const activeTwist = TWIST_ENCYCLOPEDIA[selectedType] || TWIST_ENCYCLOPEDIA.basic;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div>
            <h2 className="text-lg font-semibold text-white">Twist encyclopedia</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Comprehensive reference of all standard &amp; advanced twisting maneuvers and air displacement
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn btn-icon btn-secondary rounded-full"
          >
            ✕
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-900/50">
          <input
            type="text"
            placeholder="Search twists (e.g. apple, lock, pinch, bird body, spiral)..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Content Body: Split list & detail */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar Twist List */}
          <div className="w-1/3 border-r border-slate-800 overflow-y-auto p-3 space-y-1 bg-slate-950/40">
            {filtered.map((t) => (
              <button
                key={t.type}
                onClick={() => setSelectedType(t.type)}
                className={`w-full text-left p-3 rounded-lg transition border flex flex-col gap-1 ${
                  selectedType === t.type
                    ? "bg-amber-500/15 border-amber-500/50 text-white"
                    : "bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{t.name}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                      t.difficulty === "Easy"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : t.difficulty === "Medium"
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-rose-500/20 text-rose-400"
                    }`}
                  >
                    {t.difficulty}
                  </span>
                </div>
                {t.aka && <span className="text-[11px] text-slate-400 italic">AKA: {t.aka}</span>}
                <div className="text-[11px] text-slate-400 truncate">Air cost: ~{t.tailAirCostInches}&quot; tail</div>
              </button>
            ))}
          </div>

          {/* Twist Detail View */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-900">
            {/* Header info */}
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-amber-400">{activeTwist.name}</h3>
                <span
                  className={`text-xs px-3 py-1 rounded-full font-bold ${
                    activeTwist.difficulty === "Easy"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : activeTwist.difficulty === "Medium"
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                  }`}
                >
                  {activeTwist.difficulty} Difficulty
                </span>
              </div>
              {activeTwist.aka && (
                <div className="text-xs text-slate-400 mt-1">Also known as: <span className="text-slate-200">{activeTwist.aka}</span></div>
              )}
            </div>

            {/* Visual SVG Diagram */}
            <div>
              <h4 className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-2">Visual Diagram</h4>
              <StepVisualDiagram twistType={activeTwist.type} balloonColor="#E11D48" className="h-44" />
            </div>

            {/* Physics & Air Displacement Metric */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-400">Tail Air Displacement</div>
                <div className="text-xl font-mono font-bold text-cyan-400 mt-0.5">
                  +{activeTwist.tailAirCostInches}&quot; air shift
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Air volume forced down into uninflated tail
                </div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-400">Locking Mechanism</div>
                <div className="text-sm font-semibold text-slate-200 mt-0.5">
                  {activeTwist.type === "basic"
                    ? "Requires holding until subsequent lock"
                    : activeTwist.type === "pinch" || activeTwist.type === "toe"
                    ? "Self-locking latex friction"
                    : activeTwist.type === "tulip"
                    ? "Inverted friction lock around knot"
                    : "Mechanical junction lock"}
                </div>
              </div>
            </div>

            {/* Execution Description */}
            <div>
              <h4 className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-1">Twisting Technique</h4>
              <p className="text-sm text-slate-200 leading-relaxed bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                {activeTwist.description}
              </p>
            </div>

            {/* Common Uses */}
            <div>
              <h4 className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-1">Common Applications</h4>
              <div className="text-sm text-amber-200/90 bg-amber-950/20 p-3 rounded-xl border border-amber-900/30">
                {activeTwist.commonUse}
              </div>
            </div>

            {/* Pro Tip */}
            <div>
              <h4 className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-1">Master Twister Tip</h4>
              <div className="text-xs text-emerald-300 bg-emerald-950/30 p-3 rounded-xl border border-emerald-900/40 flex items-start gap-2">
                <span className="text-base">💡</span>
                <span>{activeTwist.proTip}</span>
              </div>
            </div>

            {/* Use twist in designer button if callback provided */}
            {onSelectTwist && (
              <div className="pt-2">
                <button
                  onClick={() => {
                    onSelectTwist(activeTwist.type);
                    onClose();
                  }}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-lg transition"
                >
                  Apply {activeTwist.name} to Selected Bubble
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
