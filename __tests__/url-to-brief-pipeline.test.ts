import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() => ({
    from: vi.fn(() => ({
      update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
    })),
  })),
}));

vi.mock("@/services/autobrief/fetch-site", () => ({
  normalizeProductUrl: (url: string) => {
    const withProtocol = url.startsWith("http") ? url : `https://${url}`;
    return new URL(withProtocol).toString();
  },
  fetchSiteForAutoBrief: vi.fn(),
}));

vi.mock("@/services/autobrief/generate", () => ({
  generateAutoBrief: vi.fn(),
}));

vi.mock("@/services/ai/logger", () => ({
  logAIRun: vi.fn(async () => undefined),
}));

import { fetchSiteForAutoBrief } from "@/services/autobrief/fetch-site";
import { generateAutoBrief } from "@/services/autobrief/generate";
import {
  buildFetchWarning,
  parseProductUrl,
  runUrlToBriefPipeline,
} from "@/services/autobrief/run-url-to-brief-pipeline";

const mockBrief = {
  product_name: "Acme",
  product_url: "https://acme.com/",
  one_line_description: "Test product",
  category: "SaaS",
  product_type: "B2B SaaS",
  product_summary: "Summary",
  what_it_does: "Does things",
  target_customer: "Founders",
  target_audience: ["Founders"],
  primary_pain: "Pain",
  user_pain_points: ["Pain"],
  core_promise: "Promise",
  key_features: ["Feature"],
  key_benefits: ["Benefit"],
  offer: null,
  cta: null,
  pricing: {
    model: null,
    has_free_tier: false,
    has_free_trial: false,
    tiers: [],
    notes: null,
  },
  niche: "SaaS",
  alternative_solutions: [],
  market_category: "SaaS",
  positioning_angles: ["Angle"],
  content_pillars: ["Pillar"],
  content_angles: [],
  brand_voice: null,
  platform_recommendations: [],
  cta_suggestions: [],
  founder_led_opportunities: [],
  positioning_gaps: [],
  suggested_competitors: [],
  suggested_sources: [],
  production_constraints: {
    can_make_carousels: true,
    can_make_founder_videos: false,
    can_use_product_screenshots: true,
    can_use_ai_images: true,
  },
  confidence: {
    overall: "medium" as const,
    audience: "medium" as const,
    features: "medium" as const,
    competitors: "low" as const,
    positioning: "medium" as const,
  },
  confidence_score: 0.8,
  missing_information: [],
  extraction_notes: [],
};

describe("parseProductUrl", () => {
  it("normalizes bare domains", () => {
    expect(parseProductUrl("acme.com")).toEqual({ ok: true, url: "https://acme.com/" });
  });

  it("rejects empty input", () => {
    expect(parseProductUrl("  ")).toEqual({ ok: false, error: "Enter a website URL." });
  });
});

describe("buildFetchWarning", () => {
  it("includes fetch error detail when present", () => {
    expect(buildFetchWarning("HTTP error 429")).toContain("429");
  });
});

describe("runUrlToBriefPipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("signup profile soft-fails fetch and still returns a brief", async () => {
    vi.mocked(fetchSiteForAutoBrief).mockResolvedValue({
      ok: false,
      url: "https://blocked.com/",
      finalUrl: null,
      title: null,
      description: null,
      textSnippet: null,
      pages: [],
      error: "HTTP error 429: Too Many Requests",
    });
    vi.mocked(generateAutoBrief).mockResolvedValue({
      brief: mockBrief,
      raw: "{}",
      provider: "mock",
      model: "mock",
      latencyMs: 10,
    });

    const result = await runUrlToBriefPipeline({
      userId: "user-1",
      productUrl: "https://blocked.com/",
      profile: "signup",
      projectId: "project-1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fetchFailed).toBe(true);
    expect(result.fetchWarning).toContain("429");
    expect(fetchSiteForAutoBrief).toHaveBeenCalledWith(
      expect.objectContaining({ maxPages: 8, projectId: "project-1" })
    );
  });

  it("preview profile hard-fails when fetch fails", async () => {
    vi.mocked(fetchSiteForAutoBrief).mockResolvedValue({
      ok: false,
      url: "https://blocked.com/",
      finalUrl: null,
      title: null,
      description: null,
      textSnippet: null,
      pages: [],
      error: "timeout",
    });

    const result = await runUrlToBriefPipeline({
      userId: "user-1",
      productUrl: "https://blocked.com/",
      profile: "preview",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("could not read this website");
    expect(generateAutoBrief).not.toHaveBeenCalled();
  });
});
