import { ExternalLink, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/app/page-header";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getProductBrief } from "../queries";
import { VideoControls } from "./video-controls";

interface PageProps { params: { id: string } }

export const metadata = { title: "Video intelligence" };

export default async function VideoIntelligencePage({ params }: PageProps) {
  const [brief, evidence] = await Promise.all([getProductBrief(params.id), loadEvidence(params.id)]);
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

      <section className="rounded-xl border border-border bg-card p-5 md:p-6">
        <VideoControls projectId={params.id} hasBrief={Boolean(brief)} />
        <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
          AutoScale only uses public video evidence. Metrics may be unavailable when platforms hide them or pages cannot be fetched.
        </p>
      </section>

      {groups.length === 0 ? (
        <EmptyState
          icon={<Video className="h-5 w-5" />}
          title="No public video evidence yet"
          description="Paste a known video or creator profile above, or run discovery from your saved Product Brief. Failed public fetches are kept honest—unknown fields remain empty."
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
                  <article key={item.id} className="rounded-xl border border-border bg-card p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="capitalize">{item.platform}</Badge>
                        <Badge variant={item.fetch_status === "success" ? "success" : item.fetch_status === "failed" ? "destructive" : "secondary"}>
                          {item.fetch_status}
                        </Badge>
                        <Badge variant="outline">{Math.round(Number(item.source_confidence) * 100)}% confidence</Badge>
                      </div>
                      <a href={item.video_url} target="_blank" rel="noreferrer" aria-label="Open public source" className="text-muted-foreground transition-colors hover:text-foreground">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>

                    <h3 className="mt-4 font-medium leading-snug">{item.title || item.caption || "Public source metadata unavailable"}</h3>
                    {item.title && item.caption && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{item.caption}</p>}
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{item.account_handle ? `@${item.account_handle}` : "Account unknown"}</span>
                      {item.competitor_name && <span>Competitor: {item.competitor_name}</span>}
                      {item.view_count != null && <span>{formatMetric(item.view_count)} views</span>}
                      {item.like_count != null && <span>{formatMetric(item.like_count)} likes</span>}
                      {item.comment_count != null && <span>{formatMetric(item.comment_count)} comments</span>}
                      {item.share_count != null && <span>{formatMetric(item.share_count)} shares</span>}
                    </div>

                    <dl className="mt-4 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-3">
                      <EvidenceField label="Hook" value={item.detected_hook} />
                      <EvidenceField label="CTA" value={item.detected_cta} />
                      <EvidenceField label="Format" value={item.format_guess === "unknown" ? null : item.format_guess.replace(/_/g, " ")} />
                    </dl>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function EvidenceField({ label, value }: { label: string; value: string | null }) {
  return <div><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 line-clamp-3 capitalize">{value ?? "Unknown"}</dd></div>;
}

function formatMetric(value: number) {
  return new Intl.NumberFormat("en", { notation: value >= 1_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
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
