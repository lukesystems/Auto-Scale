import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { z } from "zod";
import { openaiAdapter } from "@/services/ai/adapters/openai";
import { generateObject, generateText } from "@/services/ai/runtime";
import { AIError } from "@/services/ai/types";
import { mapAutoBriefError } from "@/services/autobrief/map-error";
import { ProviderSetupError } from "@/services/providers/config";

describe("AI runtime responseMode", () => {
  const originalEnv = { ...process.env };
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    process.env.OPENAI_API_KEY = "sk-test-key";
    process.env.AUTOSCALE_DEFAULT_PROVIDER = "openai";
    process.env.AI_REQUEST_TIMEOUT_MS = "45000";
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Hello world" } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("generateText defaults to responseMode text (no response_format)", async () => {
    await generateText({ prompt: "Say hi" });

    const body = JSON.parse(mockFetch.mock.calls[0]![1]!.body as string);
    expect(body.response_format).toBeUndefined();
  });

  it("openaiAdapter only includes response_format when responseMode is json", async () => {
    await openaiAdapter.generateText(
      { prompt: "Return JSON", responseMode: "json" },
      { apiKey: "sk-test", providerLabel: "openai" }
    );

    const jsonBody = JSON.parse(mockFetch.mock.calls[0]![1]!.body as string);
    expect(jsonBody.response_format).toEqual({ type: "json_object" });
  });

  it("openaiAdapter does not include response_format for normal text mode", async () => {
    await openaiAdapter.generateText(
      { prompt: "Write prose", responseMode: "text" },
      { apiKey: "sk-test", providerLabel: "openai" }
    );

    const textBody = JSON.parse(mockFetch.mock.calls[0]![1]!.body as string);
    expect(textBody.response_format).toBeUndefined();
  });

  it("generateObject passes responseMode json to the adapter", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"name":"test"}' } }],
      }),
    });

    const schema = z.object({ name: z.string() });
    await generateObject({
      prompt: "[[test]] give name",
      schema,
      provider: "openai",
    });

    const body = JSON.parse(mockFetch.mock.calls[0]![1]!.body as string);
    expect(body.response_format).toEqual({ type: "json_object" });
  });
});

describe("AI request timeout", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.AI_REQUEST_TIMEOUT_MS = "50";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("aborts provider request and returns clear error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        });
      })
    );

    await expect(
      openaiAdapter.generateText({ prompt: "slow" }, { apiKey: "sk-test", providerLabel: "openrouter" })
    ).rejects.toMatchObject({
      name: "AIError",
      message: "AI request timed out after 50ms. Try a faster model or check provider status.",
    });
  });
});

describe("AutoBrief error mapping", () => {
  it("maps AI timeout to a clean user-safe error", () => {
    const err = new AIError(
      "AI request timed out after 45000ms. Try a faster model or check provider status.",
      "openrouter"
    );
    expect(mapAutoBriefError(err, false)).toContain("timed out");
  });

  it("maps structured output failure when website fetch succeeded", () => {
    const err = new AIError(
      "Failed to produce valid structured output after 2 retries: invalid",
      "openrouter"
    );
    expect(mapAutoBriefError(err, false)).toContain("AutoBrief could not generate structured output");
    expect(mapAutoBriefError(err, false)).toContain("manual entry");
  });

  it("maps ProviderSetupError for missing OpenRouter", () => {
    const err = new ProviderSetupError("Managed OpenRouter is not configured.", "openrouter_missing");
    expect(mapAutoBriefError(err, false)).toContain("OpenRouter is not configured");
  });
});

describe("AutoBrief action error handling", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
    vi.restoreAllMocks();
  });

  async function runActionWithGenerateMock(
    generateImpl: () => Promise<never>
  ): Promise<{ ok: boolean; error?: string }> {
    vi.resetModules();

    vi.doMock("@/lib/supabase/env", () => ({
      isSupabaseConfigured: () => true,
    }));

    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(() => ({
        auth: {
          getUser: async () => ({ data: { user: { id: "user-1" } } }),
        },
      })),
    }));

    vi.doMock("@/services/autobrief/fetch-site", () => ({
      fetchSiteForAutoBrief: vi.fn(async () => ({
        ok: true,
        title: "Test",
        description: "Desc",
        textSnippet: "Snippet",
        url: "https://example.com",
      })),
    }));

    vi.doMock("@/services/ai/logger", () => ({
      logAIRun: vi.fn(async () => null),
    }));

    vi.doMock("@/services/autobrief/generate", () => ({
      generateAutoBrief: vi.fn(generateImpl),
    }));

    const { fetchAndGenerateAutoBriefAction } = await import("@/app/(app)/onboarding/actions");
    return fetchAndGenerateAutoBriefAction({ productUrl: "https://example.com" });
  }

  it("returns clean error on AI timeout", async () => {
    const result = await runActionWithGenerateMock(async () => {
      throw new AIError(
        "AI request timed out after 45000ms. Try a faster model or check provider status.",
        "openrouter"
      );
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("timed out");
    }
  });

  it("returns clean error on provider failure", async () => {
    const result = await runActionWithGenerateMock(async () => {
      throw new AIError("openrouter request failed (503): unavailable", "openrouter");
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("AI provider request failed");
    }
  });
});
