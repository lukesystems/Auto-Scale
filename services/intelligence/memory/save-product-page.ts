import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CrawledPageContent, ProductPageType } from "../types";

export interface SaveProductPageInput {
  crawlId: string;
  projectId: string;
  page: CrawledPageContent;
  pageType: ProductPageType;
}

export async function saveProductPage(input: SaveProductPageInput): Promise<string> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("product_site_pages")
    .insert({
      crawl_id: input.crawlId,
      project_id: input.projectId,
      url: input.page.url,
      final_url: input.page.finalUrl,
      page_type: input.pageType,
      title: input.page.title,
      description: input.page.description,
      markdown: input.page.markdown || null,
      body_text: input.page.bodyText || null,
      headings: input.page.headings,
      ctas: input.page.ctas,
      adapter_used: input.page.adapterUsed,
      fetch_status: input.page.fetchStatus,
      error: input.page.error,
      metadata: {},
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to save product page.");
  return data.id;
}
