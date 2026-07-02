import { describe, expect, it } from "vitest";
import { formatBriefField } from "@/lib/format-brief-field";

describe("formatBriefField", () => {
  it("formats JSON string ICP into readable text", () => {
    const raw = JSON.stringify({
      role: "Content Creator",
      stage: "Active social media presence",
      context: "Looking to improve engagement",
    });
    expect(formatBriefField(raw)).toBe(
      "Content Creator · Active social media presence · Looking to improve engagement"
    );
  });

  it("passes through plain strings", () => {
    expect(formatBriefField("SaaS founders")).toBe("SaaS founders");
  });
});
