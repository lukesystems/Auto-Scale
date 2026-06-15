"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronUp, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { updatePostStatusAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PostCardProps {
  projectId: string;
  post: {
    id: string;
    format: string | null;
    platform: string | null;
    hook: string | null;
    caption: string | null;
    cta: string | null;
    target_audience: string | null;
    status: string;
    quality_score: number | null;
    quality_status: string | null;
    quality_reasons: unknown;
    hypothesis: string | null;
    metric_to_watch: string | null;
    slides: Array<{ slide_number: number; headline: string | null; body: string | null }>;
  };
  approvalMode?: boolean;
}

export function PostCard({ projectId, post, approvalMode }: PostCardProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(approvalMode ?? false);
  const [pending, startTransition] = useTransition();

  function setStatus(status: "approved" | "rejected" | "in_review") {
    const fd = new FormData();
    fd.set("project_id", projectId);
    fd.set("post_id", post.id);
    fd.set("status", status);
    startTransition(async () => {
      const result = await updatePostStatusAction(fd);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const label = status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Marked for review";
      toast.success(label);
      router.refresh();
    });
  }

  const reasons = Array.isArray(post.quality_reasons) ? (post.quality_reasons as string[]) : [];
  const qualityScorePct = Math.round((post.quality_score ?? 0) * 100);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {post.format && <Badge variant="default">{post.format}</Badge>}
            {post.platform && <Badge variant="outline">{post.platform}</Badge>}
            <StatusBadge status={post.status} />
          </div>
          <div className="flex items-center gap-2">
            <QualityBadge score={qualityScorePct} status={post.quality_status} />
          </div>
        </div>

        <h4 className="mt-3 font-semibold text-base tracking-tight text-balance">{post.hook ?? "(no hook)"}</h4>
        {post.target_audience && <p className="mt-1 text-xs text-muted-foreground">For: {post.target_audience}</p>}

        {post.hypothesis && (
          <div className="mt-3 text-xs">
            <span className="text-muted-foreground">Hypothesis: </span>
            <span className="text-foreground/80">{post.hypothesis}</span>
          </div>
        )}

        {reasons.length > 0 && (
          <ul className="mt-3 space-y-1">
            {reasons.slice(0, 3).map((r, i) => (
              <li key={i} className="text-xs text-warning">⚠ {r}</li>
            ))}
          </ul>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="mt-3 -ml-2"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {expanded ? "Hide slides" : `View ${post.slides.length} slide${post.slides.length === 1 ? "" : "s"}`}
        </Button>
      </div>

      {expanded && (
        <div className="border-t border-border bg-secondary/30 p-5 space-y-3 animate-slide-in">
          {post.slides.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No slides — non-carousel post.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2.5">
              {post.slides.map((s) => (
                <div key={s.slide_number} className="rounded-lg border border-border bg-card p-3.5 aspect-[4/5] flex flex-col">
                  <span className="text-[10px] font-mono text-muted-foreground">slide {s.slide_number}</span>
                  <h5 className="mt-2 font-semibold text-balance text-base leading-tight">{s.headline}</h5>
                  {s.body && <p className="mt-2 text-xs text-foreground/70 leading-snug">{s.body}</p>}
                </div>
              ))}
            </div>
          )}

          {(post.caption || post.cta) && (
            <div className="rounded-lg border border-border bg-card p-3.5 space-y-2">
              {post.caption && (
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Caption</div>
                  <p className="mt-1 text-sm whitespace-pre-line">{post.caption}</p>
                </div>
              )}
              {post.cta && (
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">CTA</div>
                  <p className="mt-1 text-sm">{post.cta}</p>
                </div>
              )}
              {post.metric_to_watch && (
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Metric to watch</div>
                  <p className="mt-1 text-sm">{post.metric_to_watch}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="border-t border-border px-5 py-3 flex items-center justify-between gap-2">
        <div>
          {post.quality_status !== "pass" && (
            <span className="text-[11px] text-destructive font-medium">⚠ Fails Quality Gate</span>
          )}
          {post.quality_status === "pass" && (post.quality_score ?? 0) < 0.7 && (
            <span className="text-[11px] text-destructive font-medium">Quality score must be at least 70%</span>
          )}
          {post.quality_status === "pass" && (!post.hook || !post.hypothesis || !post.metric_to_watch || !post.cta) && (
            <span className="text-[11px] text-destructive font-medium">⚠ Missing required fields</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {post.status !== "rejected" && (
            <Button size="sm" variant="ghost" onClick={() => setStatus("rejected")} disabled={pending}>
              <X className="h-3.5 w-3.5" /> Reject
            </Button>
          )}
          {post.status !== "approved" && (
            <Button
              size="sm"
              onClick={() => setStatus("approved")}
              disabled={
                pending ||
                post.quality_status !== "pass" ||
                (post.quality_score ?? 0) < 0.7 ||
                !post.hook ||
                !post.hypothesis ||
                !post.metric_to_watch ||
                !post.cta
              }
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Approve
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "success" | "destructive" | "warning" | "secondary" }> = {
    draft: { label: "draft", variant: "secondary" },
    in_review: { label: "in review", variant: "warning" },
    approved: { label: "approved", variant: "success" },
    rejected: { label: "rejected", variant: "destructive" },
    exported: { label: "exported", variant: "default" },
    scheduled: { label: "scheduled", variant: "default" },
    posted: { label: "posted", variant: "default" },
    archived: { label: "archived", variant: "secondary" },
  };
  const e = map[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={e.variant}>{e.label}</Badge>;
}

function QualityBadge({ score, status }: { score: number; status: string | null }) {
  const color =
    status === "pass" ? "border-success/40 text-success bg-success/10"
    : status === "fail" ? "border-destructive/40 text-destructive bg-destructive/10"
    : "border-warning/40 text-warning bg-warning/10";
  return (
    <span className={cn("text-[10px] font-mono px-2 py-0.5 rounded-md border", color)}>
      Q {score}%
    </span>
  );
}
