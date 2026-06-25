import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

const EMBEDDABLE_LICENSES = new Set(["cleared", "royalty_free", "user_owned"]);

export function canEmbedInRenderedMp4(licenseStatus: string): boolean {
  return EMBEDDABLE_LICENSES.has(licenseStatus);
}

export async function pickBackgroundMusic(
  client: Client,
  projectId: string
): Promise<{ id: string; fileUrl: string } | null> {
  const { data } = await client
    .from("audio_assets")
    .select("id, file_url, license_status, source_type")
    .or(`project_id.eq.${projectId},project_id.is.null`)
    .in("license_status", ["cleared", "royalty_free", "user_owned"])
    .in("source_type", ["licensed", "royalty_free", "uploaded"])
    .not("file_url", "is", null)
    .limit(5);

  const row = (data ?? []).find((a) => a.file_url && canEmbedInRenderedMp4(a.license_status));
  if (!row?.file_url) return null;
  return { id: row.id, fileUrl: row.file_url };
}

export function nativeSoundNote(platform: string): string {
  return `Add a native ${platform} trending sound manually in the app after posting. AutoScale does not embed unlicensed platform sounds in rendered MP4s.`;
}
