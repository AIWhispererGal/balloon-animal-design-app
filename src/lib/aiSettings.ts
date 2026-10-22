/**
 * Settings for the AI design engine. The API key lives only in this browser's
 * localStorage and is sent straight from the browser to the Claude API.
 */
const KEY = "twistcraft.ai.v1";

export interface AiSettings {
  apiKey: string;
  model: string;
}

export const AI_MODELS: Array<{ id: string; label: string; note: string }> = [
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", note: "Recommended · about 2¢ per design" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", note: "Cheapest · about 0.1¢ per design, rougher geometry" },
  { id: "claude-opus-5-5", label: "Claude Opus 5.5", note: "Most capable · about 4¢ per design" },
];

export const DEFAULT_AI_MODEL = AI_MODELS[0].id;

function canStore(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

export function getAiSettings(): AiSettings {
  if (!canStore()) return { apiKey: "", model: DEFAULT_AI_MODEL };
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<AiSettings>) : {};
    return {
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      model: AI_MODELS.some((m) => m.id === parsed.model) ? (parsed.model as string) : DEFAULT_AI_MODEL,
    };
  } catch {
    return { apiKey: "", model: DEFAULT_AI_MODEL };
  }
}

export function setAiSettings(next: AiSettings): void {
  if (!canStore()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function hasAiKey(): boolean {
  return getAiSettings().apiKey.trim().length > 0;
}
