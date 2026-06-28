import { bridgeVideoEvidenceToSources } from "../video/bridge-video-evidence-to-sources";
import { loadPatternMiningContext } from "./load-pattern-context";
import { extractSignalsFromSources } from "./extract-source-signals";
import {
  clusterPatterns,
  filterPatternsWithEvidence,
  groupSignalsDeterministically,
} from "./cluster-patterns";
import { savePatternRun } from "./save-pattern-run";
import { savePatterns } from "./save-patterns";
import type { MinedPattern } from "./schema";
import { scorePatterns } from "../scoring/score-patterns";

export interface RunPatternMiningInput {
  projectId: string;
}

export interface RunPatternMiningResult {
  ok: boolean;
  runId: string | null;
  sourceCount: number;
  patternCount: number;
  patterns: MinedPattern[];
  usedAi: boolean;
  error: string | null;
}

export async function runPatternMining(input: RunPatternMiningInput): Promise<RunPatternMiningResult> {
  await bridgeVideoEvidenceToSources({ projectId: input.projectId });
  let context = await loadPatternMiningContext(input.projectId);

  if (!context.sources.length) {
    return {
      ok: false,
      runId: null,
      sourceCount: 0,
      patternCount: 0,
      patterns: [],
      usedAi: false,
      error:
        "No mineable signals from video evidence or TrendWatch sources. Run video discovery or accept sources first.",
    };
  }

  let buckets = extractSignalsFromSources(context.sources);
  if (!buckets.length) {
    await bridgeVideoEvidenceToSources({ projectId: input.projectId });
    context = await loadPatternMiningContext(input.projectId);
    buckets = extractSignalsFromSources(context.sources);
  }

  if (!buckets.length) {
    return {
      ok: false,
      runId: null,
      sourceCount: context.sources.length,
      patternCount: 0,
      patterns: [],
      usedAi: false,
      error:
        "Video evidence and TrendWatch sources lack extractable hooks, formats, or CTAs for pattern mining.",
    };
  }

  let runId: string | null = null;
  try {
    runId = await savePatternRun({
      projectId: input.projectId,
      status: "running",
      sourceCount: context.sources.length,
    });
  } catch (error) {
    return {
      ok: false,
      runId: null,
      sourceCount: context.sources.length,
      patternCount: 0,
      patterns: [],
      usedAi: false,
      error: error instanceof Error ? error.message : "Failed to start pattern run.",
    };
  }

  const groups = groupSignalsDeterministically(buckets);
  const clustered = await clusterPatterns({ groups, context });
  const patterns = filterPatternsWithEvidence(clustered.patterns);
  const scoredPatterns = scorePatterns(patterns, context.sources, context).map((scored) => ({
    pattern: patterns[scored.patternIndex],
    scores: scored.scores,
  }));

  if (!patterns.length) {
    await savePatternRun({
      runId,
      projectId: input.projectId,
      status: "failed",
      sourceCount: context.sources.length,
      patternCount: 0,
      error: "No repeated patterns with enough evidence were found.",
      completed: true,
      metadata: { used_ai: clustered.usedAi, groups_found: groups.length },
    });

    return {
      ok: false,
      runId,
      sourceCount: context.sources.length,
      patternCount: 0,
      patterns: [],
      usedAi: clustered.usedAi,
      error: "No repeated patterns with enough evidence were found.",
    };
  }

  try {
    await savePatterns({ runId, projectId: input.projectId, patterns: scoredPatterns });
  } catch (error) {
    await savePatternRun({
      runId,
      projectId: input.projectId,
      status: "failed",
      sourceCount: context.sources.length,
      patternCount: 0,
      error: error instanceof Error ? error.message : "Failed to save patterns.",
      completed: true,
    });

    return {
      ok: false,
      runId,
      sourceCount: context.sources.length,
      patternCount: 0,
      patterns: [],
      usedAi: clustered.usedAi,
      error: error instanceof Error ? error.message : "Failed to save patterns.",
    };
  }

  await savePatternRun({
    runId,
    projectId: input.projectId,
    status: patterns.length > 0 ? "success" : "partial",
    sourceCount: context.sources.length,
    patternCount: patterns.length,
    completed: true,
    metadata: { used_ai: clustered.usedAi, groups_found: groups.length },
  });

  return {
    ok: true,
    runId,
    sourceCount: context.sources.length,
    patternCount: patterns.length,
    patterns,
    usedAi: clustered.usedAi,
    error: null,
  };
}
