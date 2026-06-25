import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getRenderProfile, type PlatformProfile } from "./render-profiles";
import { assembleVideoToBuffer } from "./assembler";
import { uploadGrowthMedia } from "./storage";

type Client = SupabaseClient<Database>;

const PLATFORM_TO_PROFILE: Record<string, PlatformProfile> = {
  tiktok: "tiktok",
  instagram: "instagram_reels",
  youtube: "youtube_shorts",
};

export async function upsertPlatformVariants(opts: {
  client: Client;
  projectId: string;
  growthRunId: string;
  videoId: string;
  conceptId: string;
  platform: string;
  mp4Buffer: Buffer;
  durationSeconds: number;
  targetPlatforms?: string[];
}): Promise<void> {
  const platforms =
    opts.targetPlatforms?.length
      ? opts.targetPlatforms
      : [opts.platform];

  const uniquePlatforms = [...new Set(platforms)];

  for (const p of uniquePlatforms) {
    const profileKey = PLATFORM_TO_PROFILE[p] ?? "tiktok";
    const profile = getRenderProfile(p);

    const { data: variantRow } = await opts.client
      .from("platform_video_variants")
      .upsert(
        {
          project_id: opts.projectId,
          growth_run_id: opts.growthRunId,
          video_id: opts.videoId,
          concept_id: opts.conceptId,
          platform: p as "tiktok" | "instagram" | "youtube",
          render_profile: profileKey,
          duration_seconds: opts.durationSeconds,
          width: profile.width,
          height: profile.height,
          status: "rendering",
        } as never,
        { onConflict: "video_id,platform" }
      )
      .select("id")
      .single();

    const { storagePath, publicUrl } = await uploadGrowthMedia({
      projectId: opts.projectId,
      growthRunId: opts.growthRunId,
      conceptId: opts.conceptId,
      filename: `${profile.fileNamePrefix}-final.mp4`,
      body: opts.mp4Buffer,
      contentType: "video/mp4",
    });

    const { data: asset } = await opts.client
      .from("generated_assets")
      .insert({
        project_id: opts.projectId,
        growth_run_id: opts.growthRunId,
        concept_id: opts.conceptId,
        kind: "final_mp4",
        provider: "ffmpeg",
        storage_path: storagePath,
        public_url: publicUrl,
        duration_seconds: opts.durationSeconds,
        status: "succeeded",
        metadata: { platform: p, render_profile: profileKey },
      } as never)
      .select("id")
      .single();

    await opts.client
      .from("platform_video_variants")
      .update({
        final_asset_id: asset?.id ?? null,
        public_url: publicUrl,
        status: "ready",
      } as never)
      .eq("id", variantRow?.id ?? "");
  }
}

export async function getPlatformVariantUrl(
  client: Client,
  videoId: string,
  platform: string
): Promise<string | null> {
  const { data } = await client
    .from("platform_video_variants")
    .select("public_url, status")
    .eq("video_id", videoId)
    .eq("platform", platform as "tiktok" | "instagram" | "youtube")
    .maybeSingle();
  if (data?.status === "ready" && data.public_url) return data.public_url;
  return null;
}
