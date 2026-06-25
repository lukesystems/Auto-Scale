import Link from "next/link";
import {
  decideVideoAction,
  rerenderVideoAction,
  reviseHookAction,
  reviseSceneTextAction,
  regenerateSceneVisualAction,
} from "@/app/(app)/projects/[id]/growth/actions";

export interface ProductionWorkspaceVideo {
  id: string;
  conceptId: string;
  status: string;
  approvalStatus: string;
  durationSeconds: number | null;
  finalAssetUrl: string | null;
  hook: string;
  platform: string;
  videoType: string;
  productionMode: string | null;
  job: {
    id: string;
    status: string;
    currentStage: string | null;
    error: string | null;
    platformProfile: string;
  } | null;
  experiment: {
    testedVariable: string;
    audiencePain: string;
    fixedBody: string;
    fixedCta: string;
    fixedAudience: string;
    status: string;
  } | null;
  fingerprint: { name: string; status: string } | null;
  receipt: {
    observedEvidence: string[];
    strategicInference: string[];
    expectedSignal: string;
    confidence: number;
    missingEvidence: string[];
    hasEvidence: boolean;
    reasoning: string;
  } | null;
  quality: {
    overallScore: number;
    blockReason: string | null;
    hookStrength: number;
    ctaStrength: number;
    duplicateRisk: number;
    claimRisk: number;
    passReasons: string[];
    passed: boolean;
  } | null;
  scenes: Array<{
    id: string;
    sceneIndex: number;
    purpose: string | null;
    role: string;
    visualMethod: string | null;
    overlayText: string | null;
    voiceoverLine: string | null;
    durationSeconds: number;
    status: string;
    error: string | null;
  }>;
  assets: Array<{
    id: string;
    kind: string;
    status: string;
    publicUrl: string | null;
    sceneId: string | null;
    error: string | null;
  }>;
  captions: Array<{ id: string; platform: string; caption: string; handle: string | null }>;
}

interface ProductionWorkspaceProps {
  projectId: string;
  runId: string;
  videos: ProductionWorkspaceVideo[];
}

export function ProductionWorkspace({ projectId, runId, videos }: ProductionWorkspaceProps) {
  if (!videos.length) {
    return (
      <section className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        Production workspace will populate once the Video Factory renders concepts.
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold">Production workspace</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Agent plan → scene timeline → asset pipeline → review. Revise without restarting the run.
        </p>
      </header>
      {videos.map((video) => (
        <article key={video.id} className="rounded-xl border bg-card overflow-hidden">
          <div className="border-b bg-muted/30 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{video.hook.slice(0, 80)}</p>
              <p className="text-xs text-muted-foreground">
                {video.productionMode ?? video.videoType} · {video.platform} · job{" "}
                {video.job?.status ?? "pending"}
              </p>
            </div>
            <span
              className={`text-xs font-medium px-2 py-1 rounded ${
                video.status === "ready"
                  ? "bg-green-500/15 text-green-700 dark:text-green-300"
                  : video.status === "failed"
                    ? "bg-red-500/15 text-red-700 dark:text-red-300"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {video.status}
            </span>
          </div>

          <div className="grid gap-4 p-4 lg:grid-cols-2">
            <AgentPlanCard video={video} />
            <QualityGateCard quality={video.quality} />
          </div>

          <div className="px-4 pb-4 grid gap-4 lg:grid-cols-2">
            <SceneTimeline scenes={video.scenes} />
            <AssetPipeline assets={video.assets} finalUrl={video.finalAssetUrl} captions={video.captions} />
          </div>

          {video.receipt ? <TrendReceiptDrawer receipt={video.receipt} /> : null}

          <ReviewActionsBar projectId={projectId} runId={runId} video={video} />
        </article>
      ))}
    </section>
  );
}

function AgentPlanCard({ video }: { video: ProductionWorkspaceVideo }) {
  const exp = video.experiment;
  return (
    <div className="rounded-lg border bg-background p-3 space-y-2 text-xs">
      <h3 className="font-semibold text-sm">Agent plan</h3>
      {video.fingerprint ? (
        <p>
          <span className="text-muted-foreground">Format:</span> {video.fingerprint.name} (
          {video.fingerprint.status})
        </p>
      ) : null}
      {exp ? (
        <>
          <p>
            <span className="text-muted-foreground">Tested variable:</span> {exp.testedVariable}
          </p>
          <p>
            <span className="text-muted-foreground">Audience pain:</span> {exp.audiencePain}
          </p>
          <p>
            <span className="text-muted-foreground">Fixed body:</span> {exp.fixedBody}
          </p>
          <p>
            <span className="text-muted-foreground">CTA:</span> {exp.fixedCta}
          </p>
          <p>
            <span className="text-muted-foreground">Expected signal:</span>{" "}
            {video.receipt?.expectedSignal ?? "—"}
          </p>
        </>
      ) : (
        <p className="text-muted-foreground">No controlled experiment linked.</p>
      )}
      {video.job?.error ? (
        <p className="text-red-600 dark:text-red-300">Job error: {video.job.error}</p>
      ) : null}
    </div>
  );
}

function QualityGateCard({
  quality,
}: {
  quality: ProductionWorkspaceVideo["quality"];
}) {
  if (!quality) {
    return (
      <div className="rounded-lg border bg-background p-3 text-xs text-muted-foreground">
        Quality gate runs after render.
      </div>
    );
  }
  return (
    <div className="rounded-lg border bg-background p-3 space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Quality gate</h3>
        <span
          className={
            quality.passed
              ? "text-green-600 dark:text-green-300 font-medium"
              : "text-amber-600 dark:text-amber-300 font-medium"
          }
        >
          {quality.passed ? "PASS" : "BLOCKED"}
        </span>
      </div>
      <p>Overall: {(quality.overallScore * 100).toFixed(0)}%</p>
      <p>Hook: {(quality.hookStrength * 100).toFixed(0)}% · CTA: {(quality.ctaStrength * 100).toFixed(0)}%</p>
      <p>Duplicate risk: {(quality.duplicateRisk * 100).toFixed(0)}% · Claim risk: {(quality.claimRisk * 100).toFixed(0)}%</p>
      {quality.blockReason ? <p className="text-amber-700 dark:text-amber-300">{quality.blockReason}</p> : null}
      {quality.passReasons.length ? (
        <ul className="list-disc pl-4 text-muted-foreground">
          {quality.passReasons.slice(0, 4).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SceneTimeline({ scenes }: { scenes: ProductionWorkspaceVideo["scenes"] }) {
  const order = ["hook", "problem", "mechanism", "demo", "proof", "cta", "outro"];
  const sorted = [...scenes].sort(
    (a, b) =>
      (order.indexOf(a.purpose ?? a.role) >= 0 ? order.indexOf(a.purpose ?? a.role) : 99) -
      (order.indexOf(b.purpose ?? b.role) >= 0 ? order.indexOf(b.purpose ?? b.role) : 99)
  );
  return (
    <div className="rounded-lg border bg-background p-3">
      <h3 className="font-semibold text-sm mb-2">Scene timeline</h3>
      <ol className="space-y-1 text-xs">
        {sorted.map((s) => (
          <li key={s.id} className="grid grid-cols-[5rem_1fr_auto] gap-2 items-start border-l-2 border-primary/30 pl-2">
            <span className="font-medium capitalize">{s.purpose ?? s.role}</span>
            <span className="text-muted-foreground truncate">
              {s.overlayText || s.voiceoverLine || "—"} · {s.visualMethod ?? "slide"}
            </span>
            <span className={s.status === "ready" ? "text-green-600" : "text-muted-foreground"}>{s.status}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function AssetPipeline({
  assets,
  finalUrl,
  captions,
}: {
  assets: ProductionWorkspaceVideo["assets"];
  finalUrl: string | null;
  captions: ProductionWorkspaceVideo["captions"];
}) {
  const voice = assets.find((a) => a.kind === "voiceover");
  const final = assets.find((a) => a.kind === "final_mp4");
  const slides = assets.filter((a) => a.kind === "slide_image");
  return (
    <div className="rounded-lg border bg-background p-3 space-y-2 text-xs">
      <h3 className="font-semibold text-sm">Asset pipeline</h3>
      <PipelineRow label="Slide scenes" status={`${slides.filter((s) => s.status === "succeeded").length}/${slides.length}`} />
      <PipelineRow label="Voiceover" status={voice?.status ?? "pending"} />
      <PipelineRow label="Captions" status={captions.length ? `${captions.length} account(s)` : "none"} />
      <PipelineRow label="Final MP4" status={final?.status ?? (finalUrl ? "ready" : "missing")} />
      {finalUrl ? (
        <video
          src={finalUrl}
          controls
          className="w-full max-w-xs rounded border mt-2"
          preload="metadata"
        />
      ) : null}
    </div>
  );
}

function PipelineRow({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{status}</span>
    </div>
  );
}

function TrendReceiptDrawer({ receipt }: { receipt: NonNullable<ProductionWorkspaceVideo["receipt"]> }) {
  return (
    <div className="mx-4 mb-4 rounded-lg border border-primary/20 bg-primary/[0.03] p-3 text-xs space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Trend receipt</h3>
        <span
          className={
            receipt.hasEvidence
              ? "text-green-700 dark:text-green-300"
              : "text-amber-700 dark:text-amber-300 font-medium"
          }
        >
          {receipt.hasEvidence ? "Evidence-backed" : "Hypothesis — unproven"}
        </span>
      </div>
      <p>
        <span className="text-muted-foreground">Observed:</span> {receipt.observedEvidence.join("; ") || "—"}
      </p>
      <p>
        <span className="text-muted-foreground">Inference:</span> {receipt.strategicInference.join("; ")}
      </p>
      <p>
        <span className="text-muted-foreground">Expected signal:</span> {receipt.expectedSignal}
      </p>
      <p>
        <span className="text-muted-foreground">Confidence:</span> {(receipt.confidence * 100).toFixed(0)}%
      </p>
      {receipt.missingEvidence.length ? (
        <p className="text-amber-700 dark:text-amber-300">
          Missing: {receipt.missingEvidence.join("; ")}
        </p>
      ) : null}
    </div>
  );
}

function ReviewActionsBar({
  projectId,
  runId,
  video,
}: {
  projectId: string;
  runId: string;
  video: ProductionWorkspaceVideo;
}) {
  const hookScene = video.scenes.find((s) => s.purpose === "hook" || s.role === "hook");
  return (
    <div className="border-t bg-muted/20 px-4 py-3 flex flex-wrap gap-2 items-end">
      <form action={decideVideoAction} className="inline">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="growthRunId" value={runId} />
        <input type="hidden" name="videoId" value={video.id} />
        <input type="hidden" name="decision" value="approve" />
        <button type="submit" className="rounded border border-green-600/40 px-2 py-1 text-xs hover:bg-muted">
          Approve
        </button>
      </form>
      <form action={decideVideoAction} className="inline">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="growthRunId" value={runId} />
        <input type="hidden" name="videoId" value={video.id} />
        <input type="hidden" name="decision" value="reject" />
        <button type="submit" className="rounded border px-2 py-1 text-xs hover:bg-muted">
          Reject
        </button>
      </form>
      <form action={rerenderVideoAction} className="inline">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="growthRunId" value={runId} />
        <input type="hidden" name="videoId" value={video.id} />
        <input type="hidden" name="conceptId" value={video.conceptId} />
        <button type="submit" className="rounded border px-2 py-1 text-xs hover:bg-muted">
          Regenerate video
        </button>
      </form>
      {hookScene ? (
        <form action={reviseSceneTextAction} className="inline-flex gap-1 items-center">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="growthRunId" value={runId} />
          <input type="hidden" name="sceneId" value={hookScene.id} />
          <input
            name="overlayText"
            placeholder="Edit hook overlay"
            className="rounded border px-2 py-1 text-xs w-40"
            defaultValue={hookScene.overlayText ?? ""}
          />
          <button type="submit" className="rounded border px-2 py-1 text-xs hover:bg-muted">
            Save scene
          </button>
        </form>
      ) : null}
      {hookScene ? (
        <form action={regenerateSceneVisualAction} className="inline">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="growthRunId" value={runId} />
          <input type="hidden" name="videoId" value={video.id} />
          <input type="hidden" name="conceptId" value={video.conceptId} />
          <input type="hidden" name="sceneId" value={hookScene.id} />
          <button type="submit" className="rounded border px-2 py-1 text-xs hover:bg-muted">
            Regenerate scene
          </button>
        </form>
      ) : null}
      <form action={reviseHookAction} className="inline-flex gap-1 items-center">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="growthRunId" value={runId} />
        <input type="hidden" name="videoId" value={video.id} />
        <input type="hidden" name="conceptId" value={video.conceptId} />
        <input name="newHook" placeholder="Revise hook" className="rounded border px-2 py-1 text-xs w-48" />
        <button type="submit" className="rounded border px-2 py-1 text-xs hover:bg-muted">
          Update hook
        </button>
      </form>
      <Link
        href={`/api/projects/${projectId}/growth/${runId}/export`}
        className="rounded border px-2 py-1 text-xs hover:bg-muted"
      >
        Export pack
      </Link>
    </div>
  );
}
