import type { Json } from "@/lib/supabase/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CrawlAdapterName, CrawlRunStatus } from "../types";

export interface SaveProductCrawlInput {
  crawlId?: string;
  projectId: string;
  sourceUrl: string;
  status: CrawlRunStatus;
  primaryAdapter?: string;
  fallbackAdapters?: CrawlAdapterName[];
  pagesDiscovered?: number;
  pagesCrawled?: number;
  pagesFailed?: number;
  error?: string | null;
  metadata?: Json;
  completed?: boolean;
}

export async function saveProductCrawl(input: SaveProductCrawlInput): Promise<string> {
  const supabase = createSupabaseServerClient();

  if (input.crawlId) {
    let mergedMetadata: Json | undefined;
    if (input.metadata !== undefined) {
      const { data: existing } = await supabase
        .from("product_site_crawls")
        .select("metadata")
        .eq("id", input.crawlId)
        .maybeSingle();
      const prev =
        existing?.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
          ? (existing.metadata as Record<string, unknown>)
          : {};
      mergedMetadata = { ...prev, ...(input.metadata as Record<string, unknown>) } as Json;
    }

    const { error } = await supabase
      .from("product_site_crawls")
      .update({
        status: input.status,
        primary_adapter: input.primaryAdapter ?? "crawl4ai",
        fallback_adapters: input.fallbackAdapters ?? [],
        pages_discovered: input.pagesDiscovered ?? 0,
        pages_crawled: input.pagesCrawled ?? 0,
        pages_failed: input.pagesFailed ?? 0,
        error: input.error ?? null,
        ...(mergedMetadata !== undefined ? { metadata: mergedMetadata } : {}),
        completed_at: input.completed ? new Date().toISOString() : null,
      })
      .eq("id", input.crawlId);

    if (error) throw new Error(error.message);
    return input.crawlId;
  }

  const { data, error } = await supabase
    .from("product_site_crawls")
    .insert({
      project_id: input.projectId,
      source_url: input.sourceUrl,
      status: input.status,
      primary_adapter: input.primaryAdapter ?? "crawl4ai",
      fallback_adapters: input.fallbackAdapters ?? [],
      pages_discovered: input.pagesDiscovered ?? 0,
      pages_crawled: input.pagesCrawled ?? 0,
      pages_failed: input.pagesFailed ?? 0,
      error: input.error ?? null,
      metadata: (input.metadata ?? {}) as Json,
      completed_at: input.completed ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to save product crawl.");
  return data.id;
}
