import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validatePostForApproval } from "@/lib/approval-guard";
import { checkChainIntegrity } from "@/lib/chain-integrity";
import { calculateRealSignalScore } from "@/services/trendwatch/scoring";
import {
  aggregateRunConfidence,
  deriveSignalInputs,
  enrichSourceFromUrl,
  scoreSourceRecord,
} from "@/services/trendwatch/enrich-sources";
import * as ingestion from "@/services/trendwatch/ingestion";

describe("Approval guard", () => {
  it("blocks failed quality gate posts", () => {
    const result = validatePostForApproval({
      quality_status: "fail",
      quality_score: 0.9,
      insight_id: "ins-1",
      content_idea_id: "idea-1",
      hook: "Hook",
      hypothesis: "Hypothesis",
      metric_to_watch: "saves",
      cta: "Try it",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("pass");
  });

  it("blocks unanchored posts missing insight_id", () => {
    const result = validatePostForApproval({
      quality_status: "pass",
      quality_score: 0.9,
      insight_id: null,
      content_idea_id: "idea-1",
      hook: "Hook",
      hypothesis: "Hypothesis",
      metric_to_watch: "saves",
      cta: "Try it",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("TrendWatch insight");
  });
});

describe("Schedule chain integrity", () => {
  it("validates post belongs to project", async () => {
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => ({
        select: vi.fn().mockImplementation(() => ({
          eq: vi.fn().mockImplementation(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data:
                table === "generated_posts"
                  ? { project_id: "other-project", content_idea_id: null, insight_id: null }
                  : { project_id: "other-project" },
            }),
          })),
        })),
      })),
    } as never;

    const result = await checkChainIntegrity(mockSupabase, {
      projectId: "my-project",
      postId: "post-1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Cross-project boundary violation");
  });
});

describe("TrendWatch scoring & ingestion", () => {
  it("returns lower confidence when metrics are missing", () => {
    const score = calculateRealSignalScore({
      relevance: 0.8,
      formatTransferability: null,
      saveSignal: null,
      recency: null,
      conversionIntent: null,
      accountFit: null,
    });
    expect(score.confidenceScore).toBeLessThan(1);
    expect(score.reasons.some((r) => r.includes("Missing data"))).toBe(true);
  });

  it("records fetch failure in scoring reasons, not fake metrics", () => {
    const scored = scoreSourceRecord(
      {
        id: "src-1",
        source_url: "https://example.com/post",
        platform: "x",
        account_handle: null,
        account_type: "unknown",
        follower_count: null,
        views: null,
        likes: null,
        saves: null,
        shares: null,
        comments: null,
        transferability_score: null,
        notes: null,
      },
      false,
      "HTTP error 404"
    );
    expect(scored.score.reasons.some((r) => r.includes("fetch failed"))).toBe(true);
    expect(scored.score.confidenceScore).toBeLessThan(0.5);
  });

  it("aggregate run confidence is zero with no sources", () => {
    const agg = aggregateRunConfidence([]);
    expect(agg.confidence).toBe(0);
    expect(agg.reasons[0]).toContain("No sources");
  });

  it("deriveSignalInputs nulls metrics when fetch failed and no notes", () => {
    const inputs = deriveSignalInputs(
      {
        id: "s",
        source_url: "https://example.com",
        platform: "other",
        account_handle: null,
        account_type: "unknown",
        follower_count: null,
        views: null,
        likes: null,
        saves: null,
        shares: null,
        comments: null,
        transferability_score: null,
        notes: null,
      },
      false
    );
    expect(inputs.relevance).toBeNull();
    expect(inputs.saveSignal).toBeNull();
  });

  it("stores fetch failure from enrichSourceFromUrl without inventing metrics", async () => {
    vi.spyOn(ingestion, "safeFetchUrl").mockResolvedValue({
      url: "https://example.com/missing",
      finalUrl: "https://example.com/missing",
      status: "failed",
      textSnippet: null,
      title: null,
      description: null,
      platform: "other",
      error: "HTTP error 404",
    });

    const result = await enrichSourceFromUrl({
      id: "src-1",
      source_url: "https://example.com/missing",
      platform: "other",
      account_handle: null,
      account_type: "unknown",
      follower_count: null,
      views: null,
      likes: null,
      saves: null,
      shares: null,
      comments: null,
      transferability_score: null,
      notes: null,
    });

    expect(result.fetch_status).toBe("failed");
    expect(result.fetched_text).toBeNull();
    expect(result.fetch_metadata.error).toBe("HTTP error 404");
    expect(result.confidence_score).toBeLessThan(0.5);
    expect(result.scoring_reasons.some((r) => r.includes("fetch failed"))).toBe(true);

    vi.restoreAllMocks();
  });
});
