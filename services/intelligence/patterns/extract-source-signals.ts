import type { Database } from "@/lib/supabase/types";
import type { MineableSourceRow } from "./load-pattern-context";
import type { PatternType, SourceSignalBucket } from "./schema";
import {
  videoEvidenceHasMineableSignals,
  videoEvidenceToSourcePatch,
} from "../video/bridge-video-evidence-to-sources";

type VideoEvidenceRow = Database["public"]["Tables"]["video_evidence"]["Row"];

const OFFER_PATTERN = /\b(free trial|free plan|demo|pricing|per month|per seat|discount|limited time)\b/i;

function pushSignal(
  bucket: SourceSignalBucket,
  patternType: PatternType,
  field: string,
  raw: string | null | undefined
) {
  const text = raw?.trim();
  if (!text || text.length < 4) return;
  bucket.signals[patternType].push({ text, field });
}

export function extractSourceSignals(source: MineableSourceRow): SourceSignalBucket {
  const bucket: SourceSignalBucket = {
    sourceId: source.id,
    sourceUrl: source.source_url,
    platform: source.platform,
    signals: {
      hook: [],
      pain: [],
      angle: [],
      format: [],
      cta: [],
      visual: [],
      offer: [],
      positioning: [],
    },
  };

  pushSignal(bucket, "hook", "hook", source.hook);
  pushSignal(bucket, "pain", "audience_pain", source.audience_pain);
  pushSignal(bucket, "angle", "angle", source.angle);
  pushSignal(bucket, "format", "format", source.format);
  pushSignal(bucket, "cta", "cta_pattern", source.cta_pattern);
  pushSignal(bucket, "visual", "visual_pattern", source.visual_pattern);
  pushSignal(bucket, "positioning", "why_it_worked", source.why_it_worked);
  pushSignal(bucket, "positioning", "how_to_adapt", source.how_to_adapt);

  const notes = source.notes?.trim();
  if (notes) {
    if (OFFER_PATTERN.test(notes)) {
      pushSignal(bucket, "offer", "notes", notes);
    } else {
      pushSignal(bucket, "positioning", "notes", notes);
    }
  }

  const caption = source.caption?.trim();
  if (caption) {
    if (!source.hook) pushSignal(bucket, "hook", "caption", caption.slice(0, 200));
    if (OFFER_PATTERN.test(caption)) pushSignal(bucket, "offer", "caption", caption.slice(0, 200));
  }

  const fetched = source.fetched_text?.trim();
  if (fetched) {
    const snippet = fetched.slice(0, 240);
    if (!source.hook && !source.caption) pushSignal(bucket, "hook", "fetched_text", snippet);
    if (OFFER_PATTERN.test(snippet)) pushSignal(bucket, "offer", "fetched_text", snippet);
  }

  return bucket;
}

export function extractSignalsFromSources(sources: MineableSourceRow[]): SourceSignalBucket[] {
  return sources.map(extractSourceSignals).filter((bucket) =>
    Object.values(bucket.signals).some((items) => items.length > 0)
  );
}

export function videoEvidenceToMineableSource(row: VideoEvidenceRow): MineableSourceRow | null {
  if (!videoEvidenceHasMineableSignals(row)) return null;

  const patch = videoEvidenceToSourcePatch(row);
  return {
    id: row.id,
    project_id: row.project_id,
    source_url: row.video_url,
    platform: patch.platform as MineableSourceRow["platform"],
    account_type: patch.account_type as MineableSourceRow["account_type"],
    caption: (patch.caption as string | null) ?? null,
    hook: (patch.hook as string | null) ?? null,
    angle: (patch.angle as string | null) ?? null,
    format: (patch.format as string | null) ?? null,
    cta_pattern: (patch.cta_pattern as string | null) ?? null,
    visual_pattern: null,
    audience_pain: null,
    why_it_worked: null,
    how_to_adapt: null,
    fetched_text: null,
    notes: (patch.notes as string | null) ?? null,
    confidence_score: row.source_confidence,
    fetch_status: row.fetch_status,
  };
}

export function extractSignalsFromVideoEvidence(rows: VideoEvidenceRow[]): SourceSignalBucket[] {
  return rows
    .map((row) => {
      const source = videoEvidenceToMineableSource(row);
      return source ? extractSourceSignals(source) : null;
    })
    .filter((bucket): bucket is SourceSignalBucket => Boolean(bucket))
    .filter((bucket) => Object.values(bucket.signals).some((items) => items.length > 0));
}
