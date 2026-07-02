import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ELEVENLABS_BUILTIN_DEFAULT_VOICE_ID,
  buildElevenLabsVoiceRetryQueue,
  getConfiguredElevenLabsVoiceId,
  getFallbackElevenLabsVoiceId,
  isElevenLabsPaidPlanRequired,
  isElevenLabsVoiceNotFound,
  synthesizeWithProvider,
} from "@/services/voiceover/provider";

const INVALID_VOICE = "441c7c1abe08c62564a40bc0ee516fc330318a44e1043f8da9b1d4f89b646dff";
const LIBRARY_VOICE = "507tTFX0IPtqFzGd1CAL";
const FAKE_AUDIO = Buffer.from("fake-mp3").toString("base64");

const PAID_PLAN_BODY = JSON.stringify({
  detail: {
    type: "payment_required",
    code: "paid_plan_required",
    message:
      "Free users cannot use library voices via the API. Please upgrade your subscription to use this voice.",
  },
});

describe("ElevenLabs voice resolution", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    delete process.env.ELEVENLABS_VOICE_ID;
    delete process.env.DEFAULT_VOICE_ID;
    delete process.env.ELEVENLABS_FALLBACK_VOICE_ID;
  });

  afterEach(() => {
    process.env = envBackup;
    vi.restoreAllMocks();
  });

  it("defaults to Rachel when no voice env is set", () => {
    expect(getConfiguredElevenLabsVoiceId()).toBe(ELEVENLABS_BUILTIN_DEFAULT_VOICE_ID);
    expect(getFallbackElevenLabsVoiceId()).toBe(ELEVENLABS_BUILTIN_DEFAULT_VOICE_ID);
  });

  it("prefers ELEVENLABS_VOICE_ID over DEFAULT_VOICE_ID", () => {
    process.env.ELEVENLABS_VOICE_ID = "voice-a";
    process.env.DEFAULT_VOICE_ID = "voice-b";
    expect(getConfiguredElevenLabsVoiceId()).toBe("voice-a");
  });

  it("uses DEFAULT_VOICE_ID when ELEVENLABS_VOICE_ID is unset", () => {
    process.env.DEFAULT_VOICE_ID = INVALID_VOICE;
    expect(getConfiguredElevenLabsVoiceId()).toBe(INVALID_VOICE);
  });

  it("detects voice_not_found from HTTP 404 body", () => {
    const body = JSON.stringify({
      detail: { status: "voice_not_found", message: "A voice with the voice_id ... was not found." },
    });
    expect(isElevenLabsVoiceNotFound(404, body)).toBe(true);
    expect(isElevenLabsVoiceNotFound(500, body)).toBe(false);
  });

  it("detects paid_plan_required from HTTP 402 body", () => {
    expect(isElevenLabsPaidPlanRequired(402, PAID_PLAN_BODY)).toBe(true);
    expect(isElevenLabsPaidPlanRequired(404, PAID_PLAN_BODY)).toBe(false);
  });

  it("builds retry queue with configured voice then premade fallbacks", () => {
    process.env.ELEVENLABS_VOICE_ID = LIBRARY_VOICE;
    const queue = buildElevenLabsVoiceRetryQueue();
    expect(queue[0]).toBe(LIBRARY_VOICE);
    expect(queue).toContain(ELEVENLABS_BUILTIN_DEFAULT_VOICE_ID);
    expect(queue.indexOf(ELEVENLABS_BUILTIN_DEFAULT_VOICE_ID)).toBeGreaterThan(0);
  });
});

describe("synthesizeWithProvider — ElevenLabs voice fallback", () => {
  const envBackup = { ...process.env };
  const fetchMock = vi.fn();

  beforeEach(() => {
    process.env = { ...envBackup };
    process.env.ELEVENLABS_API_KEY = "test-key";
    process.env.DEFAULT_VOICE_ID = INVALID_VOICE;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ELEVENLABS_VOICE_ID;
    delete process.env.ELEVENLABS_FALLBACK_VOICE_ID;
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    process.env = envBackup;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("retries with Rachel when configured voice is not found", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () =>
          JSON.stringify({
            detail: { status: "voice_not_found", message: "voice missing" },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          audio_base64: FAKE_AUDIO,
          alignment: null,
        }),
      });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = await synthesizeWithProvider({
      scriptText: "Hello world",
      durationSeconds: 3,
    });

    expect(result.provider).toBe("elevenlabs");
    expect(result.isSilent).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain(INVALID_VOICE);
    expect(fetchMock.mock.calls[1][0]).toContain(ELEVENLABS_BUILTIN_DEFAULT_VOICE_ID);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("unavailable"),
      expect.objectContaining({ failedVoice: INVALID_VOICE, reason: "voice_not_found" })
    );
  });

  it("retries with premade voice when library voice returns 402 paid_plan_required", async () => {
    process.env.ELEVENLABS_VOICE_ID = LIBRARY_VOICE;
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 402,
        text: async () => PAID_PLAN_BODY,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          audio_base64: FAKE_AUDIO,
          alignment: null,
        }),
      });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = await synthesizeWithProvider({
      scriptText: "Hello world",
      durationSeconds: 3,
    });

    expect(result.provider).toBe("elevenlabs");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain(LIBRARY_VOICE);
    expect(fetchMock.mock.calls[1][0]).toContain(ELEVENLABS_BUILTIN_DEFAULT_VOICE_ID);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("unavailable"),
      expect.objectContaining({ failedVoice: LIBRARY_VOICE, reason: "paid_plan_required" })
    );
  });

  it("falls back to OpenAI when all ElevenLabs voices fail with 402", async () => {
    process.env.ELEVENLABS_VOICE_ID = LIBRARY_VOICE;
    process.env.OPENAI_API_KEY = "openai-key";
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("elevenlabs.io")) {
        return {
          ok: false,
          status: 402,
          text: async () => PAID_PLAN_BODY,
        };
      }
      if (url.includes("openai.com")) {
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        };
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const result = await synthesizeWithProvider({
      scriptText: "Hello world",
      durationSeconds: 3,
    });

    expect(result.provider).toBe("openai");
    expect(result.attemptLog.some((e) => e.provider === "elevenlabs" && !e.ok)).toBe(true);
    expect(result.attemptLog.some((e) => e.provider === "openai" && e.ok)).toBe(true);
  });

  it("surfaces voice ID error when configured and fallback voices both fail", async () => {
    const notFoundBody = JSON.stringify({
      detail: { status: "voice_not_found", message: "missing" },
    });
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => notFoundBody,
    });
    process.env.ELEVENLABS_VOICE_ID = "also-missing";
    process.env.ELEVENLABS_FALLBACK_VOICE_ID = "also-missing-2";

    await expect(
      synthesizeWithProvider({ scriptText: "Hello", durationSeconds: 2 })
    ).rejects.toThrow(/ElevenLabs voice ID not found/);
  });

  it("does not blame missing API key when key is set but voice fails", async () => {
    const notFoundBody = JSON.stringify({
      detail: { status: "voice_not_found", message: "missing" },
    });
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => notFoundBody,
    });
    process.env.ELEVENLABS_VOICE_ID = "also-missing";
    process.env.ELEVENLABS_FALLBACK_VOICE_ID = "also-missing-2";

    await expect(
      synthesizeWithProvider({ scriptText: "Hello", durationSeconds: 2 })
    ).rejects.not.toThrow(/configure ELEVENLABS_API_KEY/);
  });

  it("surfaces paid-plan guidance when library voice blocked and no OpenAI key", async () => {
    process.env.ELEVENLABS_VOICE_ID = LIBRARY_VOICE;
    fetchMock.mockResolvedValue({
      ok: false,
      status: 402,
      text: async () => PAID_PLAN_BODY,
    });

    await expect(
      synthesizeWithProvider({ scriptText: "Hello", durationSeconds: 2 })
    ).rejects.toThrow(/requires a paid plan on free accounts/);
  });
});
