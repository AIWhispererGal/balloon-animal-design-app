"use client";

import React, { useMemo, useState } from "react";
import { Bookmark, Hammer, Trash2 } from "lucide-react";
import { BalloonSize, ComplexityLevel, FullDesign } from "@/types/balloon";
import {
  Archetype,
  ArchetypeBuildSettings,
  BUILT_IN_ARCHETYPES,
  MAX_ARCHETYPE_BALLOONS,
  applyBuildSettings,
  buildAirUse,
  buildDesignsFromArchetype,
  defaultBuildSettings,
  deleteCustomArchetype,
  listCustomArchetypes,
  saveDesignAsArchetype,
} from "@/lib/archetypes";
import { generateStepsFromSimulation } from "@/lib/stepGenerator";
import { ColorPicker } from "./ColorPicker";
import { StepVisualDiagram } from "./StepVisualDiagram";

interface ArchetypeBuilderProps {
  /** The design open in the editor, offered for saving as a body plan */
  currentDesign: FullDesign;
  onBuild: (designs: Record<ComplexityLevel, FullDesign>, label: string) => void;
}

const SIZES: BalloonSize[] = ["160", "260", "360"];

/**
 * Build a sculpture the way a twister does: pick a body plan, set how long each
 * part is, choose balloon colors and gauges. The twists, bends and locks come
 * from the plan, so the result is always buildable.
 */
export const ArchetypeBuilder: React.FC<ArchetypeBuilderProps> = ({ currentDesign, onBuild }) => {
  const [custom, setCustom] = useState<Archetype[]>(() => (typeof window === "undefined" ? [] : listCustomArchetypes()));
  const all = useMemo(() => [...custom, ...BUILT_IN_ARCHETYPES], [custom]);
  const [selectedId, setSelectedId] = useState<string>(BUILT_IN_ARCHETYPES[0].id);
  const archetype = all.find((a) => a.id === selectedId) ?? BUILT_IN_ARCHETYPES[0];
  const [settings, setSettings] = useState<ArchetypeBuildSettings>(() => defaultBuildSettings(archetype));
  const [saveName, setSaveName] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  // Fresh sliders whenever another plan is picked
  const selectPlan = (a: Archetype) => {
    setSelectedId(a.id);
    setSettings(defaultBuildSettings(a));
    setNotice(null);
  };

  const preview = useMemo(() => {
    const { balloons, bubbles } = applyBuildSettings(archetype, settings);
    const steps = generateStepsFromSimulation(balloons, bubbles);
    return { balloons, bubbles, steps, air: buildAirUse(balloons, bubbles) };
  }, [archetype, settings]);
  const overAir = preview.air.some((a) => a.over);

  const setPart = (id: string, v: number) => setSettings((s) => ({ ...s, partLengths: { ...s.partLengths, [id]: v } }));
  const setBalloon = (id: string, patch: Partial<ArchetypeBuildSettings["balloons"][string]>) =>
    setSettings((s) => ({ ...s, balloons: { ...s.balloons, [id]: { ...s.balloons[id], ...patch } } }));

  const handleSaveCurrent = () => {
    const result = saveDesignAsArchetype(currentDesign, saveName || currentDesign.title);
    if (!result.ok) {
      setNotice(result.reason);
      return;
    }
    setCustom(listCustomArchetypes());
    selectPlan(result.archetype);
    setSaveName("");
    setNotice(`Saved “${result.archetype.name}” as a body plan in this browser.`);
  };

  const canSaveCurrent = currentDesign.bubbles.length > 0 && currentDesign.balloons.length <= MAX_ARCHETYPE_BALLOONS;

  return (
    <div className="panel space-y-4 p-6 shadow-2xl">
      <div className="flex flex-col justify-between gap-2 md:flex-row md:items-start">
        <div>
          <h2 className="text-lg font-semibold text-white">Build from a body plan</h2>
          <p className="text-xs text-slate-400">
            The way a twister designs: pick the plan (a dog is snout, ears, neck, legs, body, tail), set how long each part
            is, pick colors. The twists and locks come from the plan, so it always builds.
          </p>
        </div>
      </div>

      {/* plan chips */}
      <div className="flex flex-wrap gap-1.5">
        {all.map((a) => (
          <span key={a.id} className="inline-flex items-stretch">
            <button
              onClick={() => selectPlan(a)}
              className={`rounded-l-lg border px-2.5 py-1 text-xs font-semibold transition ${a.builtIn ? "" : "border-dashed"} ${
                a.id === archetype.id
                  ? "border-amber-400 bg-amber-400/15 text-amber-200"
                  : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"
              } ${a.builtIn ? "rounded-r-lg" : ""}`}
              title={a.description}
            >
              {a.name}
            </button>
            {!a.builtIn && (
              <button
                onClick={() => {
                  deleteCustomArchetype(a.id);
                  setCustom(listCustomArchetypes());
                  if (a.id === selectedId) selectPlan(BUILT_IN_ARCHETYPES[0]);
                }}
                className="rounded-r-lg border border-l-0 border-dashed border-slate-700 px-1.5 text-slate-500 hover:text-rose-400"
                title="Delete this saved body plan"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        {/* parts */}
        <div className="space-y-2 md:col-span-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Parts</div>
          {archetype.parts.map((p) => {
            const v = settings.partLengths[p.id] ?? p.templateLength;
            return (
              <div key={p.id} className="flex items-center gap-2 text-xs">
                <div className="w-36 shrink-0 truncate text-slate-300" title={`${p.kind === "pair" ? "Lock pair" : p.kind === "group" ? "Folded group" : "Bubble"} · bubbles ${p.bubbleIndices.map((i) => i + 1).join(", ")}`}>
                  {p.label}
                  {p.kind === "pair" && <span className="ml-1 text-slate-500">×2</span>}
                </div>
                {p.fixed ? (
                  <div className="flex-1 text-[11px] text-slate-500">pinch · {p.templateLength}″</div>
                ) : (
                  <input
                    type="range"
                    min={p.minLength}
                    max={p.maxLength}
                    step={0.25}
                    value={v}
                    onChange={(e) => setPart(p.id, Number(e.target.value))}
                    className="h-1 flex-1 accent-amber-400"
                  />
                )}
                <div className="w-12 shrink-0 text-right font-mono text-slate-200">{p.fixed ? "" : `${v}″`}</div>
              </div>
            );
          })}

          <div className="pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Balloons</div>
          {archetype.balloons.map((b) => {
            const choice = settings.balloons[b.id];
            const air = preview.air.find((a) => a.balloon.id === b.id);
            return (
              <div key={b.id} className="flex flex-wrap items-center gap-2 text-xs">
                <ColorPicker
                  value={choice.color}
                  valueName={choice.colorName}
                  balloonSize={choice.size}
                  onChange={(hex, name) => setBalloon(b.id, { color: hex, colorName: name })}
                  size="sm"
                />
                <div className="flex overflow-hidden rounded-md border border-slate-700">
                  {SIZES.map((sz) => (
                    <button
                      key={sz}
                      onClick={() => setBalloon(b.id, { size: sz })}
                      className={`px-2 py-0.5 font-mono ${choice.size === sz ? "bg-amber-400 text-slate-950" : "bg-slate-900 text-slate-300 hover:bg-slate-800"}`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
                <span className="truncate text-slate-400">{b.name.replace(/\b(160|260|360)\b/g, choice.size)}</span>
                {air && (
                  <span className={`ml-auto font-mono ${air.over ? "text-rose-400" : "text-slate-400"}`} title="Inches of inflated balloon the bubbles and twists use, of what one balloon gives">
                    {air.used}″ / {air.capacity}″{air.over ? " · too long" : ""}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* preview + build */}
        <div className="space-y-2 md:col-span-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Preview</div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-1">
            <StepVisualDiagram
              twistType="basic"
              balloons={preview.balloons}
              bubbles={preview.bubbles}
              steps={preview.steps}
              stepIndex={Math.max(0, preview.steps.length - 1)}
              orientation={archetype.orientation}
              className="h-40 w-full"
            />
          </div>
          <input
            value={settings.title ?? ""}
            onChange={(e) => setSettings((s) => ({ ...s, title: e.target.value }))}
            placeholder={`Title (default: ${archetype.name.replace(/\s*\(\d balloons?\)\s*$/i, "")})`}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-600"
          />
          <button
            onClick={() => onBuild(buildDesignsFromArchetype(archetype, settings), (settings.title ?? "").trim() || archetype.name)}
            className="btn btn-primary w-full"
            disabled={overAir}
            title={overAir ? "Shorten some parts: a balloon is over its inflated length" : "Open this sculpture in the editor"}
          >
            <Hammer className="h-3.5 w-3.5" /> Build this sculpture
          </button>
        </div>
      </div>

      {/* save the open design as a plan */}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3 text-xs">
        <Bookmark className="h-3.5 w-3.5 text-slate-500" />
        <span className="text-slate-400">Save the open design as a body plan:</span>
        <input
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          placeholder={currentDesign.title}
          className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-white placeholder:text-slate-600"
        />
        <button onClick={handleSaveCurrent} className="btn btn-secondary btn-xs" disabled={!canSaveCurrent} title={canSaveCurrent ? "Keep this one- or two-balloon recipe as a reusable plan" : `Body plans are one- or two-balloon recipes with at least one bubble`}>
          Save as plan
        </button>
        {notice && <div className="w-full text-[11px] text-amber-300">{notice}</div>}
      </div>
    </div>
  );
};
