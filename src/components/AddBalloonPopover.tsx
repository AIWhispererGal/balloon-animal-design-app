"use client";

import React, { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { BalloonSize, BubbleSpec, JointAnchorRef } from "@/types/balloon";
import { BALLOON_SIZE_DETAILS, TWISTER_COLORS } from "@/lib/balloonConstants";
import { ColorPicker } from "./ColorPicker";

export interface AddBalloonRequest {
  size: BalloonSize;
  colorHex: string;
  colorName: string;
  /** Joint the nozzle knot ties into; null = free-standing balloon */
  attachTo: JointAnchorRef | null;
  /** Start the balloon with one basic bubble so there is something to grab */
  withStarterBubble: boolean;
}

interface AddBalloonPopoverProps {
  bubbles: BubbleSpec[];
  selectedBubbleIndex: number | null;
  usedColors: string[];
  onAdd: (req: AddBalloonRequest) => void;
  compact?: boolean;
  align?: "left" | "right";
  /** Open the panel above the button when there is no room below */
  direction?: "down" | "up";
  className?: string;
}

/** Pick a color that is not already in use so a new balloon reads distinctly */
function suggestColor(used: string[]): { hex: string; name: string } {
  const usedSet = new Set(used.map((c) => c.toLowerCase()));
  const pick = TWISTER_COLORS.find((c) => !usedSet.has(c.hex.toLowerCase())) ?? TWISTER_COLORS[0];
  return { hex: pick.hex, name: pick.name };
}

export const AddBalloonPopover: React.FC<AddBalloonPopoverProps> = ({
  bubbles,
  selectedBubbleIndex,
  usedColors,
  onAdd,
  compact = false,
  align = "left",
  direction = "down",
  className = "",
}) => {
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState<BalloonSize>("260");
  const [color, setColor] = useState(() => suggestColor(usedColors));
  const [attachMode, setAttachMode] = useState<"end" | "start" | "free">(
    bubbles.length > 0 ? "end" : "free"
  );
  const [starter, setStarter] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);

  const toggle = () => {
    setOpen((o) => {
      if (!o) {
        setColor(suggestColor(usedColors));
        setAttachMode(bubbles.length > 0 ? "end" : "free");
      }
      return !o;
    });
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const anchorIdx =
    selectedBubbleIndex !== null && bubbles[selectedBubbleIndex]
      ? selectedBubbleIndex
      : bubbles.length > 0
      ? bubbles.length - 1
      : null;
  const anchorBubble = anchorIdx !== null ? bubbles[anchorIdx] : null;

  const submit = () => {
    onAdd({
      size,
      colorHex: color.hex,
      colorName: color.name,
      attachTo:
        attachMode === "free" || anchorIdx === null
          ? null
          : { bubbleIndex: anchorIdx, end: attachMode },
      withStarterBubble: starter,
    });
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={toggle}
        className={`btn ${compact ? "btn-secondary btn-xs" : "btn-primary"}`}
        title="Add another balloon to the sculpture"
      >
        <Plus className="h-3.5 w-3.5" />
        <span>Add balloon</span>
      </button>

      {open && (
        <div
          className={`hud animate-fade-in absolute z-50 w-[300px] space-y-3 p-3.5 ${
            align === "right" ? "right-0" : "left-0"
          } ${direction === "up" ? "bottom-full mb-1.5" : "mt-1.5"}`}
        >
          <div>
            <div className="label">Size</div>
            <div className="seg w-full">
              {(["160", "260", "360"] as BalloonSize[]).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setSize(sz)}
                  className={`seg-item flex-1 font-mono ${size === sz ? "seg-item-active" : ""}`}
                  title={BALLOON_SIZE_DETAILS[sz].description}
                >
                  {sz}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">{BALLOON_SIZE_DETAILS[size].bestFor}</p>
          </div>

          <div>
            <div className="label">Color</div>
            <ColorPicker
              value={color.hex}
              valueName={color.name}
              onChange={(hex, name) => setColor({ hex, name })}
            />
          </div>

          <div>
            <div className="label">Attach</div>
            <div className="space-y-1 text-xs">
              {anchorBubble && (
                <>
                  <label className="flex cursor-pointer items-center gap-2 text-slate-300">
                    <input
                      type="radio"
                      name="attach"
                      checked={attachMode === "end"}
                      onChange={() => setAttachMode("end")}
                      className="accent-amber-400"
                    />
                    Tie knot into the joint after <strong className="text-white">#{anchorIdx! + 1} {anchorBubble.label}</strong>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-slate-300">
                    <input
                      type="radio"
                      name="attach"
                      checked={attachMode === "start"}
                      onChange={() => setAttachMode("start")}
                      className="accent-amber-400"
                    />
                    Tie knot into the joint before it
                  </label>
                </>
              )}
              <label className="flex cursor-pointer items-center gap-2 text-slate-300">
                <input
                  type="radio"
                  name="attach"
                  checked={attachMode === "free"}
                  onChange={() => setAttachMode("free")}
                  className="accent-amber-400"
                />
                Free-standing (tie it in later)
              </label>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={starter}
              onChange={(e) => setStarter(e.target.checked)}
              className="accent-amber-400"
            />
            Start with one bubble already twisted
          </label>

          <button type="button" onClick={submit} className="btn btn-primary w-full">
            <Plus className="h-3.5 w-3.5" /> Add {size} {color.name}
          </button>
        </div>
      )}
    </div>
  );
};
