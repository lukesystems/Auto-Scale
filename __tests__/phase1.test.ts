import { describe, it, expect, vi } from "vitest";
import { buildPipelineSteps } from "../lib/project-pipeline";
import { runDeterministicQualityChecks } from "../services/quality-gate/check";
import { checkChainIntegrity } from "../lib/chain-integrity";

describe("Phase 1: Stabilization & Security Tests", () => {
  describe("buildPipelineSteps", () => {
    it("returns correct pipeline done statuses", () => {
      const stats = {
        sourceCount: 2,
        insightCount: 1,
        ideaCount: 0,
        postCount: 0,
        approvedCount: 0,
        scheduledCount: 0,
        experimentCount: 0,
        winnerCount: 0,
        growthRunCompletedCount: 1,
        growthVideoReadyCount: 3,
        growthScheduledCount: 0,
        growthPostedCount: 0,
        videoEvidenceCount: 0,
        patternRunCount: 0,
        dailyPackCount: 0,
      };
      const pipeline = buildPipelineSteps(stats, true);
      
      const briefStep = pipeline.find((p) => p.key === "brief");
      const sourcesStep = pipeline.find((p) => p.key === "sources");
      const growthStep = pipeline.find((p) => p.key === "growth");
      const winnersStep = pipeline.find((p) => p.key === "winners");

      expect(briefStep?.done).toBe(true);
      expect(sourcesStep?.done).toBe(true);
      expect(growthStep?.done).toBe(true);
      expect(winnersStep?.done).toBe(false);
    });
  });

  describe("runDeterministicQualityChecks", () => {
    it("fails when hook is missing", () => {
      const result = runDeterministicQualityChecks({
        post: {
          hook: "",
          hypothesis: "Test hypothesis",
          metric_to_watch: "clicks",
        },
        insightLinked: true,
      });
      expect(result.status).toBe("revise");
      expect(result.failure_reasons).toContain("Missing hook.");
    });

    it("fails when hypothesis is missing", () => {
      const result = runDeterministicQualityChecks({
        post: {
          hook: "A sharp hook that is short",
          hypothesis: "",
          metric_to_watch: "clicks",
        },
        insightLinked: true,
      });
      expect(result.status).toBe("revise");
      expect(result.failure_reasons).toContain("Missing hypothesis.");
    });

    it("passes when all criteria are met", () => {
      const result = runDeterministicQualityChecks({
        post: {
          hook: "Short hook here",
          hypothesis: "Test hypothesis",
          metric_to_watch: "clicks",
          cta: "Click here",
        },
        insightLinked: true,
      });
      expect(result.status).toBe("pass");
      expect(result.failure_reasons.length).toBe(0);
    });
  });

  describe("checkChainIntegrity", () => {
    it("detects cross-project boundary violations", async () => {
      const mockSupabase = {
        from: vi.fn().mockImplementation((table) => ({
          select: vi.fn().mockImplementation(() => ({
            eq: vi.fn().mockImplementation(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { project_id: "other-project-id" },
              }),
            })),
          })),
        })),
      } as any;

      const result = await checkChainIntegrity(mockSupabase, {
        projectId: "my-project-id",
        insightId: "some-insight-id",
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain("Cross-project boundary violation");
    });

    it("passes when project ids match", async () => {
      const mockSupabase = {
        from: vi.fn().mockImplementation((table) => ({
          select: vi.fn().mockImplementation(() => ({
            eq: vi.fn().mockImplementation(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { project_id: "my-project-id" },
              }),
            })),
          })),
        })),
      } as any;

      const result = await checkChainIntegrity(mockSupabase, {
        projectId: "my-project-id",
        insightId: "some-insight-id",
      });

      expect(result.ok).toBe(true);
    });
  });
});
