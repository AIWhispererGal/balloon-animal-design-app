"use client";

import React from "react";
import { BalloonSpec, BubbleSpec } from "@/types/balloon";
import { computeAirBudget, fitTailForBubbles } from "@/lib/balloonAir";
import { AirBudgetBar } from "./AirBudgetBar";

interface TailAllowanceMeterProps {
  balloon: BalloonSpec;
  bubbles: BubbleSpec[];
  /** Restrict to bubbles formed at the current step (omit for the finished sculpture) */
  formed?: ReadonlySet<number> | null;
  onUpdateBalloon?: (balloonId: string, updated: Partial<BalloonSpec>) => void;
  className?: string;
}

export const TailAllowanceMeter: React.FC<TailAllowanceMeterProps> = ({
  balloon,
  bubbles,
  formed,
  onUpdateBalloon,
  className = "",
}) => {
  const air = computeAirBudget(balloon, bubbles, formed);
  const fitted = fitTailForBubbles(balloon, bubbles);
  const canFit = onUpdateBalloon && Math.abs(fitted - air.initialTailInches) >= 0.5;

  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 ${className}`}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="h-3.5 w-3.5 rounded-full border border-white/20"
            style={{ backgroundColor: balloon.color }}
          />
          <span className="text-sm font-semibold text-white">{balloon.name}</span>
          <span className="chip chip-muted">{balloon.size}</span>
        </div>
        <span className="font-mono text-xs text-slate-400">
          inflate to {air.inflatedInches}″ · leave {air.initialTailInches}″ tail
          {formed ? ` · ${air.formedCount}/${air.totalCount} bubbles` : ""}
        </span>
      </div>
      <AirBudgetBar air={air} color={balloon.color} />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        {balloon.burpNote ? (
          <p className="text-xs text-slate-500">Burp note: {balloon.burpNote}</p>
        ) : (
          <span />
        )}
        {canFit && (
          <button
            onClick={() =>
              onUpdateBalloon(balloon.id, {
                tailLengthInches: fitted,
                tailFingers: Math.round((fitted / 0.8) * 10) / 10,
                inflatedLengthInches: Math.round((60 - fitted) * 4) / 4,
              })
            }
            className="btn btn-secondary btn-xs"
            title="Set the inflation so the balloon just covers these bubbles with room for the twists"
          >
            Inflate just enough · {fitted}″ tail
          </button>
        )}
      </div>
    </div>
  );
};
