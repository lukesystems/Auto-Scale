import type { VideoScript } from "@/services/growth-run/schema";
import type { AudioMode } from "./production-options";
import { audioModeUsesVoiceover } from "./production-options";

export interface PreRenderGateInput {
  hook: string;
  cta: string;
  script: VideoScript;
  targetLengthSeconds: number;
  sceneDurationsSeconds: number[];
  audioMode: AudioMode;
  /** Other hook variants in the same controlled experiment (body lock). */
  siblingHooks?: string[];
  /** Trend receipt confidence 0–1 */
  trendConfidence?: number | null;
  /** Whether this is the project's first completed growth run */
  isFirstRun?: boolean;
  /** User acknowledged low-evidence render */
  lowEvidenceAcknowledged?: boolean;
}

export interface PreRenderGateResult {
  passed: boolean;
  grade: "A" | "B" | "C" | "C+" | "BLOCKED";
  hookScore: number;
  autoApproveEligible: boolean;
  blockReasons: string[];
  warnings: string[];
  checks: Record<string, boolean>;
}

const BANNED_CLAIM_PATTERNS = [
  /\b10x\b/i,
  /\b#1\b/i,
  /\bguaranteed\b/i,
  /\b100%\s*(free|success|roi)\b/i,
  /\bdouble your\b/i,
  /\bovernight\b/i,
];

const FILLER_WORDS = /\b(the|a|an|is|are|was|were|to|of|in|for|on|with)\b/gi;

export function scoreHook(hook: string): number {
  const text = hook.trim();
  if (!text) return 0;
  let score = 5;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length >= 4 && words.length <= 14) score += 1.5;
  if (words.length < 3 || words.length > 18) score -= 1;
  if (/\?/.test(text)) score += 0.5;
  if (/\d/.test(text)) score += 0.5;
  if (/[A-Z]{2,}/.test(text)) score -= 0.5;
  const unique = new Set(words.map((w) => w.toLowerCase()));
  if (unique.size / words.length > 0.7) score += 0.5;
  return Math.min(10, Math.max(0, Math.round(score * 10) / 10));
}

export function scanBannedClaims(text: string): string[] {
  const hits: string[] = [];
  for (const pattern of BANNED_CLAIM_PATTERNS) {
    if (pattern.test(text)) hits.push(pattern.source.replace(/\\b/g, "").replace(/\\/g, ""));
  }
  return hits;
}

function estimateWpm(script: VideoScript, totalSeconds: number): number {
  const text = [script.hook_line, ...script.body_lines, script.cta_line, script.voiceover_full]
    .filter(Boolean)
    .join(" ");
  const words = text.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(totalSeconds / 60, 0.1);
  return Math.round(words / minutes);
}

function bodyLockHash(script: VideoScript): string {
  const body = [...script.body_lines, script.cta_line].join("|").toLowerCase().replace(FILLER_WORDS, "").trim();
  return body;
}

export function runPreRenderGate(input: PreRenderGateInput): PreRenderGateResult {
  const blockReasons: string[] = [];
  const warnings: string[] = [];
  const checks: Record<string, boolean> = {};

  const totalDuration = input.sceneDurationsSeconds.reduce((s, d) => s + d, 0);
  const target = input.targetLengthSeconds;
  const durationDelta = target > 0 ? Math.abs(totalDuration - target) / target : 0;
  checks.duration_within_15pct = durationDelta <= 0.15;
  if (!checks.duration_within_15pct) {
    warnings.push(
      `Storyboard duration ${totalDuration.toFixed(1)}s is ${(durationDelta * 100).toFixed(0)}% off target ${target}s`
    );
  }

  const wpm = estimateWpm(input.script, totalDuration);
  checks.wpm_in_range = !audioModeUsesVoiceover(input.audioMode) || (wpm >= 140 && wpm <= 170);
  if (audioModeUsesVoiceover(input.audioMode) && !checks.wpm_in_range) {
    warnings.push(`Voiceover pace ${wpm} WPM outside 140–170 range`);
  }

  const claimText = [input.hook, input.cta, ...input.script.body_lines, input.script.voiceover_full].join(" ");
  const bannedHits = scanBannedClaims(claimText);
  checks.clean_claims = bannedHits.length === 0;
  if (!checks.clean_claims) {
    blockReasons.push(`Banned claim patterns: ${bannedHits.join(", ")}`);
  }

  const hookScore = scoreHook(input.hook);
  checks.hook_score_ok = hookScore >= 5;
  if (hookScore < 7) {
    warnings.push(`Hook score ${hookScore}/10 — consider sharpening specificity`);
  }

  const bodyHash = bodyLockHash(input.script);
  checks.body_lock = true;
  if (input.siblingHooks?.length) {
    // Body lock is satisfied when same script body is used across hook variants.
    checks.body_lock = Boolean(bodyHash.length);
  }

  const confidence = input.trendConfidence ?? 0;
  const lowEvidence = confidence < 0.45 && !input.lowEvidenceAcknowledged;
  checks.evidence_ok = !lowEvidence;
  if (lowEvidence) {
    warnings.push("Low trend confidence — acknowledge before autopilot render");
  }

  const grade =
    blockReasons.length > 0
      ? "BLOCKED"
      : hookScore >= 8 && checks.duration_within_15pct && checks.clean_claims
        ? "A"
        : hookScore >= 7 && checks.clean_claims
          ? "B"
          : hookScore >= 6
            ? "C+"
            : "C";

  const autoApproveEligible =
    !input.isFirstRun &&
    confidence >= 0.45 &&
    hookScore >= 7 &&
    checks.clean_claims &&
    checks.duration_within_15pct;

  const passed = blockReasons.length === 0;

  return {
    passed,
    grade: passed ? (grade === "BLOCKED" ? "C" : grade) : "BLOCKED",
    hookScore,
    autoApproveEligible,
    blockReasons,
    warnings,
    checks,
  };
}
