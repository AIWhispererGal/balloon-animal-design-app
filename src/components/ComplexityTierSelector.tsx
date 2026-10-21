"use client";

import React from "react";
import { ComplexityLevel, FullDesign } from "@/types/balloon";

interface ComplexityTierSelectorProps {
  designs: Record<ComplexityLevel, FullDesign>;
  activeComplexity: ComplexityLevel;
  onSelectComplexity: (complexity: ComplexityLevel) => void;
  className?: string;
}

const TIERS: Array<{ key: ComplexityLevel; label: string; hint: string }> = [
  { key: "beginner", label: "Beginner", hint: "One balloon, basic and lock twists. 45-second party sculptures." },
  { key: "intermediate", label: "Intermediate", hint: "Two or three balloons with pinch twists, toe paws and loops." },
  { key: "advanced", label: "Advanced", hint: "Showpiece with 360 armature, apple twists, bird bodies and spirals." },
];

/** Compact segmented control for switching between the three generated tiers. */
export const ComplexityTierSelector: React.FC<ComplexityTierSelectorProps> = ({
  designs,
  activeComplexity,
  onSelectComplexity,
  className = "",
}) => (
  <div className={`seg shrink-0 ${className}`} role="tablist" aria-label="Complexity tier">
    {TIERS.map((t) => {
      const d = designs[t.key];
      const active = activeComplexity === t.key;
      return (
        <button
          key={t.key}
          role="tab"
          aria-selected={active}
          onClick={() => onSelectComplexity(t.key)}
          className={`seg-item flex items-center gap-1.5 ${active ? "seg-item-active" : ""}`}
          title={`${t.hint} (${d?.bubbles.length ?? 0} bubbles, ${d?.balloons.length ?? 0} balloon${
            d?.balloons.length === 1 ? "" : "s"
          })`}
        >
          <span>{t.label}</span>
          <span className={`font-mono text-[10px] ${active ? "text-slate-800" : "text-slate-500"}`}>
            {d?.bubbles.length ?? 0}
          </span>
        </button>
      );
    })}
  </div>
);
