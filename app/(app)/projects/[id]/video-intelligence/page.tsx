import { Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/app/page-header";
import { NextMoveBanner } from "@/components/app/next-move-banner";
import { getNextMove } from "@/lib/next-move";
import { VideoEvidenceArticle } from "@/components/evidence/video-evidence-article";
import { isBriefComplete } from "@/lib/brief-completeness";
import { getProductBrief, getProjectStats } from "../queries";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { VideoControls } from "./video-controls";

interface PageProps { params: { id: string } }

export const metadata = { title: "Video intelligence" };

export default async function VideoIntelligencePage({ params }: PageProps) {
  const [brief, evidence, stats] = await Promise.all([
    getProductBrief(params.id),
    loadEvidence(params.id),
    getProjectStats(params.id),
  ]);
  const next = getNextMove({
    projectId: params.id,
    briefComplete: isBriefComplete(brief),
    stats,
  });
  const groups = ["tiktok", "instagram", "youtube", "other"].map((platform) => ({
    platform,
    items: evidence.filter((item) => item.platform === platform),
  })).filter((group) => group.items.length);

  return (
    <div className="container py-10 space-y-8">
      <PageHeader
        title="Video intelligence"
        description="Collect public TikTok, Instagram Reels, and YouTube Shorts evidence before AutoScale mines repeatable distribution patterns."
      />

      <NextMoveBanner move={next} />

      <section className="rounded-xl border border-border bg-card p-5 md:p-6">
        <VideoControls projectId={params.id} briefComplete={isBriefComplete(brief)} />
        <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
          AutoScale only uses public video evidence. Metrics may be unavailable when platforms hide them or pages cannot be fetched.
        </p>
      </section>

      {groups.length === 0 ? (
        <EmptyState
          icon={<Video className="h-5 w-5" />}
          title="No public video evidence yet"
          description="Paste a known video or creator profile above, or run discovery from your saved Product Brief."
          action={
            <a
              href="#video-import"
              className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Import a reference video
            </a>
          }
        />
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.platform} className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold capitalize tracking-tight">{group.platform}</h2>
                <Badge variant="secondary">{group.items.length}</Badge>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                {group.items.map((item) => (
                  <VideoEvidenceArticle key={item.id} projectId={params.id} item={item} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

async function loadEvidence(projectId: string) {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServerClient();
  const [{ data: rows }, { data: competitors }] = await Promise.all([
    supabase.from("video_evidence").select("id, competitor_id, platform, video_url, account_handle, title, caption, view_count, like_count, comment_count, share_count, detected_hook, detected_cta, format_guess, source_confidence, fetch_status, created_at").eq("project_id", projectId).order("created_at", { ascending: false }).limit(100),
    supabase.from("competitors").select("id, name").eq("project_id", projectId),
  ]);
  const names = new Map((competitors ?? []).map((competitor) => [competitor.id, competitor.name]));
  return (rows ?? []).map((row) => ({ ...row, competitor_name: row.competitor_id ? names.get(row.competitor_id) ?? null : null }));
}
