import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDefaultProviderMode, getUserSettings } from "@/lib/provider-mode";
import { runUrlToBriefPipeline } from "@/services/autobrief/run-url-to-brief-pipeline";
import { createProjectFromAutoBrief } from "@/services/autobrief/create-project";
import { LOW_CONFIDENCE_THRESHOLD } from "@/services/autobrief/schema";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

export interface RunAutobriefPhaseInput {
  projectId: string;
  ownerId: string;
  productUrl: string;
  crawlId?: string | null;
  profile?: "signup" | "project";
  client?: Client;
}

export async function runAutobriefPhase(input: RunAutobriefPhaseInput) {
  const pipeline = await runUrlToBriefPipeline({
    userId: input.ownerId,
    productUrl: input.productUrl,
    profile: input.profile ?? "project",
    projectId: input.projectId,
    existingCrawlId: input.crawlId ?? undefined,
  });

  if (!pipeline.ok) {
    // #region agent log
    fetch("http://127.0.0.1:7755/ingest/e9fc8964-ae23-4fa9-a7cb-b5541b636a4d", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "845232" },
      body: JSON.stringify({
        sessionId: "845232",
        hypothesisId: "H4",
        location: "run-autobrief-phase.ts",
        message: "autobrief pipeline failed",
        data: { projectId: input.projectId, errorPreview: pipeline.error.slice(0, 500) },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    throw new Error(pipeline.error);
  }

  const settings = await getUserSettings(input.ownerId);
  const providerMode = settings?.provider_mode ?? getDefaultProviderMode();

  await createProjectFromAutoBrief({
    userId: input.ownerId,
    projectId: input.projectId,
    brief: pipeline.brief,
    providerMode,
    touchUserSettings: input.profile === "signup",
  });

  const lowConfidence =
    pipeline.lowConfidence || pipeline.brief.confidence_score < LOW_CONFIDENCE_THRESHOLD;

  return {
    lowConfidence,
    fetchFailed: pipeline.fetchFailed,
    productName: pipeline.brief.product_name,
  };
}
