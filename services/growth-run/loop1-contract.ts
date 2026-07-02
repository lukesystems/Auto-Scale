import { buildGrowthRunExportZip, type GrowthRunExportVideo } from "@/services/export/growth-run-pack";

export type Loop1CheckStatus = "pass" | "warn" | "fail";

export interface Loop1Check {
  group: string;
  name: string;
  status: Loop1CheckStatus;
  detail: string;
}

export interface Loop1ContractReport {
  projectId: string;
  growthRunId: string;
  passed: boolean;
  checks: Loop1Check[];
  summary: {
    evidenceCount: number;
    conceptCount: number;
    receiptCount: number;
    readyVideoCount: number;
    exportableVideoCount: number;
    scheduledCount: number;
    metricCount: number;
    trackedLinkCount: number;
    overSlaCount: number;
  };
}

type QueryClient = {
  from(table: string): any;
};

interface VerifyLoop1ContractOptions {
  client: QueryClient;
  projectId: string;
  growthRunId: string;
  projectName?: string;
  targetVideos?: number;
  stageSlaMs?: number;
  requireMetrics?: boolean;
}

interface VideoRow {
  id: string;
  concept_id: string | null;
  status: string;
  approval_status: string;
  final_asset_id: string | null;
}

interface AssetRow {
  id: string;
  status: string;
  public_url: string | null;
  kind: string;
}

interface ConceptRow {
  id: string;
  platform?: string | null;
  video_type?: string | null;
  hook?: string | null;
  hypothesis?: string | null;
  evidence_video_ids?: unknown;
}

interface CaptionRow {
  video_id: string;
  caption: string | null;
  hashtags: unknown;
}

interface ScheduleRow {
  video_id: string;
  platform: string | null;
  scheduled_for: string | null;
}

interface SlaRow {
  phase: string;
  status: string;
  duration_ms: number | null;
}

export function isReadyOrApprovedVideo(video: Pick<VideoRow, "status" | "approval_status">): boolean {
  return (
    video.status === "ready" ||
    video.status === "approved" ||
    video.approval_status === "approved" ||
    video.approval_status === "auto_approved"
  );
}

export function countExportableVideos(videos: VideoRow[], assetsById: Map<string, AssetRow>): number {
  return videos.filter((video) => {
    if (!isReadyOrApprovedVideo(video) || !video.final_asset_id) return false;
    const asset = assetsById.get(video.final_asset_id);
    return asset?.kind === "final_mp4" && asset.status === "succeeded" && Boolean(asset.public_url);
  }).length;
}

export function evaluateSlaRows(rows: SlaRow[], stageSlaMs: number): {
  overSla: SlaRow[];
  completed: SlaRow[];
  missingDuration: SlaRow[];
} {
  const completed = rows.filter((row) => row.status === "succeeded" || row.status === "skipped");
  const missingDuration = completed.filter((row) => row.status === "succeeded" && row.duration_ms == null);
  const overSla = completed.filter(
    (row) => typeof row.duration_ms === "number" && row.duration_ms > stageSlaMs
  );
  return { overSla, completed, missingDuration };
}

function add(checks: Loop1Check[], group: string, name: string, status: Loop1CheckStatus, detail: string) {
  checks.push({ group, name, status, detail });
}

function jsonArrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asCount(data: unknown[] | null | undefined, count: number | null | undefined): number {
  return count ?? data?.length ?? 0;
}

export async function verifyLoop1Contract(
  opts: VerifyLoop1ContractOptions
): Promise<Loop1ContractReport> {
  const targetVideos = opts.targetVideos ?? 3;
  const stageSlaMs = opts.stageSlaMs ?? 60_000;
  const checks: Loop1Check[] = [];

  const { data: run, error: runError } = await opts.client
    .from("growth_runs")
    .select("id, project_id, phase, status")
    .eq("id", opts.growthRunId)
    .eq("project_id", opts.projectId)
    .maybeSingle();
  if (runError || !run) {
    add(checks, "run", "growth run", "fail", runError?.message ?? "growth run not found");
    return {
      projectId: opts.projectId,
      growthRunId: opts.growthRunId,
      passed: false,
      checks,
      summary: {
        evidenceCount: 0,
        conceptCount: 0,
        receiptCount: 0,
        readyVideoCount: 0,
        exportableVideoCount: 0,
        scheduledCount: 0,
        metricCount: 0,
        trackedLinkCount: 0,
        overSlaCount: 0,
      },
    };
  }
  add(checks, "run", "growth run", "pass", `found (${run.phase ?? "unknown phase"})`);

  const [
    evidenceRes,
    trendRes,
    experimentsRes,
    receiptsRes,
    conceptsRes,
    videosRes,
    schedulesRes,
    captionsRes,
    slaRes,
  ] = await Promise.all([
    opts.client
      .from("video_evidence")
      .select("id", { count: "exact", head: true })
      .eq("project_id", opts.projectId)
      .eq("fetch_status", "success"),
    opts.client
      .from("video_trend_reports")
      .select("id, evidence_video_ids, recommended_experiments", { count: "exact" })
      .eq("growth_run_id", opts.growthRunId),
    opts.client
      .from("controlled_experiments")
      .select("id, hypothesis", { count: "exact" })
      .eq("growth_run_id", opts.growthRunId),
    opts.client
      .from("trend_receipts")
      .select("id, concept_id, evidence_video_ids", { count: "exact" })
      .eq("growth_run_id", opts.growthRunId),
    opts.client
      .from("video_concepts")
      .select("id, platform, video_type, hook, hypothesis, evidence_video_ids", { count: "exact" })
      .eq("growth_run_id", opts.growthRunId),
    opts.client
      .from("videos")
      .select("id, concept_id, status, approval_status, final_asset_id")
      .eq("growth_run_id", opts.growthRunId),
    opts.client
      .from("schedule_items")
      .select("id, video_id, platform, scheduled_for", { count: "exact" })
      .eq("growth_run_id", opts.growthRunId),
    opts.client.from("video_captions").select("video_id, caption, hashtags").eq("project_id", opts.projectId),
    opts.client
      .from("growth_run_sla_events")
      .select("phase, status, duration_ms")
      .eq("growth_run_id", opts.growthRunId),
  ]);

  const trendReports = trendRes.data ?? [];
  const experiments = experimentsRes.data ?? [];
  const receipts = receiptsRes.data ?? [];
  const concepts = (conceptsRes.data ?? []) as ConceptRow[];
  const videos = (videosRes.data ?? []) as VideoRow[];
  const schedules = (schedulesRes.data ?? []) as ScheduleRow[];
  const captions = (captionsRes.data ?? []) as CaptionRow[];
  const slaRows = (slaRes.data ?? []) as SlaRow[];

  const evidenceFromTrend = trendReports.reduce(
    (sum: number, report: { evidence_video_ids?: unknown }) => sum + jsonArrayLength(report.evidence_video_ids),
    0
  );
  const evidenceFromReceipts = receipts.reduce(
    (sum: number, receipt: { evidence_video_ids?: unknown }) => sum + jsonArrayLength(receipt.evidence_video_ids),
    0
  );
  const evidenceCount = Math.max(asCount(evidenceRes.data, evidenceRes.count), evidenceFromTrend, evidenceFromReceipts);

  if (evidenceCount > 0) {
    add(checks, "evidence", "source evidence", "pass", `${evidenceCount} evidence reference(s) available`);
  } else {
    add(checks, "evidence", "source evidence", "fail", "no successful video evidence or run evidence references found");
  }

  const hypothesisCount =
    experiments.filter((experiment: { hypothesis?: string | null }) => Boolean(experiment.hypothesis?.trim())).length +
    concepts.filter((concept) => Boolean(concept.hypothesis?.trim())).length +
    trendReports.reduce(
      (sum: number, report: { recommended_experiments?: unknown }) =>
        sum + jsonArrayLength(report.recommended_experiments),
      0
    );
  if (hypothesisCount > 0) {
    add(checks, "hypothesis", "experiment hypothesis", "pass", `${hypothesisCount} hypothesis source(s) found`);
  } else {
    add(checks, "hypothesis", "experiment hypothesis", "fail", "no controlled experiment or concept hypothesis found");
  }

  const conceptCount = asCount(concepts, conceptsRes.count);
  if (conceptCount === targetVideos) {
    add(checks, "concepts", "first-loop batch size", "pass", `${conceptCount}/${targetVideos} concepts`);
  } else if (conceptCount > targetVideos) {
    add(
      checks,
      "concepts",
      "first-loop batch size",
      "warn",
      `${conceptCount} concepts found; Loop 1 target is ${targetVideos}`
    );
  } else {
    add(checks, "concepts", "first-loop batch size", "fail", `${conceptCount}/${targetVideos} concepts`);
  }

  const receiptCount = asCount(receipts, receiptsRes.count);
  const conceptIds = new Set(concepts.map((concept) => concept.id));
  const receiptConceptIds = new Set(receipts.map((receipt: { concept_id?: string | null }) => receipt.concept_id));
  const conceptsWithOwnEvidence = concepts.filter((concept) => jsonArrayLength(concept.evidence_video_ids) > 0);
  const chainedConcepts = concepts.filter(
    (concept) => receiptConceptIds.has(concept.id) || jsonArrayLength(concept.evidence_video_ids) > 0
  ).length;
  if (conceptCount > 0 && chainedConcepts === conceptIds.size) {
    add(checks, "evidence-chain", "concept evidence chain", "pass", `${chainedConcepts}/${conceptCount} concepts linked`);
  } else {
    add(
      checks,
      "evidence-chain",
      "concept evidence chain",
      "fail",
      `${chainedConcepts}/${conceptCount} concepts have trend receipts or evidence ids`
    );
  }
  if (receiptCount < conceptCount && conceptsWithOwnEvidence.length < conceptCount) {
    add(checks, "evidence-chain", "trend receipts", "warn", `${receiptCount}/${conceptCount} concepts have receipts`);
  }

  const assetIds = videos.map((video) => video.final_asset_id).filter((id): id is string => Boolean(id));
  const { data: assetsData } = assetIds.length
    ? await opts.client
        .from("generated_assets")
        .select("id, status, public_url, kind")
        .in("id", assetIds)
        .eq("kind", "final_mp4")
    : { data: [] as AssetRow[] };
  const assetsById = new Map(((assetsData ?? []) as AssetRow[]).map((asset) => [asset.id, asset]));
  const readyVideoCount = videos.filter(isReadyOrApprovedVideo).length;
  const exportableVideoCount = countExportableVideos(videos, assetsById);

  if (readyVideoCount >= targetVideos) {
    add(checks, "videos", "ready videos", "pass", `${readyVideoCount}/${targetVideos} ready or approved`);
  } else {
    add(checks, "videos", "ready videos", "fail", `${readyVideoCount}/${targetVideos} ready or approved`);
  }
  if (exportableVideoCount >= targetVideos) {
    add(checks, "videos", "final MP4 urls", "pass", `${exportableVideoCount}/${targetVideos} exportable MP4s`);
  } else {
    add(
      checks,
      "videos",
      "final MP4 urls",
      "fail",
      `${exportableVideoCount}/${targetVideos} ready videos have succeeded final_mp4 public_url`
    );
  }

  const scheduledCount = asCount(schedules, schedulesRes.count);
  if (scheduledCount >= targetVideos) {
    add(checks, "distribution", "schedule items", "pass", `${scheduledCount}/${targetVideos} scheduled`);
  } else if (exportableVideoCount >= targetVideos) {
    const captionsByVideo = new Map(captions.map((caption) => [caption.video_id, caption]));
    const schedulesByVideo = new Map(schedules.map((schedule) => [schedule.video_id, schedule]));
    const conceptsById = new Map(concepts.map((concept) => [concept.id, concept]));
    const exportVideos: GrowthRunExportVideo[] = videos.filter((video) => {
      if (!isReadyOrApprovedVideo(video) || !video.final_asset_id) return false;
      const asset = assetsById.get(video.final_asset_id);
      return asset?.kind === "final_mp4" && asset.status === "succeeded" && Boolean(asset.public_url);
    }).map((video) => {
      const concept = video.concept_id ? conceptsById.get(video.concept_id) : undefined;
      const caption = captionsByVideo.get(video.id);
      const schedule = schedulesByVideo.get(video.id);
      const asset = video.final_asset_id ? assetsById.get(video.final_asset_id) : undefined;
      return {
        videoId: video.id,
        conceptId: video.concept_id ?? "",
        platform: concept?.platform ?? schedule?.platform ?? "tiktok",
        videoType: concept?.video_type ?? "slide",
        hook: concept?.hook ?? "",
        caption: caption?.caption ?? "",
        hashtags: stringArray(caption?.hashtags),
        mediaUrl: asset?.public_url ?? null,
        scheduledFor: schedule?.scheduled_for ?? null,
        accountHandle: null,
      };
    });
    try {
      const zip = await buildGrowthRunExportZip({
        projectName: opts.projectName ?? "AutoScale project",
        growthRunId: opts.growthRunId,
        videos: exportVideos,
      });
      add(
        checks,
        "distribution",
        "export fallback",
        zip.byteLength > 100 ? "pass" : "fail",
        zip.byteLength > 100
          ? `export pack builds for ${exportVideos.length} video(s)`
          : "export pack returned an empty buffer"
      );
    } catch (err) {
      add(
        checks,
        "distribution",
        "export fallback",
        "fail",
        err instanceof Error ? err.message : String(err)
      );
    }
  } else {
    add(checks, "distribution", "schedule or export", "fail", "not enough exportable videos for schedule/export");
  }

  const videoIds = videos.map((video) => video.id);
  const [metricsRes, trackedLinksRes] = await Promise.all([
    videoIds.length
      ? opts.client.from("metrics_snapshots").select("id", { count: "exact", head: true }).in("video_id", videoIds)
      : { count: 0 },
    opts.client
      .from("tracked_links")
      .select("id", { count: "exact", head: true })
      .eq("growth_run_id", opts.growthRunId),
  ]);
  const metricCount = metricsRes.count ?? 0;
  const trackedLinkCount = trackedLinksRes.count ?? 0;
  if (metricCount > 0) {
    add(checks, "measure", "metrics snapshots", "pass", `${metricCount} metric snapshot(s) found`);
  } else if (opts.requireMetrics) {
    add(checks, "measure", "metrics snapshots", "fail", "no metrics snapshots found and --require-metrics is enabled");
  } else {
    add(checks, "measure", "metrics snapshots", "warn", "none yet; expected before compound, not always before first post lands");
  }
  if (trackedLinkCount > 0) {
    add(checks, "measure", "tracking links", "pass", `${trackedLinkCount} tracking link(s) minted`);
  } else {
    add(checks, "measure", "tracking links", "warn", "no tracking links yet; schedule/export can still proceed");
  }

  const sla = evaluateSlaRows(slaRows, stageSlaMs);
  if (slaRows.length === 0) {
    add(checks, "sla", "stage timing rows", "fail", "no growth_run_sla_events rows found");
  } else if (sla.overSla.length > 0) {
    add(
      checks,
      "sla",
      "under 60s phases",
      "fail",
      `${sla.overSla.length} completed phase(s) exceeded ${stageSlaMs}ms: ${sla.overSla
        .map((row) => `${row.phase}=${row.duration_ms}ms`)
        .join(", ")}`
    );
  } else {
    add(checks, "sla", "under 60s phases", "pass", `${sla.completed.length}/${slaRows.length} terminal phase(s) within ${stageSlaMs}ms`);
  }
  if (sla.missingDuration.length > 0) {
    add(
      checks,
      "sla",
      "duration completeness",
      "warn",
      `${sla.missingDuration.length} succeeded phase(s) missing duration_ms`
    );
  }

  const summary = {
    evidenceCount,
    conceptCount,
    receiptCount,
    readyVideoCount,
    exportableVideoCount,
    scheduledCount,
    metricCount,
    trackedLinkCount,
    overSlaCount: sla.overSla.length,
  };

  return {
    projectId: opts.projectId,
    growthRunId: opts.growthRunId,
    passed: !checks.some((check) => check.status === "fail"),
    checks,
    summary,
  };
}

export function formatLoop1ContractReport(report: Loop1ContractReport): string {
  const lines = [
    `Loop 1 Contract Verification: ${report.growthRunId}`,
    `Project: ${report.projectId}`,
    `Result: ${report.passed ? "PASS" : "FAIL"}`,
    `Summary: evidence=${report.summary.evidenceCount} concepts=${report.summary.conceptCount} ready=${report.summary.readyVideoCount} exportable=${report.summary.exportableVideoCount} scheduled=${report.summary.scheduledCount} metrics=${report.summary.metricCount} over_sla=${report.summary.overSlaCount}`,
    "",
    ...report.checks.map(
      (check) => `[${check.status.toUpperCase()}] ${check.group}: ${check.name} - ${check.detail}`
    ),
  ];
  return lines.join("\n");
}
