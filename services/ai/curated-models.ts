export type CuratedModelTier = "fast" | "balanced" | "reasoning";

export interface CuratedModel {
  id: string;
  slug: string;
  label: string;
  provider: string;
  tier: CuratedModelTier;
  description: string;
  jsonCapable: boolean;
  recommended?: boolean;
}

/** Curated models for the project-creation picker. Slugs are OpenRouter-compatible. */
export const CURATED_MODELS: CuratedModel[] = [
  {
    id: "gpt-4o-mini",
    slug: "openai/gpt-4o-mini",
    label: "GPT-4o Mini",
    provider: "OpenAI",
    tier: "fast",
    description: "Fast and reliable for structured JSON across the full pipeline.",
    jsonCapable: true,
    recommended: true,
  },
  {
    id: "gpt-4o",
    slug: "openai/gpt-4o",
    label: "GPT-4o",
    provider: "OpenAI",
    tier: "balanced",
    description: "Strong all-rounder for brief, discovery, and content generation.",
    jsonCapable: true,
  },
  {
    id: "claude-sonnet",
    slug: "anthropic/claude-3.5-sonnet",
    label: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    tier: "balanced",
    description: "Excellent reasoning for strategy and competitor analysis.",
    jsonCapable: true,
  },
  {
    id: "claude-haiku",
    slug: "anthropic/claude-3-haiku",
    label: "Claude 3 Haiku",
    provider: "Anthropic",
    tier: "fast",
    description: "Quick passes for discovery and caption drafts.",
    jsonCapable: true,
  },
  {
    id: "gemini-flash",
    slug: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    provider: "Google",
    tier: "fast",
    description: "Low-latency Google model for high-volume structured generation.",
    jsonCapable: true,
  },
  {
    id: "deepseek-v3",
    slug: "deepseek/deepseek-chat",
    label: "DeepSeek V3",
    provider: "DeepSeek",
    tier: "reasoning",
    description: "Deep reasoning for pattern mining and strategy.",
    jsonCapable: true,
  },
  {
    id: "llama-70b",
    slug: "meta-llama/llama-3.3-70b-instruct",
    label: "Llama 3.3 70B",
    provider: "Meta",
    tier: "balanced",
    description: "Open-weight model with solid structured output.",
    jsonCapable: true,
  },
];

export function getCuratedModelBySlug(slug: string): CuratedModel | undefined {
  return CURATED_MODELS.find((m) => m.slug === slug);
}

export function getDefaultCuratedModel(): CuratedModel {
  return CURATED_MODELS.find((m) => m.recommended) ?? CURATED_MODELS[0]!;
}
