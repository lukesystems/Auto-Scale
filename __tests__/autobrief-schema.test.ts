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

  it("coerces string confidence_score levels to numeric scores", () => {
    const result = AutoBriefSchema.safeParse({
      ...validBrief,
      confidence_score: "high",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.confidence_score).toBe(0.85);
    }
  });

  it("still rejects invalid object for string-array fields", () => {
    const result = AutoBriefSchema.safeParse({
      ...validBrief,
      target_audience: { name: "wrong" },
    });
    expect(result.success).toBe(false);
  });

  it("coerces missing competitor reason to a default string", () => {
    const result = AutoBriefSchema.safeParse({
      ...validBrief,
      suggested_competitors: [
        { name: "Comp A", confidence: 0.6 },
        { name: "Comp B", reason: "Direct rival", confidence: "medium" },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.suggested_competitors[0]?.reason).toContain("Likely alternative");
      expect(result.data.suggested_competitors[1]?.reason).toBe("Direct rival");
    }
  });

  it("coerces missing source confidence and object target_customer", () => {
    const result = AutoBriefSchema.safeParse({
      ...validBrief,
      target_customer: { description: "Busy founders", segment: "B2B SaaS" },
      primary_pain: null,
      suggested_sources: [
        { platform: "tiktok", reason: "Active niche", confidence: "medium" },
        { platform: "youtube", url: "https://youtube.com/@x" },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.target_customer).toBe("Busy founders");
      expect(result.data.primary_pain).toContain("not clearly stated");
      expect(result.data.suggested_sources[0]?.confidence).toBe(0.55);
      expect(result.data.suggested_sources[1]?.confidence).toBe(0.5);
    }
  });
});
