import {
  calculateRealSignalScore,
  clamp,
  estimateDistortionRisk,
} from "@/services/trendwatch/scoring";
import type { MineableSourceRow } from "../patterns/load-pattern-context";
import type { PatternMiningContext } from "../patterns/load-pattern-context";
import type { SourceScore } from "./schema";

const OFFER_PATTERN = /\b(free trial|free plan|demo|pricing|per month|per seat|discount|limited time|sign up|get started)\b/i;

const STOP_WORDS = new Set([
  "about", "after", "also", "been", "before", "being", "between", "could", "does",
  "from", "have", "into", "more", "other", "should", "that", "their", "there",
  "these", "they", "this", "through", "under", "very", "what", "when", "where",
  "which", "while", "with", "would", "your",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter((word) => word.length > 3 && !STOP_WORDS.has(word));
}

function addJsonText(value: unknown, keywords: Set<string>) {
  if (typeof value === "string") {
    for (const word of tokenize(value)) keywords.add(word);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) addJsonText(item, keywords);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) addJsonText(item, keywords);
  }
}

export function extractBriefKeywords(context: PatternMiningContext): Set<string> {
  const keywords = new Set<string>();
  const brief = context.brief;

  if (brief) {
    for (const text of [
      brief.product_name,
      brief.one_line_description,
      brief.category,
      brief.product_type,
      brief.product_summary,
      brief.what_it_does,
      brief.target_customer,
      brief.primary_pain,
      brief.core_promise,
      brief.offer,
      brief.market_category,
    ]) {
      if (text) for (const word of tokenize(text)) keywords.add(word);
    }

    addJsonText(brief.target_audience, keywords);
    addJsonText(brief.user_pain_points, keywords);
    addJsonText(brief.key_features, keywords);
    addJsonText(brief.key_benefits, keywords);
    addJsonText(brief.content_pillars, keywords);
    addJsonText(brief.positioning_angles, keywords);
  }

  for (const fact of context.facts) {
    if (fact.fact_value) for (const word of tokenize(fact.fact_value)) keywords.add(word);
  }

  return keywords;
}

export function getSourceSignalText(source: MineableSourceRow): string {
  return [
    source.hook,
    source.angle,
    source.format,
    source.cta_pattern,
    source.visual_pattern,
    source.audience_pain,
    source.why_it_worked,
    source.how_to_adapt,
    source.notes,
    source.caption,
    source.fetched_text,
  ]
    .filter(Boolean)
    .join(" ");
}

export function scoreRelevance(sourceText: string, keywords: Set<string>): number | null {
  if (keywords.size === 0) return null;

  const tokens = tokenize(sourceText);
  if (!tokens.length) return 0.15;

  let matches = 0;
  for (const token of tokens) {
    if (keywords.has(token)) matches += 1;
  }

  const denominator = Math.min(Math.max(keywords.size, 1), 24);
  return clamp(matches / denominator);
}

export function scoreFormatTransferability(source: MineableSourceRow): number {
  let score = 0.25;

  if (source.format?.trim()) score += 0.35;
  if (source.how_to_adapt?.trim()) score += 0.25;

  const transferableTypes = new Set(["competitor", "shadow", "creator", "unknown"]);
  if (source.account_type && transferableTypes.has(source.account_type)) {
    score += 0.1;
  }

  if (source.fetch_status === "success") score += 0.05;

  return clamp(score);
}

export function scoreConversionIntent(source: MineableSourceRow): number {
  let score = 0.15;

  if (source.cta_pattern?.trim()) score += 0.45;

  const combined = [source.notes, source.caption, source.fetched_text].filter(Boolean).join(" ");
  if (OFFER_PATTERN.test(combined)) score += 0.25;

  return clamp(score);
}

export function scoreAccountFit(accountType: string | null | undefined): number {
  switch (accountType) {
    case "competitor":
      return 0.95;
    case "shadow":
      return 0.9;
    case "creator":
      return 0.85;
    case "review":
      return 0.7;
    case "official":
      return 0.6;
    case "affiliate":
      return 0.55;
    case "partner":
      return 0.5;
    default:
      return 0.5;
  }
}

export function scoreSource(source: MineableSourceRow, context: PatternMiningContext): SourceScore {
  const keywords = extractBriefKeywords(context);
  const sourceText = getSourceSignalText(source);

  const relevance = scoreRelevance(sourceText, keywords);
  const formatTransferability = scoreFormatTransferability(source);
  const conversionIntent = scoreConversionIntent(source);
  const accountFit = scoreAccountFit(source.account_type);

  const { signalScore, confidenceScore, reasons } = calculateRealSignalScore({
    relevance,
    formatTransferability,
    saveSignal: null,
    recency: null,
    conversionIntent,
    accountFit,
  });

  const distortionRisk = estimateDistortionRisk({
    accountType: source.account_type,
    followerCount: null,
  });

  return {
    sourceId: source.id,
    relevance,
    formatTransferability,
    conversionIntent,
    accountFit,
    signalScore,
    confidenceScore,
    distortionRisk,
    reasons,
  };
}
