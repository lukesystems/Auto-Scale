import type { DiscoveryContext } from "./load-context";
import type { DiscoveryIntent } from "./schema";
import type { NormalizedCandidate } from "./dedupe-candidates";

export interface BriefScoringContext {
  productName: string | null;
  category: string | null;
  targetCustomer: string | null;
  primaryPain: string | null;
  marketCategory: string | null;
  keywords: Set<string>;
}

export interface CandidateQualityScore {
  competitorLikelihood: number;
  audienceRelevance: number;
  evidenceRichness: number;
  platformValue: number;
  strategicValue: number;
  confidence: number;
  reasons: string[];
}

const STOP_WORDS = new Set([
  "about", "after", "also", "been", "before", "being", "between", "could", "does",
  "from", "have", "into", "more", "other", "should", "that", "their", "there",
  "these", "they", "this", "through", "under", "very", "what", "when", "where",
  "which", "while", "with", "would", "your",
]);

const HIGH_VALUE_SOURCE_TYPES = new Set([
  "competitor_homepage",
  "competitor_pricing",
  "comparison",
  "review",
  "community_pain",
  "video",
]);

const COMPETITOR_SOURCE_TYPES = new Set([
  "competitor_homepage",
  "competitor_pricing",
  "competitor_blog",
  "comparison",
  "marketplace",
]);

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter((word) => word.length > 3 && !STOP_WORDS.has(word));
}

function addKeywordsFromText(text: string | null | undefined, keywords: Set<string>) {
  if (!text) return;
  for (const word of tokenize(text)) keywords.add(word);
}

export function buildScoringContextFromDiscovery(context: DiscoveryContext): BriefScoringContext {
  const brief = context.brief;
  const keywords = new Set<string>();

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
    brief.market_category,
  ]) {
    addKeywordsFromText(text, keywords);
  }

  for (const fact of context.facts) {
    addKeywordsFromText(fact.fact_value, keywords);
  }

  if (Array.isArray(brief.user_pain_points)) {
    for (const pain of brief.user_pain_points) {
      if (typeof pain === "string") addKeywordsFromText(pain, keywords);
    }
  }

  return {
    productName: brief.product_name,
    category: brief.category ?? brief.market_category,
    targetCustomer: brief.target_customer,
    primaryPain: brief.primary_pain,
    marketCategory: brief.market_category ?? brief.category,
    keywords,
  };
}

function scoreCompetitorLikelihood(candidate: NormalizedCandidate, intent: DiscoveryIntent): number {
  let score = 0.2;

  if (COMPETITOR_SOURCE_TYPES.has(candidate.sourceType)) score += 0.45;
  if (candidate.sourceType === "competitor_homepage") score += 0.2;
  if (candidate.sourceType === "competitor_pricing") score += 0.15;
  if (intent === "competitor" || intent === "indirect_competitor" || intent === "alternative") {
    score += 0.15;
  }
  if (intent === "shadow_account") score += 0.2;
  if (intent === "distribution") score += 0.1;
  if (intent === "comparison") score += 0.1;

  const lower = candidate.url.toLowerCase();
  if (/\/(pricing|plans|features)(\/|$)/.test(lower)) score += 0.1;
  if (candidate.platform === "other" && !lower.includes("reddit.com") && !lower.includes("youtube.com")) {
    score += 0.05;
  }

  return clamp(score);
}

function scoreAudienceRelevance(
  candidate: NormalizedCandidate,
  context: BriefScoringContext
): number {
  if (context.keywords.size === 0) return 0.35;

  const haystack = [candidate.title, candidate.snippet, candidate.discoveryQuery, candidate.url]
    .filter(Boolean)
    .join(" ");
  const tokens = tokenize(haystack);
  if (!tokens.length) return 0.2;

  let matches = 0;
  for (const token of tokens) {
    if (context.keywords.has(token)) matches += 1;
  }

  const denominator = Math.min(Math.max(context.keywords.size, 1), 24);
  return clamp(matches / denominator);
}

function scoreEvidenceRichness(candidate: NormalizedCandidate): number {
  let score = 0.15;

  if (candidate.title?.trim()) score += 0.2;
  if ((candidate.snippet?.length ?? 0) >= 80) score += 0.25;
  else if (candidate.snippet?.trim()) score += 0.1;

  const lower = candidate.url.toLowerCase();
  if (/\/(pricing|plans|features|blog|docs|customers|about)(\/|$)/.test(lower)) score += 0.15;
  if (HIGH_VALUE_SOURCE_TYPES.has(candidate.sourceType)) score += 0.15;

  const adapterCount = candidate.adapter.split("+").filter(Boolean).length;
  if (adapterCount > 1) score += 0.1;

  return clamp(score);
}

function scorePlatformValue(candidate: NormalizedCandidate, intent: DiscoveryIntent): number {
  let score = 0.35;

  const platform = candidate.platform;
  if (intent === "community" && (platform === "reddit" || candidate.sourceType === "community_pain")) {
    score += 0.35;
  }
  if (intent === "creator" && (platform === "x" || platform === "youtube" || platform === "tiktok")) {
    score += 0.3;
  }
  if (intent === "comparison" && candidate.sourceType === "comparison") score += 0.25;
  if (intent === "competitor" && COMPETITOR_SOURCE_TYPES.has(candidate.sourceType)) score += 0.25;
  if (intent === "pain" && candidate.sourceType === "community_pain") score += 0.3;
  if (intent === "shadow_account" && (platform === "tiktok" || platform === "instagram" || platform === "x")) {
    score += 0.35;
  }
  if (intent === "distribution" && (platform === "tiktok" || platform === "youtube" || platform === "instagram")) {
    score += 0.3;
  }
  if (platform !== "other") score += 0.1;

  return clamp(score);
}

function scoreStrategicValue(dimensions: {
  competitorLikelihood: number;
  audienceRelevance: number;
  evidenceRichness: number;
  platformValue: number;
  coverageScore?: number;
}): number {
  const base =
    dimensions.competitorLikelihood * 0.3 +
    dimensions.audienceRelevance * 0.25 +
    dimensions.evidenceRichness * 0.25 +
    dimensions.platformValue * 0.2;

  const coverageBoost = dimensions.coverageScore ? Math.min(0.15, dimensions.coverageScore * 0.1) : 0;
  return clamp(base + coverageBoost);
}

function buildReasons(
  candidate: NormalizedCandidate,
  scores: Omit<CandidateQualityScore, "reasons" | "strategicValue" | "confidence">
): string[] {
  const reasons: string[] = [];

  if (scores.competitorLikelihood >= 0.65) {
    reasons.push(`High competitor signal (${candidate.sourceType.replace(/_/g, " ")}).`);
  }
  if (scores.audienceRelevance >= 0.5) {
    reasons.push("Snippet overlaps with brief keywords.");
  }
  if (scores.evidenceRichness >= 0.55) {
    reasons.push("Rich title/snippet or high-value page type.");
  }
  if (scores.platformValue >= 0.6) {
    reasons.push(`Strong platform fit (${candidate.platform}).`);
  }
  if (candidate.adapter.includes("+")) {
    reasons.push(`Found by multiple search adapters (${candidate.adapter}).`);
  }
  if (reasons.length === 0) {
    reasons.push("Weak strategic signal — review before promoting.");
  }

  return reasons;
}

export interface ScoreCandidateInput {
  candidate: NormalizedCandidate;
  intent: DiscoveryIntent;
  context: BriefScoringContext;
  coverageScore?: number;
}

export function scoreCandidate(input: ScoreCandidateInput): CandidateQualityScore {
  const competitorLikelihood = scoreCompetitorLikelihood(input.candidate, input.intent);
  const audienceRelevance = scoreAudienceRelevance(input.candidate, input.context);
  const evidenceRichness = scoreEvidenceRichness(input.candidate);
  const platformValue = scorePlatformValue(input.candidate, input.intent);

  const strategicValue = scoreStrategicValue({
    competitorLikelihood,
    audienceRelevance,
    evidenceRichness,
    platformValue,
    coverageScore: input.coverageScore,
  });

  const confidence = clamp(
    strategicValue * 0.5 +
      evidenceRichness * 0.25 +
      (input.coverageScore && input.coverageScore > 1 ? 0.15 : 0) +
      (competitorLikelihood >= 0.6 ? 0.1 : 0)
  );

  const partial = { competitorLikelihood, audienceRelevance, evidenceRichness, platformValue };
  const reasons = buildReasons(input.candidate, partial);

  return {
    ...partial,
    strategicValue,
    confidence,
    reasons,
  };
}

export function scoreCandidates(
  candidates: NormalizedCandidate[],
  intentsByQuery: Map<string, DiscoveryIntent>,
  context: BriefScoringContext,
  coverageByUrl?: Map<string, number>
): Array<{ candidate: NormalizedCandidate; quality: CandidateQualityScore }> {
  return candidates.map((candidate) => {
    const intent = intentsByQuery.get(candidate.discoveryQuery) ?? "competitor";
    const quality = scoreCandidate({
      candidate,
      intent,
      context,
      coverageScore: coverageByUrl?.get(candidate.canonicalUrl),
    });
    return {
      candidate: {
        ...candidate,
        relevanceScore: quality.strategicValue,
      },
      quality,
    };
  });
}
