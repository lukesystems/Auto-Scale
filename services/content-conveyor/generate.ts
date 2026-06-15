import { generateObject } from "@/services/ai/runtime";
import {
  ContentIdeasSchema,
  GeneratedPostSchema,
  HooksSchema,
  type ContentIdeas,
  type GeneratedPostDraft,
  type Hooks,
} from "./schema";

const SYSTEM = `You are AutoScale's Content Conveyor. You turn TrendWatch insights into structured content drafts.

Core rules:
- Never generate disconnected content. Every output is linked to a TrendWatch insight or hook.
- Every idea includes: format, hook, hypothesis, metric_to_watch.
- Avoid generic AI marketing voice. Be specific to the founder's niche.
- Prefer transferable formats (carousels, teardowns, before/after) over high-budget production.
- Return JSON matching the requested schema.`;

export interface HooksInput {
  niche?: string;
  primaryPain?: string;
  targetCustomer?: string;
  trendwatchSummary?: string;
  insights?: string[];
  hookOpportunities?: string[];
  count?: number;
}

export async function generateHooks(input: HooksInput): Promise<{
  hooks: Hooks["hooks"];
  raw: string;
  provider: string;
  model: string;
  latencyMs: number;
}> {
  const count = input.count ?? 24;
  const prompt = `[[hooks]]
Generate ${count} hooks for this project.

Niche: ${input.niche ?? "(not provided)"}
Primary pain: ${input.primaryPain ?? "(not provided)"}
Target customer: ${input.targetCustomer ?? "(not provided)"}
TrendWatch summary: ${input.trendwatchSummary ?? "(not provided)"}
Insights:
${(input.insights ?? []).map((i, n) => `  ${n + 1}. ${i}`).join("\n") || "  (none)"}
Hook opportunities from TrendWatch:
${(input.hookOpportunities ?? []).map((h, n) => `  ${n + 1}. ${h}`).join("\n") || "  (none)"}

Requirements:
- One sharp sentence each. No emojis. No clickbait.
- Mix angles: pain, contrarian, math, reframe, vulnerability, tactical, journey.
- Avoid "Discover", "Unlock", "Imagine".`;

  const result = await generateObject({
    system: SYSTEM,
    prompt,
    schema: HooksSchema,
    schemaName: "Hooks",
    temperature: 0.75,
  });

  return {
    hooks: result.object.hooks,
    raw: result.raw,
    provider: result.provider,
    model: result.model,
    latencyMs: result.latencyMs,
  };
}

export interface ContentIdeasInput {
  niche?: string;
  productSummary?: string;
  targetCustomer?: string;
  primaryPain?: string;
  hooks?: Array<{ hook: string; angle?: string }>;
  preferredPlatforms?: string[];
  count?: number;
}

export async function generateContentIdeas(input: ContentIdeasInput): Promise<{
  ideas: ContentIdeas["ideas"];
  raw: string;
  provider: string;
  model: string;
  latencyMs: number;
}> {
  const count = input.count ?? 12;
  const hookLines = (input.hooks ?? [])
    .slice(0, 20)
    .map((h, i) => `  ${i + 1}. ${h.hook}${h.angle ? ` (${h.angle})` : ""}`)
    .join("\n");

  const prompt = `[[content_ideas]]
Generate ${count} structured content ideas.

Niche: ${input.niche ?? "(not provided)"}
Product summary: ${input.productSummary ?? "(not provided)"}
Target customer: ${input.targetCustomer ?? "(not provided)"}
Primary pain: ${input.primaryPain ?? "(not provided)"}
Preferred platforms: ${(input.preferredPlatforms ?? []).join(", ") || "tiktok, linkedin, x"}

Hooks to choose from:
${hookLines || "  (none — invent niche-appropriate hooks)"}

Each idea must include: format, hook, angle, target_audience, why_this_should_work, hypothesis, platforms, metric_to_watch, risk_level, variant_suggestions.
Prefer formats: problem-solution carousel, tool teardown, before/after workflow, mistake carousel, comparison carousel, founder-led script.`;

  const result = await generateObject({
    system: SYSTEM,
    prompt,
    schema: ContentIdeasSchema,
    schemaName: "ContentIdeas",
    temperature: 0.7,
  });

  return {
    ideas: result.object.ideas,
    raw: result.raw,
    provider: result.provider,
    model: result.model,
    latencyMs: result.latencyMs,
  };
}

export interface GeneratePostInput {
  idea: {
    format: string;
    hook: string;
    angle?: string;
    target_audience?: string;
    hypothesis?: string;
    platforms?: string[];
    metric_to_watch?: string;
  };
  niche?: string;
  brandVoice?: string;
  cta?: string;
  productSummary?: string;
}

export async function generatePostDraft(input: GeneratePostInput): Promise<{
  post: GeneratedPostDraft;
  raw: string;
  provider: string;
  model: string;
  latencyMs: number;
}> {
  const prompt = `[[generated_post]]
Generate a structured post draft.

Idea:
  Format: ${input.idea.format}
  Hook: ${input.idea.hook}
  Angle: ${input.idea.angle ?? ""}
  Target audience: ${input.idea.target_audience ?? ""}
  Hypothesis: ${input.idea.hypothesis ?? ""}
  Platforms: ${(input.idea.platforms ?? []).join(", ") || "linkedin, x"}
  Metric to watch: ${input.idea.metric_to_watch ?? "saves"}

Project context:
  Niche: ${input.niche ?? "(not provided)"}
  Product summary: ${input.productSummary ?? "(not provided)"}
  Brand voice: ${input.brandVoice ?? "Direct, technical, no hype."}
  CTA: ${input.cta ?? "(not provided)"}

Output a post with:
- 5-8 slides if format is a carousel; otherwise a script as 3-6 slides
- caption (40-90 words)
- cta (one short line)
Keep each slide headline under 12 words. Body under 20 words.`;

  const result = await generateObject({
    system: SYSTEM,
    prompt,
    schema: GeneratedPostSchema,
    schemaName: "GeneratedPost",
    temperature: 0.65,
  });

  return {
    post: result.object,
    raw: result.raw,
    provider: result.provider,
    model: result.model,
    latencyMs: result.latencyMs,
  };
}
