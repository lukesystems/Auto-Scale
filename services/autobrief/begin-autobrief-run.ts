import "server-only";

import { createBriefGeneratingProject } from "./create-project";
import { parseProductUrl } from "./run-url-to-brief-pipeline";
import { saveProductCrawl } from "@/services/intelligence/memory/save-product-crawl";
import { updateAutobriefProgress } from "./crawl-progress";

export interface BeginAutobriefRunInput {
  userId: string;
  productUrl: string;
}

export type BeginAutobriefRunResult =
  | { ok: true; projectId: string; crawlId: string; normalizedUrl: string }
  | { ok: false; error: string };

export async function beginAutobriefRun(input: BeginAutobriefRunInput): Promise<BeginAutobriefRunResult> {
  const parsed = parseProductUrl(input.productUrl);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  try {
    const project = await createBriefGeneratingProject({
      userId: input.userId,
      productUrl: parsed.url,
    });

    const crawlId = await saveProductCrawl({
      projectId: project.projectId,
      sourceUrl: parsed.url,
      status: "running",
      primaryAdapter: "crawl4ai",
      metadata: { progress: { phase: "starting", currentMessage: "Starting…", events: [] } },
    });

    await updateAutobriefProgress(crawlId, {
      phase: "starting",
      currentMessage: "Preparing to read your website…",
      event: { kind: "phase", message: "Preparing to read your website…", status: "running" },
    });

    return { ok: true, projectId: project.projectId, crawlId, normalizedUrl: parsed.url };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to start AutoBrief run." };
  }
}
