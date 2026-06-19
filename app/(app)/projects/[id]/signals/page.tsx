import Link from "next/link";
import { ExternalLink, TrendingUp } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { countMineableSources } from "@/services/intelligence/patterns/load-pattern-context";
import {
  formatScorePercent,
  loadLatestSuccessfulRunPatterns,
  scoreBadgeVariant,
} from "@/services/intelligence/patterns/load-latest-patterns";
import { RunPatternMiningButton } from "../patterns/run-pattern-mining-button";

interface PageProps {
  params: { id: string };
}

export const metadata = { title: "Signal Priorities" };

const PATTERN_TYPE_LABELS: Record<string, string> = {
  hook: "Hook",
  pain: "Pain",
  angle: "Angle",
  format: "Format",
  cta: "CTA",
  visual: "Visual",
  offer: "Offer",
  positioning: "Positioning",
};

export default async function SignalsPage({ params }: PageProps) {
  const [latestRunData, sourceCount] = await Promise.all([
    loadLatestSuccessfulRunPatterns(params.id),
    countMineableSources(params.id),
  ]);

  const { patterns, evidence, sourceScores } = latestRunData;

  const evidenceByPattern = new Map<string, typeof evidence>();
  for (const row of evidence) {
    const list = evidenceByPattern.get(row.pattern_id) ?? [];
    list.push(row);
    evidenceByPattern.set(row.pattern_id, list);
  }

  const sourceScoresByPattern = new Map<string, typeof sourceScores>();
  for (const row of sourceScores) {
    const list = sourceScoresByPattern.get(row.pattern_id) ?? [];
    list.push(row);
    sourceScoresByPattern.set(row.pattern_id, list);
  }

  return (
    <div className="container py-10 space-y-8">
      <PageHeader
        title="Signal Priorities"
        description="Ranked market patterns from your latest successful mining run — ordered by strength, transferability, and confidence."
        actions={<RunPatternMiningButton projectId={params.id} disabled={sourceCount === 0} />}
      />

      {sourceCount === 0 ? (
        <EmptyState
          icon={<TrendingUp className="h-5 w-5" />}
          title="Accept sources first"
          description="Signal scoring runs after pattern mining. Add and accept sources, then mine patterns."
          action={
            <Link href={`/projects/${params.id}/sources`} className="text-sm text-primary hover:underline">
              Go to Sources
            </Link>
          }
        />
      ) : patterns.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="h-5 w-5" />}
          title="No scored signals yet"
          description="Run Pattern Mining to generate evidence-backed patterns with strength scores."
          action={<RunPatternMiningButton projectId={params.id} />}
        />
      ) : (
        <div className="space-y-4">
          {patterns.map((pattern, index) => {
            const scoreReasons = Array.isArray(pattern.score_reasons)
              ? (pattern.score_reasons as string[])
              : [];
            const rows = evidenceByPattern.get(pattern.id) ?? [];
            const scores = sourceScoresByPattern.get(pattern.id) ?? [];
            const scoresBySource = new Map(scores.map((score) => [score.source_id, score]));

            return (
              <article key={pattern.id} className="rounded-xl border border-border bg-card p-5 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">#{index + 1}</Badge>
                      <Badge variant="outline">{PATTERN_TYPE_LABELS[pattern.pattern_type] ?? pattern.pattern_type}</Badge>
                      <Badge variant="secondary">{pattern.support_count} sources</Badge>
                    </div>
                    <h3 className="mt-2 text-lg font-semibold tracking-tight">{pattern.label}</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={scoreBadgeVariant(pattern.strength_score ?? 0)}>
                      Strength {formatScorePercent(pattern.strength_score)}
                    </Badge>
                    <Badge variant={scoreBadgeVariant(pattern.transferability_score ?? 0)}>
                      Transferability {formatScorePercent(pattern.transferability_score)}
                    </Badge>
                    <Badge variant={scoreBadgeVariant(pattern.signal_confidence ?? 0)}>
                      Confidence {formatScorePercent(pattern.signal_confidence)}
                    </Badge>
                  </div>
                </div>

                <p className="text-sm text-foreground/85">{pattern.summary}</p>

                {scoreReasons.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Score breakdown</p>
                    <ul className="mt-1 space-y-1 text-sm text-foreground/80">
                      {scoreReasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {rows.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Top evidence ({Math.min(rows.length, 3)} of {rows.length})
                    </p>
                    <ul className="mt-2 space-y-2">
                      {rows.slice(0, 3).map((row) => {
                        const sourceScore = scoresBySource.get(row.source_id);
                        return (
                          <li key={row.id} className="rounded-lg border border-border/70 bg-background/50 p-3 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-xs text-muted-foreground">{row.evidence_field}</div>
                              {sourceScore && (
                                <Badge variant="outline" className="text-[10px]">
                                  Source signal {formatScorePercent(sourceScore.signal_score)}
                                </Badge>
                              )}
                            </div>
                            <p className="mt-1 text-foreground/85">{row.evidence_text}</p>
                            {sourceScore && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Distortion risk: {sourceScore.distortion_risk}
                              </p>
                            )}
                            {row.source_url && (
                              <a
                                href={row.source_url}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                View source <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  <Link href={`/projects/${params.id}/patterns`} className="text-primary hover:underline">
                    Full pattern detail →
                  </Link>
                </div>

                {pattern.how_to_use && (
                  <div className="rounded-lg border border-border/70 bg-background/40 p-3">
                    <p className="text-xs font-medium text-muted-foreground">How to use it</p>
                    <p className="mt-1 text-sm">{pattern.how_to_use}</p>
                  </div>
                )}

                {Array.isArray(pattern.examples) && pattern.examples.length > 0 && (
                  <p className="text-sm text-foreground/75">
                    Example: “{(pattern.examples as string[])[0]}”
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
