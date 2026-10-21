"use client";

import React, { useRef, useState } from "react";
import { FolderOpen, Trash2, Upload } from "lucide-react";
import { SavedProjectSummary } from "@/lib/designStorage";

interface DesignLibraryProps {
  projects: SavedProjectSummary[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onImportFile: (file: File) => void;
}

/** Saved designs in this browser, plus import from a .twistcraft.json file. */
export const DesignLibrary: React.FC<DesignLibraryProps> = ({ projects, onOpen, onDelete, onImportFile }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <div className="panel space-y-3 p-6 shadow-2xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Your designs</h2>
          <p className="text-xs text-slate-400">
            Saved in this browser. Download a design as a file to keep a copy or move it to another
            device.
          </p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImportFile(f);
            e.target.value = "";
          }}
        />
        <button onClick={() => fileRef.current?.click()} className="btn btn-secondary shrink-0">
          <Upload className="h-3.5 w-3.5" /> Import file
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-4 text-center text-xs text-slate-500">
          Nothing saved yet. Use Save in the header to keep the current design here.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {projects.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5"
            >
              <button onClick={() => onOpen(p.id)} className="min-w-0 flex-1 text-left" title="Open this design">
                <div className="truncate text-sm font-semibold text-white">{p.title}</div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                  <span className="flex items-center gap-0.5">
                    {p.colors.slice(0, 4).map((c, i) => (
                      <span key={i} className="h-2.5 w-2.5 rounded-full border border-white/20" style={{ backgroundColor: c }} />
                    ))}
                  </span>
                  <span>
                    {p.bubbleCount} bubbles · {p.balloonCount} balloon{p.balloonCount !== 1 ? "s" : ""} · {p.activeComplexity}
                  </span>
                  <span>· {new Date(p.savedAt).toLocaleDateString()}</span>
                </div>
              </button>
              <div className="flex shrink-0 items-center gap-1">
                <button onClick={() => onOpen(p.id)} className="btn btn-secondary btn-xs">
                  <FolderOpen className="h-3.5 w-3.5" /> Open
                </button>
                {confirmId === p.id ? (
                  <button
                    onClick={() => {
                      onDelete(p.id);
                      setConfirmId(null);
                    }}
                    className="btn btn-danger btn-xs"
                  >
                    Confirm delete
                  </button>
                ) : (
                  <button onClick={() => setConfirmId(p.id)} className="btn btn-ghost btn-icon text-rose-300" title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
