import { z } from "zod";
import type { SceneContract } from "./scene-contract";

export const SlideQualityCheckSchema = z.object({
  passed: z.boolean(),
  issues: z.array(z.string()),
  checks: z.object({
    text_not_too_long: z.boolean(),
    hook_in_first_2s: z.boolean(),
    cta_present: z.boolean(),
    subtitles_complete: z.boolean(),
    duration_in_target: z.boolean(),
    mp4_url_exists: z.boolean(),
  }),
});

export type SlideQualityCheck = z.infer<typeof SlideQualityCheckSchema>;

export interface SlideQualityInput {
  scenes: SceneContract[];
  totalDurationSeconds: number;
  targetDurationSeconds: number;
  mp4Url: string | null;
}

const MAX_CHARS_PER_SCENE = 120;
const MAX_WORDS_HOOK_OVERLAY = 12;

/**
 * Basic design quality check for fast_slides output.
 * Blocks publish when critical checks fail.
 */
export function checkSlideQuality(input: SlideQualityInput): SlideQualityCheck {
  const issues: string[] = [];
  const hookScene = input.scenes.find((s) => s.purpose === "hook");
  const ctaScene = input.scenes.find((s) => s.purpose === "cta");

  const textNotTooLong = input.scenes.every((s) => {
    const text = s.overlay_text || s.visual_prompt || s.voiceover_text;
    return text.length <= MAX_CHARS_PER_SCENE;
  });
  if (!textNotTooLong) issues.push("One or more slides exceed max text length.");

  const hookInFirst2s = hookScene ? hookScene.duration_seconds <= 2.5 : false;
  if (!hookInFirst2s) issues.push("Hook scene must be visible within the first 2 seconds.");

  const hookWords = (hookScene?.overlay_text || hookScene?.voiceover_text || "").split(/\s+/).filter(Boolean);
  if (hookWords.length > MAX_WORDS_HOOK_OVERLAY) {
    issues.push("Hook overlay has too many words for mobile safe zone.");
  }

  const ctaPresent = Boolean(ctaScene?.voiceover_text?.trim());
  if (!ctaPresent) issues.push("CTA end card is missing.");

  const subtitlesComplete = input.scenes.every(
    (s) => s.subtitle_text?.trim() || !s.voiceover_text?.trim()
  );
  if (!subtitlesComplete) issues.push("Missing subtitle lines for voiced scenes.");

  const durationMin = input.targetDurationSeconds * 0.7;
  const durationMax = input.targetDurationSeconds * 1.4;
  const durationInTarget =
    input.totalDurationSeconds >= durationMin && input.totalDurationSeconds <= durationMax;
  if (!durationInTarget) {
    issues.push(
      `Duration ${input.totalDurationSeconds}s outside target ~${input.targetDurationSeconds}s.`
    );
  }

  const mp4UrlExists = Boolean(input.mp4Url?.trim());
  if (!mp4UrlExists) issues.push("Final MP4 URL is missing.");

  const sceneCountOk = input.scenes.length >= 4 && input.scenes.length <= 7;
  if (!sceneCountOk) issues.push("Fast slides should have 4–7 scenes.");

  const checks = {
    text_not_too_long: textNotTooLong && hookWords.length <= MAX_WORDS_HOOK_OVERLAY,
    hook_in_first_2s: hookInFirst2s,
    cta_present: ctaPresent,
    subtitles_complete: subtitlesComplete,
    duration_in_target: durationInTarget && sceneCountOk,
    mp4_url_exists: mp4UrlExists,
  };

  const criticalFail =
    !checks.hook_in_first_2s || !checks.cta_present || !checks.mp4_url_exists;

  return SlideQualityCheckSchema.parse({
    passed: !criticalFail && issues.length === 0,
    issues,
    checks,
  });
}
