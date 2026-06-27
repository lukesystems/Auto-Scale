import { EvidenceChainDrawer } from "@/components/evidence-chain-drawer";
import { loadTrendHopEvidenceChain } from "@/lib/evidence-chain/load";
import { sendTrendHopToGrowthAction, dismissTrendHopAction } from "@/app/(app)/projects/[id]/trendwatch/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";

interface TrendHopItemCardProps {
  projectId: string;
  item: {
    id: string;
    platform: string;
    trend_name: string;
    why_hot: string | null;
    product_angle: string | null;
    suggested_hook: string | null;
    suggested_concept: string | null;
    references: unknown;
    recency_score: number | null;
    confidence: number | null;
    promoted_video_concept_id: string | null;
    created_at: string;
  };
}

export async function TrendHopItemCard({ projectId, item }: TrendHopItemCardProps) {
  const chain = await loadTrendHopEvidenceChain(projectId, item.id);

  return (
    <article className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="capitalize">{item.platform}</Badge>
            {item.confidence != null && (
              <Badge variant="secondary">{Math.round(Number(item.confidence) * 100)}% conf.</Badge>
            )}
          </div>
          <h3 className="font-semibold tracking-tight">{item.trend_name}</h3>
        </div>
        <EvidenceChainDrawer entityType="trendhop" entityId={item.id} chain={chain} />
      </div>
      {item.why_hot && <p className="text-sm text-muted-foreground">{item.why_hot}</p>}
      {item.suggested_hook && (
        <p className="text-sm">
          <span className="text-muted-foreground">Hook: </span>
          {item.suggested_hook}
        </p>
      )}
      {item.suggested_concept && (
        <p className="text-sm text-muted-foreground">{item.suggested_concept}</p>
      )}
      <div className="flex flex-wrap gap-2 pt-2">
        <form action={sendTrendHopToGrowthAction}>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="itemId" value={item.id} />
          <Button
            type="submit"
            size="sm"
            variant={item.promoted_video_concept_id ? "outline" : "default"}
          >
            {item.promoted_video_concept_id ? "Sent" : "Send to Growth Run"}
          </Button>
        </form>
        <form action={dismissTrendHopAction}>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="itemId" value={item.id} />
          <Button type="submit" size="sm" variant="ghost">
            Dismiss
          </Button>
        </form>
      </div>
      <p className="text-[10px] text-muted-foreground">{formatRelativeTime(item.created_at)}</p>
    </article>
  );
}
