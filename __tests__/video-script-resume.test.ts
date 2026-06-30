import { describe, expect, it } from "vitest";

import { videoScriptFromStoredRow } from "@/services/video-factory/script";

describe("videoScriptFromStoredRow", () => {
  it("maps stored script rows for resume-safe storyboard generation", () => {
    const script = videoScriptFromStoredRow({
      id: "script-1",
      hook_line: "Hook line here",
      body_lines: ["line one", "line two"],
      cta_line: "Try it free",
      voiceover_full: "Hook line here line one line two Try it free",
      on_screen_text: ["overlay"],
      estimated_duration_seconds: 22,
    });

    expect(script.hook_line).toBe("Hook line here");
    expect(script.body_lines).toEqual(["line one", "line two"]);
    expect(script.estimated_duration_seconds).toBe(22);
  });
});
