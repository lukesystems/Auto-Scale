import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProductSiteFact } from "../types";

export interface SaveProductFactsInput {
  crawlId: string;
  projectId: string;
  facts: Array<ProductSiteFact & { pageId?: string }>;
}

export async function saveProductFacts(input: SaveProductFactsInput): Promise<void> {
  if (!input.facts.length) return;

  const supabase = createSupabaseServerClient();

  const { error } = await supabase.from("product_site_facts").insert(
    input.facts.map((fact) => ({
      crawl_id: input.crawlId,
      page_id: fact.pageId ?? null,
      project_id: input.projectId,
      fact_type: fact.factType,
      fact_key: fact.factKey,
      fact_value: fact.factValue,
      confidence: fact.confidence,
      evidence_snippet: fact.evidenceSnippet,
      source_url: fact.sourceUrl,
      metadata: {},
    }))
  );

  if (error) throw new Error(error.message);
}
