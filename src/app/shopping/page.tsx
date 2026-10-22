"use client";

import React, { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, FileDown, Plus, RefreshCw, Save, ShoppingCart, Trash2 } from "lucide-react";
import catalogJson from "@/data/balloonCatalog.json";
import {
  Catalog,
  CatalogItem,
  Recipe,
  RecipeLine,
  costRecipe,
  matchCatalogItem,
  planForCount,
  planPacks,
  recipeToJson,
  round2,
} from "@/lib/recipeMath";
import { RecipeHandoff, deleteRecipe, getCurrentDesign, listRecipes, saveRecipe, takeRecipeHandoff } from "@/lib/recipeStorage";

const catalog = catalogJson as Catalog;

const newId = () => `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

const money = (v: number) => `$${v.toFixed(2)}`;

function emptyRecipe(): Recipe {
  return { id: newId(), name: "New recipe", lines: [], updatedAt: new Date().toISOString() };
}

const itemById = new Map(catalog.items.map((i) => [i.id, i]));

/** Turn the design open in the editor into a recipe: linked packs exactly, the rest by size and color. */
function recipeFromDesign(h: RecipeHandoff): { recipe: Recipe; note: string } {
  const unmatched: string[] = [];
  const guessed: string[] = [];
  const counts = new Map<string, number>();
  h.balloons.forEach((b) => {
    const linked = b.catalogItemId ? itemById.get(b.catalogItemId) : undefined;
    const item = linked ?? matchCatalogItem(catalog, b.size, b.colorName);
    if (!item) {
      unmatched.push(`${b.size} ${b.colorName}`);
      return;
    }
    if (!linked) guessed.push(`${b.size} ${b.colorName} → ${item.brand} ${item.color}`);
    counts.set(item.id, (counts.get(item.id) ?? 0) + 1);
  });
  const lines: RecipeLine[] = [];
  counts.forEach((qty, itemId) => lines.push({ itemId, qty }));
  const parts = [`Recipe for “${h.designTitle}”, the design open in the editor.`];
  if (guessed.length) parts.push(`Matched by color, not linked to a pack: ${guessed.join("; ")}. Pick packs in the designer's color picker to make these exact.`);
  if (unmatched.length) parts.push(`No catalog match for: ${unmatched.join(", ")}. Add those by hand.`);
  return { recipe: { id: newId(), name: h.designTitle, lines, updatedAt: new Date().toISOString() }, note: parts.join(" ") };
}

/** Starting recipe: the design just handed over, else the design currently open, else empty. */
function initialFromHandoff(): { recipe: Recipe; note: string | null } {
  const h = takeRecipeHandoff() ?? getCurrentDesign();
  if (!h || h.balloons.length === 0) return { recipe: emptyRecipe(), note: null };
  return recipeFromDesign(h);
}

const subscribeNoop = () => () => {};

export default function ShoppingPage() {
  // Browser storage is only readable on the client; render the workspace after mount
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  if (!mounted) return <div className="min-h-screen" />;
  return <ShoppingWorkspace />;
}

function ShoppingWorkspace() {
  const [initial] = useState(initialFromHandoff);
  const [recipe, setRecipe] = useState<Recipe>(initial.recipe);
  const [handoffNote, setHandoffNote] = useState<string | null>(initial.note);

  const reloadFromDesigner = () => {
    const h = getCurrentDesign();
    if (!h || h.balloons.length === 0) {
      setToast("No design is open in the editor.");
      return;
    }
    const r = recipeFromDesign(h);
    setRecipe(r.recipe);
    setHandoffNote(r.note);
  };
  const [saved, setSaved] = useState<Recipe[]>(listRecipes);
  const [anchorId, setAnchorId] = useState<string>("");
  const [anchorPacks, setAnchorPacks] = useState(1);
  const [sculpturesWanted, setSculpturesWanted] = useState(10);
  const [sizeFilter, setSizeFilter] = useState<string>("all");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const itemsById = useMemo(() => new Map(catalog.items.map((i) => [i.id, i])), []);
  const sizes = useMemo(() => Array.from(new Set(catalog.items.map((i) => i.size))).sort(), []);
  const brands = useMemo(() => Array.from(new Set(catalog.items.map((i) => i.brand))).sort(), []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const cost = useMemo(() => costRecipe(recipe, catalog), [recipe]);
  const effectiveAnchor = recipe.lines.some((l) => l.itemId === anchorId && l.qty > 0)
    ? anchorId
    : recipe.lines.find((l) => l.qty > 0)?.itemId ?? "";
  const plan = useMemo(
    () => (effectiveAnchor ? planPacks(recipe, catalog, effectiveAnchor, anchorPacks) : null),
    [recipe, effectiveAnchor, anchorPacks]
  );
  const countPlan = useMemo(() => planForCount(recipe, catalog, sculpturesWanted), [recipe, sculpturesWanted]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.items.filter(
      (i) =>
        (sizeFilter === "all" || i.size === sizeFilter) &&
        (brandFilter === "all" || i.brand === brandFilter) &&
        (!q || `${i.name} ${i.color} ${i.finish ?? ""}`.toLowerCase().includes(q))
    );
  }, [sizeFilter, brandFilter, search]);

  const touch = (r: Recipe): Recipe => ({ ...r, updatedAt: new Date().toISOString() });

  const addItem = (item: CatalogItem) => {
    setRecipe((r) => {
      const existing = r.lines.find((l) => l.itemId === item.id);
      const lines = existing
        ? r.lines.map((l) => (l.itemId === item.id ? { ...l, qty: l.qty + 1 } : l))
        : [...r.lines, { itemId: item.id, qty: 1 }];
      return touch({ ...r, lines });
    });
  };
  const setQty = (itemId: string, qty: number) =>
    setRecipe((r) => touch({ ...r, lines: r.lines.map((l) => (l.itemId === itemId ? { ...l, qty: Math.max(0, qty) } : l)) }));
  const removeLine = (itemId: string) =>
    setRecipe((r) => touch({ ...r, lines: r.lines.filter((l) => l.itemId !== itemId) }));

  const handleSave = () => {
    const r = touch(recipe);
    setRecipe(r);
    if (saveRecipe(r)) {
      setSaved(listRecipes());
      setToast(`Saved “${r.name}”.`);
    } else setToast("Could not save in this browser.");
  };

  const exportJson = () => recipeToJson(recipe, catalog, plan, countPlan);

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(exportJson(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${recipe.name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "recipe"}.recipe.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setToast("Recipe JSON downloaded.");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(exportJson(), null, 2));
      setToast("Recipe JSON copied.");
    } catch {
      setToast("Clipboard not available; use Download instead.");
    }
  };

  return (
    <div className="flex min-h-screen flex-col text-slate-100">
      {toast && (
        <div className="hud fixed left-1/2 top-4 z-50 -translate-x-1/2 border-amber-400/40 px-4 py-2 text-sm font-medium text-amber-100">
          {toast}
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-2.5 md:px-6">
          <Link href="/" className="btn btn-ghost">
            <ArrowLeft className="h-4 w-4" /> Designer
          </Link>
          <div className="mx-1 hidden h-6 w-px bg-slate-800 md:block" />
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-amber-300" />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-white">Balloon shopping</div>
              <div className="text-[11px] text-slate-500">
                Recipes, cost per sculpture and pack planning · prices from {catalog.source}
              </div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={handleSave} className="btn btn-primary">
              <Save className="h-3.5 w-3.5" /> Save recipe
            </button>
            <button onClick={handleCopy} className="btn btn-ghost" title="Copy the recipe JSON with all prices">
              <Copy className="h-4 w-4" />
              <span className="hidden lg:inline">Copy JSON</span>
            </button>
            <button onClick={handleDownload} className="btn btn-secondary" title="Download the recipe JSON with all prices">
              <FileDown className="h-4 w-4" />
              <span className="hidden lg:inline">Download JSON</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] flex-1 space-y-4 p-4 md:p-6">
        {catalog.sample && (
          <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-xs text-amber-100">
            <strong>Sample prices.</strong> This catalog is placeholder data until the La Rock&apos;s listing is imported.
            The math is real; the numbers are not.
          </div>
        )}
        {handoffNote && (
          <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2.5 text-xs text-cyan-100">{handoffNote}</div>
        )}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          {/* Catalog */}
          <div className="panel xl:col-span-5">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Catalog</h2>
                <p className="panel-sub">{catalog.items.length} packs · click one to add it to the recipe</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-4 py-2.5">
              <div className="seg">
                <button onClick={() => setSizeFilter("all")} className={`seg-item ${sizeFilter === "all" ? "seg-item-active" : ""}`}>
                  All
                </button>
                {sizes.map((s) => (
                  <button key={s} onClick={() => setSizeFilter(s)} className={`seg-item font-mono ${sizeFilter === s ? "seg-item-active" : ""}`}>
                    {s}
                  </button>
                ))}
              </div>
              <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} className="select">
                <option value="all">All brands</option>
                {brands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search color…"
                className="input input-sm w-40"
              />
            </div>
            <div className="max-h-[560px] space-y-1 overflow-y-auto p-2 scrollbar-thin">
              {filteredItems.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-500">No packs match those filters.</div>
              )}
              {filteredItems.map((item) => {
                const inRecipe = recipe.lines.find((l) => l.itemId === item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => addItem(item)}
                    className={`list-row w-full text-left ${inRecipe ? "list-row-active" : ""}`}
                    title="Add one balloon of this to the recipe"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="h-4 w-4 shrink-0 rounded-full border border-white/20" style={{ backgroundColor: item.hex ?? "#64748b" }} />
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-100">
                          <span className="font-mono text-amber-200">{item.size}</span> {item.color}
                          {item.finish && item.finish !== "standard" ? <span className="text-slate-500"> · {item.finish}</span> : null}
                        </div>
                        <div className="truncate text-[11px] text-slate-500">
                          {item.brand} · {item.packQty} per pack
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-mono text-slate-200">{money(item.price)}</div>
                      <div className="font-mono text-[11px] text-slate-500">{money(item.pricePerBalloon)} ea</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recipe + math */}
          <div className="space-y-4 xl:col-span-7">
            <div className="panel">
              <div className="panel-header">
                <input
                  value={recipe.name}
                  onChange={(e) => setRecipe((r) => touch({ ...r, name: e.target.value }))}
                  className="input w-64 text-sm font-semibold"
                />
                <div className="flex items-center gap-1">
                  <button onClick={reloadFromDesigner} className="btn btn-secondary btn-xs" title="Rebuild this recipe from the design open in the editor">
                    <RefreshCw className="h-3.5 w-3.5" /> From designer
                  </button>
                  <button onClick={() => setRecipe(emptyRecipe())} className="btn btn-ghost btn-xs">
                    <Plus className="h-3.5 w-3.5" /> New
                  </button>
                </div>
              </div>

              {recipe.lines.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  Pick packs from the catalog, then set how many balloons of each one sculpture uses.
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="text-[11px] uppercase tracking-wider text-slate-500">
                    <tr className="border-b border-slate-800">
                      <th className="px-4 py-2 text-left">Balloon</th>
                      <th className="px-2 py-2 text-right">Per sculpture</th>
                      <th className="px-2 py-2 text-right">Each</th>
                      <th className="px-2 py-2 text-right">Cost</th>
                      <th className="px-2 py-2 text-right">Min packs</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {cost.lines.map((l) => (
                      <tr key={l.line.itemId} className="border-b border-slate-800/70">
                        <td className="px-4 py-2">
                          {l.item ? (
                            <div className="flex items-center gap-2">
                              <span className="h-3.5 w-3.5 rounded-full border border-white/20" style={{ backgroundColor: l.item.hex ?? "#64748b" }} />
                              <div>
                                <div className="font-medium text-slate-100">
                                  <span className="font-mono text-amber-200">{l.item.size}</span> {l.item.color}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {l.item.brand} · {l.item.packQty}/pack · {money(l.item.price)}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-rose-300">Unknown item {l.line.itemId}</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={l.line.qty}
                            onChange={(e) => setQty(l.line.itemId, parseInt(e.target.value) || 0)}
                            className="input input-sm w-16 text-right font-mono"
                          />
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-slate-400">{l.item ? money(l.item.pricePerBalloon) : "—"}</td>
                        <td className="px-2 py-2 text-right font-mono text-slate-100">{money(l.balloonCost)}</td>
                        <td className="px-2 py-2 text-right font-mono text-slate-400">
                          {l.packsForOne} · {money(l.packCostForOne)}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <button onClick={() => removeLine(l.line.itemId)} className="btn btn-ghost btn-icon h-6 w-6 text-rose-300" title="Remove">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="text-sm">
                      <td className="px-4 py-3 font-semibold text-white" colSpan={3}>
                        One sculpture
                      </td>
                      <td className="px-2 py-3 text-right font-mono font-semibold text-amber-200">{money(cost.perSculpture)}</td>
                      <td className="px-2 py-3 text-right font-mono text-slate-300" colSpan={2}>
                        {money(cost.minimumPurchase)} for {cost.sculpturesFromMinimum}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
              {recipe.lines.length > 0 && (
                <p className="px-4 pb-3 text-[11px] text-slate-500">
                  “Cost” is the per-balloon share. “Min packs” is the fewest packs that cover one sculpture, and how many
                  sculptures that purchase makes.
                </p>
              )}
            </div>

            {/* How many sculptures */}
            {countPlan && (
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">Shopping list for an event</h2>
                    <p className="panel-sub">How many sculptures do you need? Every line rounds up to whole packs.</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <input
                      type="number"
                      min={1}
                      value={sculpturesWanted}
                      onChange={(e) => setSculpturesWanted(Math.max(1, parseInt(e.target.value) || 1))}
                      className="input input-sm w-20 text-right font-mono"
                    />
                    <span className="text-slate-400">sculptures</span>
                  </div>
                </div>
                <table className="w-full text-xs">
                  <thead className="text-[11px] uppercase tracking-wider text-slate-500">
                    <tr className="border-b border-slate-800">
                      <th className="px-4 py-2 text-left">Balloon</th>
                      <th className="px-2 py-2 text-right">Need</th>
                      <th className="px-2 py-2 text-right">Packs</th>
                      <th className="px-2 py-2 text-right">Balloons</th>
                      <th className="px-2 py-2 text-right">Spare</th>
                      <th className="px-2 py-2 text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {countPlan.lines.map((l) => (
                      <tr key={l.item.id} className="border-b border-slate-800/70">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className="h-3.5 w-3.5 rounded-full border border-white/20" style={{ backgroundColor: l.item.hex ?? "#64748b" }} />
                            <span className="font-medium text-slate-100">
                              <span className="font-mono text-amber-200">{l.item.size}</span> {l.item.color}
                              <span className="text-slate-500"> · {l.item.brand} {l.item.packQty}ct</span>
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-slate-400">{l.line.qty * countPlan.sculptures}</td>
                        <td className="px-2 py-2 text-right font-mono text-slate-100">{l.packs}</td>
                        <td className="px-2 py-2 text-right font-mono text-slate-400">{l.balloons}</td>
                        <td className="px-2 py-2 text-right font-mono text-slate-400">{l.leftover}</td>
                        <td className="px-2 py-2 text-right font-mono text-slate-100">{money(l.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="text-sm">
                      <td className="px-4 py-3 font-semibold text-white" colSpan={3}>
                        {countPlan.sculptures} sculpture{countPlan.sculptures !== 1 ? "s" : ""}
                      </td>
                      <td className="px-2 py-3 text-right font-mono text-slate-300" colSpan={2}>
                        {money(countPlan.costPerSculpture)} each
                      </td>
                      <td className="px-2 py-3 text-right font-mono font-semibold text-amber-200">{money(countPlan.totalCost)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Pack planner */}
            {plan && (
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">Pack planner</h2>
                    <p className="panel-sub">Buy packs of one balloon, then enough of the rest to use them up.</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <select value={effectiveAnchor} onChange={(e) => setAnchorId(e.target.value)} className="select">
                      {recipe.lines
                        .filter((l) => l.qty > 0 && itemsById.get(l.itemId))
                        .map((l) => {
                          const it = itemsById.get(l.itemId)!;
                          return (
                            <option key={l.itemId} value={l.itemId}>
                              {it.size} {it.color} ({it.brand})
                            </option>
                          );
                        })}
                    </select>
                    <span className="text-slate-400">×</span>
                    <input
                      type="number"
                      min={1}
                      value={anchorPacks}
                      onChange={(e) => setAnchorPacks(Math.max(1, parseInt(e.target.value) || 1))}
                      className="input input-sm w-16 text-right font-mono"
                    />
                    <span className="text-slate-400">packs</span>
                  </div>
                </div>
                <table className="w-full text-xs">
                  <thead className="text-[11px] uppercase tracking-wider text-slate-500">
                    <tr className="border-b border-slate-800">
                      <th className="px-4 py-2 text-left">Balloon</th>
                      <th className="px-2 py-2 text-right">Packs</th>
                      <th className="px-2 py-2 text-right">Balloons</th>
                      <th className="px-2 py-2 text-right">Makes</th>
                      <th className="px-2 py-2 text-right">Left over</th>
                      <th className="px-2 py-2 text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.lines.map((l) => (
                      <tr key={l.item.id} className={`border-b border-slate-800/70 ${l.isAnchor ? "bg-amber-400/5" : ""}`}>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className="h-3.5 w-3.5 rounded-full border border-white/20" style={{ backgroundColor: l.item.hex ?? "#64748b" }} />
                            <span className="font-medium text-slate-100">
                              <span className="font-mono text-amber-200">{l.item.size}</span> {l.item.color}
                            </span>
                            {l.isAnchor && <span className="chip chip-accent">anchor</span>}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-slate-100">{l.packs}</td>
                        <td className="px-2 py-2 text-right font-mono text-slate-400">{l.balloons}</td>
                        <td className="px-2 py-2 text-right font-mono text-slate-400">{l.sculpturesSupported}</td>
                        <td className="px-2 py-2 text-right font-mono text-slate-400">{l.leftover}</td>
                        <td className="px-2 py-2 text-right font-mono text-slate-100">{money(l.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="text-sm">
                      <td className="px-4 py-3 font-semibold text-white" colSpan={3}>
                        {plan.sculptures} sculpture{plan.sculptures !== 1 ? "s" : ""}
                      </td>
                      <td className="px-2 py-3 text-right font-mono text-slate-300" colSpan={2}>
                        {money(plan.costPerSculpture)} each
                      </td>
                      <td className="px-2 py-3 text-right font-mono font-semibold text-amber-200">{money(plan.totalCost)}</td>
                    </tr>
                  </tfoot>
                </table>
                {plan.targetSculptures > plan.sculptures && (
                  <p className="px-4 pb-3 text-[11px] text-amber-200/80">
                    The anchor packs would allow {plan.targetSculptures}, but another line caps it at {plan.sculptures}.
                  </p>
                )}
              </div>
            )}

            {/* Saved recipes */}
            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Saved recipes</h2>
                  <p className="panel-sub">Kept in this browser.</p>
                </div>
              </div>
              {saved.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">Nothing saved yet.</div>
              ) : (
                <div className="space-y-1 p-2">
                  {saved.map((r) => {
                    const c = costRecipe(r, catalog);
                    return (
                      <div key={r.id} className={`list-row ${r.id === recipe.id ? "list-row-active" : ""}`}>
                        <button onClick={() => setRecipe(r)} className="min-w-0 flex-1 text-left">
                          <div className="truncate font-medium text-slate-100">{r.name}</div>
                          <div className="text-[11px] text-slate-500">
                            {r.lines.reduce((s, l) => s + l.qty, 0)} balloons · {money(c.perSculpture)} each ·{" "}
                            {new Date(r.updatedAt).toLocaleDateString()}
                          </div>
                        </button>
                        <button
                          onClick={() => {
                            deleteRecipe(r.id);
                            setSaved(listRecipes());
                          }}
                          className="btn btn-ghost btn-icon h-6 w-6 text-rose-300"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-900 px-6 py-4 text-center text-xs text-slate-600">
        Catalog: {catalog.source} · fetched {catalog.fetchedAt} · prices in {catalog.currency} · per-balloon price ={" "}
        {round2(1).toFixed(0) && "pack price ÷ pack quantity"}
      </footer>
    </div>
  );
}
