import { generateObject } from "@/services/ai/runtime";
import { AutoBriefSchema, type AutoBrief } from "./schema";
import type { SiteFetchOutput } from "./fetch-site";

export interface AutoBriefGenerateInput {
  productUrl: string;
  siteFetch: SiteFetchOutput | null;
  manualProductName?: string;
  manualDescription?: string;
}

const SYSTEM = `You are AutoScale AutoBrief. You turn a startup website (or manual founder inputs) into a structured product brief for content distribution.

Rules:
- Be specific. Avoid generic marketing language.
- If website content is missing or fetch failed, say so in missing_information and lower confidence_score.
- Do NOT invent competitor URLs. Only include URLs you are confident about from provided context.
- Suggested competitors can be names without URLs when uncertain, but they must be labeled as guesses with low/medium/high confidence.
- Never claim you verified a page you could not fetch.
- Separate observed product facts from market/distribution guesses.
- Add confidence levels for audience, features, competitors, and positioning.
- Return JSON matching the requested schema.`;

export async function generateAutoBrief(input: AutoBriefGenerateInput): Promise<{
  brief: AutoBrief;
  raw: string;
  provider: string;
  model: string;
  latencyMs: number;
}> {
  const fetchBlock = input.siteFetch
    ? input.siteFetch.ok
      ? `Website fetch: SUCCESS (${input.siteFetch.crawlMode ?? "llm"} crawl)
Title: ${input.siteFetch.title ?? "(none)"}
Description: ${input.siteFetch.description ?? "(none)"}
Visible text snippet:
${input.siteFetch.textSnippet ?? "(none)"}

${
  input.siteFetch.llmFactsSummary
    ? `LLM-extracted structured facts (aggregated across pages):
${input.siteFetch.llmFactsSummary}`
    : ""
}

Extracted pages:
${input.siteFetch.pages
  .map((page) => `- ${page.url}
  title: ${page.title ?? "(none)"}
  description: ${page.description ?? "(none)"}
  headings: ${page.headings.join(" | ") || "(none)"}
  ctas: ${page.ctas.join(" | ") || "(none)"}`)
  .join("\n") || "(none)"}`
      : `Website fetch: FAILED
Error: ${input.siteFetch.error ?? "unknown"}`
    : "Website fetch: not attempted";

  const manualBlock =
    input.manualProductName || input.manualDescription
      ? `Manual founder inputs:
Product name: ${input.manualProductName ?? "(not provided)"}
Description: ${input.manualDescription ?? "(not provided)"}`
      : "";

  const prompt = `[[autobrief]]
Generate a structured AutoBrief for onboarding.

Product URL: ${input.productUrl}
${fetchBlock}
${manualBlock}

Produce a comprehensive founder intelligence brief — this powers the dashboard and first Growth Run.

Required depth:
- product_summary and what_it_does: 2-4 sentences each, concrete not generic
- target_customer: specific ICP with role, stage, and context
- user_pain_points: at least 4 distinct pains observed or inferred from site copy
- key_features and key_benefits: at least 5 items each when evidence exists
- suggested_competitors: at least 3 named competitors or alternatives with reason + confidence (never invent URLs)
- suggested_sources: at least 3 public accounts, communities, or pages worth monitoring (platform + url when known + reason)
- platform_recommendations: at least 3 platforms with specific reasons tied to this product
- content_angles and content_pillars: at least 4 each, grounded in observed positioning
- positioning_gaps: at least 2 gaps vs alternatives
- extraction_notes: 4-8 bullet-style strings explaining your reasoning, what was observed vs inferred, and caveats
- missing_information: honest gaps only

Also include:
- product_name, product_url, one_line_description, category, product_type
- primary_pain, core_promise, offer, cta (nullable if unknown)
- pricing: model (e.g. "freemium", "subscription", "usage-based"), has_free_tier, has_free_trial, tiers (name/price/billing_period/notes from what is actually visible on the site — do not invent numbers), notes for anything ambiguous
- niche, alternative_solutions, market_category
- positioning_angles, brand_voice, cta_suggestions, founder_led_opportunities
- production_constraints booleans
- confidence object with low/medium/high values
- confidence_score (0-1) reflecting how complete the inputs are`;

  const result = await generateObject({
    system: SYSTEM,
    prompt,
    schema: AutoBriefSchema,
    schemaName: "AutoBrief",
    taskType: "autobrief",
    temperature: 0.45,
    maxTokens: 5000,
  });

  return {
    brief: result.object,
    raw: result.raw,
    provider: result.provider,
    model: result.model,
    latencyMs: result.latencyMs,
  };
}
