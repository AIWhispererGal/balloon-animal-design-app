"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { ComplexityLevel, FullDesign } from "@/types/balloon";
import { PromptImageConverter } from "./PromptImageConverter";
import { DesignLibrary } from "./DesignLibrary";
import { SavedProjectSummary } from "@/lib/designStorage";

interface NewDesignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDesignsGenerated: (designs: Record<ComplexityLevel, FullDesign>, label: string) => void;
  onStartBlankSlate: () => void;
  projects: SavedProjectSummary[];
  onOpenProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onImportFile: (file: File) => void;
}

/** New designs (generator / blank slate) and the saved-design library, in one modal. */
export const NewDesignModal: React.FC<NewDesignModalProps> = ({
  isOpen,
  onClose,
  onDesignsGenerated,
  onStartBlankSlate,
  projects,
  onOpenProject,
  onDeleteProject,
  onImportFile,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-[6vh] backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-4xl space-y-4">
        <button
          onClick={onClose}
          className="btn btn-icon btn-secondary absolute -right-2 -top-2 z-10 rounded-full"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <PromptImageConverter
          onDesignsGenerated={(designs, label) => {
            onDesignsGenerated(designs, label);
            onClose();
          }}
          onStartBlankSlate={() => {
            onStartBlankSlate();
            onClose();
          }}
        />
        <DesignLibrary
          projects={projects}
          onOpen={onOpenProject}
          onDelete={onDeleteProject}
          onImportFile={onImportFile}
        />
      </div>
    </div>
  );
};
