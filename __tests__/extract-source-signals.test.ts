import { describe, it, expect } from "vitest";
import { extractSourceSignals } from "@/services/intelligence/patterns/extract-source-signals";
import type { TrendWatchSourceRow } from "@/services/intelligence/patterns/load-pattern-context";

function mockSource(overrides: Partial<TrendWatchSourceRow> = {}): TrendWatchSourceRow {
  return {
    id: "source-1",
    project_id: "project-1",
    run_id: null,
    source_url: "https://example.com/post",
    platform: "linkedin",
    account_handle: "founder",
    account_type: "creator",
    caption: null,
    published_at: null,
    follower_count: null,
    views: null,
    likes: null,
    saves: null,
    shares: null,
    comments: null,
    format: "thread",
    hook: "Stop guessing what to post",
    angle: "distribution problem",
    visual_pattern: "carousel",
    cta_pattern: "Paste your URL",
    audience_pain: "Founders do not know what to post after shipping",
    why_it_worked: "Clear founder pain",
    how_to_adapt: "Position as distribution intelligence",
    distortion_risk: "low",
    transferability_score: 0.5,
    notes: null,
    screenshot_url: null,
    fetch_status: "success",
    fetched_text: null,
    fetch_metadata: {},
    confidence_score: 0.6,
    scoring_reasons: [],
    signal_score: 0.5,
    created_at: new Date().toISOString(),
    ...overrides,
  } as TrendWatchSourceRow;
}

describe("extract-source-signals", () => {
  it("extracts hook, pain, angle, format, CTA, visual, and positioning signals", () => {
    const bucket = extractSourceSignals(mockSource());

    expect(bucket.signals.hook.some((s) => s.text.includes("Stop guessing"))).toBe(true);
    expect(bucket.signals.pain.some((s) => s.text.includes("do not know what to post"))).toBe(true);
    expect(bucket.signals.angle.some((s) => s.text.includes("distribution problem"))).toBe(true);
    expect(bucket.signals.format.some((s) => s.text.includes("thread"))).toBe(true);
    expect(bucket.signals.cta.some((s) => s.text.includes("Paste your URL"))).toBe(true);
    expect(bucket.signals.visual.some((s) => s.text.includes("carousel"))).toBe(true);
    expect(bucket.signals.positioning.length).toBeGreaterThan(0);
  });

  it("does not read rejected candidates — only trendwatch source rows are passed in", () => {
    const bucket = extractSourceSignals(mockSource({ hook: "Accepted source hook" }));
    expect(bucket.sourceId).toBe("source-1");
    expect(bucket.signals.hook[0]?.text).toContain("Accepted source hook");
  });
});
