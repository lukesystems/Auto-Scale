/**
 * Signal Scoring Engine
 *
 * V1 weights (from product canvas, section 11):
 *   score =
 *     (relevance * 0.30)
 *   + (format_transferability * 0.25)
 *   + (save_signal * 0.20)
 *   + (recency * 0.10)
 *   + (conversion_intent * 0.10)
 *   + (account_fit * 0.05)
 *
 * Each dimension is normalized to 0-1.
 */

export interface SignalInputs {
  relevance: number;
  formatTransferability: number;
  saveSignal: number;
  recency: number;
  conversionIntent: number;
  accountFit: number;
}

const WEIGHTS = {
  relevance: 0.3,
  formatTransferability: 0.25,
  saveSignal: 0.2,
  recency: 0.1,
  conversionIntent: 0.1,
  accountFit: 0.05,
} as const;

export function calculateSignalScore(inputs: Partial<SignalInputs>): number {
  const safe = {
    relevance: clamp(inputs.relevance ?? 0.5),
    formatTransferability: clamp(inputs.formatTransferability ?? 0.5),
    saveSignal: clamp(inputs.saveSignal ?? 0.5),
    recency: clamp(inputs.recency ?? 0.5),
    conversionIntent: clamp(inputs.conversionIntent ?? 0.5),
    accountFit: clamp(inputs.accountFit ?? 0.5),
  };
  return (
    safe.relevance * WEIGHTS.relevance +
    safe.formatTransferability * WEIGHTS.formatTransferability +
    safe.saveSignal * WEIGHTS.saveSignal +
    safe.recency * WEIGHTS.recency +
    safe.conversionIntent * WEIGHTS.conversionIntent +
    safe.accountFit * WEIGHTS.accountFit
  );
}

export function clamp(n: number, min = 0, max = 1): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

/**
 * Quickly classify an account's distortion risk from follower count + type.
 */
export function estimateDistortionRisk(opts: {
  followerCount?: number | null;
  accountType?: string | null;
}): "low" | "medium" | "high" {
  const { followerCount, accountType } = opts;

  if (accountType === "official") return "low";
  if (accountType === "review" || accountType === "partner") return "low";
  if (accountType === "shadow" && (followerCount ?? 0) < 50_000) return "low";

  if ((followerCount ?? 0) > 500_000) return "high";
  if ((followerCount ?? 0) > 100_000) return "medium";

  return "medium";
}
