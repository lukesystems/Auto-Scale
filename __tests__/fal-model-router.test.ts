import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { selectFalVideoModel, describeFalTierForRun } from "@/services/video-factory/fal/model-router";
import { getDefaultFalVideoModel } from "@/services/video-factory/fal/model-catalog";

describe("selectFalVideoModel", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("picks fast T2V when render mode is fast and no reference image", () => {
    const selected = selectFalVideoModel({
      falRenderMode: "fast",
      scenePurpose: "mechanism",
      durationSeconds: 5,
      aspectRatio: "9:16",
    });
    expect(selected.mode).toBe("text_to_video");
    expect(selected.tier).toBe("fast");
    expect(selected.modelId).toBe(getDefaultFalVideoModel("fast", "text_to_video").id);
  });

  it("picks cinematic T2V for hook scenes in cinematic mode", () => {
    const selected = selectFalVideoModel({
      falRenderMode: "cinematic",
      scenePurpose: "hook",
      durationSeconds: 6,
    });
    expect(selected.mode).toBe("text_to_video");
    expect(selected.tier).toBe("cinematic");
    expect(selected.modelId).toBe("bytedance/seedance-2.0/text-to-video");
  });

  it("picks standard T2V for proof scenes in cinematic auto mode", () => {
    const selected = selectFalVideoModel({
      falRenderMode: "cinematic",
      scenePurpose: "proof",
      durationSeconds: 4,
    });
    expect(selected.mode).toBe("text_to_video");
    expect(selected.tier).toBe("standard");
    expect(selected.modelId).toBe("fal-ai/bytedance/seedance/v1.5/pro/text-to-video");
  });

  it("prefers I2V when a reference image URL is present", () => {
    const selected = selectFalVideoModel({
      falRenderMode: "cinematic",
      scenePurpose: "hook",
      referenceImageUrl: "https://cdn.example.com/hook-frame.png",
      durationSeconds: 5,
    });
    expect(selected.mode).toBe("image_to_video");
    expect(selected.tier).toBe("cinematic");
    expect(selected.modelId).toBe("bytedance/seedance-2.0/image-to-video");
  });

  it("uses explicit fal_model_tier override", () => {
    const selected = selectFalVideoModel({
      falRenderMode: "cinematic",
      falModelTier: "fast",
      scenePurpose: "hook",
      durationSeconds: 5,
    });
    expect(selected.tier).toBe("fast");
    expect(selected.modelId).toBe("bytedance/seedance-2.0/fast/text-to-video");
  });

  it("respects env override for cinematic T2V", () => {
    vi.stubEnv("AUTOSCALE_FAL_SEEDANCE_MODEL", "bytedance/seedance-2.0/fast/text-to-video");
    const selected = selectFalVideoModel({
      falRenderMode: "cinematic",
      falModelTier: "cinematic",
      scenePurpose: "hook",
      durationSeconds: 5,
    });
    expect(selected.modelId).toBe("bytedance/seedance-2.0/fast/text-to-video");
  });

  it("clamps duration to model max", () => {
    const selected = selectFalVideoModel({
      falRenderMode: "cinematic",
      scenePurpose: "proof",
      durationSeconds: 30,
    });
    expect(selected.duration).toBe(12);
  });
});

describe("describeFalTierForRun", () => {
  it("describes fast slide-only path", () => {
    expect(describeFalTierForRun({ falRenderMode: "fast" })).toContain("slides only");
  });

  it("describes cinematic tier label", () => {
    expect(describeFalTierForRun({ falRenderMode: "cinematic", falModelTier: "cinematic" })).toContain(
      "Seedance 2.0"
    );
  });
});
