import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchSiteForAutoBrief, normalizeProductUrl, type SiteFetchOutput } from "./fetch-site";
import { generateAutoBrief } from "./generate";
import { mapAutoBriefError, isAIError } from "./map-error";
import { AutoBriefSchema, LOW_CONFIDENCE_THRESHOLD, type AutoBrief } from "./schema";
import { logAIRun } from "@/services/ai/logger";
import { updateAutobriefProgress } from "./crawl-progress";

export type UrlToBriefProfile = "signup" | "project" | "refresh" | "preview";

const PROFILE_MAX_PAGES: Record<UrlToBriefProfile, number> = {
  signup: 8,
  project: 8,
  refresh: 8,
  preview: 5,
};

const PROFILE_SOFT_FAIL: Record<UrlToBriefProfile, boolean> = {
  signup: true,
  project: true,
  refresh: true,
  preview: false,
};

export interface RunUrlToBriefPipelineInput {
  userId: string;
  productUrl: string;
  profile: UrlToBriefProfile;
  /** When set, crawl evidence is persisted and tied to this project. */
  projectId?: string;
  /** Reuse a crawl row created by beginAutobriefRun for live progress polling. */
  existingCrawlId?: string;
}

export type RunUrlToBriefPipelineResult =
  | {
      ok: true;
      normalizedUrl: string;
      brief: AutoBrief;
      siteFetch: SiteFetchOutput;
      fetchFailed: boolean;
      fetchWarning?: string;
      lowConfidence: boolean;
    }
  | { ok: false; error: string; projectId?: string };

export function parseProductUrl(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (trimmed.length < 3) {
    return { ok: false, error: "Enter a website URL." };
  }

  try {
    return { ok: true, url: normalizeProductUrl(trimmed) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Invalid URL." };
  }
}

export function buildFetchWarning(fetchError: string | null | undefined): string {
  if (fetchError) {
    return `We could not fully read this website (${fetchError}). A draft brief was generated from your URL — review and edit it.`;
  }
  return "We could not fully read this website. A draft brief was generated from your URL — review and edit it.";
}

function failedSiteFetch(normalizedUrl: string, error: string): SiteFetchOutput {
  return {
    ok: false,
    url: normalizedUrl,
    finalUrl: null,
    title: null,
    description: null,
    textSnippet: null,
    pages: [],
    error,
  };
}

export async function runUrlToBriefPipeline(
  input: RunUrlToBriefPipelineInput
): Promise<RunUrlToBriefPipelineResult> {
  const parsed = parseProductUrl(input.productUrl);
  if (!parsed.ok) return { ok: false, error: parsed.error, projectId: input.projectId };

  const normalizedUrl = parsed.url;
  const maxPages = PROFILE_MAX_PAGES[input.profile];
  const softFail = PROFILE_SOFT_FAIL[input.profile];

  let siteFetch: SiteFetchOutput;
  let fetchFailed = false;

  try {
    siteFetch = await fetchSiteForAutoBrief({
      url: normalizedUrl,
      projectId: input.projectId,
      maxPages,
      existingCrawlId: input.existingCrawlId,
    });
    if (!siteFetch.ok) fetchFailed = true;
  } catch (err) {
    fetchFailed = true;
    siteFetch = failedSiteFetch(
      normalizedUrl,
      err instanceof Error ? err.message : "Website fetch failed."
    );
  }

  if (fetchFailed && !softFail) {
    const error = siteFetch.error
      ? `We could not read this website: ${siteFetch.error}`
      : "We could not read this website. Check the URL and try again.";

    if (input.projectId) {
      const supabase = createSupabaseServerClient();
      await supabase
        .from("projects")
        .update({ status: "brief_failed", description: error })
        .eq("id", input.projectId);
    }

    return { ok: false, error, projectId: input.projectId };
  }

  const fetchWarning = fetchFailed ? buildFetchWarning(siteFetch.error) : undefined;

  if (input.existingCrawlId) {
    await updateAutobriefProgress(input.existingCrawlId, {
      phase: "brief",
      currentMessage: "Building your product brief…",
      event: {
        kind: "phase",
        message: "Building your product brief…",
        status: "running",
      },
    });
  }

  try {
    const generated = await generateAutoBrief({
      productUrl: normalizedUrl,
      siteFetch,
    });

    const briefParsed = AutoBriefSchema.safeParse(generated.brief);
    if (!briefParsed.success) {
      throw new Error("AutoBrief output failed validation.");
    }

    await logAIRun({
      ownerId: input.userId,
      projectId: input.projectId ?? null,
      kind: "autobrief",
      provider: generated.provider,
      model: generated.model,
      input: {
        productUrl: normalizedUrl,
        profile: input.profile,
        fetchFailed,
        pagesRead: siteFetch.pages.length,
        crawlId: siteFetch.crawlId ?? null,
        factsCount: siteFetch.factsCount ?? 0,
      },
      rawOutput: generated.raw,
      parsedOutput: briefParsed.data as never,
      status: "success",
      latencyMs: generated.latencyMs,
    });

    const lowConfidence =
      briefParsed.data.confidence_score < LOW_CONFIDENCE_THRESHOLD || fetchFailed;

    if (input.existingCrawlId) {
      await updateAutobriefProgress(input.existingCrawlId, {
        phase: "done",
        currentMessage: "Product brief ready for review",
        event: {
          kind: "phase",
          message: "Product brief ready for review",
          status: "success",
        },
      });
    }

    return {
      ok: true,
      normalizedUrl,
      brief: briefParsed.data,
      siteFetch,
      fetchFailed,
      fetchWarning,
      lowConfidence,
    };
  } catch (err) {
    const errorMessage = mapAutoBriefError(err, fetchFailed);

    await logAIRun({
      ownerId: input.userId,
      projectId: input.projectId ?? null,
      kind: "autobrief",
      provider: isAIError(err) ? err.provider : "unknown",
      model: "unknown",
      input: {
        productUrl: normalizedUrl,
        profile: input.profile,
        fetchFailed,
        pagesRead: siteFetch.pages.length,
        crawlId: siteFetch.crawlId ?? null,
        factsCount: siteFetch.factsCount ?? 0,
      },
      status: "failed",
      errorMessage,
    });

    if (input.projectId) {
      const supabase = createSupabaseServerClient();
      await supabase
        .from("projects")
        .update({ status: "brief_failed", description: errorMessage })
        .eq("id", input.projectId);
    }

    if (input.existingCrawlId) {
      await updateAutobriefProgress(input.existingCrawlId, {
        phase: "failed",
        currentMessage: errorMessage,
        event: {
          kind: "error",
          message: errorMessage,
          status: "failed",
        },
      });
    }

    return { ok: false, error: errorMessage, projectId: input.projectId };
  }
}
