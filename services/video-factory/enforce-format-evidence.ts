import type { FormatHypothesis } from "@/services/winning-format/schema";

export interface RankedEvidenceRow {
  id: string;
  platform: string;
  score: number;
}

export function normalizeFormatEvidence(
  format: FormatHypothesis,
  allowedEvidence: Set<string>,
  allowedPatterns: Set<string>
): FormatHypothesis {
  return {
    ...format,
    evidence_video_ids: format.evidence_video_ids.filter((id) => allowedEvidence.has(id)),
    source_pattern_ids: format.source_pattern_ids.filter((id) => allowedPatterns.has(id)),
  };
}

/**
 * When the project has enough video evidence, every format fingerprint must cite
 * at least one allowed evidence_video_id. Auto-assign top-ranked platform match
 * when the LLM left the array empty.
 */
export function enforceFormatEvidence(
  format: FormatHypothesis,
  allowedEvidenceIds: string[],
  rankedEvidence: RankedEvidenceRow[]
): FormatHypothesis {
  if (allowedEvidenceIds.length < 3) {
    return format;
  }

  if (format.evidence_video_ids.length > 0) {
    return format;
  }

  const allowed = new Set(allowedEvidenceIds);
  const candidates = rankedEvidence.filter((row) => allowed.has(row.id));
  const platformMatch = candidates.find((row) => row.platform === format.platform);
  const best = platformMatch ?? candidates[0];
  if (!best) {
    return format;
  }

  const missing = format.missing_evidence.filter(
    (item) => !item.toLowerCase().includes("auto-assigned evidence")
  );

  return {
    ...format,
    evidence_video_ids: [best.id],
    missing_evidence: missing,
    observed_evidence: [
      ...format.observed_evidence,
      `Auto-assigned evidence video ${best.id} (${best.platform}) — LLM left evidence_video_ids empty.`,
    ],
    confidence: Math.min(format.confidence, 0.45),
  };
}

export function rankEvidenceRows(
  rows: Array<{
    id: string;
    platform: string;
    view_count?: number | null;
    source_confidence?: number | null;
  }>
): RankedEvidenceRow[] {
  return [...rows]
    .map((row) => ({
      id: row.id,
      platform: row.platform,
      score:
        (row.source_confidence ?? 0.5) * 0.6 +
        Math.min((row.view_count ?? 0) / 1_000_000, 1) * 0.4,
    }))
    .sort((a, b) => b.score - a.score);
}
