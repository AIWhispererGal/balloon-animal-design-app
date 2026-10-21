"use client";

import React from "react";
import { AirBudget } from "@/lib/balloonAir";

interface AirBudgetBarProps {
  air: AirBudget;
  color: string;
  /** Compact single-line variant for the viewport dock */
  compact?: boolean;
  className?: string;
}

const STATUS_STYLE: Record<AirBudget["status"], { label: string; cls: string; bar: string }> = {
  safe: { label: "Comfortable", cls: "chip-ok", bar: "bg-emerald-400" },
  underfilled: { label: "Lots of tail", cls: "chip-info", bar: "bg-sky-400" },
  tight: { label: "Tight", cls: "chip-accent", bar: "bg-amber-400" },
  pop_risk: { label: "Pop risk", cls: "chip-danger", bar: "bg-rose-400" },
  over_budget: { label: "Out of balloon", cls: "chip-danger", bar: "bg-rose-400" },
};

/**
 * One 60″ balloon drawn as a horizontal bar:
 *   [ bubbles twisted so far | untwisted inflated balloon | tail still uninflated | tail used up by twists ]
 * The "tail used up" segment grows as twists squeeze air forward, so the
 * uninflated tip visibly shrinks while you build.
 */
export const AirBudgetBar: React.FC<AirBudgetBarProps> = ({ air, color, compact = false, className = "" }) => {
  const total = air.totalLatexInches;
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / total) * 100))}%`;
  const style = STATUS_STYLE[air.status];
  const overflow = air.overBudgetInches > 0;
  const bubblesShown = Math.min(air.bubbleInches, air.inflatedInches);

  const bar = (
    <div
      className={`flex w-full overflow-hidden rounded-md border border-slate-800 bg-slate-950 ${
        compact ? "h-2.5" : "h-4"
      }`}
      title={`Bubbles ${air.bubbleInches}″ · untwisted ${air.untwistedInches}″ · tail ${air.tailRemainingInches}″ (${air.twistShiftInches}″ squeezed away)`}
    >
      <div
        className="h-full transition-all duration-300"
        style={{ width: pct(bubblesShown), backgroundColor: color }}
      />
      <div
        className="h-full border-l border-black/30 transition-all duration-300"
        style={{ width: pct(air.untwistedInches), backgroundColor: color, opacity: 0.45 }}
      />
      <div
        className={`h-full border-l border-black/30 transition-all duration-300 ${style.bar}`}
        style={{ width: pct(air.tailRemainingInches), opacity: 0.85 }}
      />
      <div
        className="h-full border-l border-black/30 bg-slate-700/70 transition-all duration-300"
        style={{
          width: pct(air.twistShiftInches),
          backgroundImage:
            "repeating-linear-gradient(135deg, rgba(255,255,255,0.12) 0 3px, transparent 3px 6px)",
        }}
      />
    </div>
  );

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/20" style={{ backgroundColor: color }} />
        <div className="min-w-0 flex-1">{bar}</div>
        <span
          className={`shrink-0 font-mono text-[11px] ${
            overflow || air.status === "pop_risk" ? "text-rose-300" : "text-slate-300"
          }`}
        >
          tail {air.tailRemainingInches}″
        </span>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {bar}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-4">
        <Stat label="Bubbles twisted" value={`${air.bubbleInches}″`} swatch={color} />
        <Stat label="Untwisted balloon" value={`${air.untwistedInches}″`} swatch={color} faint />
        <Stat
          label="Tail remaining"
          value={`${air.tailRemainingInches}″ · ${air.tailRemainingFingers} fingers`}
          swatchClass={style.bar}
        />
        <Stat label="Tail squeezed away" value={`${air.twistShiftInches}″`} swatchClass="bg-slate-600" />
      </div>
      <div className="flex items-center gap-2">
        <span className={`chip ${style.cls}`}>{style.label}</span>
        <span className="text-xs text-slate-400">{air.statusMessage}</span>
      </div>
    </div>
  );
};

const Stat: React.FC<{
  label: string;
  value: string;
  swatch?: string;
  swatchClass?: string;
  faint?: boolean;
}> = ({ label, value, swatch, swatchClass, faint }) => (
  <div className="flex items-center gap-1.5">
    <span
      className={`h-2.5 w-2.5 shrink-0 rounded-sm ${swatchClass ?? ""}`}
      style={swatch ? { backgroundColor: swatch, opacity: faint ? 0.45 : 1 } : undefined}
    />
    <div className="min-w-0">
      <div className="truncate text-[11px] text-slate-500">{label}</div>
      <div className="font-mono text-slate-200">{value}</div>
    </div>
  </div>
);
