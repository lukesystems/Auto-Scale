import { describe, it, expect } from "vitest";
import { StringArraySchema, AutoBriefSchema } from "@/services/autobrief/schema";

describe("StringArraySchema", () => {
  it("wraps a non-empty string into a single-item array", () => {
    expect(StringArraySchema.parse("founders")).toEqual(["founders"]);
  });

  it("preserves an existing array", () => {
    expect(StringArraySchema.parse(["a", "b"])).toEqual(["a", "b"]);
  });

  it("coerces empty string to empty array", () => {
    expect(StringArraySchema.parse("")).toEqual([]);
  });

  it("coerces whitespace-only string to empty array", () => {
    expect(StringArraySchema.parse("   ")).toEqual([]);
  });

  it("defaults undefined to empty array", () => {
    expect(StringArraySchema.parse(undefined)).toEqual([]);
  });

  it("rejects non-string non-array values", () => {
    expect(StringArraySchema.safeParse(42).success).toBe(false);
    expect(StringArraySchema.safeParse({ key: "val" }).success).toBe(false);
  });
});

describe("AutoBriefSchema string-to-array tolerance", () => {
  const validBrief = {
    product_name: "Acme",
    product_url: "https://acme.com",
    product_summary: "Does things",
    target_customer: "Founders",
    primary_pain: "Distribution",
    core_promise: "Grow faster",
    niche: "SaaS",
    confidence_score: 0.7,
  };

  it("accepts strings for target_audience and extraction_notes", () => {
    const result = AutoBriefSchema.safeParse({
      ...validBrief,
      target_audience: "SaaS founders",
      extraction_notes: "Limited info on the site",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.target_audience).toEqual(["SaaS founders"]);
      expect(result.data.extraction_notes).toEqual(["Limited info on the site"]);
    }
  });

  it("keeps arrays as arrays", () => {
    const result = AutoBriefSchema.safeParse({
      ...validBrief,
      target_audience: ["Founders", "Marketers"],
      positioning_angles: ["Speed", "Price"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.target_audience).toEqual(["Founders", "Marketers"]);
      expect(result.data.positioning_angles).toEqual(["Speed", "Price"]);
    }
  });

  it("still rejects invalid confidence_score", () => {
    const result = AutoBriefSchema.safeParse({
      ...validBrief,
      confidence_score: "high",
    });
    expect(result.success).toBe(false);
  });

  it("still rejects invalid object for string-array fields", () => {
    const result = AutoBriefSchema.safeParse({
      ...validBrief,
      target_audience: { name: "wrong" },
    });
    expect(result.success).toBe(false);
  });
});
