import "server-only";

import type { Json } from "@/lib/supabase/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AutoBriefProgressEvent,
  AutoBriefProgressPhase,
  AutoBriefProgressState,
} from "@/lib/autobrief/progress-types";

export type {
  AutoBriefProgressEvent,
  AutoBriefProgressEventKind,
  AutoBriefProgressPhase,
  AutoBriefProgressState,
} from "@/lib/autobrief/progress-types";

const EMPTY: AutoBriefProgressState = {
  phase: "starting",
  currentMessage: "Starting…",
  events: [],
  pagesDiscovered: 0,
  pagesCrawled: 0,
  factsFound: 0,
};

export function pathnameLabel(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    if (!pathname || pathname === "/") return "homepage";
    return pathname;
  } catch {
    return url;
  }
}

export function pageFetchMessage(url: string, adapter: string, status: "running" | "success" | "failed"): string {
  const path = pathnameLabel(url);
  const via = adapter === "crawl4ai" ? "direct fetch" : adapter;
  if (status === "running") {
    return path === "homepage" ? "Reading homepage…" : `Reading ${path}…`;
  }
  if (status === "failed") {
    return path === "homepage" ? `Could not read homepage (${via})` : `Could not read ${path} (${via})`;
  }
  return path === "homepage" ? `Fetched homepage via ${via}` : `Fetched ${path} via ${via}`;
}

export function pageExtractMessage(pageType: string, factCount: number, url: string): string {
  const path = pathnameLabel(url);
  if (pageType === "pricing") {
    if (factCount === 0) return "Checking pricing… no clear tiers found yet";
    return `Checking pricing… found ${factCount} pricing signal${factCount === 1 ? "" : "s"}`;
  }
  if (pageType === "features" || pageType === "product") {
    if (factCount === 0) return path === "homepage" ? "Scanning product features…" : `Reading ${path}…`;
    return path === "homepage"
      ? `Found ${factCount} feature${factCount === 1 ? "" : "s"} on homepage`
      : `Reading ${path}… found ${factCount} feature${factCount === 1 ? "" : "s"}`;
  }
  const label = pageType === "home" ? "homepage" : pageType.replace(/_/g, " ");
  if (factCount === 0) return `Scanned ${path} (${label}) — no strong signals yet`;
  const noun = factCount === 1 ? "signal" : "signals";
  return `Extracted ${factCount} ${noun} from ${label}${path !== "homepage" ? ` (${path})` : ""}`;
}

function parseProgress(metadata: Json | null | undefined): AutoBriefProgressState {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return { ...EMPTY };
  const progress = (metadata as Record<string, unknown>).progress;
  if (!progress || typeof progress !== "object" || Array.isArray(progress)) return { ...EMPTY };
  const p = progress as Partial<AutoBriefProgressState>;
  return {
    phase: p.phase ?? EMPTY.phase,
    currentMessage: p.currentMessage ?? EMPTY.currentMessage,
    events: Array.isArray(p.events) ? (p.events as AutoBriefProgressEvent[]) : [],
    pagesDiscovered: p.pagesDiscovered ?? 0,
    pagesCrawled: p.pagesCrawled ?? 0,
    factsFound: p.factsFound ?? 0,
  };
}

export async function readAutobriefProgress(crawlId: string): Promise<AutoBriefProgressState | null> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("product_site_crawls")
    .select("metadata")
    .eq("id", crawlId)
    .maybeSingle();
  if (!data) return null;
  return parseProgress(data.metadata);
}

export async function updateAutobriefProgress(
  crawlId: string,
  input: {
    phase?: AutoBriefProgressPhase;
    currentMessage?: string;
    pagesDiscovered?: number;
    pagesCrawled?: number;
    factsFound?: number;
    event?: Omit<AutoBriefProgressEvent, "id" | "at">;
  }
): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { data: row } = await supabase
    .from("product_site_crawls")
    .select("metadata")
    .eq("id", crawlId)
    .maybeSingle();
  if (!row) return;

  const current = parseProgress(row.metadata);
  const events = [...current.events];
  if (input.event) {
    events.push({
      ...input.event,
      id: `${Date.now()}-${events.length}`,
      at: new Date().toISOString(),
    });
  }

  const next: AutoBriefProgressState = {
    phase: input.phase ?? current.phase,
    currentMessage: input.currentMessage ?? input.event?.message ?? current.currentMessage,
    events: events.slice(-40),
    pagesDiscovered: input.pagesDiscovered ?? current.pagesDiscovered,
    pagesCrawled: input.pagesCrawled ?? current.pagesCrawled,
    factsFound: input.factsFound ?? current.factsFound,
  };

  const metadata = {
    ...(typeof row.metadata === "object" && row.metadata && !Array.isArray(row.metadata) ? row.metadata : {}),
    progress: next,
  } as unknown as Json;

  await supabase.from("product_site_crawls").update({ metadata }).eq("id", crawlId);
}
