import { afterEach, describe, expect, it, vi } from "vitest";

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({ from: mockFrom }),
}));

vi.mock("@/services/media/fal-config", () => ({
  isFalConfigured: () => false,
}));

const baseInput = {
  projectId: "project-1",
  growthRunId: "run-1",
  conceptId: "concept-1",
  aspectRatio: "9:16",
  durationSeconds: 30,
};

function chain(result: unknown) {
  const terminal = async () => result;
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "limit", "update", "insert"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = terminal;
  builder.single = terminal;
  return builder;
}

describe("queueFinalAssembly", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("updates an existing video row instead of inserting", async () => {
    const videoUpdate = vi.fn(() => ({
      eq: async () => ({ error: null }),
    }));
    const assetUpdate = vi.fn(() => ({
      eq: async () => ({ error: null }),
    }));

    mockFrom.mockImplementation((table: string) => {
      if (table === "videos") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: "video-1", final_asset_id: "asset-1" },
                error: null,
              }),
            }),
          }),
          update: videoUpdate,
        };
      }
      if (table === "generated_assets") {
        return {
          update: assetUpdate,
        };
      }
      return chain({ data: null, error: null });
    });

    const { queueFinalAssembly } = await import("@/services/video-factory/assets");
    const result = await queueFinalAssembly(baseInput);

    expect(result).toEqual({ assetId: "asset-1", videoId: "video-1" });
    expect(videoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "rendering",
        final_asset_id: "asset-1",
        approval_status: "pending_review",
      })
    );
    expect(assetUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "pending",
        storage_path: null,
        public_url: null,
      })
    );
    expect(mockFrom).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ insert: expect.anything() })
    );
  });

  it("inserts a new video row when none exists for the concept", async () => {
    const assetInsert = vi.fn(() => ({
      select: () => ({
        single: async () => ({ data: { id: "asset-new" }, error: null }),
      }),
    }));
    const videoInsert = vi.fn(() => ({
      select: () => ({
        single: async () => ({ data: { id: "video-new" }, error: null }),
      }),
    }));

    mockFrom.mockImplementation((table: string) => {
      if (table === "videos") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
          insert: videoInsert,
        };
      }
      if (table === "generated_assets") {
        return {
          insert: assetInsert,
        };
      }
      return chain({ data: null, error: null });
    });

    const { queueFinalAssembly } = await import("@/services/video-factory/assets");
    const result = await queueFinalAssembly(baseInput);

    expect(result).toEqual({ assetId: "asset-new", videoId: "video-new" });
    expect(assetInsert).toHaveBeenCalled();
    expect(videoInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        concept_id: "concept-1",
        status: "rendering",
        final_asset_id: "asset-new",
      })
    );
  });
});
