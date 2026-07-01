import { afterEach, describe, expect, it, vi } from "vitest";

const mockAdminFrom = vi.fn();
const mockServerFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: () => ({ from: mockAdminFrom }),
  createSupabaseServerClient: () => ({ from: mockServerFrom }),
}));

function jobsTableHandlers(candidates: Array<Record<string, unknown>>) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn((_col: string, val: unknown) => {
        if (val === "queued") {
          return {
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(async () => ({ data: candidates, error: null })),
              })),
            })),
          };
        }
        return {
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          })),
        };
      }),
    })),
    update: vi.fn(() => {
      let jobId: string | null = null;
      return {
        eq: vi.fn((col: string, val: string) => {
          if (col === "id") jobId = val;
          return {
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => {
                    const row = candidates.find((c) => c.id === jobId);
                    if (!row) return { data: null, error: null };
                    return {
                      data: {
                        id: row.id,
                        project_id: row.project_id,
                        growth_run_id: row.growth_run_id,
                        video_id: row.video_id,
                        concept_id: row.concept_id,
                      },
                      error: null,
                    };
                  }),
                })),
              })),
            })),
          };
        }),
      };
    }),
  };
}

describe("render worker", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("claims only queued awaiting_worker jobs idempotently", async () => {
    const candidates = [
      {
        id: "job-1",
        project_id: "project-1",
        growth_run_id: "run-1",
        video_id: "video-1",
        concept_id: "concept-1",
        status: "queued",
        current_stage: "awaiting_worker",
      },
      {
        id: "job-2",
        project_id: "project-1",
        growth_run_id: "run-1",
        video_id: "video-2",
        concept_id: "concept-2",
        status: "queued",
        current_stage: "awaiting_worker",
      },
    ];

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "video_production_jobs") return jobsTableHandlers(candidates);
      return jobsTableHandlers([]);
    });

    const { claimRenderJobs } = await import("@/services/video-factory/render-job-queue");
    const claimed = await claimRenderJobs({ limit: 5 });

    expect(claimed).toHaveLength(2);
    expect(claimed.map((j) => j.id)).toEqual(["job-1", "job-2"]);
  });

  it("skips re-enqueue when an awaiting_worker job already exists", async () => {
    mockServerFrom.mockImplementation((table: string) => {
      if (table === "video_production_jobs") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: "job-existing",
                    video_id: "video-existing",
                    status: "queued",
                    current_stage: "awaiting_worker",
                  },
                  error: null,
                })),
              })),
            })),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          })),
        })),
      };
    });

    const { findExistingQueuedRenderJob } = await import("@/services/video-factory/render-job-queue");
    const existing = await findExistingQueuedRenderJob(
      { from: mockServerFrom } as never,
      "run-1",
      "concept-1"
    );

    expect(existing).toEqual({ jobId: "job-existing", videoId: "video-existing" });
  });
});
