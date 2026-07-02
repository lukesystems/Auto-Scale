import { afterEach, describe, expect, it, vi } from "vitest";

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({ from: mockFrom }),
}));

describe("promoteSynthesisCompetitors", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("upserts competitors and accounts from synthesis profiles", async () => {
    const competitorSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        ilike: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });

    const competitorInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: "comp-1" }, error: null }),
      }),
    });

    const accountSelectChain = {
      ilike: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      }),
    };
    const accountSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue(accountSelectChain),
      }),
    });

    const accountInsert = vi.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "competitors") {
        return {
          select: competitorSelect,
          insert: competitorInsert,
        };
      }
      if (table === "competitor_accounts") {
        return {
          select: accountSelect,
          insert: accountInsert,
        };
      }
      return {};
    });

    const { promoteSynthesisCompetitors } = await import(
      "@/services/intelligence/memory/promote-synthesis-competitors"
    );

    const result = await promoteSynthesisCompetitors({
      projectId: "project-1",
      discoveryRunId: "run-1",
      synthesis: {
        summary: "Market overview",
        competitors: [
          {
            name: "Rival SaaS",
            kind: "direct",
            platforms: ["x"],
            handles: ["rivalsaas"],
            what_they_do: "Posts founder-led distribution threads on X.",
            working_patterns: ["Build in public threads"],
            hooks: ["We grew to 1k users without ads"],
            formats: ["thread"],
            evidence_urls: [
              "https://x.com/rivalsaas/status/123",
              "https://x.com/rivalsaas/status/456",
            ],
            confidence: "medium",
            caveats: ["Engagement metrics unverified"],
          },
        ],
        market_patterns: [],
        white_space: [],
        suggested_opportunities: [],
        overall_confidence: "medium",
        caveats: [],
      },
    });

    expect(result.competitorsUpserted).toBe(1);
    expect(result.accountsUpserted).toBe(1);
    expect(result.competitorIds).toEqual(["comp-1"]);
    expect(competitorInsert).toHaveBeenCalled();
    expect(accountInsert).toHaveBeenCalled();
  });

  it("no-ops when synthesis has no competitors", async () => {
    const { promoteSynthesisCompetitors } = await import(
      "@/services/intelligence/memory/promote-synthesis-competitors"
    );

    const result = await promoteSynthesisCompetitors({
      projectId: "project-1",
      discoveryRunId: "run-1",
      synthesis: {
        summary: "Thin evidence",
        competitors: [],
        market_patterns: [],
        white_space: [],
        suggested_opportunities: [],
        overall_confidence: "low",
        caveats: [],
      },
    });

    expect(result).toEqual({
      competitorsUpserted: 0,
      accountsUpserted: 0,
      competitorIds: [],
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
