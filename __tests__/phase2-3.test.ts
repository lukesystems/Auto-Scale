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
import {
  buildPostizPayload,
  normalizePostizError,
  resolvePostizApiBase,
  sendToPostiz,
  validatePostizConfig,
} from "@/services/postiz/client";

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

describe("Postiz client", () => {
  it("resolves public v1 base URL", () => {
    expect(resolvePostizApiBase("https://api.postiz.com")).toBe("https://api.postiz.com/public/v1");
    expect(resolvePostizApiBase("https://selfhosted.com/api/public/v1")).toBe(
      "https://selfhosted.com/api/public/v1"
    );
  });

  it("buildPostizPayload uses schedule type and integration id", () => {
    const body = buildPostizPayload({
      channel: "integration-123",
      scheduledFor: "2024-12-14T10:00:00.000Z",
      caption: "Hello world",
      platform: "linkedin",
      externalRef: "post-abc",
    });
    expect(body.type).toBe("schedule");
    expect(body.posts[0].integration.id).toBe("integration-123");
    expect(body.posts[0].settings.__type).toBe("linkedin");
    expect(body.posts[0].value[0].content).toContain("Hello world");
  });

  it("validatePostizConfig rejects missing credentials", () => {
    expect(validatePostizConfig({}).ok).toBe(false);
    expect(validatePostizConfig({ apiUrl: "https://api.postiz.com", apiKey: "key" }).ok).toBe(true);
  });

  it("normalizePostizError maps 401 auth failures", () => {
    expect(normalizePostizError(401, { message: "bad key" })).toContain("authentication failed");
  });

  describe("sendToPostiz (mocked fetch)", () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      global.fetch = vi.fn();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it("uses /public/v1/posts and raw Authorization header", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify([{ postId: "remote-1", integration: "int-1" }]),
      });

      const result = await sendToPostiz(
        { apiUrl: "https://api.postiz.com", apiKey: "test-key-123" },
        {
          channel: "int-1",
          scheduledFor: "2024-12-14T10:00:00.000Z",
          caption: "Caption",
        }
      );

      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.postiz.com/public/v1/posts",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "test-key-123",
          }),
        })
      );
      const headers = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].headers;
      expect(headers.Authorization).not.toMatch(/^Bearer /);
      expect(result.remoteId).toBe("remote-1");
    });

    it("returns failed status on API error preserving export fallback path", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "server error",
      });

      const result = await sendToPostiz(
        { apiUrl: "https://api.postiz.com", apiKey: "test-key" },
        {
          channel: "int-1",
          scheduledFor: "2024-12-14T10:00:00.000Z",
          caption: "Caption",
        }
      );

      expect(result.ok).toBe(false);
      expect(result.status).toBe("failed");
      expect(result.error).toContain("500");
    });

    it("does not call fetch when config is invalid", async () => {
      const result = await sendToPostiz({}, {
        channel: "int-1",
        scheduledFor: "2024-12-14T10:00:00.000Z",
        caption: "Caption",
      });
      expect(result.ok).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
