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

Produce:
- product_name, product_url, one_line_description, category, product_type
- product_summary, what_it_does, target_customer, target_audience, primary_pain, user_pain_points, core_promise
- key_features, key_benefits
- offer, cta (nullable if unknown)
- niche, alternative_solutions, market_category
- positioning_angles (3-5), content_pillars (3-6), content_angles, brand_voice
- platform_recommendations with platform + reason
- cta_suggestions, founder_led_opportunities, positioning_gaps
- production_constraints booleans
- suggested_competitors (name, optional url, reason, confidence 0-1)
- suggested_sources (platform, url, reason, confidence)
- confidence object with low/medium/high values
- extraction_notes: explain what was easy/hard to infer from the website
- confidence_score (0-1) reflecting how complete the inputs are
- missing_information: list gaps the founder should fill`;

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
