"use client";

import React, { useEffect, useRef, useState } from "react";
import { Scissors } from "lucide-react";
import { BubbleSpec } from "@/types/balloon";
import { SplitMode } from "@/lib/designEdits";
import { roundQuarter } from "@/lib/balloonLayout";

interface SplitMenuProps {
  bubble: BubbleSpec;
  onSplit: (mode: SplitMode) => void;
  /** Render the options inline instead of behind a button */
  inline?: boolean;
  align?: "left" | "right";
  compact?: boolean;
}

/**
 * Ways to divide one bubble into more twists without changing its total
 * length: equal parts, a lock pair, a pinch lock in the middle, or at a
 * precise distance from the start.
 */
export const SplitMenu: React.FC<SplitMenuProps> = ({
  bubble,
  onSplit,
  inline = false,
  align = "left",
  compact = false,
}) => {
  const [open, setOpen] = useState(false);
  /** Split point as a fraction of the bubble, so it stays sensible when the bubble changes */
  const [atFraction, setAtFraction] = useState(0.5);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const total = bubble.lengthInches;
  const canSplit = total >= 1;
  const maxAt = Math.max(0.5, total - 0.5);
  const atInches = Math.min(maxAt, Math.max(0.5, roundQuarter(total * atFraction)));
  const fire = (mode: SplitMode) => {
    onSplit(mode);
    setOpen(false);
  };

  const body = (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => fire({ kind: "equal", parts: 2 })} disabled={!canSplit} className="btn btn-secondary btn-xs" title="Two equal basic bubbles">
          Halves
        </button>
        <button onClick={() => fire({ kind: "equal", parts: 3 })} disabled={total < 1.5} className="btn btn-secondary btn-xs" title="Three equal basic bubbles">
          Thirds
        </button>
        <button onClick={() => fire({ kind: "lock_pair" })} disabled={!canSplit} className="btn btn-secondary btn-xs" title="Two equal bubbles folded and lock-twisted together (ears, legs)">
          Lock pair
        </button>
        <button onClick={() => fire({ kind: "pinch_between" })} disabled={total < 2} className="btn btn-secondary btn-xs" title="Two bubbles with a small pinch twist between them that locks the seam">
          Pinch between
        </button>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <span>at</span>
        <input
          type="range"
          min={0.5}
          max={maxAt}
          step={0.25}
          value={atInches}
          onChange={(e) => setAtFraction(parseFloat(e.target.value) / Math.max(0.5, total))}
          className="range flex-1"
          disabled={!canSplit}
        />
        <span className="w-12 text-right font-mono text-slate-200">{atInches}″</span>
        <button onClick={() => fire({ kind: "at", inches: atInches })} disabled={!canSplit} className="btn btn-primary btn-xs">
          Split
        </button>
      </div>
      {!canSplit && <p className="text-[11px] text-rose-300">Needs at least 1″ to split.</p>}
    </div>
  );

  if (inline) return body;

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`btn btn-secondary ${compact ? "btn-xs" : ""} ${open ? "btn-active" : ""}`}
        title="Split this bubble into more twists"
      >
        <Scissors className="h-3.5 w-3.5" />
        Split
      </button>
      {open && (
        <div className={`hud animate-fade-in absolute z-50 mt-1.5 w-[300px] p-3 ${align === "right" ? "right-0" : "left-0"}`}>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Split “{bubble.label}” ({total}″)
          </div>
          {body}
        </div>
      )}
    </div>
  );
};
