"use client";

import React, { useRef, useState } from "react";
import { ComplexityLevel, FullDesign } from "@/types/balloon";
import { findOrGenerateDesigns } from "@/lib/balloonPresets";

interface PromptImageConverterProps {
  onDesignsGenerated: (
    designs: Record<ComplexityLevel, FullDesign>,
    promptOrSource: string,
    imageUrl?: string
  ) => void;
  onStartBlankSlate: () => void;
  isLoading?: boolean;
}

interface ImageAnalysis {
  colors: string[];
  silhouette: string;
  archetypeHint: string;
  width: number;
  height: number;
  foregroundRatio: number;
}

const SAMPLE_INSPIRATIONS = [
  { label: "Classic Dog / Puppy", query: "dog", icon: "🐶" },
  { label: "Pirate Cutlass Sword", query: "sword", icon: "⚔️" },
  { label: "Spring Daisy Flower", query: "flower", icon: "🌸" },
  { label: "Teddy Bear", query: "teddy bear", icon: "🧸" },
  { label: "T-Rex Dinosaur", query: "dinosaur t-rex", icon: "🦖" },
  { label: "Fairy Butterfly", query: "butterfly wings", icon: "🦋" },
  { label: "Swan / Flamingo", query: "swan flamingo", icon: "🦩" },
  { label: "Magic Cosmic Wand", query: "magic wand star", icon: "🪄" },
  { label: "Unicorn with Spiral Horn", query: "unicorn spiral horn", icon: "🦄" },
  { label: "Alien with Antenna", query: "alien octopus antenna", icon: "👾" },
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
    // The decoded bitmap remains available after revoking the source object URL.
    URL.revokeObjectURL(url);
  }
}

function analyzeImage(image: HTMLImageElement): { analysis: ImageAnalysis; previewUrl: string } {
  const sampleSize = 112;
  const canvas = document.createElement("canvas");
  canvas.width = sampleSize;
  canvas.height = sampleSize;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas image analysis is unavailable in this browser.");

  context.clearRect(0, 0, sampleSize, sampleSize);
  const scale = Math.min(sampleSize / image.naturalWidth, sampleSize / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const offsetX = (sampleSize - drawWidth) / 2;
  const offsetY = (sampleSize - drawHeight) / 2;
  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
  const pixels = context.getImageData(0, 0, sampleSize, sampleSize).data;

  const readPixel = (x: number, y: number): [number, number, number] => {
    const index = (Math.max(0, Math.min(sampleSize - 1, y)) * sampleSize + Math.max(0, Math.min(sampleSize - 1, x))) * 4;
    return [pixels[index], pixels[index + 1], pixels[index + 2]];
  };
  const corners = [
    readPixel(2, 2),
    readPixel(sampleSize - 3, 2),
    readPixel(2, sampleSize - 3),
    readPixel(sampleSize - 3, sampleSize - 3),
  ];
  const background: [number, number, number] = [
    Math.round(corners.reduce((sum, color) => sum + color[0], 0) / corners.length),
    Math.round(corners.reduce((sum, color) => sum + color[1], 0) / corners.length),
    Math.round(corners.reduce((sum, color) => sum + color[2], 0) / corners.length),
  ];

  const buckets = new Map<string, { count: number; sum: [number, number, number] }>();
  let minX = sampleSize;
  let minY = sampleSize;
  let maxX = 0;
  let maxY = 0;
  let foregroundPixels = 0;

  for (let y = 0; y < sampleSize; y += 1) {
    for (let x = 0; x < sampleSize; x += 1) {
      const index = (y * sampleSize + x) * 4;
      if (pixels[index + 3] < 80) continue;
      const rgb: [number, number, number] = [pixels[index], pixels[index + 1], pixels[index + 2]];
      const saturation = Math.max(...rgb) - Math.min(...rgb);
      const isForeground = rgbDistance(rgb, background) > Math.max(34, saturation * 0.38);
      if (!isForeground) continue;

      foregroundPixels += 1;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      const quantized: [number, number, number] = [
        Math.round(rgb[0] / 28) * 28,
        Math.round(rgb[1] / 28) * 28,
        Math.round(rgb[2] / 28) * 28,
      ];
      const key = quantized.join(",");
      const bucket = buckets.get(key) ?? { count: 0, sum: [0, 0, 0] as [number, number, number] };
      bucket.count += 1;
      bucket.sum[0] += rgb[0];
      bucket.sum[1] += rgb[1];
      bucket.sum[2] += rgb[2];
      buckets.set(key, bucket);
    }
  }

  const ranked = [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .map((bucket): [number, number, number] => [
      Math.round(bucket.sum[0] / bucket.count),
      Math.round(bucket.sum[1] / bucket.count),
      Math.round(bucket.sum[2] / bucket.count),
    ]);
  const distinct: Array<[number, number, number]> = [];
  for (const color of ranked) {
    if (distinct.every((existing) => rgbDistance(existing, color) > 58)) distinct.push(color);
    if (distinct.length === 4) break;
  }
  if (distinct.length === 0) distinct.push([225, 29, 72]);

  const foregroundWidth = Math.max(1, maxX - minX + 1);
  const foregroundHeight = Math.max(1, maxY - minY + 1);
  const aspect = foregroundWidth / foregroundHeight;
  const fill = foregroundPixels / (foregroundWidth * foregroundHeight);

  // Shape feature extraction for balloon archetype mapping
  // Extract edge density and contour information
  let edgeDensity = 0;
  let contourScore = 0;
  let hasDiagonalStructure = false;
  let hasVerticalStructure = false;
  let hasHorizontalStructure = false;

  // Sample edge density from the foreground bounding box
  const edgeSample = 64;
  const edgeCanvas = document.createElement("canvas");
  edgeCanvas.width = edgeSample;
  edgeCanvas.height = edgeSample;
  const edgeCtx = edgeCanvas.getContext("2d", { willReadFrequently: true });
  if (edgeCtx) {
    edgeCtx.drawImage(image, 0, 0, edgeSample, edgeSample);
    const edgeData = edgeCtx.getImageData(0, 0, edgeSample, edgeSample).data;
    const edgePixels = [];
    for (let y = 0; y < edgeSample; y++) {
      for (let x = 0; x < edgeSample; x++) {
        const idx = (y * edgeSample + x) * 4;
        if (edgeData[idx + 3] < 80) continue;
        // Simple edge detection: check if pixel differs from neighbors
        const idxRight = (y * edgeSample + Math.min(edgeSample - 1, x + 1)) * 4;
        const idxBelow = (Math.min(edgeSample - 1, y + 1) * edgeSample + x) * 4;
        const diffR = Math.abs(edgeData[idx] - edgeData[idxRight]);
        const diffB = Math.abs(edgeData[idx] - edgeData[idxBelow]);
        if (diffR > 30 || diffB > 30) edgePixels.push([x, y]);
      }
    }
    edgeDensity = edgePixels.length / (edgeSample * edgeSample);
    contourScore = Math.min(1, edgeDensity * 4);

    // Check for structural directions
    const midX = edgeSample / 2;
    const midY = edgeSample / 2;
    let diagonalCount = 0;
    let verticalCount = 0;
    let horizontalCount = 0;
    for (const [px, py] of edgePixels) {
      const dx = px - midX;
      const dy = py - midY;
      if (Math.abs(dx) > Math.abs(dy) * 2) horizontalCount++;
      if (Math.abs(dy) > Math.abs(dx) * 2) verticalCount++;
      if (Math.abs(Math.abs(dx) - Math.abs(dy)) < Math.max(Math.abs(dx), Math.abs(dy)) * 0.3) diagonalCount++;
    }
    hasDiagonalStructure = diagonalCount > edgePixels.length * 0.3;
    hasVerticalStructure = verticalCount > edgePixels.length * 0.35;
    hasHorizontalStructure = horizontalCount > edgePixels.length * 0.35;
  }

  // Map shape features to balloon archetype
  let silhouette = "compact character or object";
  let archetypeHint = "quadruped";
  if (aspect > 1.75) {
    silhouette = "wide winged or long horizontal object";
    if (hasDiagonalStructure) archetypeHint = "winged";
    else archetypeHint = "wand";
  } else if (aspect < 0.48) {
    silhouette = "tall narrow wand, stem, sword, or upright character";
    archetypeHint = "wand";
  } else if (fill < 0.38) {
    silhouette = "branched figure with limbs, wings, or open spaces";
    if (hasDiagonalStructure) archetypeHint = "radial";
    else archetypeHint = "winged";
  } else if (fill > 0.72) {
    silhouette = "rounded compact figure";
    archetypeHint = "quadruped";
  } else if (contourScore > 0.4) {
    silhouette = "detailed figure with clear contours";
    archetypeHint = "radial";
  } else {
    silhouette = "balanced creature or object";
    archetypeHint = "quadruped";
  }

  // Add archetype hint to the analysis for use in generation
  const archetypeMap: Record<string, string> = {
    winged: "winged creature with wings",
    wand: "tall staff or wand with appendages",
    radial: "radial creature with tentacles or limbs",
    quadruped: "quadrupedal animal with four limbs",
  };
  const finalHint = archetypeMap[archetypeHint] || "generic object";

  // Use a bounded JPEG preview instead of retaining an arbitrarily huge original data URL.
  const previewCanvas = document.createElement("canvas");
  const maxPreview = 900;
  const previewScale = Math.min(1, maxPreview / Math.max(image.naturalWidth, image.naturalHeight));
  previewCanvas.width = Math.max(1, Math.round(image.naturalWidth * previewScale));
  previewCanvas.height = Math.max(1, Math.round(image.naturalHeight * previewScale));
  const previewContext = previewCanvas.getContext("2d");
  if (!previewContext) throw new Error("Could not create an image preview.");
  previewContext.drawImage(image, 0, 0, previewCanvas.width, previewCanvas.height);

  return {
    previewUrl: previewCanvas.toDataURL("image/jpeg", 0.86),
    analysis: {
      colors: distinct.map(toHex),
      silhouette,
      archetypeHint: finalHint,
      width: image.naturalWidth,
      height: image.naturalHeight,
      foregroundRatio: Math.round((foregroundPixels / (sampleSize * sampleSize)) * 100),
    },
  };
}

export const PromptImageConverter: React.FC<PromptImageConverterProps> = ({
  onDesignsGenerated,
  onStartBlankSlate,
  isLoading = false,
}) => {
  const [prompt, setPrompt] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [analysis, setAnalysis] = useState<ImageAnalysis | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState("Describe an item, upload a reference, or use both.");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generate = (
    promptOverride?: string,
    analysisOverride?: ImageAnalysis | null,
    imageOverride?: string | null
  ) => {
    const visual = analysisOverride ?? analysis;
    const fileHint = cleanFileName(selectedFileName);
    const typedHint = (promptOverride ?? prompt).trim();
    const effectivePrompt = typedHint || fileHint || visual?.silhouette || "uploaded reference object";
    const sourceLabel = visual
      ? `${effectivePrompt} — reference image (${visual.silhouette})`
      : effectivePrompt;
    // Use archetype hint as the primary shape descriptor for generation
    const shapePrompt = visual?.archetypeHint || effectivePrompt;

    setIsProcessing(true);
    setError(null);
    setStatus(visual ? "Building three balloon tiers from the analyzed reference…" : "Building three balloon tiers…");
    window.setTimeout(() => {
      try {
        const results = findOrGenerateDesigns(shapePrompt, visual?.colors);
        onDesignsGenerated(results, sourceLabel, imageOverride ?? selectedImage ?? undefined);
        setStatus(
          visual
            ? `Generated from image: ${visual.width}×${visual.height}, ${visual.silhouette}, ${visual.colors.length} latex color candidates.`
            : `Generated three adjustable tiers for “${effectivePrompt}”.`
        );
      } catch (generationError) {
        setError(generationError instanceof Error ? generationError.message : "Reference generation failed.");
        setStatus("Generation failed. Try another image or add a short description.");
      } finally {
        setIsProcessing(false);
      }
    }, 80);
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
      setStatus("Analyzing silhouette and extracting usable latex colors…");
      const result = analyzeImage(decoded);
      setSelectedImage(result.previewUrl);
      setAnalysis(result.analysis);
      const fileHint = cleanFileName(file.name);
      if (!prompt.trim() && fileHint) setPrompt(fileHint);
      // Image upload is a complete input mode: generate immediately after successful analysis.
      generate(prompt.trim() || fileHint || result.analysis.silhouette, result.analysis, result.previewUrl);
    } catch (imageError) {
      setError(imageError instanceof Error ? imageError.message : "The image could not be analyzed.");
      setStatus("Image analysis failed. Please try a different file.");
      setIsProcessing(false);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-800 pb-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎈</span>
            <h2 className="text-xl font-bold tracking-wide text-white">
              Convert an Item or Reference Image into 3 Twister Tiers
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Uploading a reference analyzes it and generates immediately. Add a short description for better object recognition.
          </p>
        </div>
        <button
          onClick={onStartBlankSlate}
          className="self-start rounded-xl border border-amber-500/30 bg-slate-800 px-4 py-2 text-xs font-bold text-amber-400 shadow transition hover:bg-slate-700 hover:text-amber-300 md:self-auto"
        >
          ✨ Start from Blank Slate
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        <div className="space-y-2 md:col-span-7">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
            Description or Image Recognition Hint
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="Optional with an image — e.g. red race car, dachshund, orchid, astronaut…"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && !isProcessing && generate()}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-4 pr-28 text-sm text-white shadow-inner placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
            />
            <button
              onClick={() => generate()}
              disabled={isProcessing || isLoading}
              className="absolute bottom-1.5 right-1.5 top-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 text-xs font-bold text-slate-950 shadow transition hover:from-amber-400 hover:to-amber-500 disabled:opacity-50"
            >
              {isProcessing ? "Analyzing…" : selectedImage ? "Regenerate" : "Twist! 🪄"}
            </button>
          </div>
        </div>

        <div className="space-y-2 md:col-span-5">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
            Reference Image
          </label>
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
                : selectedImage
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
            {selectedImage ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedImage}
                  alt="Uploaded reference"
                  className="h-14 w-14 shrink-0 rounded-lg border border-amber-500 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold text-amber-300">{selectedFileName}</div>
                  <div className="mt-0.5 text-[10px] leading-snug text-slate-400">
                    {analysis?.silhouette ?? "Analyzing reference…"}
                  </div>
                  <div className="mt-1 flex items-center gap-1">
                    {analysis?.colors.map((color) => (
                      <span
                        key={color}
                        className="h-3.5 w-3.5 rounded-full border border-white/30"
                        style={{ backgroundColor: color }}
                        title={`Candidate balloon color ${color}`}
                      />
                    ))}
                    <span className="ml-1 text-[9px] text-slate-500">one color assigned per balloon</span>
                  </div>
                </div>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedImage(null);
                    setSelectedFileName("");
                    setAnalysis(null);
                    setStatus("Reference cleared. Describe an item or upload another image.");
                  }}
                  className="rounded-md bg-slate-800 px-2 py-1 text-[10px] text-slate-300 hover:bg-rose-900 hover:text-rose-200"
                >
                  Clear
                </button>
              </>
            ) : (
              <div className="mx-auto text-center text-xs text-slate-400">
                <div className="text-xl">📷</div>
                <div className="font-semibold text-slate-300">Click or drop a reference image</div>
                <div className="text-[10px]">PNG · JPEG · WebP · GIF · up to 18 MB</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        className={`rounded-lg border px-3 py-2 text-[11px] ${
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

      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Quick examples
        </div>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_INSPIRATIONS.map((item) => (
            <button
              key={item.query}
              onClick={() => {
                setPrompt(item.query);
                generate(item.query, null, null);
              }}
              disabled={isProcessing}
              className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-300 shadow-sm transition hover:border-slate-700 hover:bg-slate-800 hover:text-white disabled:opacity-50"
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
