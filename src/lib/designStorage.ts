import { ComplexityLevel, FullDesign } from "@/types/balloon";

/**
 * Designs are saved in the browser (localStorage) and can be moved between
 * machines as JSON files. No server involved: all the math already runs
 * client-side, so a saved project is just the three tier designs plus which
 * tier was active.
 */

export const PROJECT_FORMAT = "twistcraft-project";
export const PROJECT_VERSION = 1;

export interface SavedProject {
  format: typeof PROJECT_FORMAT;
  version: number;
  id: string;
  title: string;
  savedAt: string;
  activeComplexity: ComplexityLevel;
  tiers: Record<ComplexityLevel, FullDesign>;
}

export interface SavedProjectSummary {
  id: string;
  title: string;
  savedAt: string;
  activeComplexity: ComplexityLevel;
  bubbleCount: number;
  balloonCount: number;
  colors: string[];
}

const STORAGE_KEY = "twistcraft.projects.v1";
const TIERS: ComplexityLevel[] = ["beginner", "intermediate", "advanced"];

function canStore(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

function readAll(): SavedProject[] {
  if (!canStore()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isSavedProject) : [];
  } catch {
    return [];
  }
}

function writeAll(projects: SavedProject[]): boolean {
  if (!canStore()) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    return true;
  } catch {
    return false;
  }
}

function isDesign(d: unknown): d is FullDesign {
  if (!d || typeof d !== "object") return false;
  const x = d as Record<string, unknown>;
  return (
    typeof x.title === "string" &&
    Array.isArray(x.balloons) &&
    Array.isArray(x.bubbles) &&
    Array.isArray(x.steps)
  );
}

export function isSavedProject(p: unknown): p is SavedProject {
  if (!p || typeof p !== "object") return false;
  const x = p as Record<string, unknown>;
  if (x.format !== PROJECT_FORMAT) return false;
  if (typeof x.id !== "string" || typeof x.title !== "string") return false;
  const tiers = x.tiers as Record<string, unknown> | undefined;
  if (!tiers) return false;
  return TIERS.every((t) => isDesign(tiers[t]));
}

export function makeProject(
  tiers: Record<ComplexityLevel, FullDesign>,
  activeComplexity: ComplexityLevel,
  id?: string,
  title?: string
): SavedProject {
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    id: id ?? `proj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    title: (title ?? tiers[activeComplexity]?.title ?? "Untitled design").trim() || "Untitled design",
    savedAt: new Date().toISOString(),
    activeComplexity,
    tiers,
  };
}

export function listProjects(): SavedProjectSummary[] {
  return readAll()
    .map((p) => {
      const d = p.tiers[p.activeComplexity] ?? p.tiers.beginner;
      return {
        id: p.id,
        title: p.title,
        savedAt: p.savedAt,
        activeComplexity: p.activeComplexity,
        bubbleCount: d?.bubbles.length ?? 0,
        balloonCount: d?.balloons.length ?? 0,
        colors: (d?.balloons ?? []).map((b) => b.color),
      };
    })
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function loadProject(id: string): SavedProject | null {
  return readAll().find((p) => p.id === id) ?? null;
}

/** Insert or replace by id. Returns false if storage is unavailable or full. */
export function saveProject(project: SavedProject): boolean {
  const all = readAll().filter((p) => p.id !== project.id);
  all.unshift(project);
  return writeAll(all);
}

export function deleteProject(id: string): boolean {
  return writeAll(readAll().filter((p) => p.id !== id));
}

/* ---------- JSON files ---------- */

const safeFileName = (title: string) =>
  title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "balloon-design";

export function downloadProjectJson(project: SavedProject) {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeFileName(project.title)}.twistcraft.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function readProjectFile(file: File): Promise<SavedProject> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  if (!isSavedProject(parsed)) {
    throw new Error("That file is not a TwistCraft design (expected a .twistcraft.json export).");
  }
  return parsed;
}
