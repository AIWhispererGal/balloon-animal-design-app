"use client";

import React, { useMemo, useState } from "react";
import { Bookmark, Hammer, Trash2 } from "lucide-react";
import { BalloonSize, ComplexityLevel, FullDesign } from "@/types/balloon";
import {
  BUILT_IN_ARCHETYPES,
  FamilyBuildSettings,
  MAX_ARCHETYPE_BALLOONS,
  PlanFamily,
  TIERS,
  applyBuildSettings,
  buildAirUse,
  buildDesignsFromFamily,
  defaultBuildSettings,
  defaultFamilySettings,
  deleteCustomArchetype,
  groupFamilies,
  listCustomArchetypes,
  planForTier,
  saveDesignAsArchetype,
  setFamilyBalloon,
  setFamilyPartLength,
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
const TIER_LABEL: Record<ComplexityLevel, string> = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };

/**
 * Build a sculpture the way a twister does: pick a body-plan family (a subject
 * with a recipe per tier), set how long each part is, choose balloon colors and
 * gauges. The twists, bends and locks come from the plans, so the result is
 * always buildable, and proportions carry across the tiers by part name.
 */
export const ArchetypeBuilder: React.FC<ArchetypeBuilderProps> = ({ currentDesign, onBuild }) => {
  const [custom, setCustom] = useState(() => (typeof window === "undefined" ? [] : listCustomArchetypes()));
  const families = useMemo(() => groupFamilies([...custom, ...BUILT_IN_ARCHETYPES]), [custom]);
  const [familyKey, setFamilyKey] = useState<string>(families[0].key);
  const family: PlanFamily = families.find((f) => f.key === familyKey) ?? families[0];
  const [tier, setTier] = useState<ComplexityLevel>("beginner");
  const [settings, setSettings] = useState<FamilyBuildSettings>(() => defaultFamilySettings(family));
  const [saveName, setSaveName] = useState("");
  const [saveTier, setSaveTier] = useState<ComplexityLevel>(currentDesign.complexity);
  const [notice, setNotice] = useState<string | null>(null);

  const selectFamily = (f: PlanFamily) => {
    setFamilyKey(f.key);
    setSettings(defaultFamilySettings(f));
    setTier(f.tiers.beginner ? "beginner" : planForTier(f, "beginner").complexity);
    setNotice(null);
  };

  const plan = planForTier(family, tier);
  const planSettings = settings.byPlan[plan.id] ?? defaultBuildSettings(plan);

  const preview = useMemo(() => {
    const { balloons, bubbles } = applyBuildSettings(plan, planSettings);
    const steps = generateStepsFromSimulation(balloons, bubbles);
    return { balloons, bubbles, steps, air: buildAirUse(balloons, bubbles) };
  }, [plan, planSettings]);
  /** Tiers whose build would run a balloon over its inflated length */
  const overTiers = useMemo(
    () =>
      TIERS.filter((t) => {
        const a = planForTier(family, t);
        const { balloons, bubbles } = applyBuildSettings(a, settings.byPlan[a.id] ?? defaultBuildSettings(a));
        return buildAirUse(balloons, bubbles).some((u) => u.over);
      }),
    [family, settings]
  );
  const overAir = overTiers.length > 0;

  const handleSaveCurrent = () => {
    const result = saveDesignAsArchetype(currentDesign, saveName || currentDesign.title, saveTier);
    if (!result.ok) {
      setNotice(result.reason);
      return;
    }
    const next = listCustomArchetypes();
    setCustom(next);
    const fams = groupFamilies([...next, ...BUILT_IN_ARCHETYPES]);
    const fam = fams.find((f) => f.key === result.archetype.family.trim().toLowerCase());
    if (fam) selectFamily(fam);
    setTier(saveTier);
    setSaveName("");
    setNotice(`Saved as the ${TIER_LABEL[saveTier].toLowerCase()} plan of “${result.archetype.family}”.`);
  };

  const canSaveCurrent = currentDesign.bubbles.length > 0 && currentDesign.balloons.length <= MAX_ARCHETYPE_BALLOONS;

  return (
    <div className="panel space-y-4 p-6 shadow-2xl">
      <div>
        <h2 className="text-lg font-semibold text-white">Build from a body plan</h2>
        <p className="text-xs text-slate-400">
          The way a twister designs: pick the subject (a dog is snout, ears, neck, legs, body, tail), set how long each part
          is, pick colors. Each tier is its own recipe of the same subject; the twists and locks come from the plan, so it
          always builds.
        </p>
      </div>

      {/* family chips */}
      <div className="flex flex-wrap gap-1.5">
        {families.map((f) => (
          <button
            key={f.key}
            onClick={() => selectFamily(f)}
            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${f.builtIn ? "" : "border-dashed"} ${
              f.key === family.key ? "border-amber-400 bg-amber-400/15 text-amber-200" : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"
            }`}
            title={TIERS.filter((t) => f.tiers[t]).map((t) => `${TIER_LABEL[t]}: ${f.tiers[t]!.name}`).join("\n")}
          >
            {f.name}
            <span className="ml-1.5 text-[10px] font-normal text-slate-500">{TIERS.filter((t) => f.tiers[t]).length}/3</span>
          </button>
        ))}
      </div>

      {/* tier row */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {TIERS.map((t) => {
          const own = family.tiers[t];
          const used = planForTier(family, t);
          return (
            <button
              key={t}
              onClick={() => setTier(t)}
              className={`rounded-lg border px-2.5 py-1 ${
                t === tier ? "border-cyan-400 bg-cyan-400/15 text-cyan-100" : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"
              }`}
              title={own ? own.description : `No ${TIER_LABEL[t].toLowerCase()} plan in this family yet: builds the ${TIER_LABEL[used.complexity].toLowerCase()} recipe`}
            >
              {TIER_LABEL[t]}
              <span className="ml-1 text-[10px] text-slate-500">{own ? `${own.balloons.length} balloon${own.balloons.length === 1 ? "" : "s"}` : `= ${TIER_LABEL[used.complexity].toLowerCase()}`}</span>
              {overTiers.includes(t) && (
                <span className="ml-1 text-[10px] font-semibold text-rose-400" title="A balloon in this tier is over its inflated length">
                  too long
                </span>
              )}
            </button>
          );
        })}
        <span className="ml-auto truncate text-[11px] text-slate-500" title={plan.description}>
          {plan.name}
        </span>
        {!plan.builtIn && (
          <button
            onClick={() => {
              deleteCustomArchetype(plan.id);
              const next = listCustomArchetypes();
              setCustom(next);
              const fams = groupFamilies([...next, ...BUILT_IN_ARCHETYPES]);
              const fam = fams.find((f) => f.key === family.key);
              selectFamily(fam ?? fams[0]);
            }}
            className="btn btn-ghost btn-xs text-slate-500 hover:text-rose-400"
            title="Delete this saved plan"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        {/* parts */}
        <div className="space-y-2 md:col-span-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Parts · {TIER_LABEL[tier].toLowerCase()}</div>
          {plan.parts.map((p) => {
            const v = planSettings.partLengths[p.id] ?? p.templateLength;
            return (
              <div key={p.id} className="flex items-center gap-2 text-xs">
                <div
                  className="w-36 shrink-0 truncate text-slate-300"
                  title={`${p.kind === "pair" ? "Lock pair" : p.kind === "group" ? "Folded group" : "Bubble"} · bubbles ${p.bubbleIndices.map((i) => i + 1).join(", ")}. Changing it also scales the same part in the other tiers.`}
                >
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
                    onChange={(e) => setSettings((s) => setFamilyPartLength(family, s, plan.id, p.id, Number(e.target.value)))}
                    className="h-1 flex-1 accent-amber-400"
                  />
                )}
                <div className="w-12 shrink-0 text-right font-mono text-slate-200">{p.fixed ? "" : `${v}″`}</div>
              </div>
            );
          })}

          <div className="pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Balloons</div>
          {plan.balloons.map((b) => {
            const choice = planSettings.balloons[b.id] ?? { color: b.color, colorName: b.colorName, size: b.size };
            const air = preview.air.find((a) => a.balloon.id === b.id);
            return (
              <div key={b.id} className="flex flex-wrap items-center gap-2 text-xs">
                <ColorPicker
                  value={choice.color}
                  valueName={choice.colorName}
                  balloonSize={choice.size}
                  onChange={(hex, name) => setSettings((s) => setFamilyBalloon(family, s, plan.id, b.id, { color: hex, colorName: name }))}
                  size="sm"
                />
                <div className="flex overflow-hidden rounded-md border border-slate-700">
                  {SIZES.map((sz) => (
                    <button
                      key={sz}
                      onClick={() => setSettings((s) => setFamilyBalloon(family, s, plan.id, b.id, { size: sz }))}
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
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Preview · {TIER_LABEL[tier].toLowerCase()}</div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-1">
            <StepVisualDiagram
              twistType="basic"
              balloons={preview.balloons}
              bubbles={preview.bubbles}
              steps={preview.steps}
              stepIndex={Math.max(0, preview.steps.length - 1)}
              orientation={plan.orientation}
              className="h-40 w-full"
            />
          </div>
          <input
            value={settings.title ?? ""}
            onChange={(e) => setSettings((s) => ({ ...s, title: e.target.value }))}
            placeholder={`Title (default: ${family.name})`}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-600"
          />
          <button
            onClick={() => onBuild(buildDesignsFromFamily(family, settings), (settings.title ?? "").trim() || family.name)}
            className="btn btn-primary w-full"
            disabled={overAir}
            title={overAir ? `Shorten some parts: a balloon is over its inflated length in the ${overTiers.map((t) => TIER_LABEL[t].toLowerCase()).join(" and ")} tier${overTiers.length > 1 ? "s" : ""}` : "Open all three tiers in the editor"}
          >
            <Hammer className="h-3.5 w-3.5" /> Build all three tiers
          </button>
        </div>
      </div>

      {/* save the open design as a plan */}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3 text-xs">
        <Bookmark className="h-3.5 w-3.5 text-slate-500" />
        <span className="text-slate-400">Save the open design as a plan:</span>
        <input
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          placeholder={`Family, e.g. ${currentDesign.title}`}
          className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-white placeholder:text-slate-600"
        />
        <div className="flex overflow-hidden rounded-md border border-slate-700">
          {TIERS.map((t) => (
            <button
              key={t}
              onClick={() => setSaveTier(t)}
              className={`px-2 py-0.5 ${saveTier === t ? "bg-cyan-400 text-slate-950" : "bg-slate-900 text-slate-300 hover:bg-slate-800"}`}
              title={`Save as the ${t} recipe of this family`}
            >
              {TIER_LABEL[t]}
            </button>
          ))}
        </div>
        <button
          onClick={handleSaveCurrent}
          className="btn btn-secondary btn-xs"
          disabled={!canSaveCurrent}
          title={canSaveCurrent ? "Keep this one- or two-balloon recipe as a tier of a reusable family" : "Body plans are one- or two-balloon recipes with at least one bubble"}
        >
          Save as plan
        </button>
        {notice && <div className="w-full text-[11px] text-amber-300">{notice}</div>}
      </div>
    </div>
  );
};
