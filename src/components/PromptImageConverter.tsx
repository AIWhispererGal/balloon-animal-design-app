"use client";

import React, { useRef, useState } from "react";
import { ChevronDown, ChevronUp, KeyRound, Sparkles } from "lucide-react";
import { ComplexityLevel, FullDesign } from "@/types/balloon";
import { findOrGenerateDesigns } from "@/lib/balloonPresets";
import { generateDesignsWithClaude, generatePlanWithClaude } from "@/lib/aiDesigner";
import { AI_MODELS, AiSettings, getAiSettings, setAiSettings } from "@/lib/aiSettings";
import { BUILT_IN_ARCHETYPES, listCustomArchetypes } from "@/lib/archetypes";

interface PromptImageConverterProps {
  onDesignsGenerated: (
    designs: Record<ComplexityLevel, FullDesign>,
    promptOrSource: string,
    imageUrl?: string
  ) => void;
  onStartBlankSlate: () => void;
  isLoading?: boolean;
}

interface ImageInfo {
  /** JPEG data URL, longest side at most 1024px */
  previewUrl: string;
  colors: string[];
  width: number;
  height: number;
}

const SAMPLE_INSPIRATIONS = [
  { label: "Classic Dog / Puppy", query: "dog" },
  { label: "Pirate Cutlass Sword", query: "sword" },
  { label: "Spring Daisy Flower", query: "flower" },
  { label: "Teddy Bear", query: "teddy bear" },
  { label: "T-Rex Dinosaur", query: "dinosaur t-rex" },
  { label: "Fairy Butterfly", query: "butterfly wings" },
  { label: "Swan / Flamingo", query: "swan flamingo" },
  { label: "Magic Cosmic Wand", query: "magic wand star" },
  { label: "Unicorn with Spiral Horn", query: "unicorn spiral horn" },
  { label: "Alien with Antenna", query: "alien octopus antenna" },
];

const rgbDistance = (a: [number, number, number], b: [number, number, number]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const toHex = ([r, g, b]: [number, number, number]) =>
  `#${[r, g, b].map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0")).join("")}`;

const cleanFileName = (name: string) =>
  name
    .replace(/\.[^/.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b(img|image|photo|pic|screenshot|dsc|pxl)\b/gi, " ")
    .replace(/\b\d{3,}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

async function decodeFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The selected file could not be decoded as an image."));
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Downscale the reference for the model and pull a few dominant subject colors
 * for the no-key fallback. The background is sampled from the picture's own
 * corners (not the letterbox), so a white studio backdrop is not read as the subject.
 */
function prepareImage(image: HTMLImageElement): ImageInfo {
  const maxSide = 1024;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const w = Math.max(1, Math.round(image.naturalWidth * scale));
  const h = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas image processing is unavailable in this browser.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(image, 0, 0, w, h);
  const previewUrl = canvas.toDataURL("image/jpeg", 0.88);

  // color sampling on a small copy
  const s = 96;
  const small = document.createElement("canvas");
  small.width = s;
  small.height = s;
  const sctx = small.getContext("2d", { willReadFrequently: true })!;
  sctx.drawImage(canvas, 0, 0, s, s);
  const px = sctx.getImageData(0, 0, s, s).data;
  const at = (x: number, y: number): [number, number, number] => {
    const i = (y * s + x) * 4;
    return [px[i], px[i + 1], px[i + 2]];
  };
  const corners = [at(1, 1), at(s - 2, 1), at(1, s - 2), at(s - 2, s - 2), at(Math.floor(s / 2), 1), at(Math.floor(s / 2), s - 2)];
  const background: [number, number, number] = [0, 1, 2].map(
    (c) => Math.round(corners.reduce((sum, col) => sum + col[c], 0) / corners.length)
  ) as [number, number, number];

  const buckets = new Map<string, { count: number; sum: [number, number, number] }>();
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const rgb = at(x, y);
      if (rgbDistance(rgb, background) < 48) continue;
      const sat = Math.max(...rgb) - Math.min(...rgb);
      const lum = (rgb[0] + rgb[1] + rgb[2]) / 3;
      if (sat < 24 && (lum < 40 || lum > 215)) continue; // shadows and highlights are not latex colors
      const key = rgb.map((v) => Math.round(v / 32)).join(",");
      const b = buckets.get(key) ?? { count: 0, sum: [0, 0, 0] as [number, number, number] };
      b.count += 1;
      b.sum[0] += rgb[0];
      b.sum[1] += rgb[1];
      b.sum[2] += rgb[2];
      buckets.set(key, b);
    }
  }
  const ranked = [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .map((b): [number, number, number] => [Math.round(b.sum[0] / b.count), Math.round(b.sum[1] / b.count), Math.round(b.sum[2] / b.count)]);
  const distinct: Array<[number, number, number]> = [];
  for (const c of ranked) {
    if (distinct.every((d) => rgbDistance(d, c) > 60)) distinct.push(c);
    if (distinct.length === 4) break;
  }
  return { previewUrl, colors: distinct.map(toHex), width: image.naturalWidth, height: image.naturalHeight };
}

export const PromptImageConverter: React.FC<PromptImageConverterProps> = ({
  onDesignsGenerated,
  onStartBlankSlate,
  isLoading = false,
}) => {
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<ImageInfo | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState("Describe an item, drop a reference photo, or both.");
  const [error, setError] = useState<string | null>(null);
  const [ai, setAi] = useState<AiSettings>(getAiSettings);
  const [settingsOpen, setSettingsOpen] = useState(() => !getAiSettings().apiKey);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasKey = ai.apiKey.trim().length > 0;

  const updateAi = (patch: Partial<AiSettings>) => {
    const next = { ...ai, ...patch };
    setAi(next);
    setAiSettings(next);
  };

  const generate = async (promptOverride?: string, imageOverride?: ImageInfo | null) => {
    const img = imageOverride === undefined ? image : imageOverride;
    const typed = (promptOverride ?? prompt).trim();
    const fileHint = cleanFileName(selectedFileName);
    const effectivePrompt = typed || fileHint;
    if (!effectivePrompt && !img) {
      setError("Type what to make, or drop a reference image.");
      return;
    }
    setIsProcessing(true);
    setError(null);
    try {
      if (hasKey) {
        const modelLabel = AI_MODELS.find((m) => m.id === ai.model)?.label ?? ai.model;
        const common = {
          apiKey: ai.apiKey,
          model: ai.model,
          prompt: effectivePrompt,
          imageBase64: img ? img.previewUrl.split(",")[1] : undefined,
          imageMediaType: "image/jpeg" as const,
        };
        if (ai.method === "plan") {
          setStatus(img ? `${modelLabel} is studying the photo and picking a body plan…` : `${modelLabel} is picking a body plan…`);
          const result = await generatePlanWithClaude({ ...common, archetypes: [...listCustomArchetypes(), ...BUILT_IN_ARCHETYPES] });
          const label = result.subject || effectivePrompt;
          onDesignsGenerated(result.designs, label, img?.previewUrl);
          setStatus(
            `Built “${label}” on the ${result.family.name} body plan with ${modelLabel} (${result.usage.input + result.usage.output} tokens).` +
              (result.reason ? ` ${result.reason}` : "") +
              (result.warnings.length ? ` ${result.warnings.join(" ")}` : "")
          );
        } else {
          setStatus(img ? `${modelLabel} is studying the photo and designing three tiers…` : `${modelLabel} is designing three tiers…`);
          const result = await generateDesignsWithClaude(common);
          const label = result.subject || effectivePrompt;
          onDesignsGenerated(result.designs, label, img?.previewUrl);
          setStatus(
            `Designed “${label}” with ${modelLabel} (${result.usage.input + result.usage.output} tokens).` +
              (result.warnings.length ? ` ${result.warnings.join(" ")}` : "")
          );
        }
      } else {
        setStatus("Building three tiers from the built-in templates…");
        await new Promise((r) => setTimeout(r, 40));
        const results = findOrGenerateDesigns(effectivePrompt || "custom sculpture", img?.colors);
        onDesignsGenerated(results, effectivePrompt || "reference image", img?.previewUrl);
        setStatus(
          img
            ? "Used a template with the photo's colors. Add an API key below and the model will design from what is actually in the photo."
            : `Generated template tiers for “${effectivePrompt}”. Add an API key below for designs tailored to your description.`
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generation failed.";
      setError(/401|authentication|invalid x-api-key/i.test(msg) ? "That API key was rejected. Check it and try again." : msg);
      setStatus("Generation failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const processImageFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please choose a PNG, JPEG, WebP, GIF, or other browser-supported image.");
      return;
    }
    if (file.size > 18 * 1024 * 1024) {
      setError("Please use an image smaller than 18 MB.");
      return;
    }
    setIsProcessing(true);
    setError(null);
    setStatus(`Reading ${file.name}…`);
    setSelectedFileName(file.name);
    try {
      const decoded = await decodeFile(file);
      const info = prepareImage(decoded);
      setImage(info);
      const fileHint = cleanFileName(file.name);
      if (!prompt.trim() && fileHint) setPrompt(fileHint);
      setIsProcessing(false);
      await generate(prompt.trim() || fileHint, info);
    } catch (imageError) {
      setError(imageError instanceof Error ? imageError.message : "The image could not be read.");
      setStatus("Image could not be read. Please try a different file.");
      setIsProcessing(false);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="panel space-y-5 p-6 shadow-2xl">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-800 pb-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-lg font-semibold text-white">New design</h2>
          <p className="mt-1 text-xs text-slate-400">
            Describe an item or drop a reference photo to get beginner, intermediate and advanced versions. Or start
            from an empty balloon and sculpt by hand.
          </p>
        </div>
        <button onClick={onStartBlankSlate} className="btn btn-secondary self-start md:self-auto">
          Start from a blank balloon
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        <div className="space-y-2 md:col-span-7">
          <label className="label">Describe the item</label>
          <div className="relative">
            <input
              type="text"
              placeholder="e.g. dachshund with a red collar, race car, orchid, astronaut…"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && !isProcessing && void generate()}
              className="input py-2.5 pr-28"
            />
            <button
              onClick={() => void generate()}
              disabled={isProcessing || isLoading}
              className="btn btn-primary absolute bottom-1.5 right-1.5 top-1.5 px-4"
            >
              {isProcessing ? "Working…" : image ? "Regenerate" : "Generate"}
            </button>
          </div>
        </div>

        <div className="space-y-2 md:col-span-5">
          <label className="label">Reference image</label>
          <div
            role="button"
            tabIndex={0}
            onClick={() => !isProcessing && fileInputRef.current?.click()}
            onKeyDown={(event) => event.key === "Enter" && fileInputRef.current?.click()}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              const file = event.dataTransfer.files?.[0];
              if (file) void processImageFile(file);
            }}
            className={`flex min-h-20 cursor-pointer items-center gap-3 rounded-xl border border-dashed px-3 py-2 transition ${
              isDragging
                ? "border-emerald-400 bg-emerald-500/10"
                : image
                ? "border-amber-500/60 bg-slate-950"
                : "border-slate-700 bg-slate-950/60 hover:border-amber-500"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
              className="hidden"
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void processImageFile(file);
              }}
            />
            {image ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.previewUrl}
                  alt="Uploaded reference"
                  className="h-14 w-14 shrink-0 rounded-lg border border-amber-500 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold text-amber-300">{selectedFileName}</div>
                  <div className="mt-0.5 text-[11px] leading-snug text-slate-400">
                    {image.width}×{image.height}
                    {hasKey ? " · sent to the model with your description" : " · template colors only (no API key)"}
                  </div>
                  <div className="mt-1 flex items-center gap-1">
                    {image.colors.map((color) => (
                      <span
                        key={color}
                        className="h-3.5 w-3.5 rounded-full border border-white/30"
                        style={{ backgroundColor: color }}
                        title={`Subject color ${color}`}
                      />
                    ))}
                  </div>
                </div>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    setImage(null);
                    setSelectedFileName("");
                    setStatus("Reference cleared. Describe an item or upload another image.");
                  }}
                  className="btn btn-ghost btn-xs"
                >
                  Clear
                </button>
              </>
            ) : (
              <div className="mx-auto text-center text-xs text-slate-400">
                <div className="font-semibold text-slate-300">Click or drop a reference image</div>
                <div className="text-[11px] text-slate-500">PNG · JPEG · WebP · GIF · up to 18 MB</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        className={`rounded-lg border px-3 py-2 text-xs ${
          error
            ? "border-rose-500/40 bg-rose-950/30 text-rose-300"
            : isProcessing
            ? "border-cyan-500/40 bg-cyan-950/30 text-cyan-300"
            : "border-slate-800 bg-slate-950/60 text-slate-400"
        }`}
      >
        {isProcessing && <span className="mr-2 inline-block animate-spin">◌</span>}
        {error ?? status}
      </div>

      {/* AI engine settings */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/60">
        <button
          type="button"
          onClick={() => setSettingsOpen((o) => !o)}
          className="flex w-full items-center justify-between px-3 py-2 text-left text-xs"
        >
          <span className="flex items-center gap-2">
            <Sparkles className={`h-3.5 w-3.5 ${hasKey ? "text-amber-300" : "text-slate-500"}`} />
            <span className="font-semibold text-slate-200">AI design engine</span>
            <span className={`chip ${hasKey ? "chip-accent" : ""}`}>
              {hasKey ? AI_MODELS.find((m) => m.id === ai.model)?.label ?? ai.model : "off · templates only"}
            </span>
          </span>
          {settingsOpen ? <ChevronUp className="h-3.5 w-3.5 text-slate-500" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-500" />}
        </button>
        {settingsOpen && (
          <div className="space-y-3 border-t border-slate-800 px-3 py-3">
            <p className="text-[11px] leading-snug text-slate-400">
              With an Anthropic API key, the model looks at your photo and description. The key is stored only in
              this browser and sent straight to the Claude API from here. You pay per generation on your own account.
            </p>
            <div>
              <span className="label">Design method</span>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["plan", "Body plan", "The model picks one of the body plans (built-in and your saved ones) and sets proportions and colors; the builder makes the geometry, so it always holds. Cheapest and most reliable."],
                    ["freeform", "Freeform geometry", "The model writes the whole bubble sequence itself: bends, turns, locks, three tiers. More variety, rougher results."],
                  ] as const
                ).map(([id, label, note]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => updateAi({ method: id })}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                      ai.method === id ? "border-amber-400 bg-amber-400/15 text-amber-200" : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"
                    }`}
                    title={note}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                {ai.method === "plan"
                  ? "Picks a body plan and its proportions from the photo or description. Save your own one- or two-balloon designs as plans and the model can use those too."
                  : "Writes the bubble geometry directly. Use when no body plan fits the subject."}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
              <label className="md:col-span-7">
                <span className="label">API key</span>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    value={ai.apiKey}
                    onChange={(e) => updateAi({ apiKey: e.target.value })}
                    placeholder="sk-ant-…"
                    autoComplete="off"
                    spellCheck={false}
                    className="input input-sm pl-8 font-mono"
                  />
                </div>
              </label>
              <label className="md:col-span-5">
                <span className="label">Model</span>
                <select value={ai.model} onChange={(e) => updateAi({ model: e.target.value })} className="select w-full">
                  {AI_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <div className="mt-1 text-[11px] text-slate-500">{AI_MODELS.find((m) => m.id === ai.model)?.note}</div>
              </label>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>
                Get a key at{" "}
                <a href="https://platform.claude.com/" target="_blank" rel="noreferrer" className="text-amber-300 underline">
                  platform.claude.com
                </a>
                .
              </span>
              {hasKey && (
                <button type="button" onClick={() => updateAi({ apiKey: "" })} className="btn btn-ghost btn-xs">
                  Forget key
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="label">Quick examples</div>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_INSPIRATIONS.map((item) => (
            <button
              key={item.query}
              onClick={() => {
                setPrompt(item.query);
                void generate(item.query, null);
              }}
              disabled={isProcessing}
              className="btn btn-secondary"
            >
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
