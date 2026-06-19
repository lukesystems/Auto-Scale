import { generateObject } from "@/services/ai/runtime";
import { estimateDistortionRisk } from "./scoring";
import { SourceClassificationSchema, type SourceClassification } from "./schema";
import type { SourceRecord } from "./enrich-sources";

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

export function classifySourceDeterministically(source: SourceRecord): SourceClassification {
  const text = [source.caption, source.fetched_text, source.notes].filter(Boolean).join(" ").toLowerCase();
  const format = includesAny(text, ["step ", "steps", "how to", "checklist"])
    ? "how-to"
    : includesAny(text, ["before", "after"])
      ? "before-and-after"
      : includesAny(text, ["mistake", "avoid"])
        ? "mistake breakdown"
        : includesAny(text, ["tool", "stack", "workflow"])
          ? "tool or workflow teardown"
          : "single-post insight";
  const hook = (source.caption ?? source.fetched_text ?? source.notes ?? "").split(/[.!?\n]/)[0].trim().slice(0, 180);
  const ctaPattern = includesAny(text, ["comment", "reply"])
    ? "comment or reply"
    : includesAny(text, ["download", "get the", "link"])
      ? "resource or link"
      : includesAny(text, ["follow", "subscribe"])
        ? "follow or subscribe"
        : "no explicit CTA detected";
  const transferability = source.source_url || source.caption || source.notes ? 0.65 : 0.35;

  return {
    account_type: (source.account_type || "unknown") as SourceClassification["account_type"],
    follower_count: source.follower_count,
    format,
    hook,
    angle: includesAny(text, ["why", "because"]) ? "explanation" : "practical observation",
    visual_pattern: "Not verifiable from text-only ingestion",
    cta_pattern: ctaPattern,
    audience_pain: includesAny(text, ["struggle", "problem", "hard", "waste"])
      ? "Explicit pain language detected"
      : "No explicit audience pain detected",
    why_it_worked: "Deterministic baseline only; validate with real performance metrics.",
    how_to_adapt: `Adapt the ${format} structure to the product brief while preserving the source-to-post chain.`,
    distortion_risk: estimateDistortionRisk({
      followerCount: source.follower_count,
      accountType: source.account_type,
    }),
    transferability_score: transferability,
    signal_score: 0.5,
    recommended_experiments: [`Test one ${format} using a niche-specific hook.`],
  };
}

export async function classifySource(source: SourceRecord): Promise<SourceClassification> {
  const fallback = classifySourceDeterministically(source);
  const evidence = [source.caption, source.fetched_text, source.notes].filter(Boolean).join("\n").slice(0, 6_000);
  if (!evidence) return fallback;

  const result = await generateObject({
    prompt: `[[source_classification]]
Classify this source using only the supplied evidence. Do not invent metrics, follower counts, visuals, or performance.
Platform: ${source.platform}
Handle: ${source.account_handle ?? "(unknown)"}
Known account type: ${source.account_type}
Known follower count: ${source.follower_count ?? "(unknown)"}
Evidence:
${evidence}`,
    schema: SourceClassificationSchema,
    schemaName: "SourceClassification",
    taskType: "trendwatch",
    temperature: 0.2,
  });

  return {
    ...result.object,
    follower_count: source.follower_count,
    account_type: source.account_type === "unknown" ? result.object.account_type : source.account_type as SourceClassification["account_type"],
    signal_score: fallback.signal_score,
  };
}
