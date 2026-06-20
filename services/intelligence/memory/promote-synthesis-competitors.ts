import "server-only";

import type { Json } from "@/lib/supabase/types";
import type { AccountType, SourcePlatform } from "@/lib/supabase/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { detectPlatform } from "@/services/trendwatch/ingestion";
import { extractAccountHandle } from "../discovery/dedupe-candidates";
import type { CompetitorStrategyProfile, MarketSynthesis } from "../deep-discovery/schema";

export interface PromoteSynthesisCompetitorsInput {
  projectId: string;
  discoveryRunId: string;
  synthesis: MarketSynthesis;
}

export interface PromoteSynthesisCompetitorsResult {
  competitorsUpserted: number;
  accountsUpserted: number;
  competitorIds: string[];
}

export async function promoteSynthesisCompetitors(
  input: PromoteSynthesisCompetitorsInput
): Promise<PromoteSynthesisCompetitorsResult> {
  const profiles = input.synthesis.competitors ?? [];
  if (!profiles.length) {
    return { competitorsUpserted: 0, accountsUpserted: 0, competitorIds: [] };
  }

  const supabase = createSupabaseServerClient();
  const competitorIds: string[] = [];
  let accountsUpserted = 0;

  for (const profile of profiles) {
    const name = profile.name.trim();
    if (!name) continue;

    const competitorId = await upsertCompetitor({
      supabase,
      projectId: input.projectId,
      discoveryRunId: input.discoveryRunId,
      profile,
    });
    if (!competitorId) continue;

    competitorIds.push(competitorId);
    accountsUpserted += await upsertAccountsForProfile({
      supabase,
      projectId: input.projectId,
      discoveryRunId: input.discoveryRunId,
      competitorId,
      profile,
    });
  }

  return {
    competitorsUpserted: competitorIds.length,
    accountsUpserted,
    competitorIds,
  };
}

interface UpsertCompetitorInput {
  supabase: ReturnType<typeof createSupabaseServerClient>;
  projectId: string;
  discoveryRunId: string;
  profile: CompetitorStrategyProfile;
}

async function upsertCompetitor(input: UpsertCompetitorInput): Promise<string | null> {
  const { supabase, projectId, discoveryRunId, profile } = input;
  const normalizedName = profile.name.trim().toLowerCase();

  const { data: existing } = await supabase
    .from("competitors")
    .select("id, notes, url, source")
    .eq("project_id", projectId)
    .ilike("name", profile.name.trim())
    .maybeSingle();

  const payload = {
    project_id: projectId,
    name: profile.name.trim(),
    url: pickCompetitorUrl(profile),
    notes: buildCompetitorNotes(profile, existing?.notes),
    discovery_run_id: discoveryRunId,
    kind: profile.kind,
    confidence: profile.confidence,
    strategy_profile: {
      what_they_do: profile.what_they_do,
      working_patterns: profile.working_patterns,
      hooks: profile.hooks,
      formats: profile.formats,
      caveats: profile.caveats,
    } as Json,
    evidence_urls: profile.evidence_urls as Json,
    discovered_at: new Date().toISOString(),
    source: (existing?.source === "manual" ? "manual" : "deep_discovery") as "manual" | "deep_discovery",
  };

  if (existing?.id) {
    const { error } = await supabase
      .from("competitors")
      .update({
        url: payload.url ?? undefined,
        notes: payload.notes,
        discovery_run_id: discoveryRunId,
        kind: profile.kind,
        confidence: profile.confidence,
        strategy_profile: payload.strategy_profile,
        evidence_urls: payload.evidence_urls,
        discovered_at: payload.discovered_at,
      })
      .eq("id", existing.id);

    if (error) {
      console.warn("[competitors] update failed", normalizedName, error.message);
      return null;
    }
    return existing.id;
  }

  const { data, error } = await supabase
    .from("competitors")
    .insert(payload)
    .select("id")
    .single();

  if (error || !data) {
    console.warn("[competitors] insert failed", normalizedName, error?.message);
    return null;
  }

  return data.id;
}

interface UpsertAccountsInput {
  supabase: ReturnType<typeof createSupabaseServerClient>;
  projectId: string;
  discoveryRunId: string;
  competitorId: string;
  profile: CompetitorStrategyProfile;
}

async function upsertAccountsForProfile(input: UpsertAccountsInput): Promise<number> {
  const accounts = buildAccountRows(input.profile, input.projectId, input.discoveryRunId, input.competitorId);
  if (!accounts.length) return 0;

  let upserted = 0;
  for (const account of accounts) {
    const { data: existing } = await input.supabase
      .from("competitor_accounts")
      .select("id")
      .eq("project_id", input.projectId)
      .eq("platform", account.platform)
      .ilike("handle", account.handle)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await input.supabase
        .from("competitor_accounts")
        .update({
          competitor_id: input.competitorId,
          url: account.url,
          account_type: account.account_type,
          discovery_run_id: input.discoveryRunId,
        })
        .eq("id", existing.id);
      if (!error) upserted += 1;
      continue;
    }

    const { error } = await input.supabase.from("competitor_accounts").insert(account);
    if (!error) upserted += 1;
  }

  return upserted;
}

function buildAccountRows(
  profile: CompetitorStrategyProfile,
  projectId: string,
  discoveryRunId: string,
  competitorId: string
) {
  const accountType = inferAccountType(profile.kind);
  const rows = new Map<string, {
    competitor_id: string;
    project_id: string;
    platform: SourcePlatform;
    handle: string;
    url: string | null;
    account_type: AccountType;
    discovery_run_id: string;
  }>();

  for (const url of profile.evidence_urls) {
    const platform = normalizePlatform(detectPlatform(url));
    const handle = extractAccountHandle(url, platform);
    if (!handle) continue;
    const key = `${platform}:${handle.toLowerCase()}`;
    if (!rows.has(key)) {
      rows.set(key, {
        competitor_id: competitorId,
        project_id: projectId,
        platform,
        handle,
        url,
        account_type: accountType,
        discovery_run_id: discoveryRunId,
      });
    }
  }

  for (let i = 0; i < profile.handles.length; i++) {
    const handle = profile.handles[i]?.replace(/^@/, "").trim();
    if (!handle) continue;
    const platform = normalizePlatform(profile.platforms[i] ?? "other");
    const key = `${platform}:${handle.toLowerCase()}`;
    if (rows.has(key)) continue;
    rows.set(key, {
      competitor_id: competitorId,
      project_id: projectId,
      platform,
      handle,
      url: null,
      account_type: accountType,
      discovery_run_id: discoveryRunId,
    });
  }

  return [...rows.values()];
}

function pickCompetitorUrl(profile: CompetitorStrategyProfile): string | null {
  for (const url of profile.evidence_urls) {
    const platform = detectPlatform(url);
    if (platform === "other") return url;
  }
  return profile.evidence_urls[0] ?? null;
}

function buildCompetitorNotes(profile: CompetitorStrategyProfile, existingNotes: string | null | undefined): string {
  const sections = [
    profile.what_they_do,
    profile.working_patterns.length
      ? `Working patterns:\n${profile.working_patterns.map((p) => `- ${p}`).join("\n")}`
      : null,
    profile.hooks.length ? `Hooks: ${profile.hooks.join(", ")}` : null,
    profile.formats.length ? `Formats: ${profile.formats.join(", ")}` : null,
    profile.caveats.length
      ? `Caveats:\n${profile.caveats.map((c) => `- ${c}`).join("\n")}`
      : null,
  ].filter(Boolean);

  const synthesized = sections.join("\n\n");
  if (!existingNotes?.trim()) return synthesized;
  if (!synthesized) return existingNotes;
  if (existingNotes.includes(profile.what_they_do)) return existingNotes;
  return `${existingNotes}\n\n---\nDeep discovery update:\n${synthesized}`;
}

function inferAccountType(kind: CompetitorStrategyProfile["kind"]): AccountType {
  switch (kind) {
    case "direct":
    case "indirect":
      return "competitor";
    case "creator":
    case "audience_magnet":
      return "creator";
    case "community":
      return "unknown";
    default:
      return "unknown";
  }
}

function normalizePlatform(value: string): SourcePlatform {
  const allowed: SourcePlatform[] = [
    "tiktok",
    "instagram",
    "x",
    "linkedin",
    "youtube",
    "threads",
    "pinterest",
    "reddit",
    "facebook",
    "other",
  ];
  return allowed.includes(value as SourcePlatform) ? (value as SourcePlatform) : "other";
}
