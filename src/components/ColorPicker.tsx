"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, Palette } from "lucide-react";
import { TWISTER_COLORS } from "@/lib/balloonConstants";

interface ColorPickerProps {
  value: string;
  valueName?: string;
  onChange: (hex: string, name: string) => void;
  /** Trigger label; defaults to the current color name */
  label?: string;
  size?: "sm" | "md";
  align?: "left" | "right";
  className?: string;
}

const CATEGORIES = ["Standard", "Fashion", "Pastel", "Metallic"] as const;

function nearestName(hex: string): string {
  const match = TWISTER_COLORS.find((c) => c.hex.toLowerCase() === hex.toLowerCase());
  return match ? match.name : `Custom ${hex.toUpperCase()}`;
}

/**
 * Popover color picker for a balloon. Offers the named twister latex colors
 * grouped by family plus a free hex / native color input for anything else.
 */
export const ColorPicker: React.FC<ColorPickerProps> = ({
  value,
  valueName,
  onChange,
  label,
  size = "md",
  align = "left",
  className = "",
}) => {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(value);
  const rootRef = useRef<HTMLDivElement>(null);

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

  const commitCustom = (hex: string) => {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return;
    setCustom(hex);
    onChange(hex, nearestName(hex));
  };

  const dot = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <div ref={rootRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => {
          setCustom(value);
          setOpen((o) => !o);
        }}
        className={`btn btn-secondary ${size === "sm" ? "btn-xs" : ""}`}
        title="Change balloon color"
      >
        <span className={`${dot} rounded-full border border-white/30`} style={{ backgroundColor: value }} />
        <span className="max-w-[9rem] truncate">{label ?? valueName ?? nearestName(value)}</span>
        <Palette className="h-3.5 w-3.5 opacity-60" />
      </button>

      {open && (
        <div
          className={`hud animate-fade-in absolute z-50 mt-1.5 w-[272px] p-3 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {CATEGORIES.map((cat) => {
            const colors = TWISTER_COLORS.filter((c) => c.category === cat);
            if (colors.length === 0) return null;
            return (
              <div key={cat} className="mb-2.5 last:mb-0">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {cat}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {colors.map((c) => {
                    const active = c.hex.toLowerCase() === value.toLowerCase();
                    return (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => {
                          onChange(c.hex, c.name);
                          setOpen(false);
                        }}
                        className={`swatch relative h-6 w-6 ${active ? "swatch-active" : ""}`}
                        style={{ backgroundColor: c.hex }}
                        title={c.name}
                      >
                        {active && (
                          <Check
                            className="absolute inset-0 m-auto h-3.5 w-3.5"
                            style={{ color: c.hex === "#F8FAFC" ? "#0f172a" : "#fff" }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="mt-3 border-t border-slate-800 pt-2.5">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Custom
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={/^#[0-9a-f]{6}$/i.test(custom) ? custom : "#ffffff"}
                onChange={(e) => commitCustom(e.target.value)}
                className="h-7 w-9 cursor-pointer rounded border border-slate-700 bg-transparent p-0"
                title="Pick any color"
              />
              <input
                type="text"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onBlur={() => commitCustom(custom)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitCustom(custom);
                }}
                className="input input-sm font-mono"
                placeholder="#RRGGBB"
                spellCheck={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
