import type { GeneratedPostDraft } from "@/services/content-conveyor/schema";
import type { QualityGateResult } from "./schema";

/**
 * Deterministic Quality Gate checks. Run before any LLM-based review.
 * Catches the obvious failures that should never reach approval.
 */
export function runDeterministicQualityChecks(input: {
  post: Partial<GeneratedPostDraft> & {
    hook?: string;
    caption?: string;
    cta?: string;
    slides?: Array<{ slide_number: number; headline?: string | null; body?: string | null }>;
    hypothesis?: string;
    metric_to_watch?: string;
  };
  insightLinked: boolean;
  existingHooks?: string[];
}): QualityGateResult {
  const failures: string[] = [];
  const fixes: string[] = [];
  const risks: string[] = [];
  let score = 1.0;

  const hook = input.post.hook?.trim() ?? "";
  const caption = input.post.caption?.trim() ?? "";
  const cta = input.post.cta?.trim() ?? "";

  if (!input.insightLinked) {
    failures.push("Post is not linked to a TrendWatch insight.");
    fixes.push("Generate via Content Conveyor so the source → insight → post chain is preserved.");
    score -= 0.4;
  }

  if (!hook) {
    failures.push("Missing hook.");
    fixes.push("Add a short, sharp hook (under 14 words).");
    score -= 0.25;
  } else if (hook.split(/\s+/).length > 18) {
    failures.push("Hook is too long.");
    fixes.push("Trim the hook to under 14 words.");
    score -= 0.1;
  }

  if (!input.post.hypothesis) {
    failures.push("Missing hypothesis.");
    fixes.push("Add a one-line hypothesis describing what this post is testing.");
    score -= 0.1;
  }

  if (!input.post.metric_to_watch) {
    failures.push("Missing metric to watch.");
    fixes.push("Pick saves, save_rate, clicks, ctr, signups, or revenue.");
    score -= 0.05;
  }

  if (!cta) {
    risks.push("No CTA — direct conversion will be weak.");
    score -= 0.05;
  }

  if (caption.length > 0 && caption.length < 40) {
    risks.push("Caption is short — consider adding context or proof.");
    score -= 0.03;
  }

  // Duplicate hook detection
  if (hook && input.existingHooks) {
    const normalized = hook.toLowerCase();
    const duplicate = input.existingHooks.find((h) => h.toLowerCase() === normalized);
    if (duplicate) {
      failures.push("Hook duplicates an existing post.");
      fixes.push("Generate a variant — change the angle or audience.");
      score -= 0.2;
    }
  }

  // Over-promise / spam heuristic
  const overpromiseTerms = ["guaranteed", "10x overnight", "instantly viral", "secret hack", "millionaire"];
  const lower = `${hook} ${caption}`.toLowerCase();
  for (const term of overpromiseTerms) {
    if (lower.includes(term)) {
      risks.push(`Possible overpromise: "${term}"`);
      score -= 0.05;
    }
  }

  // Slide count for carousels
  if (input.post.format?.includes("carousel")) {
    const count = input.post.slides?.length ?? 0;
    if (count < 3) {
      failures.push("Carousel has too few slides (< 3).");
      fixes.push("Add slides — most carousels need 5-8.");
      score -= 0.15;
    } else if (count > 12) {
      risks.push("Carousel may be too long (>12 slides). Save rate often drops past 9.");
      score -= 0.03;
    }
  }

  score = Math.max(0, Math.min(1, score));

  const status: QualityGateResult["status"] =
    failures.length === 0 && score >= 0.75 ? "pass" : score >= 0.5 ? "revise" : "fail";

  return {
    status,
    score,
    failure_reasons: failures,
    fix_instructions: fixes,
    risk_flags: risks,
    approved_for_export: status === "pass",
  };
}
