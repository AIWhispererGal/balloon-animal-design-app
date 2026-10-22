import { Recipe } from "./recipeMath";

const RECIPES_KEY = "twistcraft.recipes.v1";
const HANDOFF_KEY = "twistcraft.recipe-handoff.v1";
const CURRENT_KEY = "twistcraft.current-design.v1";

/** What the design page shares with the shopping page: balloons to shop for */
export interface RecipeHandoff {
  designTitle: string;
  balloons: Array<{ size: string; colorName: string; name: string; hex: string; catalogItemId?: string }>;
}

/** The design currently open in the editor, kept up to date so Shopping can always price it */
export function setCurrentDesign(h: RecipeHandoff): void {
  if (!canStore()) return;
  try {
    window.localStorage.setItem(CURRENT_KEY, JSON.stringify(h));
  } catch {
    // ignore
  }
}

export function getCurrentDesign(): RecipeHandoff | null {
  if (!canStore()) return null;
  try {
    const raw = window.localStorage.getItem(CURRENT_KEY);
    return raw ? (JSON.parse(raw) as RecipeHandoff) : null;
  } catch {
    return null;
  }
}

function canStore(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

export function listRecipes(): Recipe[] {
  if (!canStore()) return [];
  try {
    const raw = window.localStorage.getItem(RECIPES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRecipe(recipe: Recipe): boolean {
  if (!canStore()) return false;
  try {
    const all = listRecipes().filter((r) => r.id !== recipe.id);
    all.unshift(recipe);
    window.localStorage.setItem(RECIPES_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

export function deleteRecipe(id: string): void {
  if (!canStore()) return;
  try {
    window.localStorage.setItem(RECIPES_KEY, JSON.stringify(listRecipes().filter((r) => r.id !== id)));
  } catch {
    // ignore
  }
}

export function setRecipeHandoff(h: RecipeHandoff): void {
  if (!canStore()) return;
  try {
    window.localStorage.setItem(HANDOFF_KEY, JSON.stringify(h));
  } catch {
    // ignore
  }
}

/** Read and clear the hand-off so it is consumed once */
export function takeRecipeHandoff(): RecipeHandoff | null {
  if (!canStore()) return null;
  try {
    const raw = window.localStorage.getItem(HANDOFF_KEY);
    if (!raw) return null;
    window.localStorage.removeItem(HANDOFF_KEY);
    return JSON.parse(raw) as RecipeHandoff;
  } catch {
    return null;
  }
}
