import "server-only";

import { z } from "zod";

export const EmbeddableLicenseSchema = z.enum([
  "cleared",
  "royalty_free",
  "user_owned",
]);

export function canEmbedInRenderedMp4(licenseStatus: string): boolean {
  return EmbeddableLicenseSchema.safeParse(licenseStatus).success;
}

export function nativeSoundNote(platform: string): string {
  return `Add this native ${platform} sound manually in the app after posting. AutoScale does not embed unlicensed trending sounds in rendered MP4s.`;
}
