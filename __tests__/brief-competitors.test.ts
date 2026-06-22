import { describe, it, expect } from "vitest";
import {
  computeCompetitorConfidence,
  mergeBriefCompetitors,
  parseExistingGuesses,
  type BriefCompetitorEntry,
} from "@/services/intelligence/memory/merge-brief-competitors";
import type { CompetitorStrategyProfile } from "@/services/intelligence/deep-discovery/schema";

function profile(overrides: Partial<CompetitorStrategyProfile> & { name: string }): CompetitorStrategyProfile {
  return {
    name: overrides.name,
    kind: overrides.kind ?? "direct",
    platforms: overrides.platforms ?? [],
    handles: overrides.handles ?? [],
    what_they_do: overrides.what_they_do ?? "Does competitor things.",
    working_patterns: overrides.working_patterns ?? [],
    hooks: overrides.hooks ?? [],
    formats: overrides.formats ?? [],
    evidence_urls: overrides.evidence_urls ?? [],
    confidence: overrides.confidence ?? "low",
    caveats: overrides.caveats ?? [],
  };
}

describe("mergeBriefCompetitors", () => {
  it("marks discovery competitors with evidence as verified", () => {
    const merged = mergeBriefCompetitors(
      [],
      [profile({ name: "RoUI", evidence_urls: ["https://roui.dev", "https://x.com/roui"], confidence: "high" })]
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].verification).toBe("verified");
    expect(merged[0].evidence_count).toBe(2);
    expect(merged[0].confidence).toBe("high");
    expect(merged[0].url).toBe("https://roui.dev");
  });

  it("downgrades single-source competitors away from high confidence", () => {
    const merged = mergeBriefCompetitors(
      [],
      [profile({ name: "Solo", evidence_urls: ["https://solo.dev"], confidence: "high" })]
    );
    expect(merged[0].verification).toBe("verified");
    expect(merged[0].confidence).toBe("medium");
  });

  it("keeps model guesses but labels them unverified and low", () => {
    const merged = mergeBriefCompetitors(
      [{ name: "Figma", reason: "general knowledge", confidence: "low" }],
      []
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].verification).toBe("unverified");
    expect(merged[0].confidence).toBe("low");
    expect(merged[0].evidence_count).toBe(0);
  });

  it("lets verified discovery competitors win over a same-name guess", () => {
    const merged = mergeBriefCompetitors(
      [{ name: "roui", reason: "guess", confidence: "low" }],
      [profile({ name: "RoUI", evidence_urls: ["https://roui.dev", "https://devforum.roblox.com/t/roui"] })]
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].verification).toBe("verified");
    expect(merged[0].evidence_count).toBe(2);
  });

  it("sorts verified competitors first, most-evidenced on top", () => {
    const merged = mergeBriefCompetitors(
      [{ name: "GuessCo", reason: "", confidence: "low" }],
      [
        profile({ name: "OneSource", evidence_urls: ["https://a.com"] }),
        profile({ name: "TwoSource", evidence_urls: ["https://b.com", "https://c.com"] }),
      ]
    );
    expect(merged.map((m) => m.name)).toEqual(["TwoSource", "OneSource", "GuessCo"]);
  });

  it("uses linked candidate count as evidence when it exceeds synthesis URLs", () => {
    const linked = new Map<string, number>([["roui", 4]]);
    const merged = mergeBriefCompetitors(
      [],
      [profile({ name: "RoUI", evidence_urls: ["https://roui.dev"], confidence: "low" })],
      linked
    );
    // synthesis returned only 1 URL, but 4 source_candidates link to this
    // competitor — the brief should reflect the richer evidence count and
    // promote confidence from "low" to "medium".
    expect(merged[0].evidence_count).toBe(4);
    expect(merged[0].confidence).toBe("medium");
  });

  it("dedupes evidence urls when counting", () => {
    const merged = mergeBriefCompetitors(
      [],
      [profile({ name: "Dup", evidence_urls: ["https://a.com", "https://A.com", "https://a.com"] })]
    );
    expect(merged[0].evidence_count).toBe(1);
  });
});

describe("computeCompetitorConfidence", () => {
  const verified = (count: number): BriefCompetitorEntry => ({
    name: `c${count}`,
    url: null,
    reason: "",
    confidence: "medium",
    verification: "verified",
    evidence_count: count,
    evidence_urls: [],
  });
  const guess: BriefCompetitorEntry = {
    name: "g",
    url: null,
    reason: "",
    confidence: "low",
    verification: "unverified",
    evidence_count: 0,
    evidence_urls: [],
  };

  it("is low with only guesses", () => {
    expect(computeCompetitorConfidence([guess])).toBe("low");
  });

  it("is medium with one evidence-backed competitor", () => {
    expect(computeCompetitorConfidence([verified(1), guess])).toBe("medium");
  });

  it("is high with two strongly-verified competitors", () => {
    expect(computeCompetitorConfidence([verified(2), verified(3)])).toBe("high");
  });

  it("stays medium when verified competitors only have one source each", () => {
    expect(computeCompetitorConfidence([verified(1), verified(1)])).toBe("medium");
  });
});

describe("parseExistingGuesses", () => {
  it("handles string arrays and object arrays", () => {
    expect(parseExistingGuesses(["A", "B"]).map((g) => g.name)).toEqual(["A", "B"]);
    expect(parseExistingGuesses([{ name: "C", url: "https://c.com", reason: "r" }])[0]).toEqual({
      name: "C",
      url: "https://c.com",
      reason: "r",
    });
  });

  it("ignores malformed entries", () => {
    expect(parseExistingGuesses([null, {}, { name: "" }, 5])).toEqual([]);
  });
});
