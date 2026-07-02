import { describe, expect, it } from "vitest";
import {
  isSilentVoiceoverAsset,
  validateSilentVoiceoverForSchedule,
} from "@/lib/schedule-guard";

describe("schedule guard — silent voiceover", () => {
  it("detects silent voiceover from asset metadata", () => {
    expect(isSilentVoiceoverAsset({ metadata: { is_silent: true } })).toBe(true);
    expect(isSilentVoiceoverAsset({ metadata: { is_silent: false } })).toBe(false);
    expect(isSilentVoiceoverAsset(null)).toBe(false);
  });

  it("blocks schedule when voiceover is silent without override", () => {
    const result = validateSilentVoiceoverForSchedule({ metadata: { is_silent: true } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Silent voiceover");
    }
  });

  it("allows schedule when voiceover is not silent", () => {
    expect(validateSilentVoiceoverForSchedule({ metadata: { is_silent: false } })).toEqual({
      ok: true,
    });
  });

  it("allows silent voiceover when run option allow_silent_voiceover is set", () => {
    expect(
      validateSilentVoiceoverForSchedule(
        { metadata: { is_silent: true } },
        { allowSilentVoiceover: true }
      )
    ).toEqual({ ok: true });
  });

  it("allows silent voiceover when user confirms override", () => {
    expect(
      validateSilentVoiceoverForSchedule(
        { metadata: { is_silent: true } },
        { userConfirmedOverride: true }
      )
    ).toEqual({ ok: true });
  });
});
