"use client";

import React from "react";
import { ComplexityLevel, FullDesign } from "@/types/balloon";

interface ComplexityTierSelectorProps {
  designs: Record<ComplexityLevel, FullDesign>;
  activeComplexity: ComplexityLevel;
  onSelectComplexity: (complexity: ComplexityLevel) => void;
  className?: string;
}

export const ComplexityTierSelector: React.FC<ComplexityTierSelectorProps> = ({
  designs,
  activeComplexity,
  onSelectComplexity,
  className = "",
}) => {
  const tiers: Array<{
    key: ComplexityLevel;
    title: string;
    subtitle: string;
    badge: string;
    badgeColor: string;
    description: string;
  }> = [
    {
      key: "beginner",
      title: "Beginner Line Work",
      subtitle: "1-Balloon Busker",
      badge: "Level 1",
      badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      description: "Fast 45-second party sculptures using 1 balloon with basic and lock twists.",
    },
    {
      key: "intermediate",
      title: "Intermediate Deluxe",
      subtitle: "2-3 Multi-Balloons",
      badge: "Level 2",
      badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
      description: "Richer detail featuring pinch/ear twists, toe twist paws, and accent loops.",
    },
    {
      key: "advanced",
      title: "Advanced Masterpiece",
      subtitle: "Deluxe Multi-Armature",
      badge: "Level 3",
      badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/30",
      description: "Showpiece with 360 armature, apple twists, bird body roll-through & spirals.",
    },
  ];

  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-3.5 ${className}`}>
      {tiers.map((t) => {
        const design = designs[t.key];
        const isSelected = activeComplexity === t.key;

        return (
          <div
            key={t.key}
            onClick={() => onSelectComplexity(t.key)}
            className={`cursor-pointer rounded-2xl p-4 transition border relative overflow-hidden flex flex-col justify-between ${
              isSelected
                ? "bg-slate-900 border-amber-500 ring-2 ring-amber-500/30 shadow-xl"
                : "bg-slate-900/60 border-slate-800 hover:bg-slate-900/90 hover:border-slate-700"
            }`}
          >
            {/* Top row */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${t.badgeColor}`}>
                  {t.badge}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {design?.balloons.length || 1} Balloon{design?.balloons.length !== 1 ? "s" : ""}
                </span>
              </div>

              <h3 className={`font-bold text-sm tracking-wide ${isSelected ? "text-amber-400" : "text-white"}`}>
                {t.title}
              </h3>
              <div className="text-xs text-slate-400 font-medium">{t.subtitle}</div>

              <p className="text-[11px] text-slate-400 mt-2 line-clamp-2">
                {t.description}
              </p>
            </div>

            {/* Complexity Metrics Footer */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span className="font-mono font-bold text-slate-200">
                  {design?.bubbles.length || 0} bubbles
                </span>
              </div>

              <div className="flex items-center gap-1">
                {design?.balloons.map((b, i) => (
                  <span
                    key={b.id || i}
                    className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-xs"
                    style={{ backgroundColor: b.color }}
                    title={`${b.size} ${b.colorName}`}
                  />
                ))}
              </div>

              <span
                className={`text-[11px] font-bold ${
                  isSelected ? "text-amber-400" : "text-slate-500"
                }`}
              >
                {isSelected ? "● Active View" : "Select"}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
