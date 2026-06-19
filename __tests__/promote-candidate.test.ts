import { afterEach, describe, it, expect, vi } from "vitest";

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({ from: mockFrom }),
}));

vi.mock("@/services/trendwatch/enrich-sources", () => ({
  enrichSourceFromUrl: vi.fn(async () => ({
    fetch_status: "success",
    fetched_text: "text",
    fetch_metadata: {},
    platform: "other",
  })),
  scoreSourceRecord: vi.fn(() => ({
    score: { signalScore: 0.5, confidenceScore: 0.5, reasons: [] },
  })),
}));

vi.mock("@/services/trendwatch/classify-source", () => ({
  classifySource: vi.fn(async () => ({
    distortion_risk: "low",
    transferability_score: 0.5,
    account_type: "unknown",
    format: "post",
    hook: "hook",
    angle: "angle",
    visual_pattern: null,
    cta_pattern: null,
    audience_pain: null,
    why_it_worked: "why",
    how_to_adapt: "how",
  })),
}));

describe("promoteCandidateToSource", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("rejects non-pending candidates", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "source_candidates") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: "cand-1",
                    review_status: "rejected",
                    url: "https://example.com/post",
                    platform: "other",
                    source_type: "unknown",
                    metadata: {},
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const { promoteCandidateToSource } = await import("@/services/intelligence/memory/promote-candidate");

    await expect(
      promoteCandidateToSource({ projectId: "project-1", candidateId: "cand-1" })
    ).rejects.toThrow("Candidate is no longer pending review.");
  });

  it("returns existing source when URL already exists", async () => {
    const candidateUpdate = vi.fn(() => ({
      eq: () => ({
        eq: async () => ({ error: null }),
      }),
    }));

    mockFrom.mockImplementation((table: string) => {
      if (table === "source_candidates") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: "cand-1",
                    review_status: "pending",
                    url: "https://example.com/post",
                    platform: "other",
                    source_type: "unknown",
                    metadata: {},
                    enrich_status: "enriched",
                  },
                  error: null,
                }),
              }),
            }),
          }),
          update: candidateUpdate,
        };
      }
      if (table === "trendwatch_sources") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { id: "source-existing" }, error: null }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const { promoteCandidateToSource } = await import("@/services/intelligence/memory/promote-candidate");
    const result = await promoteCandidateToSource({ projectId: "project-1", candidateId: "cand-1" });

    expect(result.sourceId).toBe("source-existing");
    expect(candidateUpdate).toHaveBeenCalledWith({ review_status: "accepted" });
  });
});
