import { generateObject } from "@/services/ai/runtime";
import type { DiscoveryContext } from "./load-context";
import { formatDiscoveryContextForPrompt } from "./load-context";
import { DiscoveryPlanSchema, type DiscoveryPlan } from "./schema";

const SYSTEM = `You are AutoScale Source Discovery Planner.

Given a product brief and observed product site facts, generate a focused web search query plan to find public competitor and market evidence.

Rules:
- Generate 8-12 diverse search queries.
- Mix: direct competitors, indirect competitors, platform-specific (site:x.com, site:reddit.com, site:youtube.com, site:linkedin.com, site:tiktok.com), pain/problem, alternatives, comparisons/reviews, communities, creators.
- Use the product category, ICP, and pain points — not generic marketing fluff.
- Do NOT invent competitor names unless they appear in the brief or facts.
- Every query must have a clear intent and reason tied to evidence.
- Return JSON matching the schema.`;

export async function planDiscovery(context: DiscoveryContext): Promise<{
  plan: DiscoveryPlan;
  raw: string;
  provider: string;
  model: string;
  latencyMs: number;
  usedFallback: boolean;
}> {
  try {
    const result = await generateObject({
      system: SYSTEM,
      prompt: `[[source_discovery]]
Generate a discovery query plan for this product.

${formatDiscoveryContextForPrompt(context)}

Output queries with intent, optional platform_hint, and reason.`,
      schema: DiscoveryPlanSchema,
      schemaName: "DiscoveryPlan",
      taskType: "trendwatch",
      temperature: 0.4,
      maxTokens: 3000,
    });

    return {
      plan: result.object,
      raw: result.raw,
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
      usedFallback: false,
    };
  } catch {
    const plan = buildFallbackDiscoveryPlan(context);
    return {
      plan,
      raw: JSON.stringify(plan),
      provider: "deterministic",
      model: "fallback",
      latencyMs: 0,
      usedFallback: true,
    };
  }
}

export function buildFallbackDiscoveryPlan(context: DiscoveryContext): DiscoveryPlan {
  const category = context.brief.category || context.brief.market_category || "SaaS tool";
  const pain = context.brief.primary_pain || "workflow pain";
  const icp = context.brief.target_customer || "founders";
  const competitorNames = extractCompetitorNames(context);

  const queries: DiscoveryPlan["queries"] = [
    {
      query: `best alternatives to ${category}`,
      intent: "alternative",
      reason: "Find comparison and alternative pages for the product category.",
    },
    {
      query: `${category} vs comparison 2025`,
      intent: "comparison",
      reason: "Find recent comparison pages revealing category winners.",
    },
    {
      query: `site:reddit.com "${pain}" tool recommendation`,
      intent: "community",
      platform_hint: "reddit",
      reason: "Find Reddit threads where the ICP asks for tool recommendations.",
    },
    {
      query: `site:g2.com OR site:capterra.com ${category}`,
      intent: "comparison",
      reason: "Review sites with competitor positioning and user pain language.",
    },
    {
      query: `site:tiktok.com ${category} ${icp}`,
      intent: "distribution",
      platform_hint: "tiktok",
      reason: "Public TikTok content discussing the category.",
    },
    {
      query: `${icp} ${pain}`,
      intent: "pain",
      reason: "Surface problem discussions from the target audience.",
    },
    {
      query: `site:reddit.com ${category} ${pain}`,
      intent: "community",
      platform_hint: "reddit",
      reason: "Find community threads where the ICP discusses this pain.",
    },
    {
      query: `${category} tools for ${icp}`,
      intent: "competitor",
      reason: "Discover direct competitors in the category.",
    },
    {
      query: `${category} pricing comparison`,
      intent: "comparison",
      reason: "Find pricing and comparison pages.",
    },
    {
      query: `site:x.com ${category} ${icp}`,
      intent: "creator",
      platform_hint: "x",
      reason: "Find creator/founder posts in the niche.",
    },
  ];

  for (const competitor of competitorNames.slice(0, 3)) {
    queries.push(
      {
        query: `"${competitor}" unofficial TikTok account OR shadow account`,
        intent: "shadow_account",
        platform_hint: "tiktok",
        reason: `Hunt unofficial/shadow accounts covering ${competitor}.`,
      },
      {
        query: `"${competitor}" shadow account Instagram`,
        intent: "shadow_account",
        platform_hint: "instagram",
        reason: `Find alt Instagram accounts for ${competitor}.`,
      },
      {
        query: `"${competitor}" affiliate creator OR partner account`,
        intent: "distribution",
        reason: `Partner/creator accounts that distribute ${competitor}.`,
      }
    );
  }

  return {
    queries: queries.slice(0, 15),
    notes: ["Deterministic fallback plan — AI planner unavailable."],
  };
}

function extractCompetitorNames(context: DiscoveryContext): string[] {
  const names = new Set<string>();
  const brief = context.brief;

  if (Array.isArray(brief.likely_competitors)) {
    for (const item of brief.likely_competitors) {
      if (typeof item === "string") names.add(item);
      else if (item && typeof item === "object" && typeof (item as { name?: string }).name === "string") {
        names.add((item as { name: string }).name);
      }
    }
  }
  if (Array.isArray(brief.competitors)) {
    for (const item of brief.competitors) {
      if (typeof item === "string") names.add(item);
    }
  }

  return [...names].filter(Boolean);
}
