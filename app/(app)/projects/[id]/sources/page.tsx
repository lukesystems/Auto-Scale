import Link from "next/link";
import { Brain, ExternalLink, Network } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/app/page-header";
import { NextMoveBanner } from "@/components/app/next-move-banner";
import { getNextMove } from "@/lib/next-move";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { AddSourceForm } from "./add-source-form";
import { AddCompetitorForm } from "./add-competitor-form";
import { DeleteSourceButton } from "./delete-source-button";
import { DiscoverSourcesButton } from "./discover-sources-button";
import { CandidateReviewButtons } from "./candidate-review-buttons";
import { isBriefComplete } from "@/lib/brief-completeness";
import { getProductBrief, getProjectStats } from "../queries";

interface PageProps { params: { id: string } }

export const metadata = { title: "Sources" };

export default async function SourcesPage({ params }: PageProps) {
  const [competitors, competitorAccounts, sources, candidates, brief, stats] = await Promise.all([
    loadCompetitors(params.id),
    loadCompetitorAccounts(params.id),
    loadSources(params.id),
    loadCandidates(params.id),
    getProductBrief(params.id),
    getProjectStats(params.id),
  ]);

  const next = getNextMove({
    projectId: params.id,
    briefComplete: isBriefComplete(brief),
    stats,
  });

  const accountsByCompetitor = new Map<string, typeof competitorAccounts>();
  for (const account of competitorAccounts) {
    if (!account.competitor_id) continue;
    const list = accountsByCompetitor.get(account.competitor_id) ?? [];
    list.push(account);
    accountsByCompetitor.set(account.competitor_id, list);
  }

  return (
    <div className="container py-10 space-y-8">
      <PageHeader
        title="Competitors & sources"
        description="Add the URLs, accounts, and posts TrendWatch should learn from. The richer the input, the sharper the analysis."
        actions={
          <div className="flex items-center gap-2">
            <DiscoverSourcesButton projectId={params.id} briefComplete={isBriefComplete(brief)} />
            <Button asChild>
              <Link href={`/projects/${params.id}/trendwatch`}>
                <Brain className="h-4 w-4" /> Run TrendWatch
              </Link>
            </Button>
          </div>
        }
      />

      <NextMoveBanner move={next} />

      <div className="grid lg:grid-cols-[1fr_2fr] gap-6">
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold tracking-tight">Add a competitor</h3>
            <p className="mt-1 text-xs text-muted-foreground">High-level companies you study.</p>
            <div className="mt-4">
              <AddCompetitorForm projectId={params.id} />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold tracking-tight">Add a source post</h3>
            <p className="mt-1 text-xs text-muted-foreground">Specific posts, accounts, or URLs to analyze.</p>
            <div className="mt-4">
              <AddSourceForm projectId={params.id} />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {candidates.length > 0 && (
            <section>
              <h3 className="font-semibold tracking-tight">Discovered candidates ({candidates.length})</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Review auto-discovered sources. Accept to add them to TrendWatch evidence.
              </p>
              <div className="mt-3 space-y-2">
                {candidates.map((candidate) => (
                  <div key={candidate.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">{candidate.platform}</Badge>
                        <Badge variant="secondary">{candidate.source_type.replace(/_/g, " ")}</Badge>
                        <Badge variant="outline">{candidate.adapter}</Badge>
                        {candidate.quality?.strategicValue != null && (
                          <Badge variant="outline">
                            Strategic {Math.round(candidate.quality.strategicValue * 100)}%
                          </Badge>
                        )}
                        {candidate.quality?.competitorLikelihood != null && (
                          <Badge variant="outline">
                            Competitor {Math.round(candidate.quality.competitorLikelihood * 100)}%
                          </Badge>
                        )}
                        {candidate.quality?.confidence != null && (
                          <Badge
                            variant={
                              candidate.quality.confidence >= 0.65
                                ? "success"
                                : candidate.quality.confidence >= 0.4
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            Confidence {Math.round(candidate.quality.confidence * 100)}%
                          </Badge>
                        )}
                        <Badge
                          variant={
                            candidate.enrich_status === "enriched"
                              ? "success"
                              : candidate.enrich_status === "failed"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {candidate.enrich_status}
                        </Badge>
                      </div>
                      <CandidateReviewButtons projectId={params.id} candidateId={candidate.id} />
                    </div>
                    {candidate.title && <div className="mt-2 text-sm font-medium">{candidate.title}</div>}
                    <a
                      href={candidate.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground truncate max-w-full"
                    >
                      {candidate.url} <ExternalLink className="h-3 w-3" />
                    </a>
                    {candidate.snippet && (
                      <p className="mt-2 line-clamp-3 text-sm text-foreground/80">{candidate.snippet}</p>
                    )}
                    {candidate.discovery_reason && (
                      <p className="mt-2 text-xs text-muted-foreground">{candidate.discovery_reason}</p>
                    )}
                    {candidate.quality?.reasons?.length ? (
                      <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                        {candidate.quality.reasons.slice(0, 2).map((reason) => (
                          <li key={reason}>· {reason}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="font-semibold tracking-tight">Competitors ({competitors.length})</h3>
            <div className="mt-3 space-y-2">
              {competitors.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-card/40 p-5 text-sm text-muted-foreground">
                  No competitors yet. Add a few above.
                </div>
              ) : (
                competitors.map((c) => {
                  const strategy = parseStrategyProfile(c.strategy_profile);
                  const accounts = accountsByCompetitor.get(c.id) ?? [];
                  return (
                  <div key={c.id} className="rounded-lg border border-border bg-card px-4 py-3 space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                        {c.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="text-sm font-medium truncate">{c.name}</div>
                          {c.kind && c.kind !== "unknown" && (
                            <Badge variant="outline">{c.kind.replace("_", " ")}</Badge>
                          )}
                          {c.confidence && (
                            <Badge
                              variant={
                                c.confidence === "high"
                                  ? "success"
                                  : c.confidence === "medium"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {c.confidence} confidence
                            </Badge>
                          )}
                          {c.source === "deep_discovery" && (
                            <Badge variant="secondary">AI discovered</Badge>
                          )}
                        </div>
                        {c.url && (
                          <a href={c.url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 truncate">
                            {c.url} <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                    {(strategy?.what_they_do || c.notes) && (
                      <p className="text-sm text-foreground/80 line-clamp-3">
                        {strategy?.what_they_do ?? c.notes}
                      </p>
                    )}
                    {strategy?.working_patterns && strategy.working_patterns.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Patterns: {strategy.working_patterns.slice(0, 3).join(" · ")}
                      </p>
                    )}
                    {accounts.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {accounts.map((account) => (
                          <Badge key={account.id} variant="outline">
                            {account.platform} @{account.handle}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  );
                })
              )}
            </div>
          </section>

          <section>
            <h3 className="font-semibold tracking-tight">Source posts ({sources.length})</h3>
            <div className="mt-3 space-y-2">
              {sources.length === 0 ? (
                <EmptyState
                  icon={<Network className="h-5 w-5" />}
                  title="No source posts yet"
                  description="TrendWatch can still run on the niche alone, but signal is much sharper with concrete examples."
                  action={
                    <DiscoverSourcesButton projectId={params.id} briefComplete={isBriefComplete(brief)} />
                  }
                />
              ) : (
                sources.map((s) => (
                  <div key={s.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">{s.platform}</Badge>
                        {s.account_handle && <span className="text-sm font-medium">@{s.account_handle}</span>}
                        {s.account_type && s.account_type !== "unknown" && (
                          <Badge variant="secondary">{s.account_type}</Badge>
                        )}
                        <Badge variant={s.fetch_status === "success" ? "success" : s.fetch_status === "failed" ? "destructive" : "secondary"}>
                          {s.fetch_status}
                        </Badge>
                      </div>
                      <DeleteSourceButton projectId={params.id} sourceId={s.id} />
                    </div>
                    {s.source_url && (
                      <a href={s.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground truncate max-w-full">
                        {s.source_url} <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {s.notes && <p className="mt-2 text-sm text-foreground/80">{s.notes}</p>}
                    {s.caption && <p className="mt-2 line-clamp-2 text-sm text-foreground/80">{s.caption}</p>}
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {s.format && <span>Format: {s.format}</span>}
                      <span>Signal: {Math.round(Number(s.signal_score ?? 0) * 100)}%</span>
                      <span>Confidence: {Math.round(Number(s.confidence_score ?? 0) * 100)}%</span>
                      {s.screenshot_signed_url && (
                        <a href={s.screenshot_signed_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                          View screenshot
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

async function loadCompetitors(projectId: string) {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("competitors")
    .select("id, name, url, notes, kind, confidence, source, strategy_profile")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

async function loadCompetitorAccounts(projectId: string) {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("competitor_accounts")
    .select("id, competitor_id, platform, handle")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

function parseStrategyProfile(value: unknown): {
  what_they_do?: string;
  working_patterns?: string[];
} | null {
  if (!value || typeof value !== "object") return null;
  const profile = value as Record<string, unknown>;
  return {
    what_they_do: typeof profile.what_they_do === "string" ? profile.what_they_do : undefined,
    working_patterns: Array.isArray(profile.working_patterns)
      ? profile.working_patterns.filter((item): item is string => typeof item === "string")
      : undefined,
  };
}

async function loadSources(projectId: string) {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("trendwatch_sources")
    .select("id, platform, account_handle, account_type, source_url, caption, notes, format, signal_score, confidence_score, fetch_status, screenshot_url")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  const rows = data ?? [];
  const paths = rows.map((row) => row.screenshot_url).filter((path): path is string => Boolean(path));
  const signed = paths.length
    ? await supabase.storage.from("project-assets").createSignedUrls(paths, 60 * 60)
    : { data: [] };
  const signedByPath = new Map((signed.data ?? []).map((entry) => [entry.path, entry.signedUrl]));
  return rows.map((row) => ({
    ...row,
    screenshot_signed_url: row.screenshot_url ? signedByPath.get(row.screenshot_url) ?? null : null,
  }));
}

async function loadCandidates(projectId: string) {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("source_candidates")
    .select(
      "id, url, title, snippet, platform, source_type, adapter, discovery_query, discovery_reason, relevance_score, enrich_status, review_status, metadata"
    )
    .eq("project_id", projectId)
    .eq("review_status", "pending")
    .order("relevance_score", { ascending: false })
    .limit(50);
  return (data ?? []).map((row) => ({
    ...row,
    quality: parseCandidateQuality(row.metadata),
  }));
}

function parseCandidateQuality(metadata: unknown): {
  competitorLikelihood: number | null;
  strategicValue: number | null;
  confidence: number | null;
  reasons: string[];
} | null {
  if (!metadata || typeof metadata !== "object") return null;
  const quality = (metadata as Record<string, unknown>).quality;
  if (!quality || typeof quality !== "object") return null;
  const q = quality as Record<string, unknown>;
  return {
    competitorLikelihood:
      typeof q.competitor_likelihood === "number" ? q.competitor_likelihood : null,
    strategicValue: typeof q.strategic_value === "number" ? q.strategic_value : null,
    confidence: typeof q.confidence === "number" ? q.confidence : null,
    reasons: Array.isArray(q.reasons)
      ? q.reasons.filter((item): item is string => typeof item === "string")
      : [],
  };
}
