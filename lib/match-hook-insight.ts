export interface InsightForHookMatch {
  id: string;
  insight: string;
  hook_pattern: string | null;
}

/**
 * Pick the best TrendWatch insight for a generated hook.
 * Prefers hook_pattern overlap, then token overlap with insight text.
 */
export function matchInsightForHook(
  hookText: string,
  insights: InsightForHookMatch[]
): string | null {
  if (!insights.length) return null;

  const normalized = hookText.toLowerCase().trim();
  if (!normalized) return null;

  for (const insight of insights) {
    const pattern = insight.hook_pattern?.toLowerCase().trim();
    if (!pattern) continue;
    if (normalized.includes(pattern) || pattern.includes(normalized.slice(0, Math.min(40, normalized.length)))) {
      return insight.id;
    }
  }

  const hookWords = normalized.split(/\s+/).filter((word) => word.length > 3);
  let best: { id: string; score: number } | null = null;

  for (const insight of insights) {
    const corpus = `${insight.insight} ${insight.hook_pattern ?? ""}`.toLowerCase();
    let score = 0;
    for (const word of hookWords) {
      if (corpus.includes(word)) score++;
    }
    if (!best || score > best.score) {
      best = { id: insight.id, score };
    }
  }

  if (best && best.score > 0) return best.id;
  return insights.find((insight) => insight.hook_pattern)?.id ?? insights[0]?.id ?? null;
}
