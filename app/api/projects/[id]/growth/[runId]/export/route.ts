import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  buildGrowthRunExportZip,
  type GrowthRunExportVideo,
} from "@/services/export/growth-run-pack";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; runId: string } }
) {
  if (!isSupabaseConfigured()) {
    return new NextResponse("Supabase not configured.", { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Not signed in.", { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", params.id)
    .maybeSingle();
  if (!project) return new NextResponse("Project not found.", { status: 404 });

  const { data: run } = await supabase
    .from("growth_runs")
    .select("id")
    .eq("id", params.runId)
    .eq("project_id", params.id)
    .maybeSingle();
  if (!run) return new NextResponse("Growth run not found.", { status: 404 });

  const [videosRes, conceptsRes, captionsRes, scheduleRes, accountsRes] =
    await Promise.all([
      supabase
        .from("videos")
        .select("id, concept_id, status, approval_status, final_asset_id")
        .eq("growth_run_id", params.runId)
        .order("created_at"),
      supabase
        .from("video_concepts")
        .select("id, platform, video_type, hook")
        .eq("growth_run_id", params.runId),
      supabase.from("video_captions").select("video_id, caption, hashtags"),
      supabase
        .from("schedule_items")
        .select("video_id, platform, scheduled_for, connected_account_id")
        .eq("growth_run_id", params.runId),
      supabase
        .from("connected_accounts")
        .select("id, handle")
        .eq("project_id", params.id),
    ]);

  const videos = videosRes.data ?? [];
  if (videos.length === 0) {
    return new NextResponse("No videos to export.", { status: 400 });
  }

  const videoIds = videos.map((v) => v.id);
  const assetIds = videos.map((v) => v.final_asset_id).filter((id): id is string => Boolean(id));

  const { data: assetsData } = assetIds.length
    ? await supabase
        .from("generated_assets")
        .select("id, status, public_url")
        .in("id", assetIds)
        .eq("kind", "final_mp4")
    : { data: [] as Array<{ id: string; status: string; public_url: string | null }> };

  const conceptsById = new Map((conceptsRes.data ?? []).map((c) => [c.id, c]));
  const captionsByVideo = new Map(
    (captionsRes.data ?? [])
      .filter((c) => videoIds.includes(c.video_id))
      .map((c) => [c.video_id, c])
  );
  const assetById = new Map((assetsData ?? []).map((a) => [a.id, a]));
  const scheduleByVideo = new Map((scheduleRes.data ?? []).map((s) => [s.video_id, s]));
  const accountById = new Map((accountsRes.data ?? []).map((a) => [a.id, a]));

  const exportVideos: GrowthRunExportVideo[] = videos
    .filter(
      (v) =>
        v.approval_status === "approved" ||
        v.approval_status === "auto_approved" ||
        v.status === "ready"
    )
    .map((v) => {
      const concept = v.concept_id ? conceptsById.get(v.concept_id) : undefined;
      const caption = captionsByVideo.get(v.id);
      const asset = v.final_asset_id ? assetById.get(v.final_asset_id) : undefined;
      const schedule = scheduleByVideo.get(v.id);
      const account = schedule?.connected_account_id
        ? accountById.get(schedule.connected_account_id)
        : undefined;
      return {
        videoId: v.id,
        conceptId: v.concept_id ?? "",
        platform: concept?.platform ?? schedule?.platform ?? "tiktok",
        videoType: concept?.video_type ?? "slide",
        hook: concept?.hook ?? "",
        caption: caption?.caption ?? "",
        hashtags: (caption?.hashtags as string[] | null) ?? [],
        mediaUrl:
          asset?.status === "succeeded" && asset.public_url ? asset.public_url : null,
        scheduledFor: schedule?.scheduled_for ?? null,
        accountHandle: account?.handle ?? null,
      };
    });

  if (exportVideos.length === 0) {
    return new NextResponse("No approved or ready videos to export.", { status: 400 });
  }

  const zipData = await buildGrowthRunExportZip({
    projectName: project.name,
    growthRunId: params.runId,
    videos: exportVideos,
  });

  const slug = project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "project";
  return new NextResponse(new Uint8Array(zipData), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slug}-growth-run-${params.runId.slice(0, 8)}.zip"`,
    },
  });
}
