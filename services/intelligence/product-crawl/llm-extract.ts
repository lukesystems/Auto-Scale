import "server-only";
import { z } from "zod";
import { generateObject } from "@/services/ai/runtime";
import { logAIRun } from "@/services/ai/logger";
import type { CrawledPageContent, ProductPageType } from "../types";

const PAGE_TYPE_VALUES = [
  "home",
  "pricing",
  "features",
  "product",
  "about",
  "solutions",
  "customers",
  "blog",
  "docs",
  "contact",
  "legal",
  "other",
] as const;

function coercePageIntent(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  return "General product information page";
}

function coercePageTypeGuess(value: unknown): (typeof PAGE_TYPE_VALUES)[number] | null {
  if (typeof value === "string") {
    const key = value.trim().toLowerCase();
    if ((PAGE_TYPE_VALUES as readonly string[]).includes(key)) {
      return key as (typeof PAGE_TYPE_VALUES)[number];
    }
  }
  return "other";
}

function coerceRelevanceScore(value: unknown): number {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return Math.min(1, Math.max(0, value));
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (!Number.isNaN(parsed)) return Math.min(1, Math.max(0, parsed));
  }
  return 0.5;
}

export const PageFactsSchema = z.object({
  page_intent: z.preprocess(coercePageIntent, z.string().min(1)),
  page_type_guess: z.preprocess(
    coercePageTypeGuess,
    z.enum(PAGE_TYPE_VALUES).nullable()
  ),
  relevance_score: z.preprocess(coerceRelevanceScore, z.number().min(0).max(1)),
  audience_signals: z.array(z.string()).max(12).default([]),
  value_props: z.array(z.string()).max(12).default([]),
  features: z.array(z.string()).max(20).default([]),
  pricing_mentions: z.array(z.string()).max(12).default([]),
  social_proof: z.array(z.string()).max(12).default([]),
  ctas: z.array(z.string()).max(8).default([]),
  objections: z.array(z.string()).max(8).default([]),
  distinctive_language: z.array(z.string()).max(12).default([]),
});

export type PageFacts = z.infer<typeof PageFactsSchema>;

const SYSTEM = `You are AutoScale Product Crawl. You read one page of a product's marketing website and extract structured facts.

Rules:
- Only extract what you can support with the page text. Do not invent.
- audience_signals = who is the page speaking to.
- value_props = what the page promises.
- features = specific capabilities (verbs / nouns).
- pricing_mentions = literal dollar amounts, plan names, billing language.
- social_proof = testimonials, logos, stats with citations.
- ctas = exact CTA copy.
- objections = doubts the page tries to address.
- distinctive_language = jargon, brand-specific phrases.
- relevance_score = how relevant this page is to understanding what the product does (1.0 = homepage / features / pricing; 0.2 = legal page).
- Keep each list item short (≤ 18 words).`;

const MAX_BODY_CHARS = 9000;

export interface LLMExtractInput {
  page: CrawledPageContent;
  url: string;
  existingFacts?: Pick<PageFacts, "features" | "value_props"> | null;
  projectId?: string;
  ownerId?: string;
}

export async function llmExtractPageFacts(
  input: LLMExtractInput
): Promise<{
  facts: PageFacts;
  provider: string;
  model: string;
  latencyMs: number;
  raw: string;
}> {
  const body = (input.page.markdown || input.page.bodyText || "").slice(0, MAX_BODY_CHARS);

  const existingBlock = input.existingFacts
    ? `Existing extracted facts you can corroborate (do not duplicate verbatim):
${JSON.stringify(input.existingFacts).slice(0, 1000)}`
    : "";

  const prompt = `[[product_crawl_page]]
URL: ${input.url}
Title: ${input.page.title ?? "(none)"}
Description: ${input.page.description ?? "(none)"}
Headings: ${input.page.headings.slice(0, 20).join(" | ") || "(none)"}
On-page CTAs: ${input.page.ctas.slice(0, 8).join(" | ") || "(none)"}

Body text:
${body || "(none)"}

${existingBlock}

Return structured PageFacts.`;

  const result = await generateObject({
    system: SYSTEM,
    prompt,
    schema: PageFactsSchema,
    schemaName: "PageFacts",
    taskType: "autobrief",
    temperature: 0.2,
    maxTokens: 1800,
  });

  if (input.ownerId) {
    await logAIRun({
      ownerId: input.ownerId,
      projectId: input.projectId ?? null,
      kind: "product_crawl_extract",
      provider: result.provider,
      model: result.model,
      input: { url: input.url, title: input.page.title },
      rawOutput: result.raw,
      parsedOutput: result.object,
      status: "success",
      latencyMs: result.latencyMs,
    });
  }

  return {
    facts: result.object,
    provider: result.provider,
    model: result.model,
    latencyMs: result.latencyMs,
    raw: result.raw,
  };
}

/**
 * Best-effort LLM page-type classifier. Returns null when the LLM call fails;
 * callers should fall back to the deterministic rule-based classifier.
 */
export async function llmClassifyPage(
  page: CrawledPageContent,
  opts?: { projectId?: string; ownerId?: string }
): Promise<{ pageType: ProductPageType; relevance: number } | null> {
  try {
    const facts = await llmExtractPageFacts({
      page,
      url: page.finalUrl || page.url,
      projectId: opts?.projectId,
      ownerId: opts?.ownerId,
    });
    const guess = (facts.facts.page_type_guess ?? "other") as ProductPageType;
    return { pageType: guess, relevance: facts.facts.relevance_score };
  } catch (err) {
    console.warn("[product-crawl] llmClassifyPage failed", err);
    return null;
  }
}
