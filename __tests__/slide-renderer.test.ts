import { describe, expect, it } from "vitest";
import { renderSlidePng } from "@/services/video-factory/slide-renderer";

describe("slide renderer", () => {
  it("renders a PNG buffer for a scene", async () => {
    const buf = await renderSlidePng({
      onScreenText: "Your startup does not need more posts.",
      role: "hook",
      aspectRatio: "9:16",
    });
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 4).toString("hex")).toBe("89504e47"); // PNG magic
  }, 30_000);
});
