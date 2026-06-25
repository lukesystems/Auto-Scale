import "server-only";

import { synthesizeWithProvider } from "@/services/voiceover/provider";

/**
 * Generate voiceover audio via ElevenLabs → OpenAI → silent dev fallback.
 */
export async function synthesizeVoiceover(opts: {
  scriptText: string;
  durationSeconds: number;
}): Promise<Buffer> {
  const result = await synthesizeWithProvider(opts);
  return result.buffer;
}

export async function synthesizeVoiceoverWithMeta(opts: {
  scriptText: string;
  durationSeconds: number;
}) {
  return synthesizeWithProvider(opts);
}
