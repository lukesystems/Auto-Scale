import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateFalImage, downloadRemoteImage } from "@/services/video-factory/fal/image-gen";
import { selectFalImageModel, selectFalVideoModel } from "@/services/video-factory/fal/model-router";
import { isFalConfigured } from "@/services/media/fal-config";
import { resolveVisualPipeline } from "@/services/video-factory/production-options";

const FAL_LIVE = Boolean(process.env.FAL_KEY?.trim());

describe("fal image pipeline (offline)", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("isFalConfigured is false when FAL_KEY is unset", () => {
    vi.stubEnv("FAL_KEY", "");
    expect(isFalConfigured()).toBe(false);
  });

  it("generateFalImage throws when fal is not configured", async () => {
    vi.stubEnv("FAL_KEY", "");
    await expect(
      generateFalImage({
        prompt: "minimal product UI on desk, static frame",
        modelId: "fal-ai/flux/schnell",
      })
    ).rejects.toThrow(/not configured/i);
  });

  it("resolveVisualPipeline auto-selects image_to_video for ai_broll_short cinematic", () => {
    expect(
      resolveVisualPipeline({
        productionFormat: "ai_broll_short",
        falRenderMode: "cinematic",
        falConfigured: true,
      })
    ).toBe("image_to_video");
  });

  it("image_to_video routing selects I2V model when reference frame URL is present", () => {
    const imageModel = selectFalImageModel({
      falRenderMode: "cinematic",
      scenePurpose: "hook",
    });
    const frameUrl = "https://cdn.example.com/frame.png";
    const videoModel = selectFalVideoModel({
      falRenderMode: "cinematic",
      scenePurpose: "hook",
      referenceImageUrl: frameUrl,
      falImageAssetUrl: frameUrl,
      durationSeconds: 5,
      aspectRatio: "9:16",
    });
    expect(imageModel.modelId).toBeTruthy();
    expect(videoModel.mode).toBe("image_to_video");
    expect(videoModel.modelId).toContain("image-to-video");
  });
});

describe.skipIf(!FAL_LIVE)("fal image→I2V live (FAL_KEY)", () => {
  it(
    "generateFalImage returns a downloadable image URL",
    async () => {
      const imageModel = selectFalImageModel({
        falRenderMode: "cinematic",
        scenePurpose: "hook",
      });
      const result = await generateFalImage({
        prompt:
          "Static product screenshot on laptop screen, clean SaaS dashboard, soft studio lighting, no text",
        aspectRatio: "9:16",
        modelId: imageModel.modelId,
      });

      expect(result.imageUrl).toMatch(/^https?:\/\//);
      expect(result.model).toBe(imageModel.modelId);

      const bytes = await downloadRemoteImage(result.imageUrl);
      expect(bytes.byteLength).toBeGreaterThan(1_000);
    },
    180_000
  );

  it(
    "I2V model routing uses image frame for Seedance image-to-video path",
    async () => {
      const imageModel = selectFalImageModel({
        falRenderMode: "cinematic",
        scenePurpose: "mechanism",
      });
      const frame = await generateFalImage({
        prompt: "Abstract tech gradient background, static, vertical 9:16 frame",
        aspectRatio: "9:16",
        modelId: imageModel.modelId,
      });

      const videoModel = selectFalVideoModel({
        falRenderMode: "cinematic",
        scenePurpose: "mechanism",
        referenceImageUrl: frame.imageUrl,
        falImageAssetUrl: frame.imageUrl,
        durationSeconds: 5,
        aspectRatio: "9:16",
      });

      expect(videoModel.mode).toBe("image_to_video");
      expect(videoModel.modelId).toContain("image-to-video");
    },
    180_000
  );
});
