"use client";

import React from "react";
import { BalloonSpec, BubbleSpec } from "@/types/balloon";
import { calculateBalloonTail } from "@/lib/balloonConstants";

interface TailAllowanceMeterProps {
  balloon: BalloonSpec;
  bubbles: BubbleSpec[];
  className?: string;
}

export const TailAllowanceMeter: React.FC<TailAllowanceMeterProps> = ({
  balloon,
  bubbles,
  className = "",
}) => {
  const analysis = calculateBalloonTail(balloon, bubbles);

  const total = 60; // 60" standard twister length
  const bubblePercent = Math.min(100, (analysis.bubblesAirConsumedInches / total) * 100);
  const twistPercent = Math.min(100 - bubblePercent, (analysis.twistsAirDisplacedInches / total) * 100);
  const tailPercent = Math.max(0, 100 - bubblePercent - twistPercent);

  const getStatusBadge = () => {
    switch (analysis.status) {
      case "pop_risk":
        return {
          bg: "bg-rose-500/20 text-rose-300 border-rose-500/40",
          label: "⚠️ POP RISK! Over-demanded",
          barColor: "bg-rose-500",
        };
      case "tight":
        return {
          bg: "bg-amber-500/20 text-amber-300 border-amber-500/40",
          label: "⚡ TIGHT! High Pressure",
          barColor: "bg-amber-500",
        };
      case "underfilled":
        return {
          bg: "bg-blue-500/20 text-blue-300 border-blue-500/40",
          label: "💤 Ample Extra Tail",
          barColor: "bg-blue-500",
        };
      default:
        return {
          bg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
          label: "✅ Optimal Tail Allowance",
          barColor: "bg-emerald-500",
        };
    }
  };

  const badge = getStatusBadge();

  return (
    <div className={`bg-slate-900/90 rounded-xl p-4 border border-slate-800 space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
            style={{ backgroundColor: balloon.color }}
          />
          <span className="font-bold text-sm text-white">
            {balloon.name} ({balloon.size} Twister)
          </span>
        </div>
        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${badge.bg}`}>
          {badge.label}
        </span>
      </div>

      {/* Physics Bar Gauge */}
      <div>
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>Tail Gauge (60&quot; Latex)</span>
          <span className="font-mono text-slate-200">
            Tail: <strong className="text-amber-400">{analysis.tailRemainingFingers} fingers</strong> (
            {analysis.tailRemainingInches}&quot;)
          </span>
        </div>

        <div className="h-5 w-full bg-slate-950 rounded-lg overflow-hidden flex border border-slate-800 p-0.5">
          {/* Bubble volume */}
          <div
            style={{ width: `${bubblePercent}%`, backgroundColor: balloon.color }}
            className="h-full rounded-l transition-all duration-300 relative group"
            title={`Bubbles: ${analysis.bubblesAirConsumedInches}"`}
          />
          {/* Twist air displacement */}
          <div
            style={{ width: `${twistPercent}%` }}
            className="h-full bg-amber-500/80 transition-all duration-300 border-l border-amber-300/40"
            title={`Twist displacement: +${analysis.twistsAirDisplacedInches}"`}
          />
          {/* Tail remaining */}
          <div
            style={{ width: `${tailPercent}%` }}
            className={`h-full ${badge.barColor} transition-all duration-300 border-l border-white/30`}
            title={`Remaining Tail: ${analysis.tailRemainingInches}"`}
          />
        </div>

        <div className="flex justify-between text-[10px] text-slate-500 mt-1">
          <span>Nozzle / Bubbles: {analysis.bubblesAirConsumedInches}&quot;</span>
          <span>Twist Shifting: +{analysis.twistsAirDisplacedInches}&quot;</span>
          <span className="text-slate-300 font-semibold">Uninflated Tip: {analysis.tailRemainingInches}&quot;</span>
        </div>
      </div>

      {/* Instruction recommendation note */}
      <div className="text-xs text-slate-300 bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80 flex items-start gap-2">
        <span className="text-amber-400">💡</span>
        <span>
          <strong>Inflation Advice:</strong> Inflate leaving approximately{" "}
          <strong className="text-amber-300">{analysis.tailRemainingFingers} fingers</strong> (
          {analysis.tailRemainingInches}&quot;) uninflated. {balloon.burpNote || "Burp slightly before tying."}
        </span>
      </div>
    </div>
  );
};
