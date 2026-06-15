export interface PostApprovalFields {
  quality_status: string | null;
  quality_score: number | null;
  insight_id: string | null;
  content_idea_id: string | null;
  hook: string | null;
  hypothesis: string | null;
  metric_to_watch: string | null;
  cta: string | null;
}

export function validatePostForApproval(post: PostApprovalFields): { ok: true } | { ok: false; error: string } {
  if (post.quality_status !== "pass") {
    return { ok: false, error: "Quality Gate Blocked: Post status must be 'pass'." };
  }
  if (post.quality_score === null || post.quality_score < 0.7) {
    return {
      ok: false,
      error: `Quality Gate Blocked: Post score is too low (${post.quality_score ?? 0} < 0.70).`,
    };
  }
  if (!post.insight_id) {
    return { ok: false, error: "Quality Gate Blocked: Post is not linked to a TrendWatch insight." };
  }
  if (!post.content_idea_id) {
    return { ok: false, error: "Quality Gate Blocked: Post is not linked to a Content Idea." };
  }
  if (!post.hook?.trim()) {
    return { ok: false, error: "Quality Gate Blocked: Missing hook." };
  }
  if (!post.hypothesis?.trim()) {
    return { ok: false, error: "Quality Gate Blocked: Missing hypothesis." };
  }
  if (!post.metric_to_watch?.trim()) {
    return { ok: false, error: "Quality Gate Blocked: Missing metric to watch." };
  }
  if (!post.cta?.trim()) {
    return { ok: false, error: "Quality Gate Blocked: Missing CTA (Call-to-Action)." };
  }
  return { ok: true };
}
