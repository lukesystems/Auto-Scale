/**
 * Signal Scoring Engine
 *
 * Real signal scoring based on formula:
 *   score =
 *     (relevance * 0.30)
 *   + (format_transferability * 0.25)
 *   + (save_signal * 0.20)
 *   + (recency * 0.10)
 *   + (conversion_intent * 0.10)
 *   + (account_fit * 0.05)
 *
 * Where metrics are unavailable, we scale the available weights (null-aware scoring)
 * and lower the confidence_score accordingly.
 */

export interface SignalInputs {
  relevance: number | null;
  formatTransferability: number | null;
  saveSignal: number | null;
  recency: number | null;
  conversionIntent: number | null;
  accountFit: number | null;
}

const WEIGHTS = {
  relevance: 0.30,
  formatTransferability: 0.25,
  saveSignal: 0.20,
  recency: 0.10,
  conversionIntent: 0.10,
  accountFit: 0.05,
} as const;

export interface ScoreOutput {
  signalScore: number;
  confidenceScore: number;
  reasons: string[];
}

export function calculateRealSignalScore(inputs: Partial<SignalInputs>): ScoreOutput {
  let weightedSum = 0;
  let totalAvailableWeight = 0;
  const reasons: string[] = [];

  const checkDimension = (
    name: keyof typeof WEIGHTS,
    val: number | null | undefined,
    displayName: string
  ) => {
    const weight = WEIGHTS[name];
    if (val !== null && val !== undefined) {
      const clamped = clamp(val);
      weightedSum += clamped * weight;
      totalAvailableWeight += weight;
    } else {
      reasons.push(`Missing data for ${displayName} (weight: ${weight * 100}%).`);
    }
  };

  checkDimension("relevance", inputs.relevance, "Relevance");
  checkDimension("formatTransferability", inputs.formatTransferability, "Format Transferability");
  checkDimension("saveSignal", inputs.saveSignal, "Save Signal");
  checkDimension("recency", inputs.recency, "Recency");
  checkDimension("conversionIntent", inputs.conversionIntent, "Conversion Intent");
  checkDimension("accountFit", inputs.accountFit, "Account Fit");

  const signalScore = totalAvailableWeight > 0 ? weightedSum / totalAvailableWeight : 0.5;
  const confidenceScore = totalAvailableWeight;

  if (reasons.length === 0) {
    reasons.push("All metric signals are fully available.");
  } else {
    reasons.push(`Confidence is at ${Math.round(confidenceScore * 100)}% due to missing metrics.`);
  }

  return {
    signalScore: Math.round(signalScore * 100) / 100,
    confidenceScore: Math.round(confidenceScore * 100) / 100,
    reasons,
  };
}

export function clamp(n: number, min = 0, max = 1): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

/**
 * Estimate distortion risk from follower count + account type.
 */
export function estimateDistortionRisk(opts: {
  followerCount?: number | null;
  accountType?: string | null;
}): "low" | "medium" | "high" {
  const { followerCount, accountType } = opts;

  if (accountType === "official" || accountType === "review" || accountType === "partner") {
    return "low";
  }
  if (accountType === "shadow" && (followerCount ?? 0) < 50_000) {
    return "low";
  }
  if ((followerCount ?? 0) > 500_000) return "high";
  if ((followerCount ?? 0) > 100_000) return "medium";

  return "medium";
}
