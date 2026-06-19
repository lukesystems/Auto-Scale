import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type ProductBriefRow = Database["public"]["Tables"]["product_briefs"]["Row"];
export type ProductSiteFactRow = Database["public"]["Tables"]["product_site_facts"]["Row"];

export interface DiscoveryContext {
  projectId: string;
  brief: ProductBriefRow;
  facts: ProductSiteFactRow[];
  latestCrawlId: string | null;
}

export async function loadDiscoveryContext(projectId: string): Promise<DiscoveryContext | null> {
  const supabase = createSupabaseServerClient();

  const { data: brief } = await supabase
    .from("product_briefs")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  if (!brief) return null;

  const { data: latestCrawl } = await supabase
    .from("product_site_crawls")
    .select("id")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const factsQuery = supabase
    .from("product_site_facts")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (latestCrawl?.id) {
    factsQuery.eq("crawl_id", latestCrawl.id);
  }

  const { data: facts } = await factsQuery;

  return {
    projectId,
    brief,
    facts: facts ?? [],
    latestCrawlId: latestCrawl?.id ?? null,
  };
}

export function formatDiscoveryContextForPrompt(context: DiscoveryContext): string {
  const brief = context.brief;
  const factLines = context.facts
    .slice(0, 40)
    .map((fact) => `- [${fact.fact_type}] ${fact.fact_value}${fact.evidence_snippet ? ` (evidence: ${fact.evidence_snippet.slice(0, 120)})` : ""}`)
    .join("\n");

  return `Product name: ${brief.product_name ?? "(unknown)"}
Category: ${brief.category ?? brief.market_category ?? "(unknown)"}
One-line: ${brief.one_line_description ?? brief.product_summary ?? "(unknown)"}
Target customer: ${brief.target_customer ?? "(unknown)"}
Primary pain: ${brief.primary_pain ?? "(unknown)"}
Core promise: ${brief.core_promise ?? "(unknown)"}
Niche: ${brief.market_category ?? brief.category ?? "(unknown)"}
Likely competitors: ${JSON.stringify(brief.likely_competitors ?? [])}
Alternative solutions: ${JSON.stringify(brief.alternative_solutions ?? [])}
Content angles: ${JSON.stringify(brief.content_angles ?? [])}

Product site facts (observed evidence):
${factLines || "(no stored facts yet)"}`;
}
