import { describe, expect, it } from "vitest";
import { resolveOpenRouterModelSlug } from "@/services/ai/model-aliases";

describe("resolveOpenRouterModelSlug", () => {
  it("maps retired Gemini 2.0 Flash to 2.5 Flash", () => {
    expect(resolveOpenRouterModelSlug("google/gemini-2.0-flash-001")).toBe(
      "google/gemini-2.5-flash"
    );
  });

  it("passes through current slugs unchanged", () => {
    expect(resolveOpenRouterModelSlug("openai/gpt-4o-mini")).toBe("openai/gpt-4o-mini");
  });

  it("returns null for empty input", () => {
    expect(resolveOpenRouterModelSlug(null)).toBeNull();
    expect(resolveOpenRouterModelSlug("")).toBeNull();
  });
});
