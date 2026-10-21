"use client";

import React, { useMemo } from "react";
import { BalloonSpec, BubbleSpec, StepSpec, TwistType } from "@/types/balloon";
import { TWIST_ENCYCLOPEDIA } from "@/lib/balloonConstants";
import {
  BubbleLayout,
  UNIT,
  Vec3,
  computeBalloonLayout,
  getStepVisibility,
} from "@/lib/balloonLayout";

interface StepVisualDiagramProps {
  twistType: TwistType;
  diagramType?: string;
  balloonColor?: string;
  balloonSize?: string;
  bubbleLabels?: string[];
  tailRemainingInches?: number;
  /** Live sculpture context — when present, draws the exact simulated 3D build state at this step! */
  balloons?: BalloonSpec[];
  bubbles?: BubbleSpec[];
  steps?: StepSpec[];
  stepIndex?: number;
  className?: string;
}

function projectIso(p: Vec3): [number, number] {
  return [p[0] + p[2] * 0.36, -p[1] + p[2] * 0.16];
}

export const StepVisualDiagram: React.FC<StepVisualDiagramProps> = ({
  twistType,
  balloonColor = "#EA580C",
  balloonSize = "260",
  tailRemainingInches = 4,
  balloons,
  bubbles,
  steps,
  stepIndex,
  className = "w-full h-44",
}) => {
  const simView = useMemo(() => {
    if (!balloons || !bubbles || !steps || stepIndex === undefined || bubbles.length === 0) {
      return null;
    }
    const { layouts, chains, joints } = computeBalloonLayout(balloons, bubbles);
    const vis = getStepVisibility(steps, bubbles, balloons, stepIndex);

    // Compute bounds over full sculpture + any trailing tube so framing stays steady across steps
    const pts: Array<[number, number]> = [];
    layouts.forEach((l) => {
      pts.push(projectIso(l.start), projectIso(l.end), projectIso(l.mid));
    });

    // Build trailing tubes for introduced balloons with unformed bubbles
    const trailingTubes: Array<{
      color: string;
      p0: [number, number];
      p1: [number, number];
      p2: [number, number];
      radius: number;
      remInches: number;
    }> = [];

    balloons.forEach((bal) => {
      if (!vis.introducedBalloons.has(bal.id)) return;
      const bLayouts = layouts.filter((l) => l.bubble.balloonId === bal.id);
      if (bLayouts.length === 0) return;
      const formedL = bLayouts.filter((l) => vis.formed.has(l.index));
      const unformedL = bLayouts.filter((l) => !vis.formed.has(l.index));
      if (unformedL.length > 0) {
        const lastFormed = formedL[formedL.length - 1];
        const origin = lastFormed ? lastFormed.chainEnd : bLayouts[0].start;
        const dirR = lastFormed ? lastFormed.chainDir : bLayouts[0].dir;
        const remIn = unformedL.reduce((s, l) => s + (l.bubble.lengthInches || 0), 0);
        // Cap visual preview length so a 35" raw balloon doesn't dwarf small bubbles in the diagram
        const visLen = Math.min(4.5, Math.max(1.4, remIn * UNIT * 0.42));
        const midPt: Vec3 = [
          origin[0] + dirR[0] * visLen * 0.55,
          origin[1] + dirR[1] * visLen * 0.55 - 0.12,
          origin[2] + dirR[2] * visLen * 0.55,
        ];
        const endPt: Vec3 = [
          origin[0] + dirR[0] * visLen,
          origin[1] + dirR[1] * visLen - 0.32,
          origin[2] + dirR[2] * visLen,
        ];
        const chain = chains.get(bal.id);
        const t0 = projectIso(origin);
        const t1 = projectIso(midPt);
        const t2 = projectIso(endPt);
        pts.push(t0, t2);
        trailingTubes.push({
          color: bal.color,
          p0: t0,
          p1: t1,
          p2: t2,
          radius: chain?.radiusUnits ?? 0.55,
          remInches: Math.round(remIn * 10) / 10,
        });
      }
    });

    if (pts.length === 0) return null;

    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    pts.forEach(([x, y]) => {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });

    const W = 380;
    const H = 168;
    const padX = 44;
    const padY = 28;
    const spanX = Math.max(2.2, maxX - minX);
    const spanY = Math.max(2.0, maxY - minY);
    const scale = Math.min((W - padX * 2) / spanX, (H - padY * 2) / spanY);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const toSvg = ([x, y]: [number, number]): [number, number] => [
      W / 2 + (x - cx) * scale,
      H / 2 + (y - cy) * scale,
    ];

    return {
      W,
      H,
      scale,
      layouts,
      joints,
      vis,
      trailingTubes,
      toSvg,
    };
  }, [balloons, bubbles, steps, stepIndex]);

  // Live 1-to-1 projection of the actual 3D step state!
  if (simView) {
    const { W, H, scale, layouts, joints, vis, trailingTubes, toSvg } = simView;
    const twistMeta = TWIST_ENCYCLOPEDIA[twistType] || TWIST_ENCYCLOPEDIA.basic;
    const uniqueColors = Array.from(
      new Set([
        ...layouts.map((l) => l.bubble.color),
        ...trailingTubes.map((t) => t.color),
      ])
    );

    const renderBubbleSvg = (l: BubbleLayout, ghost: boolean, ghostOpacity = 0.13) => {
      const isActive = !ghost && vis.active.has(l.index);
      const gradId = `simgrad-${uniqueColors.indexOf(l.bubble.color)}-${stepIndex ?? 0}`;
      const strokeW = Math.max(6, Math.min(22, l.radiusUnits * 2 * scale * 0.78));
      const [sx, sy] = toSvg(projectIso(l.start));
      const [ex, ey] = toSvg(projectIso(l.end));
      const [mx, my] = toSvg(projectIso(l.mid));

      const outlineColor = isActive ? "#FACC15" : "#0b1220";
      const opacity = ghost ? ghostOpacity : 1;

      if (l.kind === "loop") {
        // Teardrop petal path from base (sx, sy) looping out through (ex, ey) and back to (sx, sy)
        const dx = ex - sx;
        const dy = ey - sy;
        const lenPx = Math.max(12, Math.hypot(dx, dy));
        const nx = (-dy / lenPx) * Math.max(9, lenPx * 0.48);
        const ny = (dx / lenPx) * Math.max(9, lenPx * 0.48);
        const d = `M ${sx.toFixed(1)} ${sy.toFixed(1)} C ${(sx + dx * 0.8 + nx).toFixed(1)} ${(
          sy +
          dy * 0.8 +
          ny
        ).toFixed(1)}, ${(ex + nx * 0.45).toFixed(1)} ${(ey + ny * 0.45).toFixed(1)}, ${ex.toFixed(
          1
        )} ${ey.toFixed(1)} C ${(ex - nx * 0.45).toFixed(1)} ${(
          ey -
          ny * 0.45
        ).toFixed(1)}, ${(sx + dx * 0.8 - nx).toFixed(1)} ${(
          sy +
          dy * 0.8 -
          ny
        ).toFixed(1)}, ${sx.toFixed(1)} ${sy.toFixed(1)}`;
        return (
          <g key={`${ghost ? "g" : "b"}-${l.index}`} opacity={opacity}>
            {isActive && (
              <path
                d={d}
                fill="none"
                stroke="#FACC15"
                strokeWidth={strokeW * 0.62 + 5}
                strokeLinejoin="round"
                opacity={0.55}
              />
            )}
            <path
              d={d}
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth={Math.max(4.5, strokeW * 0.52)}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <path
              d={d}
              fill="none"
              stroke={outlineColor}
              strokeWidth={isActive ? 1.8 : 1.1}
              opacity={0.75}
            />
          </g>
        );
      }

      if (l.kind === "pinch" || l.kind === "bead" || l.kind === "tulip") {
        const rx = Math.max(5.5, strokeW * (l.kind === "tulip" ? 0.68 : 0.55));
        const ry = Math.max(4.5, strokeW * (l.kind === "pinch" ? 0.42 : 0.62));
        return (
          <g key={`${ghost ? "g" : "b"}-${l.index}`} opacity={opacity}>
            {isActive && (
              <ellipse cx={mx} cy={my} rx={rx + 4} ry={ry + 4} fill="none" stroke="#FACC15" strokeWidth="2.5" />
            )}
            <ellipse
              cx={mx}
              cy={my}
              rx={rx}
              ry={ry}
              fill={`url(#${gradId})`}
              stroke={outlineColor}
              strokeWidth={isActive ? 2 : 1.3}
            />
          </g>
        );
      }

      // Curved / spiral / straight latex capsule path
      const pathD =
        l.kind === "bent" || l.bowOut
          ? `M ${sx.toFixed(1)} ${sy.toFixed(1)} Q ${(mx * 1.15 - (sx + ex) * 0.075).toFixed(1)} ${(
              my * 1.15 -
              (sy + ey) * 0.075
            ).toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`
          : `M ${sx.toFixed(1)} ${sy.toFixed(1)} L ${ex.toFixed(1)} ${ey.toFixed(1)}`;

      return (
        <g key={`${ghost ? "g" : "b"}-${l.index}`} opacity={opacity}>
          {isActive && (
            <path
              d={pathD}
              fill="none"
              stroke="#FACC15"
              strokeWidth={strokeW + 5}
              strokeLinecap="round"
              opacity={0.6}
            />
          )}
          <path
            d={pathD}
            fill="none"
            stroke={outlineColor}
            strokeWidth={strokeW + 2.2}
            strokeLinecap="round"
          />
          <path
            d={pathD}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={strokeW}
            strokeLinecap="round"
          />
          {/* Glossy latex specular highlight ribbon */}
          <path
            d={pathD}
            fill="none"
            stroke="#ffffff"
            strokeWidth={Math.max(1.4, strokeW * 0.22)}
            strokeLinecap="round"
            opacity={0.35}
          />
        </g>
      );
    };

    const formedLayouts = layouts.filter((layout) => vis.formed.has(layout.index));
    const bubbleStep = new Map<number, number>();
    steps?.forEach((step, futureStepIndex) => {
      step.bubbleIndices.forEach((bubbleIndex) => {
        if (!bubbleStep.has(bubbleIndex)) bubbleStep.set(bubbleIndex, futureStepIndex);
      });
    });
    const ghostLayouts = layouts
      .map((layout) => ({
        layout,
        distance: (bubbleStep.get(layout.index) ?? Number.POSITIVE_INFINITY) - (stepIndex ?? 0),
      }))
      .filter(({ layout, distance }) => !vis.formed.has(layout.index) && distance >= 1 && distance <= 3);
    const activeLayouts = formedLayouts.filter((layout) => vis.active.has(layout.index));

    return (
      <div
        className={`relative flex flex-col items-center justify-between bg-slate-950/90 p-2.5 rounded-xl border border-slate-800 overflow-hidden ${className}`}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
          <defs>
            {uniqueColors.map((hex, i) => (
              <linearGradient
                key={hex + i}
                id={`simgrad-${i}-${stepIndex ?? 0}`}
                x1="0"
                y1="0"
                x2="0.4"
                y2="1"
              >
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.65" />
                <stop offset="28%" stopColor={hex} />
                <stop offset="100%" stopColor={hex} stopOpacity="0.72" />
              </linearGradient>
            ))}
          </defs>

          {/* Subtle blueprint target ghost of upcoming bubbles */}
          {ghostLayouts.map(({ layout, distance }) =>
            renderBubbleSvg(layout, true, distance === 1 ? 0.3 : distance === 2 ? 0.13 : 0.055)
          )}

          {/* Remaining untwisted inflated balloon tube trailing from active joint */}
          {trailingTubes.map((t, i) => {
            const gradId = `simgrad-${uniqueColors.indexOf(t.color)}-${stepIndex ?? 0}`;
            const [x0, y0] = toSvg(t.p0);
            const [x1, y1] = toSvg(t.p1);
            const [x2, y2] = toSvg(t.p2);
            const w = Math.max(5, Math.min(16, t.radius * 2 * scale * 0.72));
            const d = `M ${x0.toFixed(1)} ${y0.toFixed(1)} Q ${x1.toFixed(1)} ${y1.toFixed(
              1
            )} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
            return (
              <g key={`trail-${i}`} opacity={0.78}>
                <path d={d} fill="none" stroke="#0b1220" strokeWidth={w + 2} strokeLinecap="round" />
                <path
                  d={d}
                  fill="none"
                  stroke={`url(#${gradId})`}
                  strokeWidth={w}
                  strokeLinecap="round"
                  strokeDasharray="6 3"
                />
                {/* Uninflated tail nib */}
                <path
                  d={`M ${x2.toFixed(1)} ${y2.toFixed(1)} q 12 4 18 11`}
                  fill="none"
                  stroke={t.color}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                />
                <text
                  x={Math.min(W - 44, x2 + 10)}
                  y={Math.min(H - 8, y2 + 18)}
                  fill="#94a3b8"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {t.remInches}″ left
                </text>
              </g>
            );
          })}

          {/* Formed bubbles up to this step */}
          {formedLayouts.map((l) => renderBubbleSvg(l, false))}

          {/* Joint status dots & active bubble callouts */}
          {activeLayouts.map((l) => {
            const [mx, my] = toSvg(projectIso(l.mid));
            const endJoint = joints[l.endJointId];
            const [jx, jy] = toSvg(projectIso(endJoint.pos));
            return (
              <g key={`tag-${l.index}`}>
                <circle
                  cx={jx}
                  cy={jy}
                  r={4.2}
                  fill={
                    l.endSeamWillUntwist
                      ? "#F43F5E"
                      : endJoint.isLocked
                      ? "#10B981"
                      : "#F59E0B"
                  }
                  stroke="#0f172a"
                  strokeWidth="1.5"
                />
                <g transform={`translate(${mx.toFixed(1)}, ${Math.max(14, my - 13).toFixed(1)})`}>
                  <rect
                    x="-28"
                    y="-10"
                    width="56"
                    height="14"
                    rx="7"
                    fill="#FACC15"
                    stroke="#0f172a"
                    strokeWidth="1.2"
                  />
                  <text
                    x="0"
                    y="0"
                    textAnchor="middle"
                    fill="#0f172a"
                    fontSize="8.5"
                    fontWeight="bold"
                  >
                    #{l.index + 1} · {l.bubble.lengthInches}″
                  </text>
                </g>
              </g>
            );
          })}
        </svg>

        <div className="w-full flex items-center justify-between px-1.5 text-[10px] text-slate-400">
          <span className="text-amber-300 font-semibold truncate">
            🔄 {twistMeta.name} — {vis.formed.size}/{layouts.length} bubbles built
          </span>
          <span className="font-mono text-slate-400 shrink-0">
            <span className="text-emerald-400">●</span> lock{" "}
            <span className="text-amber-400">●</span> hold{" "}
            <span className="text-rose-400">●</span> untwists
          </span>
        </div>
      </div>
    );
  }

  /* -------- Standalone technique reference SVG (used in Encyclopedia modal) -------- */
  const strokeColor = "#0f172a";
  const highlightColor = "#FACC15";

  switch (twistType) {
    case "lock":
      return (
        <div
          className={`flex flex-col items-center justify-center bg-slate-900/60 p-3 rounded-lg border border-slate-800 ${className}`}
        >
          <svg viewBox="0 0 240 140" className="w-full h-full max-h-36">
            <defs>
              <linearGradient id="balGradLock" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fff" stopOpacity="0.4" />
                <stop offset="40%" stopColor={balloonColor} />
                <stop offset="100%" stopColor="#1e1e2f" stopOpacity="0.8" />
              </linearGradient>
            </defs>
            <rect x="20" y="55" width="45" height="30" rx="15" fill="url(#balGradLock)" stroke={strokeColor} strokeWidth="2.5" />
            <text x="42" y="74" textAnchor="middle" fill="#fff" fontSize="9.5" fontWeight="bold">Base</text>
            <path
              d="M 68 65 C 100 22, 152 22, 170 52 C 178 65, 168 74, 150 72 C 125 70, 90 70, 68 70"
              fill="url(#balGradLock)"
              stroke={strokeColor}
              strokeWidth="2.5"
            />
            <text x="125" y="46" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">Bubble A</text>
            <path
              d="M 68 74 C 90 74, 125 74, 150 72 C 168 70, 178 80, 170 94 C 152 122, 100 122, 68 80"
              fill="url(#balGradLock)"
              stroke={strokeColor}
              strokeWidth="2.5"
            />
            <text x="125" y="108" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">Bubble B</text>
            <path d="M 72 52 A 20 20 0 1 1 72 88" fill="none" stroke={highlightColor} strokeWidth="3.2" strokeDasharray="4 2" />
            <text x="202" y="74" textAnchor="middle" fill={highlightColor} fontSize="10.5" fontWeight="bold">Lock 3×</text>
          </svg>
          <span className="text-[11px] font-semibold text-amber-400 mt-1">
            Lock Twist: Fold two equal bubbles side-by-side &amp; rotate joint 3×
          </span>
        </div>
      );

    case "pinch":
    case "toe":
      return (
        <div
          className={`flex flex-col items-center justify-center bg-slate-900/60 p-3 rounded-lg border border-slate-800 ${className}`}
        >
          <svg viewBox="0 0 240 140" className="w-full h-full max-h-36">
            <rect x="25" y="62" width="62" height="28" rx="14" fill={balloonColor} stroke={strokeColor} strokeWidth="2.5" />
            <rect x="148" y="62" width="66" height="28" rx="14" fill={balloonColor} stroke={strokeColor} strokeWidth="2.5" />
            <ellipse cx="118" cy="40" rx="20" ry="15" fill={balloonColor} stroke={strokeColor} strokeWidth="2.5" />
            <text x="118" y="44" textAnchor="middle" fill="#fff" fontSize="9.5" fontWeight="bold">1″ Pinch</text>
            <ellipse cx="118" cy="40" rx="26" ry="9" fill="none" stroke={highlightColor} strokeWidth="2.2" strokeDasharray="3 3" />
            <text x="118" y="114" textAnchor="middle" fill="#cbd5e1" fontSize="10">
              Self-locking friction joint — holds 90° bends hands-free
            </text>
          </svg>
          <span className="text-[11px] font-semibold text-amber-400 mt-1">
            {twistType === "toe" ? "Toe Twist: Mini paw pinch lock" : "Pinch / Ear Twist: Pull up & rotate 360°"}
          </span>
        </div>
      );

    case "loop":
      return (
        <div
          className={`flex flex-col items-center justify-center bg-slate-900/60 p-3 rounded-lg border border-slate-800 ${className}`}
        >
          <svg viewBox="0 0 240 140" className="w-full h-full max-h-36">
            <rect x="20" y="64" width="52" height="26" rx="13" fill={balloonColor} stroke={strokeColor} strokeWidth="2.5" />
            <path
              d="M 74 77 C 110 18, 206 24, 206 77 C 206 130, 110 136, 74 77 Z"
              fill="none"
              stroke={balloonColor}
              strokeWidth="18"
              strokeLinejoin="round"
            />
            <ellipse cx="74" cy="77" rx="5" ry="15" fill={highlightColor} stroke={strokeColor} strokeWidth="2" />
          </svg>
          <span className="text-[11px] font-semibold text-amber-400 mt-1">
            Loop Twist: Fold teardrop petal &amp; lock both ends at the base joint
          </span>
        </div>
      );

    default:
      return (
        <div
          className={`flex flex-col items-center justify-center bg-slate-900/60 p-3 rounded-lg border border-slate-800 ${className}`}
        >
          <svg viewBox="0 0 240 140" className="w-full h-full max-h-36">
            <rect x="26" y="54" width="132" height="32" rx="16" fill={balloonColor} stroke={strokeColor} strokeWidth="2.5" />
            <text x="92" y="74" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="bold">
              {balloonSize} Latex ({TWIST_ENCYCLOPEDIA[twistType]?.name || twistType})
            </text>
            <line x1="112" y1="50" x2="112" y2="90" stroke={highlightColor} strokeWidth="3" strokeDasharray="3 2" />
            <path d="M 158 68 C 180 68, 198 74, 218 82" fill="none" stroke={balloonColor} strokeWidth="5" strokeLinecap="round" />
            <text x="190" y="108" textAnchor="middle" fill="#38bdf8" fontSize="10" fontWeight="bold">
              {tailRemainingInches.toFixed(1)}″ Tail
            </text>
          </svg>
          <span className="text-[11px] font-semibold text-slate-300 mt-1">
            {TWIST_ENCYCLOPEDIA[twistType]?.name || "Basic Twist"}: Rotate 3–4 full turns in the same direction
          </span>
        </div>
      );
  }
};
