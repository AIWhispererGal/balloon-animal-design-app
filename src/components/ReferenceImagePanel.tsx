"use client";

import React, { useState } from "react";
import { Eye, EyeOff, FlipHorizontal2, ImageUp, Layers2, PictureInPicture2, X } from "lucide-react";

/** How the reference photo sits in the viewport */
export type ReferenceMode = "corner" | "overlay";
type CornerSize = "sm" | "md" | "lg";

interface ReferenceViewSettings {
  mode: ReferenceMode;
  size: CornerSize;
  opacity: number;
  mirrored: boolean;
  side: "left" | "right";
}

const SETTINGS_KEY = "twistcraft.reference.view.v1";
const DEFAULTS: ReferenceViewSettings = { mode: "corner", size: "md", opacity: 0.55, mirrored: false, side: "right" };
const CORNER_WIDTH: Record<CornerSize, string> = { sm: "w-40", md: "w-60", lg: "w-80" };

function readSettings(): ReferenceViewSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw) as Partial<ReferenceViewSettings>;
    return {
      mode: p.mode === "overlay" ? "overlay" : "corner",
      size: p.size === "sm" || p.size === "lg" ? p.size : "md",
      opacity: typeof p.opacity === "number" ? Math.min(1, Math.max(0.1, p.opacity)) : DEFAULTS.opacity,
      mirrored: !!p.mirrored,
      side: p.side === "left" ? "left" : "right",
    };
  } catch {
    return DEFAULTS;
  }
}

interface ReferenceImagePanelProps {
  src: string;
  visible: boolean;
  onToggleVisible: () => void;
  onReplace: (file: File) => void;
  onRemove: () => void;
}

/**
 * The reference photo a twister sculpts against. Sits in a corner of the 3D
 * viewport (like a photo propped next to the workbench) or is laid translucently
 * over the whole viewport so the balloon model can be lined up on top of it.
 * The photo itself is part of the design; how it is shown is a per-browser preference.
 */
export const ReferenceImagePanel: React.FC<ReferenceImagePanelProps> = ({ src, visible, onToggleVisible, onReplace, onRemove }) => {
  // The editor only renders after mount, so the browser preference can be read up front
  const [settings, setSettings] = useState<ReferenceViewSettings>(() => (typeof window === "undefined" ? DEFAULTS : readSettings()));
  const update = (patch: Partial<ReferenceViewSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {
        // preference only
      }
      return next;
    });
  };

  const transform = settings.mirrored ? "scaleX(-1)" : undefined;
  const btn = (active: boolean) =>
    `inline-flex h-6 w-6 items-center justify-center rounded-md border text-[11px] transition ${
      active ? "border-amber-400/60 bg-amber-400/20 text-amber-200" : "border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-500"
    }`;

  const controls = (
    <div className="flex flex-wrap items-center gap-1 px-1.5 py-1" onMouseDown={(e) => e.stopPropagation()}>
      <button onClick={onToggleVisible} className={btn(false)} title={visible ? "Hide reference" : "Show reference"}>
        {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      </button>
      <button
        onClick={() => update({ mode: settings.mode === "corner" ? "overlay" : "corner" })}
        className={btn(settings.mode === "overlay")}
        title={settings.mode === "corner" ? "Lay the photo over the whole viewport to line the model up on it" : "Put the photo back in the corner"}
      >
        {settings.mode === "corner" ? <Layers2 className="h-3.5 w-3.5" /> : <PictureInPicture2 className="h-3.5 w-3.5" />}
      </button>
      <button onClick={() => update({ mirrored: !settings.mirrored })} className={btn(settings.mirrored)} title="Mirror the photo (the model faces the other way)">
        <FlipHorizontal2 className="h-3.5 w-3.5" />
      </button>
      {settings.mode === "corner" && (
        <>
          {(["sm", "md", "lg"] as CornerSize[]).map((s) => (
            <button key={s} onClick={() => update({ size: s })} className={btn(settings.size === s)} title={`${s === "sm" ? "Small" : s === "md" ? "Medium" : "Large"} thumbnail`}>
              {s.toUpperCase()[0]}
            </button>
          ))}
          <button onClick={() => update({ side: settings.side === "left" ? "right" : "left" })} className={btn(false)} title="Move to the other corner">
            {settings.side === "left" ? "→" : "←"}
          </button>
        </>
      )}
      <input
        type="range"
        min={10}
        max={100}
        value={Math.round(settings.opacity * 100)}
        onChange={(e) => update({ opacity: Number(e.target.value) / 100 })}
        className="h-1 w-16 accent-amber-400"
        title="Opacity"
      />
      <label className={btn(false)} title="Replace the photo">
        <ImageUp className="h-3.5 w-3.5" />
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onReplace(f);
            e.target.value = "";
          }}
        />
      </label>
      <button onClick={onRemove} className={btn(false)} title="Remove the reference from this design">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  if (!visible) {
    return (
      <div className="pointer-events-auto absolute right-3 top-14 z-20">
        <button onClick={onToggleVisible} className="hud flex items-center gap-1.5 px-2 py-1 text-[11px] text-slate-300" title="Show the reference photo">
          <EyeOff className="h-3.5 w-3.5" /> Reference hidden
        </button>
      </div>
    );
  }

  if (settings.mode === "overlay") {
    return (
      <>
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="Reference" className="max-h-full max-w-full object-contain" style={{ opacity: settings.opacity, transform }} draggable={false} />
        </div>
        <div className="pointer-events-auto absolute right-3 top-14 z-20 hud">{controls}</div>
      </>
    );
  }

  return (
    <div className={`pointer-events-auto absolute top-14 z-20 ${settings.side === "left" ? "left-3" : "right-3"} ${CORNER_WIDTH[settings.size]} hud overflow-hidden`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Reference" className="block w-full object-contain" style={{ opacity: Math.max(settings.opacity, 0.35), transform, maxHeight: "60vh" }} draggable={false} />
      {controls}
    </div>
  );
};
