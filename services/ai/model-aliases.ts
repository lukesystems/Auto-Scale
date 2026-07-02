/**
 * Maps retired OpenRouter slugs to current replacements.
 * Keeps existing projects runnable without manual DB edits.
 */
export const DEPRECATED_OPENROUTER_MODEL_ALIASES: Record<string, string> = {
  "google/gemini-2.0-flash-001": "google/gemini-2.5-flash",
  "google/gemini-2.0-flash": "google/gemini-2.5-flash",
  "google/gemini-2.0-flash-lite-001": "google/gemini-2.5-flash-lite",
  "google/gemini-2.0-flash-lite": "google/gemini-2.5-flash-lite",
};

export function resolveOpenRouterModelSlug(slug: string | null | undefined): string | null {
  if (!slug?.trim()) return null;
  const normalized = slug.trim();
  const lower = normalized.toLowerCase();
  return DEPRECATED_OPENROUTER_MODEL_ALIASES[lower] ?? normalized;
}

export function isDeprecatedOpenRouterModel(slug: string): boolean {
  return slug.trim().toLowerCase() in DEPRECATED_OPENROUTER_MODEL_ALIASES;
}
