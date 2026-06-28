import "server-only";

import type { Json } from "@/lib/supabase/types";
import type { AccountType, SourcePlatform } from "@/lib/supabase/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { detectPlatform } from "@/services/trendwatch/ingestion";
import { extractAccountHandle } from "../discovery/dedupe-candidates";
import { primaryEntityKey } from "../entity-resolution/entity-key";
import {
  findMatchingCompetitor,
  type CompetitorIdentity,
} from "../entity-resolution/match-competitor";
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
  const profiles = (input.synthesis.competitors ?? []).filter(
    (p) => (p.evidence_urls?.length ?? 0) >= 2
  );
  if (!profiles.length) {
    return { competitorsUpserted: 0, accountsUpserted: 0, competitorIds: [] };
  }

  const supabase = createSupabaseServerClient();
  const competitorIds: string[] = [];
  let accountsUpserted = 0;

  // Load all existing competitors once so entity-key matching is O(1) per
  // profile and so we don't re-query on every iteration.
  const { data: existingRaw } = await supabase
    .from("competitors")
    .select("id, name, entity_key, evidence_urls, notes, source")
    .eq("project_id", input.projectId);

  const existing: Array<CompetitorIdentity & { notes: string | null; source: string }> = (
    existingRaw ?? []
  ).map((row) => ({
    id: row.id,
    name: row.name,
    entityKey: row.entity_key ?? null,
    evidenceUrls: parseEvidenceUrls(row.evidence_urls),
    notes: row.notes,
    source: row.source ?? "manual",
  }));

  for (const profile of profiles) {
    const name = profile.name.trim();
    if (!name) continue;

    const competitorId = await upsertCompetitor({
      supabase,
      projectId: input.projectId,
      discoveryRunId: input.discoveryRunId,
      profile,
      existing,
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
  existing: Array<CompetitorIdentity & { notes: string | null; source: string }>;
}

async function upsertCompetitor(input: UpsertCompetitorInput): Promise<string | null> {
  const { supabase, projectId, discoveryRunId, profile, existing } = input;
  const normalizedName = profile.name.trim().toLowerCase();
  const entityKey = primaryEntityKey({
    urls: [pickCompetitorUrl(profile), ...profile.evidence_urls],
    name: profile.name,
  });

  const match = findMatchingCompetitor(
    { name: profile.name, urls: [pickCompetitorUrl(profile), ...profile.evidence_urls] },
    existing
  );
  const matchedExisting = match
    ? existing.find((row) => row.id === match.id) ?? null
    : null;

  const payload = {
    project_id: projectId,
    name: profile.name.trim(),
    url: pickCompetitorUrl(profile),
    notes: buildCompetitorNotes(profile, matchedExisting?.notes),
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
    entity_key: entityKey,
    source: (matchedExisting?.source === "manual" ? "manual" : "deep_discovery") as "manual" | "deep_discovery",
  };

  if (matchedExisting?.id) {
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
        entity_key: entityKey ?? matchedExisting.entityKey ?? undefined,
      })
      .eq("id", matchedExisting.id);

    if (error) {
      console.warn("[competitors] update failed", normalizedName, error.message);
      return null;
    }
    return matchedExisting.id;
  }

  const { data, error } = await supabase
    .from("competitors")
    .insert(payload)
    .select("id, name, entity_key, evidence_urls")
    .single();

  if (error || !data) {
    console.warn("[competitors] insert failed", normalizedName, error?.message);
    return null;
  }

  // Keep the in-memory list in sync so subsequent profiles in the same run
  // can match against this freshly-inserted competitor.
  existing.push({
    id: data.id,
    name: data.name,
    entityKey: data.entity_key ?? null,
    evidenceUrls: parseEvidenceUrls(data.evidence_urls),
    notes: payload.notes,
    source: payload.source,
  });

  return data.id;
}

function parseEvidenceUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
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
