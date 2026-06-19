import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getDefaultProviderMode,
  isManagedMode,
  isByokMode,
} from "@/lib/provider-mode";
import { getClientSafeProviderStatus } from "@/services/providers/status";
import { resolveModelForTask, getModelRoutingSummary } from "@/services/ai/model-router";
import { AutoBriefSchema } from "@/services/autobrief/schema";
import { getManagedProviderConfig, redactSecret } from "@/services/providers/config";
import { getFalProviderStatus } from "@/services/media/fal-config";

describe("V1.1 provider mode", () => {
  it("defaults provider mode to managed", () => {
    expect(getDefaultProviderMode()).toBe("managed");
    expect(isManagedMode("managed")).toBe(true);
    expect(isByokMode("byok")).toBe(true);
  });
});

describe("V1.1 provider status", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("redacts secrets and never exposes keys in status", () => {
    process.env.OPENROUTER_API_KEY = "sk-or-test-secret-key-12345";
    process.env.POSTIZ_API_KEY = "pst_secret_postiz_key";

    const status = getClientSafeProviderStatus("managed");
    const serialized = JSON.stringify(status);

    expect(status.openrouter.configured).toBe(true);
    expect(serialized).not.toContain("sk-or-test-secret-key-12345");
    expect(serialized).not.toContain("pst_secret_postiz_key");
    expect(redactSecret(process.env.OPENROUTER_API_KEY)).not.toContain("secret-key-12345");
  });

  it("returns warnings when managed keys are missing", () => {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.POSTIZ_API_KEY;

    const status = getClientSafeProviderStatus("managed");
    expect(status.warnings.length).toBeGreaterThan(0);
    expect(status.openrouter.configured).toBe(false);
    expect(status.postiz.configured).toBe(false);
  });
});

describe("V1.1 model router", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.AUTOSCALE_MODEL_AUTOBRIEF = "anthropic/claude-3.5-sonnet";
    process.env.AUTOSCALE_MODEL_TRENDWATCH = "openai/gpt-4o-mini";
    process.env.AUTOSCALE_MODEL_CONTENT = "openai/gpt-4o-mini";
    process.env.AUTOSCALE_MODEL_COMPOUND = "meta-llama/llama-3.1-70b-instruct";
    process.env.AUTOSCALE_MODEL_DEFAULT = "openrouter/auto";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("selects task-specific models with fallback to default", () => {
    expect(resolveModelForTask("autobrief")).toBe("anthropic/claude-3.5-sonnet");
    expect(resolveModelForTask("trendwatch")).toBe("openai/gpt-4o-mini");
    expect(resolveModelForTask("content")).toBe("openai/gpt-4o-mini");
    expect(resolveModelForTask("compound")).toBe("meta-llama/llama-3.1-70b-instruct");
    expect(resolveModelForTask("quality_gate")).toBe("openrouter/auto");
    expect(resolveModelForTask("default")).toBe("openrouter/auto");
  });

  it("summarizes routing for UI", () => {
    const summary = getModelRoutingSummary();
    expect(summary.autobrief).toBe("anthropic/claude-3.5-sonnet");
    expect(summary.quality_gate).toBe("openrouter/auto");
  });
});

describe("V1.1 AutoBrief schema", () => {
  it("validates expected AutoBrief output", () => {
    const parsed = AutoBriefSchema.safeParse({
      product_name: "Acme",
      product_url: "https://acme.com",
      product_summary: "Does things",
      target_customer: "Founders",
      primary_pain: "Distribution",
      core_promise: "Grow faster",
      offer: null,
      cta: "Start",
      niche: "SaaS",
      positioning_angles: ["Angle 1"],
      content_pillars: ["Pillar 1"],
      brand_voice: "Direct",
      production_constraints: {
        can_make_carousels: true,
        can_make_founder_videos: false,
        can_use_product_screenshots: true,
        can_use_ai_images: false,
      },
      suggested_competitors: [{ name: "Comp", reason: "Similar", confidence: 0.5 }],
      suggested_sources: [{ platform: "x", reason: "Founders", confidence: 0.6 }],
      confidence_score: 0.7,
      missing_information: [],
    });
    expect(parsed.success).toBe(true);
  });
});

describe("V1.1 website fetch fallback", () => {
  it("marks fetch failure for manual fallback flow", async () => {
    vi.mock("@/services/trendwatch/ingestion", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/services/trendwatch/ingestion")>();
      return {
        ...actual,
        safeFetchHtml: vi.fn(async () => ({
          ok: false,
          url: "https://blocked.test",
          finalUrl: "https://blocked.test",
          html: null,
          contentType: null,
          error: "SSRF Prevention",
        })),
        safeFetchUrl: vi.fn(async () => ({
          url: "https://blocked.test",
          title: null,
          description: null,
          textSnippet: null,
          platform: "other",
          status: "failed",
          error: "SSRF Prevention",
        })),
      };
    });

    const { fetchSiteForAutoBrief } = await import("@/services/autobrief/fetch-site");
    const result = await fetchSiteForAutoBrief({ url: "https://blocked.test" });
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

describe("V1.1 Postiz credentials", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("uses env credentials in managed mode", async () => {
    process.env.POSTIZ_API_URL = "https://api.postiz.com/public/v1";
    process.env.POSTIZ_API_KEY = "managed-key";

    vi.mock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(),
    }));

    const { resolvePostizCredentials } = await import("@/lib/postiz-credentials");
    const creds = await resolvePostizCredentials("user-1", "managed");
    expect(creds?.source).toBe("managed");
    expect(creds?.apiKey).toBe("managed-key");
  });

  it("uses user credentials in BYOK mode", async () => {
    delete process.env.POSTIZ_API_KEY;

    vi.mock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(() => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { api_url: "https://user.postiz.com", api_key: "user-key" },
              }),
            }),
          }),
        }),
      })),
    }));

    vi.mock("@/lib/supabase/env", () => ({
      isSupabaseConfigured: () => true,
    }));

    const { resolvePostizCredentials } = await import("@/lib/postiz-credentials");
    const creds = await resolvePostizCredentials("user-1", "byok");
    expect(creds?.source).toBe("byok");
    expect(creds?.apiKey).toBe("user-key");
  });

  it("returns null when managed Postiz key missing", async () => {
    delete process.env.POSTIZ_API_KEY;
    delete process.env.POSTIZ_API_URL;

    const config = getManagedProviderConfig();
    expect(config.postiz.configured).toBe(false);
  });
});

describe("V1.1 Fal foundation", () => {
  it("reports Fal as not enabled for generation", () => {
    const status = getFalProviderStatus();
    expect(status.enabled).toBe(false);
  });
});
