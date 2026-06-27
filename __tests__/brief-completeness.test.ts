import { describe, expect, it } from "vitest";
import { isBriefComplete } from "@/lib/brief-completeness";

describe("isBriefComplete", () => {
  it("returns false when brief is missing", () => {
    expect(isBriefComplete(null)).toBe(false);
  });

  it("returns false when required fields are empty", () => {
    expect(
      isBriefComplete({
        product_summary: "A growth tool",
        target_customer: "",
        primary_pain: "No distribution",
      })
    ).toBe(false);
  });

  it("accepts one_line_description instead of product_summary", () => {
    expect(
      isBriefComplete({
        one_line_description: "AI growth copilot",
        target_customer: "Solo founders",
        primary_pain: "No repeatable content loop",
      })
    ).toBe(true);
  });
});
