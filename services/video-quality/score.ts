import { z } from "zod";

export const VideoQualityScoreSchema = z.object({
  hook_strength: z.number().min(0).max(1),
  clarity: z.number().min(0).max(1),
  pacing: z.number().min(0).max(1),
  text_density: z.number().min(0).max(1),
  cta_strength: z.number().min(0).max(1),
  platform_fit: z.number().min(0).max(1),
  brand_safety: z.number().min(0).max(1),
  duplicate_risk: z.number().min(0).max(1),
  claim_risk: z.number().min(0).max(1),
  final_asset_exists: z.number().min(0).max(1),
  overall_score: z.number().min(0).max(1),
  block_reason: z.string().nullable(),
  pass_reasons: z.array(z.string()),
});

export type VideoQualityScore = z.infer<typeof VideoQualityScoreSchema>;

/** Minimum overall score to allow autopilot scheduling. */
export const MIN_SCHEDULE_QUALITY_SCORE = 0.55;

export interface ScoreVideoInput {
  hook: string;
  cta: string;
  platform: string;
  productionMode: string | null;
  scenes: Array<{
    purpose: string;
    voiceover_text?: string | null;
    subtitle_text?: string | null;
    overlay_text?: string | null;
    duration_seconds: number;
  }>;
  totalDurationSeconds: number;
  targetDurationSeconds: number;
  mp4Url: string | null;
  trendConfidence: number | null;
  missingEvidence: string[];
  slideQualityPassed: boolean | null;
  voiceQualityPenalty?: number;
  silentVoiceover?: boolean;
}

/**
 * Deterministic video quality scoring. No AI — inspectable rules.
 * Bad videos get block_reason; good videos get pass_reasons.
 */
export function scoreVideo(input: ScoreVideoInput): VideoQualityScore {
  const passReasons: string[] = [];
  const blockReasons: string[] = [];

  const hookWords = input.hook.trim().split(/\s+/).filter(Boolean).length;
  let hookStrength = 0.5;
  if (hookWords >= 4 && hookWords <= 14) {
    hookStrength = 0.85;
    passReasons.push("Hook length is punchy for short-form.");
  } else if (hookWords < 4) {
    hookStrength = 0.35;
    blockReasons.push("Hook is too short to stop the scroll.");
  } else {
    hookStrength = 0.4;
    blockReasons.push("Hook is too long for the first frame.");
  }

  const hookScene = input.scenes.find((s) => s.purpose === "hook");
  if (hookScene && hookScene.duration_seconds <= 2.5) {
    hookStrength = Math.min(1, hookStrength + 0.1);
    passReasons.push("Hook appears within the first 2 seconds.");
  } else {
    blockReasons.push("Hook not visible in first 2 seconds.");
    hookStrength *= 0.7;
  }

  const avgChars =
    input.scenes.reduce((sum, s) => {
      const t = s.overlay_text || s.voiceover_text || "";
      return sum + t.length;
    }, 0) / Math.max(input.scenes.length, 1);

  let textDensity = avgChars <= 80 ? 0.9 : avgChars <= 120 ? 0.7 : 0.35;
  if (textDensity >= 0.7) passReasons.push("Text density is readable on mobile.");
  else blockReasons.push("Slides are too text-heavy for vertical video.");

  const ctaScene = input.scenes.find((s) => s.purpose === "cta");
  let ctaStrength = input.cta.trim().length >= 3 ? 0.75 : 0.2;
  if (ctaScene?.voiceover_text?.trim()) {
    ctaStrength = Math.min(1, ctaStrength + 0.15);
    passReasons.push("CTA end card is present.");
  } else {
    blockReasons.push("No CTA scene detected.");
  }

  const durationRatio = input.totalDurationSeconds / Math.max(input.targetDurationSeconds, 1);
  let pacing = durationRatio >= 0.75 && durationRatio <= 1.35 ? 0.85 : 0.45;
  if (pacing >= 0.7) passReasons.push("Pacing matches target duration.");
  else blockReasons.push("Video duration is off-target.");

  let clarity = input.scenes.length >= 4 ? 0.8 : 0.5;
  if (input.scenes.every((s) => s.subtitle_text?.trim() || !s.voiceover_text?.trim())) {
    clarity = Math.min(1, clarity + 0.1);
    passReasons.push("Subtitles cover voiced lines.");
  } else {
    blockReasons.push("Missing subtitle lines.");
    clarity *= 0.8;
  }

  const platformFit =
    input.platform === "tiktok" || input.platform === "instagram"
      ? input.totalDurationSeconds <= 45
        ? 0.85
        : 0.5
      : 0.75;
  if (platformFit >= 0.7) passReasons.push(`Duration fits ${input.platform} norms.`);

  let brandSafety = 0.9;
  const risky = /\b(guarantee|100%|million|revolutionary|hack)\b/i;
  if (risky.test(input.hook) || risky.test(input.cta)) {
    brandSafety = 0.45;
    blockReasons.push("Hook or CTA contains high-claim language.");
  } else {
    passReasons.push("No obvious over-claim language.");
  }

  let claimRisk = 0.2;
  if ((input.trendConfidence ?? 0) < 0.4 && input.missingEvidence.length > 0) {
    claimRisk = 0.65;
    passReasons.push("Trend confidence is low — treated as hypothesis not proof.");
  }

  let duplicateRisk = 0.15;

  if (input.silentVoiceover) {
    blockReasons.push("Silent voiceover — not postable quality without TTS.");
  }

  const voicePenalty = input.voiceQualityPenalty ?? (input.silentVoiceover ? 0.25 : 0);

  const finalAssetExists = input.mp4Url ? 1 : 0;
  if (!input.mp4Url) {
    blockReasons.push("No final MP4 URL.");
  } else {
    passReasons.push("Final MP4 is available.");
  }

  const dimensions = [
    hookStrength,
    clarity,
    pacing,
    textDensity,
    ctaStrength,
    platformFit,
    brandSafety,
    1 - duplicateRisk,
    1 - claimRisk,
    finalAssetExists,
  ];
  const overallRaw = dimensions.reduce((a, b) => a + b, 0) / dimensions.length;
  const overall = Math.max(0, overallRaw - voicePenalty);

  if (input.slideQualityPassed === false) {
    blockReasons.push("Slide design quality check failed.");
  } else if (input.slideQualityPassed === true) {
    passReasons.push("Slide design quality check passed.");
  }

  const blockReason =
    !input.mp4Url
      ? "Video not rendered — no MP4 URL."
      : input.silentVoiceover
        ? "Silent voiceover — configure ElevenLabs or OpenAI TTS."
      : overall < MIN_SCHEDULE_QUALITY_SCORE
        ? blockReasons[0] ?? `Overall score ${overall.toFixed(2)} below minimum ${MIN_SCHEDULE_QUALITY_SCORE}.`
        : blockReasons.length && hookStrength < 0.4
          ? blockReasons.join(" ")
          : null;

  return VideoQualityScoreSchema.parse({
    hook_strength: round(hookStrength),
    clarity: round(clarity),
    pacing: round(pacing),
    text_density: round(textDensity),
    cta_strength: round(ctaStrength),
    platform_fit: round(platformFit),
    brand_safety: round(brandSafety),
    duplicate_risk: round(duplicateRisk),
    claim_risk: round(claimRisk),
    final_asset_exists: round(finalAssetExists),
    overall_score: round(overall),
    block_reason: blockReason,
    pass_reasons: passReasons,
  });
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function isSchedulable(score: VideoQualityScore): boolean {
  return score.block_reason === null && score.overall_score >= MIN_SCHEDULE_QUALITY_SCORE;
}
