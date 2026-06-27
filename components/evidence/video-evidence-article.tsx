import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EvidenceChainDrawer } from "@/components/evidence-chain-drawer";
import { loadVideoEvidenceChain } from "@/lib/evidence-chain/load";

interface VideoEvidenceArticleProps {
  projectId: string;
  item: {
    id: string;
    platform: string;
    video_url: string;
    account_handle: string | null;
    title: string | null;
    caption: string | null;
    competitor_name: string | null;
    view_count: number | null;
    like_count: number | null;
    comment_count: number | null;
    share_count: number | null;
    detected_hook: string | null;
    detected_cta: string | null;
    format_guess: string;
    source_confidence: number;
    fetch_status: string;
  };
}

export async function VideoEvidenceArticle({ projectId, item }: VideoEvidenceArticleProps) {
  const chain = await loadVideoEvidenceChain(projectId, item.id);

  return (
    <article className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="capitalize">{item.platform}</Badge>
          <Badge variant={item.fetch_status === "success" ? "success" : item.fetch_status === "failed" ? "destructive" : "secondary"}>
            {item.fetch_status}
          </Badge>
          <Badge variant="outline">{Math.round(Number(item.source_confidence) * 100)}% confidence</Badge>
        </div>
        <div className="flex items-center gap-1">
          <EvidenceChainDrawer entityType="video" entityId={item.id} chain={chain} />
          <a href={item.video_url} target="_blank" rel="noreferrer" aria-label="Open public source" className="text-muted-foreground transition-colors hover:text-foreground">
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
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
  );
}

function EvidenceField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 line-clamp-3 capitalize">{value ?? "Unknown"}</dd>
    </div>
  );
}

function formatMetric(value: number) {
  return new Intl.NumberFormat("en", {
    notation: value >= 1_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}
