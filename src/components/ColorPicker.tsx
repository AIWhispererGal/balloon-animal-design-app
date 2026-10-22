"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, Palette, ShoppingCart } from "lucide-react";
import { TWISTER_COLORS } from "@/lib/balloonConstants";
import catalogJson from "@/data/balloonCatalog.json";
import { Catalog, CatalogItem, isAssortedItem } from "@/lib/recipeMath";

const catalog = catalogJson as Catalog;

interface ColorPickerProps {
  value: string;
  valueName?: string;
  onChange: (hex: string, name: string) => void;
  /** When given, the picker offers real packs of this balloon size from the shopping catalog */
  balloonSize?: string;
  /** Currently linked catalog pack, if any */
  catalogItemId?: string;
  onPickCatalogItem?: (item: CatalogItem) => void;
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

function sizeMatches(itemSize: string, balloonSize: string): boolean {
  if (balloonSize === "360") return itemSize === "360" || itemSize === "350";
  return itemSize === balloonSize;
}

/**
 * Popover color picker for a balloon. "Catalog" lists real packs you can buy
 * (brand, finish, color, price per balloon) for the balloon's size; "Palette"
 * offers generic latex colors and a free hex input.
 */
export const ColorPicker: React.FC<ColorPickerProps> = ({
  value,
  valueName,
  onChange,
  balloonSize,
  catalogItemId,
  onPickCatalogItem,
  label,
  size = "md",
  align = "left",
  className = "",
}) => {
  const hasCatalog = !!balloonSize && !!onPickCatalogItem && !catalog.sample;
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"catalog" | "palette">(hasCatalog ? "catalog" : "palette");
  const [custom, setCustom] = useState(value);
  const [search, setSearch] = useState("");
  const [brand, setBrand] = useState("all");
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

  const sizeItems = useMemo(
    () => (balloonSize ? catalog.items.filter((i) => sizeMatches(i.size, balloonSize) && !isAssortedItem(i)) : []),
    [balloonSize]
  );
  const brands = useMemo(() => Array.from(new Set(sizeItems.map((i) => i.brand))).sort(), [sizeItems]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sizeItems
      .filter((i) => (brand === "all" || i.brand === brand) && (!q || `${i.color} ${i.finish ?? ""} ${i.brand}`.toLowerCase().includes(q)))
      .sort((a, b) => a.color.localeCompare(b.color) || a.pricePerBalloon - b.pricePerBalloon)
      .slice(0, 80);
  }, [sizeItems, brand, search]);

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
          setTab(hasCatalog ? "catalog" : "palette");
          setOpen((o) => !o);
        }}
        className={`btn btn-secondary ${size === "sm" ? "btn-xs" : ""}`}
        title="Change balloon color"
      >
        <span className={`${dot} rounded-full border border-white/30`} style={{ backgroundColor: value }} />
        <span className="max-w-[10rem] truncate">{label ?? valueName ?? nearestName(value)}</span>
        <Palette className="h-3.5 w-3.5 opacity-60" />
      </button>

      {open && (
        <div
          className={`hud animate-fade-in absolute z-50 mt-1.5 w-[320px] p-3 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {hasCatalog && (
            <div className="seg mb-2.5 w-full">
              <button type="button" onClick={() => setTab("catalog")} className={`seg-item flex-1 ${tab === "catalog" ? "seg-item-active" : ""}`}>
                <ShoppingCart className="mr-1 inline h-3 w-3" /> Catalog · {balloonSize}
              </button>
              <button type="button" onClick={() => setTab("palette")} className={`seg-item flex-1 ${tab === "palette" ? "seg-item-active" : ""}`}>
                Palette
              </button>
            </div>
          )}

          {tab === "catalog" && hasCatalog ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search color or finish…"
                  className="input input-sm"
                  autoFocus
                />
                <select value={brand} onChange={(e) => setBrand(e.target.value)} className="select">
                  <option value="all">All</option>
                  {brands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div className="max-h-[300px] space-y-0.5 overflow-y-auto scrollbar-thin">
                {shown.length === 0 && <div className="p-3 text-center text-xs text-slate-500">No packs match.</div>}
                {shown.map((item) => {
                  const active = item.id === catalogItemId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onPickCatalogItem?.(item);
                        setOpen(false);
                      }}
                      className={`list-row w-full py-1 text-left ${active ? "list-row-active" : ""}`}
                      title={item.name}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-4 w-4 shrink-0 rounded-full border border-white/20" style={{ backgroundColor: item.hex ?? "#64748b" }} />
                        <div className="min-w-0">
                          <div className="truncate text-slate-100">
                            {item.color}
                            {item.finish && item.finish !== "standard" ? <span className="text-slate-500"> · {item.finish}</span> : null}
                          </div>
                          <div className="truncate text-[11px] text-slate-500">
                            {item.brand} · {item.packQty}/pack
                          </div>
                        </div>
                      </div>
                      <span className="shrink-0 font-mono text-[11px] text-slate-400">${item.pricePerBalloon.toFixed(3)}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-500">
                Picking a pack links this balloon to it, so the shopping recipe uses that exact product.
              </p>
            </div>
          ) : (
            <>
              {CATEGORIES.map((cat) => {
                const colors = TWISTER_COLORS.filter((c) => c.category === cat);
                if (colors.length === 0) return null;
                return (
                  <div key={cat} className="mb-2.5 last:mb-0">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{cat}</div>
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
                              <Check className="absolute inset-0 m-auto h-3.5 w-3.5" style={{ color: c.hex === "#F8FAFC" ? "#0f172a" : "#fff" }} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <div className="mt-3 border-t border-slate-800 pt-2.5">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Custom</div>
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
            </>
          )}
        </div>
      )}
    </div>
  );
};
