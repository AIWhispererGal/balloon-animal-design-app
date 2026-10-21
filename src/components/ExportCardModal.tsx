"use client";

import React, { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { FullDesign } from "@/types/balloon";
import { StepVisualDiagram } from "./StepVisualDiagram";
import { TWIST_ENCYCLOPEDIA } from "@/lib/balloonConstants";

interface ExportCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  design: FullDesign;
  pngDataUrl: string | null;
  onRecapturePng?: () => void;
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

async function downloadDataUrl(dataUrl: string, fileName: string) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

export const ExportCardModal: React.FC<ExportCardModalProps> = ({
  isOpen,
  onClose,
  design,
  pngDataUrl,
  onRecapturePng,
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [busyAction, setBusyAction] = useState<"model" | "sheet" | "print" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownloadModelPng = async () => {
    if (!pngDataUrl) {
      setMessage("The 3D render is not ready yet. Capture it again, then download.");
      onRecapturePng?.();
      return;
    }
    setBusyAction("model");
    setMessage(null);
    try {
      await downloadDataUrl(pngDataUrl, `${slugify(design.title)}-final-3d.png`);
      setMessage("Downloaded the clean 1800×1400 final 3D PNG.");
    } catch {
      setMessage("The browser blocked the PNG download. Try the download button again.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleDownloadInstructionPng = async () => {
    if (!printAreaRef.current) return;
    setBusyAction("sheet");
    setMessage("Rendering the complete instruction sheet PNG…");
    try {
      const dataUrl = await toPng(printAreaRef.current, {
        cacheBust: true,
        pixelRatio: 1.5,
        backgroundColor: "#020617",
        style: {
          maxHeight: "none",
          overflow: "visible",
        },
      });
      await downloadDataUrl(dataUrl, `${slugify(design.title)}-instruction-sheet.png`);
      setMessage("Downloaded the complete instruction sheet as a PNG.");
    } catch (error) {
      console.error("Instruction PNG export failed", error);
      setMessage("Instruction-sheet PNG rendering failed in this browser. The isolated Print Guide remains available.");
    } finally {
      setBusyAction(null);
    }
  };

  const handlePrintGuide = () => {
    if (!printAreaRef.current) return;
    setBusyAction("print");
    setMessage("Preparing an isolated print document…");

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "1px";
    iframe.style.height = "1px";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    document.body.appendChild(iframe);

    const printDocument = iframe.contentDocument;
    const printWindow = iframe.contentWindow;
    if (!printDocument || !printWindow) {
      iframe.remove();
      setBusyAction(null);
      setMessage("Could not open the isolated print document.");
      return;
    }

    const styleLinks = [...document.querySelectorAll('link[rel="stylesheet"], style')]
      .map((node) => node.outerHTML)
      .join("\n");
    printDocument.open();
    printDocument.write(`<!doctype html>
      <html>
        <head>
          <base href="${window.location.origin}/" />
          <title>${design.title} — Balloon Instructions</title>
          ${styleLinks}
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            html, body { margin: 0 !important; padding: 0 !important; background: white !important; color: #0f172a !important; }
            body { font-family: Arial, Helvetica, sans-serif !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            .print-document { width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; background: white !important; }
            .print-document div:not([style]) { background-color: white !important; box-shadow: none !important; }
            .print-document p, .print-document span, .print-document h1, .print-document h2, .print-document h3, .print-document h4 { color: #0f172a !important; }
            .print-document > div { break-inside: avoid; page-break-inside: avoid; }
            .print-document button { display: none !important; }
            .print-document img { max-width: 100% !important; }
            .print-document svg { max-width: 100% !important; }
          </style>
        </head>
        <body>
          <main class="print-document">${printAreaRef.current.innerHTML}</main>
        </body>
      </html>`);
    printDocument.close();

    window.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      window.setTimeout(() => iframe.remove(), 1200);
      setBusyAction(null);
      setMessage("Opened the dedicated instruction-guide print dialog (the app screen is excluded)." );
    }, 650);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-md animate-fade-in">
      <div className="relative my-auto flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/80 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📦</span>
            <div>
              <h3 className="text-lg font-bold text-white">Export Balloon Design &amp; Instruction Sheet</h3>
              <p className="text-xs text-slate-400">
                Download the clean 3D render, download the complete guide PNG, or print only the guide.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => void handleDownloadModelPng()}
              disabled={busyAction !== null || !pngDataUrl}
              className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-bold text-slate-950 shadow transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-45"
              title={pngDataUrl ? "Download clean high-resolution 3D sculpture PNG" : "3D render is still being captured"}
            >
              <span>🖼️</span>
              <span>{busyAction === "model" ? "Downloading…" : "Download Final 3D PNG"}</span>
            </button>
            <button
              onClick={() => void handleDownloadInstructionPng()}
              disabled={busyAction !== null}
              className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3.5 py-2 text-xs font-bold text-white shadow transition hover:bg-cyan-500 disabled:opacity-45"
            >
              <span>📄</span>
              <span>{busyAction === "sheet" ? "Rendering…" : "Download Guide PNG"}</span>
            </button>
            <button
              onClick={handlePrintGuide}
              disabled={busyAction !== null}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-45"
            >
              <span>🖨️</span>
              <span>{busyAction === "print" ? "Preparing…" : "Print Guide Only"}</span>
            </button>
            <button
              onClick={onClose}
              className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-sm text-slate-300 transition hover:bg-slate-700"
              aria-label="Close export dialog"
            >
              ✕
            </button>
          </div>
        </div>

        {message && (
          <div className="border-b border-slate-800 bg-slate-950 px-6 py-2 text-[11px] text-cyan-300">
            {message}
          </div>
        )}

        <div ref={printAreaRef} className="flex-1 space-y-6 overflow-y-auto bg-slate-950/50 p-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-md">
            <div className="flex flex-col items-center gap-6 md:flex-row">
              <div className="flex w-full flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-950 p-3 shadow-inner md:w-5/12">
                {pngDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pngDataUrl}
                    alt={design.title}
                    className="h-auto max-h-64 w-full rounded-lg object-contain drop-shadow-xl"
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center text-xs text-slate-500">
                    Capturing clean 3D render…
                  </div>
                )}
                <div className="mt-2 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                  Clean 1800×1400 Physical PBR Latex Render
                </div>
              </div>

              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-amber-400">
                    {design.complexity} complexity
                  </span>
                  <span className="font-mono text-xs text-slate-400">
                    {design.bubbles.length} bubbles · {design.balloons.length} balloon{design.balloons.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <h1 className="text-2xl font-black tracking-wide text-white">{design.title}</h1>
                <p className="text-xs leading-relaxed text-slate-300">{design.description}</p>

                <div className="pt-2">
                  <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Balloons Required — one color per physical balloon
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {design.balloons.map((balloon) => (
                      <div
                        key={balloon.id}
                        className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 p-2 text-xs"
                      >
                        <span
                          className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/20"
                          style={{ backgroundColor: balloon.color }}
                        />
                        <div>
                          <div className="font-bold text-white">{balloon.size} {balloon.colorName}</div>
                          <div className="text-[10px] text-amber-400">
                            Leave {balloon.tailFingers ?? 5} fingers ({balloon.tailLengthInches ?? 4}″) tail
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-300">
              <span>🪜</span>
              <span>Step-by-Step Instructions &amp; Simulated Build Diagrams</span>
            </h3>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {design.steps.map((step, index) => {
                const twist = TWIST_ENCYCLOPEDIA[step.twistType] || TWIST_ENCYCLOPEDIA.basic;
                return (
                  <article
                    key={step.stepId || index}
                    className="flex flex-col justify-between space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4"
                  >
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-400">
                          Step {index + 1}
                        </span>
                        <span className="text-[11px] font-semibold text-cyan-400">{twist.name}</span>
                      </div>
                      <h4 className="mb-1 text-sm font-bold text-white">{step.title}</h4>
                      <p className="mb-3 text-xs leading-relaxed text-slate-300">{step.description}</p>
                      <StepVisualDiagram
                        twistType={step.twistType}
                        diagramType={step.diagramSvgType}
                        balloonColor={step.balloonColor || "#EA580C"}
                        balloonSize={step.balloonSize || "260"}
                        bubbleLabels={step.bubbleLabels}
                        tailRemainingInches={step.tailRemainingInches}
                        balloons={design.balloons}
                        bubbles={design.bubbles}
                        steps={design.steps}
                        stepIndex={index}
                        className="mb-2 h-36"
                      />
                    </div>

                    <div className="space-y-1.5 border-t border-slate-800/80 pt-2 text-[11px]">
                      {step.handStateNote && <div className="font-medium text-cyan-300">{step.handStateNote}</div>}
                      <div className="flex justify-between gap-2 text-slate-400">
                        <span>Measurement:</span>
                        <span className="text-right font-mono font-semibold text-amber-300">{step.measurementText}</span>
                      </div>
                      {step.tips && <div className="italic text-emerald-400">💡 Tip: {step.tips}</div>}
                      {step.annotation && (
                        <div className="rounded border border-amber-900/40 bg-amber-950/30 p-1.5 font-medium text-amber-300">
                          📝 {step.annotation}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
