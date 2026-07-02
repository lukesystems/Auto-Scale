export interface VoiceoverAssetFields {
  metadata?: Record<string, unknown> | null;
}

export interface SilentVoiceoverGuardOptions {
  /** Run was started with allow_silent_voiceover in growth_runs.options */
  allowSilentVoiceover?: boolean;
  /** User explicitly confirmed scheduling/approving despite silent audio */
  userConfirmedOverride?: boolean;
}

export function isSilentVoiceoverAsset(asset: VoiceoverAssetFields | null | undefined): boolean {
  return asset?.metadata?.is_silent === true;
}

/**
 * Block approve/schedule when voiceover fell back to silent TTS unless overridden.
 */
export function validateSilentVoiceoverForSchedule(
  asset: VoiceoverAssetFields | null | undefined,
  opts: SilentVoiceoverGuardOptions = {}
): { ok: true } | { ok: false; error: string } {
  if (!isSilentVoiceoverAsset(asset)) {
    return { ok: true };
  }
  if (opts.allowSilentVoiceover || opts.userConfirmedOverride) {
    return { ok: true };
  }
  return {
    ok: false,
    error:
      "Silent voiceover — configure ElevenLabs or OpenAI TTS, use Regenerate voiceover, or confirm override to proceed.",
  };
}
