import { generateObject } from "@/services/ai/runtime";
import { ProductBriefSchema, type ProductBrief } from "./schema";

export interface ProductBriefInput {
  productName: string;
  productUrl?: string;
  description?: string;
  targetAudience?: string;
  competitors?: string[];
  offer?: string;
  cta?: string;
  brandTone?: string;
  preferredPlatforms?: string[];
  productionPreference?:
    | "faceless"
    | "founder-led"
    | "ugc"
    | "demo-based"
    | "educational"
    | "meme-based"
    | "comparison-based"
    | "product-screenshot-based"
    | string;
}

const SYSTEM = `You are AutoScale's Product Brief Engine. You turn a few founder inputs into a sharp, structured growth brief.

Rules:
- Be specific. Avoid generic marketing language.
- Anchor every line to the founder's actual product and audience.
- Use plain English. No fluff.
- Always return JSON matching the requested schema.`;

export async function generateProductBrief(input: ProductBriefInput): Promise<{
  brief: ProductBrief;
  raw: string;
  provider: string;
  model: string;
  latencyMs: number;
}> {
  const prompt = `[[product_brief]]
Generate a structured growth brief.

Product name: ${input.productName}
Product URL: ${input.productUrl ?? "(not provided)"}
Description: ${input.description ?? "(not provided)"}
Target audience: ${input.targetAudience ?? "(not provided)"}
Competitors: ${(input.competitors ?? []).join(", ") || "(not provided)"}
Offer: ${input.offer ?? "(not provided)"}
Preferred CTA: ${input.cta ?? "(not provided)"}
Brand tone: ${input.brandTone ?? "(not provided)"}
Preferred platforms: ${(input.preferredPlatforms ?? []).join(", ") || "(not provided)"}
Production preference: ${input.productionPreference ?? "(not provided)"}

Schema fields:
- product_summary: 1-sentence summary
- target_customer: specific ICP
- primary_pain: the most acute pain you solve
- core_promise: transformation in one line
- offer: what they get for the price
- cta: short, actionable
- competitors: array of competitor names
- content_pillars: 3-6 specific content themes
- positioning_angles: 3-5 angles, each a single line
- production_constraints: object with can_make_carousels, can_make_founder_videos, can_use_product_screenshots, can_use_ai_images (booleans), and preferred_platforms (array)
- brand_voice: one paragraph describing voice`;

  const result = await generateObject({
    system: SYSTEM,
    prompt,
    schema: ProductBriefSchema,
    schemaName: "ProductBrief",
    temperature: 0.5,
  });

  return {
    brief: result.object,
    raw: result.raw,
    provider: result.provider,
    model: result.model,
    latencyMs: result.latencyMs,
  };
}
