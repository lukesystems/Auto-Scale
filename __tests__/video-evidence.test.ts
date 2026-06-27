import { describe, expect, it } from "vitest";
import {
  detectVideoPlatform,
  detectVideoSourceType,
  canonicalizeVideoUrl,
  extractVideoAccountHandle,
  inspectVideoUrl,
} from "@/services/intelligence/video/video-url";
import {
  detectCTA,
  extractHashtags,
  extractHook,
  extractLinkedUrls,
  extractVisibleFollowerCount,
  extractVisibleMetric,
  guessVideoFormat,
  parseMetric,
} from "@/services/intelligence/video/extract-video-evidence";
import {
  buildVideoDiscoveryQueries,
  dedupeVideoCandidates,
  inferVideoAccountType,
  rankNadiaVideoCandidate,
} from "@/services/intelligence/video/discover-video-evidence";
import { toVideoEvidenceRow } from "@/services/intelligence/video/save-video-evidence";
import { VideoEvidenceSchema } from "@/services/intelligence/video/schema";

describe("video URL normalization", () => {
  it("detects platforms and public source types", () => {
    expect(detectVideoPlatform("https://www.tiktok.com/@acme/video/123")).toBe("tiktok");
    expect(detectVideoSourceType("https://www.tiktok.com/@acme/video/123")).toBe("video");
    expect(detectVideoSourceType("https://instagram.com/reel/ABC/")).toBe("video");
    expect(detectVideoSourceType("https://youtube.com/@acme")).toBe("profile");
    expect(detectVideoSourceType("https://youtube.com/shorts/xyz")).toBe("video");
  });

  it("canonicalizes share URLs without tracking parameters", () => {
    expect(canonicalizeVideoUrl("http://www.tiktok.com/@Acme/video/123/?utm_source=x#comments"))
      .toBe("https://tiktok.com/@Acme/video/123");
    expect(canonicalizeVideoUrl("https://youtu.be/abc123?si=secret"))
      .toBe("https://youtube.com/shorts/abc123");
  });

  it("extracts account handles only when the URL exposes them", () => {
    expect(extractVideoAccountHandle("https://tiktok.com/@Acme/video/123")).toBe("acme");
    expect(extractVideoAccountHandle("https://instagram.com/acme/")).toBe("acme");
    expect(extractVideoAccountHandle("https://instagram.com/reel/ABC")).toBeNull();
    expect(inspectVideoUrl("https://youtube.com/@Acme").accountUrl).toBe("https://youtube.com/@acme");
  });
});

describe("deterministic visible evidence extraction", () => {
  it("extracts unique hashtags and public linked URLs", () => {
    expect(extractHashtags("Build faster #SaaS #Growth #saas")).toEqual(["#saas", "#growth"]);
    expect(extractLinkedUrls("Visit https://acme.com/demo.", '<a href="https://docs.acme.com/start">Docs</a>'))
      .toEqual(["https://acme.com/demo", "https://docs.acme.com/start"]);
  });

  it("detects CTAs, hooks, and formats without inventing text", () => {
    expect(detectCTA("Three lessons from launch. Follow for more founder experiments!"))
      .toBe("Follow for more founder experiments!");
    expect(detectCTA("An observation with no ask.")).toBeNull();
    expect(extractHook("Stop wasting hours on reports. Here is the fix.")).toBe("Stop wasting hours on reports.");
    expect(guessVideoFormat("How to build a landing page step-by-step")).toBe("tutorial");
    expect(guessVideoFormat("Acme vs Beta: which is faster?")).toBe("comparison");
    expect(guessVideoFormat("A quiet day at the office")).toBe("unknown");
  });

  it("parses only explicit metric strings", () => {
    expect(parseMetric("1.2K")).toBe(1_200);
    expect(parseMetric("3M")).toBe(3_000_000);
    expect(parseMetric("1,234")).toBe(1_234);
    expect(parseMetric("lots")).toBeNull();
    expect(extractVisibleMetric("This video has 1.2K views and 82 likes", "views")).toBe(1_200);
    expect(extractVisibleMetric("No public count", "views")).toBeNull();
    expect(extractVisibleFollowerCount("Creator with 125K followers on TikTok")).toBe(125_000);
    expect(extractVisibleFollowerCount("No follower count")).toBeNull();
  });
});

describe("video search discovery", () => {
  it("generates bounded index queries across all three platforms and competitors", () => {
    const queries = buildVideoDiscoveryQueries({
      category: "developer tools",
      primaryPain: "slow deployments",
      competitors: ["Acme"],
    });
    expect(queries.length).toBeLessThanOrEqual(9);
    expect(queries.some((item) => item.query.includes("site:tiktok.com"))).toBe(true);
    expect(queries.some((item) => item.query.includes("site:instagram.com/reel"))).toBe(true);
    expect(queries.some((item) => item.query.includes("site:youtube.com/shorts"))).toBe(true);
    expect(queries.some((item) => item.query.includes('"Acme" "TikTok"'))).toBe(true);
    expect(queries.some((item) => item.query.includes("10k followers"))).toBe(true);
    expect(queries.some((item) => item.query.includes("shadow account"))).toBe(true);
  });

  it("infers shadow accounts and ranks Nadia candidates", () => {
    expect(inferVideoAccountType({
      evidence: { accountHandle: "acme_fan", competitorId: null, followerCount: 45_000 },
      competitorNames: ["Acme"],
      snippet: "Unofficial Acme walkthrough",
      title: null,
      caption: null,
    })).toBe("shadow");

    const shadowRank = rankNadiaVideoCandidate({
      score: 0.5,
      evidence: VideoEvidenceSchema.parse({
        platform: "tiktok",
        videoUrl: "https://tiktok.com/@fan/video/1",
        canonicalUrl: "https://tiktok.com/@fan/video/1",
        accountType: "shadow",
        followerCount: 80_000,
        fetchStatus: "success",
        fetchMethod: "safe_public_html",
        rawSourceType: "video",
      }),
    });
    const megaRank = rankNadiaVideoCandidate({
      score: 0.5,
      evidence: VideoEvidenceSchema.parse({
        platform: "tiktok",
        videoUrl: "https://tiktok.com/@mega/video/2",
        canonicalUrl: "https://tiktok.com/@mega/video/2",
        accountType: "creator",
        followerCount: 2_000_000,
        fetchStatus: "success",
        fetchMethod: "safe_public_html",
        rawSourceType: "video",
      }),
    });
    expect(shadowRank).toBeGreaterThan(megaRank);
    expect(megaRank).toBe(-Infinity);
  });

  it("deduplicates by canonical URL", () => {
    const deduped = dedupeVideoCandidates([
      { url: "https://youtube.com/shorts/abc?si=one", title: "first" },
      { url: "https://www.youtube.com/shorts/abc?utm_source=two", title: "second" },
    ]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.title).toBe("first");
  });
});

describe("video persistence shape", () => {
  it("maps normalized evidence to nullable database columns and metadata", () => {
    const evidence = VideoEvidenceSchema.parse({
      projectId: "11111111-1111-4111-8111-111111111111",
      platform: "youtube",
      videoUrl: "https://youtube.com/shorts/abc",
      canonicalUrl: "https://youtube.com/shorts/abc",
      title: "How to deploy faster",
      fetchStatus: "success",
      fetchMethod: "safe_public_html",
      rawSourceType: "video",
      metadata: { observed: true },
    });
    const row = toVideoEvidenceRow(evidence);
    expect(row).toMatchObject({
      project_id: evidence.projectId,
      platform: "youtube",
      canonical_url: evidence.canonicalUrl,
      view_count: null,
      metadata: { observed: true },
    });
  });

  it("persists follower_count and account_type in metadata when set", () => {
    const evidence = VideoEvidenceSchema.parse({
      projectId: "11111111-1111-4111-8111-111111111111",
      platform: "tiktok",
      videoUrl: "https://tiktok.com/@creator/video/1",
      canonicalUrl: "https://tiktok.com/@creator/video/1",
      followerCount: 120_000,
      accountType: "shadow",
      fetchStatus: "success",
      fetchMethod: "safe_public_html",
      rawSourceType: "video",
    });
    expect(toVideoEvidenceRow(evidence).metadata).toMatchObject({
      follower_count: 120_000,
      account_type: "shadow",
    });
  });
});
