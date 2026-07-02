import { describe, expect, it } from "vitest";
import { resolveProductionOptions } from "@/services/video-factory/production-options";

describe("loadRunProductionContext resolution", () => {
  it("matches resolveProductionOptions for stored run fields", () => {
    const resolved = resolveProductionOptions({
      productionFormat: "pain_led",
      audioMode: "voiceover_bgm",
      falRenderMode: "cinematic",
      falModelTier: "standard",
      visualPipeline: "t2v",
      falConfigured: true,
      projectDefaults: { production_format: "slide", audio_mode: "music_only" },
    });

    expect(resolved.productionFormat).toBe("pain_led");
    expect(resolved.audioMode).toBe("voiceover_bgm");
    expect(resolved.falRenderMode).toBe("cinematic");
    expect(resolved.falModelTier).toBe("standard");
    expect(resolved.visualPipeline).toBe("t2v");
  });

  it("falls back to project defaults when run options are empty", () => {
    const resolved = resolveProductionOptions({
      falConfigured: false,
      projectDefaults: { production_format: "comparison", audio_mode: "music_only" },
    });

    expect(resolved.productionFormat).toBe("comparison");
    expect(resolved.audioMode).toBe("music_only");
    expect(resolved.falRenderMode).toBe("fast");
  });
});
