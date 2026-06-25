import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { buildGrowthRunExportZip } from "@/services/export/growth-run-pack";
import { isFfmpegAvailable } from "@/services/video-factory/ffmpeg";
import { resolvePostizCredentials } from "@/lib/postiz-credentials";
import { getProviderModeForUser } from "@/lib/provider-mode";
import { runCompound } from "@/services/compound/classify";

export type VerifyStepStatus = "pass" | "fail" | "skip" | "warn";

export interface VerifyStepResult {
  step: number;
  name: string;
  status: VerifyStepStatus;
  detail: string;
  table?: string;
  service?: string;
  route?: string;
}

export interface VerifyGrowthRunReport {
  growthRunId: string;
  projectId: string;
  passed: boolean;
  failedStep: number | null;
  steps: VerifyStepResult[];
  environment: {
    supabase: boolean;
    ffmpeg: boolean;
    postiz: boolean;
  };
}

const STEPS = [
  "product_brief",
  "video_trend_report",
  "format_fingerprints",
  "controlled_experiments",
  "trend_receipts",
  "video_concepts",
  "scene_plans",
  "production_jobs_assets",
  "final_mp4",
  "video_ready_status",
  "quality_score",
  "export_pack",
  "postiz_skip_safe",
  "tracking_links",
  "compound_classifier",
] as const;

export async function verifyGrowthRun(opts: {
  projectId: string;
  growthRunId: string;
  ownerId?: string;
  useServiceRole?: boolean;
}): Promise<VerifyGrowthRunReport> {
  const supabase = opts.useServiceRole
    ? createSupabaseAdminClient()
    : createSupabaseServerClient();

  const steps: VerifyStepResult[] = [];
  let failedStep: number | null = null;

  const postiz =
    opts.ownerId != null
      ? Boolean(
          await resolvePostizCredentials(
            opts.ownerId,
            await getProviderModeForUser(opts.ownerId)
          )
        )
      : false;

  const env = {
    supabase: true,
    ffmpeg: isFfmpegAvailable(),
    postiz,
  };

  function record(
    index: number,
    status: VerifyStepStatus,
    detail: string,
    meta?: { table?: string; service?: string; route?: string }
  ) {
    const step: VerifyStepResult = {
      step: index + 1,
      name: STEPS[index] ?? `step_${index + 1}`,
      status,
      detail,
      ...meta,
    };
    steps.push(step);
    if (status === "fail" && failedStep === null) failedStep = index + 1;
  }

  // 1. Product brief
  const { data: brief } = await supabase
    .from("product_briefs")
    .select("id, product_summary, target_customer")
    .eq("project_id", opts.projectId)
    .maybeSingle();
  if (brief?.product_summary && brief?.target_customer) {
    record(0, "pass", "Product brief exists with summary and target customer.", {
      table: "product_briefs",
    });
  } else {
    record(0, "fail", "Product brief missing or incomplete (need product_summary + target_customer).", {
      table: "product_briefs",
      route: `/projects/${opts.projectId}/brief`,
    });
  }

  // 2. VideoTrend report
  const { data: trend } = await supabase
    .from("video_trend_reports")
    .select("id, confidence, winning_structures")
    .eq("growth_run_id", opts.growthRunId)
    .maybeSingle();
  if (trend?.id) {
    const structures = Array.isArray(trend.winning_structures) ? trend.winning_structures.length : 0;
    record(1, "pass", `VideoTrend report exists (confidence ${trend.confidence}, ${structures} structures).`, {
      table: "video_trend_reports",
      service: "services/videotrend/generate.ts",
    });
  } else {
    record(1, "fail", "No video_trend_reports row for this growth run.", {
      table: "video_trend_reports",
      service: "services/videotrend/generate.ts",
    });
  }

  // 3. Format fingerprints
  const { data: fingerprints, count: fpCount } = await supabase
    .from("format_fingerprints")
    .select("id", { count: "exact" })
    .eq("growth_run_id", opts.growthRunId);
  if ((fpCount ?? fingerprints?.length ?? 0) > 0) {
    record(2, "pass", `${fpCount ?? fingerprints!.length} format fingerprint(s) found.`, {
      table: "format_fingerprints",
      service: "services/video-factory/concepts.ts",
    });
  } else {
    record(2, "fail", "No format_fingerprints for this run.", {
      table: "format_fingerprints",
      service: "services/video-factory/concepts.ts",
    });
  }

  // 4. Controlled experiments
  const { count: expCount } = await supabase
    .from("controlled_experiments")
    .select("id", { count: "exact", head: true })
    .eq("growth_run_id", opts.growthRunId);
  if ((expCount ?? 0) > 0) {
    record(3, "pass", `${expCount} controlled experiment(s) found.`, {
      table: "controlled_experiments",
    });
  } else {
    record(3, "fail", "No controlled_experiments for this run.", {
      table: "controlled_experiments",
    });
  }

  // 5. Trend receipts
  const { count: receiptCount } = await supabase
    .from("trend_receipts")
    .select("id", { count: "exact", head: true })
    .eq("growth_run_id", opts.growthRunId);
  if ((receiptCount ?? 0) > 0) {
    record(4, "pass", `${receiptCount} trend receipt(s) linked to concepts.`, {
      table: "trend_receipts",
    });
  } else {
    record(4, "fail", "No trend_receipts for this run.", { table: "trend_receipts" });
  }

  // 6. Video concepts
  const { data: concepts, count: conceptCount } = await supabase
    .from("video_concepts")
    .select("id", { count: "exact" })
    .eq("growth_run_id", opts.growthRunId);
  if ((conceptCount ?? concepts?.length ?? 0) > 0) {
    record(5, "pass", `${conceptCount ?? concepts!.length} video concept(s) found.`, {
      table: "video_concepts",
    });
  } else {
    record(5, "fail", "No video_concepts for this run.", { table: "video_concepts" });
  }

  const conceptIds = (concepts ?? []).map((c) => c.id);

  // 7. Scene plans (storyboard scenes with purpose)
  let scenePlanOk = 0;
  for (const cid of conceptIds) {
    const { data: board } = await supabase
      .from("storyboards")
      .select("id")
      .eq("concept_id", cid)
      .maybeSingle();
    if (!board?.id) continue;
    const { count } = await supabase
      .from("storyboard_scenes")
      .select("id", { count: "exact", head: true })
      .eq("storyboard_id", board.id);
    if ((count ?? 0) >= 4) scenePlanOk++;
  }
  if (conceptIds.length && scenePlanOk === conceptIds.length) {
    record(6, "pass", `Scene plans with 4+ scenes for all ${conceptIds.length} concepts.`, {
      table: "storyboard_scenes",
      service: "services/video-factory/scene-plan.ts",
    });
  } else if (scenePlanOk > 0) {
    record(
      6,
      "fail",
      `Partial scene plans: ${scenePlanOk}/${conceptIds.length} concepts have 4+ scenes.`,
      { table: "storyboard_scenes" }
    );
  } else {
    record(6, "fail", "No scene plans found.", {
      table: "storyboard_scenes",
      service: "services/video-factory/scene-plan.ts",
    });
  }

  // 8. Production jobs + assets
  const { count: jobCount } = await supabase
    .from("video_production_jobs")
    .select("id", { count: "exact", head: true })
    .eq("growth_run_id", opts.growthRunId);
  const { count: assetCount } = await supabase
    .from("generated_assets")
    .select("id", { count: "exact", head: true })
    .eq("growth_run_id", opts.growthRunId);
  const { data: videos } = await supabase
    .from("videos")
    .select("id, status, final_asset_id")
    .eq("growth_run_id", opts.growthRunId);
  if ((jobCount ?? 0) > 0 && (assetCount ?? 0) > 0 && (videos?.length ?? 0) > 0) {
    record(
      7,
      "pass",
      `${jobCount} production job(s), ${assetCount} asset row(s), ${videos!.length} video(s).`,
      {
        table: "video_production_jobs, generated_assets, videos",
        service: "services/video-factory/production-job.ts",
      }
    );
  } else {
    record(7, "fail", "Missing production jobs, generated_assets, or videos.", {
      table: "video_production_jobs, generated_assets, videos",
      service: "services/video-factory/index.ts",
    });
  }

  // 9. Final MP4
  let mp4Count = 0;
  for (const v of videos ?? []) {
    if (!v.final_asset_id) continue;
    const { data: asset } = await supabase
      .from("generated_assets")
      .select("public_url, status, kind")
      .eq("id", v.final_asset_id)
      .maybeSingle();
    if (asset?.kind === "final_mp4" && asset.status === "succeeded" && asset.public_url) {
      mp4Count++;
    }
  }
  if (mp4Count > 0) {
    record(8, "pass", `${mp4Count} final MP4(s) with public URL.`, {
      table: "generated_assets",
      service: "services/video-factory/render-concept.ts",
    });
  } else if (!env.ffmpeg) {
    record(8, "fail", "No final MP4 — ffmpeg not available in this environment.", {
      table: "generated_assets",
      service: "services/video-factory/ffmpeg.ts",
    });
  } else {
    record(8, "fail", "No succeeded final_mp4 assets with public_url.", {
      table: "generated_assets",
    });
  }

  // 10. Video ready status
  const readyCount = (videos ?? []).filter((v) => v.status === "ready").length;
  if (readyCount > 0) {
    record(9, "pass", `${readyCount} video(s) in ready status.`, { table: "videos" });
  } else {
    record(9, "fail", `No videos with status=ready (found: ${(videos ?? []).map((v) => v.status).join(", ") || "none"}).`, {
      table: "videos",
    });
  }

  // 11. Quality score
  let qualityOk = 0;
  for (const v of videos ?? []) {
    const { data: q } = await supabase
      .from("video_quality_scores")
      .select("overall_score")
      .eq("video_id", v.id)
      .maybeSingle();
    if (q?.overall_score != null) qualityOk++;
  }
  if (readyCount > 0 && qualityOk >= readyCount) {
    record(10, "pass", `Quality scores for ${qualityOk} video(s).`, {
      table: "video_quality_scores",
      service: "services/video-quality/score.ts",
    });
  } else if (qualityOk > 0) {
    record(10, "fail", `Partial quality scores: ${qualityOk}/${videos?.length ?? 0}.`, {
      table: "video_quality_scores",
      service: "services/video-quality/score.ts",
    });
  } else {
    record(10, "fail", "No video_quality_scores rows.", {
      table: "video_quality_scores",
      service: "services/video-quality/score.ts",
    });
  }

  // 12. Export pack
  try {
    const exportVideos = [];
    for (const v of videos ?? []) {
      const { data: vrow } = await supabase
        .from("videos")
        .select("concept_id")
        .eq("id", v.id)
        .single();
      const { data: concept } = vrow?.concept_id
        ? await supabase
            .from("video_concepts")
            .select("hook, platform, video_type")
            .eq("id", vrow.concept_id)
            .maybeSingle()
        : { data: null };
      const { data: asset } = v.final_asset_id
        ? await supabase
            .from("generated_assets")
            .select("public_url")
            .eq("id", v.final_asset_id)
            .maybeSingle()
        : { data: null };
      exportVideos.push({
        videoId: v.id,
        conceptId: vrow?.concept_id ?? "",
        platform: concept?.platform ?? "tiktok",
        videoType: concept?.video_type ?? "slide",
        hook: concept?.hook ?? "",
        caption: "",
        hashtags: [],
        mediaUrl: asset?.public_url ?? null,
        scheduledFor: null,
        accountHandle: null,
      });
    }
    const zip = await buildGrowthRunExportZip({
      projectName: "verify",
      growthRunId: opts.growthRunId,
      videos: exportVideos,
    });
    if (zip.byteLength > 100) {
      record(11, "pass", `Export pack builds (${zip.byteLength} bytes).`, {
        service: "services/export/growth-run-pack.ts",
        route: `/api/projects/${opts.projectId}/growth/${opts.growthRunId}/export`,
      });
    } else {
      record(11, "fail", "Export pack returned empty buffer.", {
        service: "services/export/growth-run-pack.ts",
      });
    }
  } catch (err) {
    record(11, "fail", `Export pack error: ${err instanceof Error ? err.message : String(err)}`, {
      service: "services/export/growth-run-pack.ts",
    });
  }

  // 13. Postiz skip safe
  if (!postiz) {
    record(12, "skip", "Postiz not configured — scheduling safely falls back to export queue.", {
      service: "services/postiz/multi-account.ts",
    });
  } else {
    record(12, "pass", "Postiz credentials present.", { service: "lib/postiz-credentials.ts" });
  }

  // 14. Tracking links
  const { count: linkCount } = await supabase
    .from("tracked_links")
    .select("id", { count: "exact", head: true })
    .eq("growth_run_id", opts.growthRunId);
  if ((linkCount ?? 0) > 0) {
    record(13, "pass", `${linkCount} tracked link(s) exist for this run.`, {
      table: "tracked_links",
      service: "services/tracking/links.ts",
    });
  } else {
    record(
      13,
      linkCount === 0 && readyCount === 0 ? "skip" : "warn",
      "No tracked_links yet — minted at schedule time.",
      { table: "tracked_links", service: "services/tracking/links.ts" }
    );
  }

  // 15. Compound classifier dry run
  if (opts.ownerId) {
    try {
      const result = await runCompound({
        growthRunId: opts.growthRunId,
        projectId: opts.projectId,
        ownerId: opts.ownerId,
        trustedServiceRole: opts.useServiceRole,
      });
      record(
        14,
        "pass",
        `Compound classifier ran without crash (classified=${result.classifiedCount}).`,
        { service: "services/compound/classify.ts" }
      );
    } catch (err) {
      record(14, "fail", `Compound crashed: ${err instanceof Error ? err.message : String(err)}`, {
        service: "services/compound/classify.ts",
      });
    }
  } else {
    record(14, "skip", "ownerId not provided — compound step skipped.", {
      service: "services/compound/classify.ts",
    });
  }

  const passed = !steps.some((s) => s.status === "fail");

  return {
    growthRunId: opts.growthRunId,
    projectId: opts.projectId,
    passed,
    failedStep,
    steps,
    environment: env,
  };
}

export function formatVerifyReport(report: VerifyGrowthRunReport): string {
  const lines = [
    `Growth Run Verification: ${report.growthRunId}`,
    `Project: ${report.projectId}`,
    `Result: ${report.passed ? "PASS" : "FAIL"}${report.failedStep ? ` (failed at step ${report.failedStep})` : ""}`,
    `Environment: supabase=${report.environment.supabase} ffmpeg=${report.environment.ffmpeg} postiz=${report.environment.postiz}`,
    "",
    ...report.steps.map(
      (s) =>
        `[${s.status.toUpperCase()}] Step ${s.step}: ${s.name} — ${s.detail}` +
        (s.table ? ` | table: ${s.table}` : "") +
        (s.service ? ` | service: ${s.service}` : "")
    ),
  ];
  return lines.join("\n");
}
