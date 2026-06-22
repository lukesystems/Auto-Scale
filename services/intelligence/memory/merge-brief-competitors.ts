import type { BriefConfidenceLevel } from "@/services/autobrief/schema";
import type { CompetitorStrategyProfile } from "../deep-discovery/schema";

/**
 * Truth-labelled competitor as stored on the brief (`product_briefs.likely_competitors`).
 * Closes the loop between deep discovery (evidence-backed) and the brief the
 * founder actually reads. `verified` entries are backed by discovered source
 * URLs; `unverified` entries are model guesses with no external evidence.
 */
export interface BriefCompetitorEntry {
  name: string;
  url: string | null;
  reason: string;
  confidence: BriefConfidenceLevel;
  verification: "verified" | "unverified";
  evidence_count: number;
  evidence_urls: string[];
  kind?: string;
}

const MAX_EVIDENCE_SAMPLE = 5;
const UNVERIFIED_REASON = "Model guess — not verified against external evidence.";

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function uniqueUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const url = typeof raw === "string" ? raw.trim() : "";
    if (!url) continue;
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(url);
  }
  return out;
}

/** Best-effort parse of whatever currently sits in `likely_competitors` JSON. */
export function parseExistingGuesses(value: unknown): { name: string; url: string | null; reason: string }[] {
  if (!Array.isArray(value)) return [];
  const out: { name: string; url: string | null; reason: string }[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      if (item.trim()) out.push({ name: item.trim(), url: null, reason: "" });
      continue;
    }
    if (item && typeof item === "object" && "name" in item) {
      const name = String((item as { name: unknown }).name ?? "").trim();
      if (!name) continue;
      const url = "url" in item && (item as { url?: unknown }).url ? String((item as { url: unknown }).url) : null;
      const reason = "reason" in item && (item as { reason?: unknown }).reason ? String((item as { reason: unknown }).reason) : "";
      out.push({ name, url, reason });
    }
  }
  return out;
}

function profileToEntry(
  profile: CompetitorStrategyProfile,
  linkedCandidates = 0
): BriefCompetitorEntry {
  const evidence = uniqueUrls(profile.evidence_urls ?? []);
  // Linked source candidates are independent corroborating evidence — a
  // competitor with only one synthesis URL but five linked candidates should
  // be treated as well-evidenced.
  const evidenceCount = Math.max(evidence.length, linkedCandidates);
  const verified = evidenceCount >= 1;
  // Truth-first: never let a competitor read higher than "low" without evidence,
  // cap at "medium" unless there are multiple corroborating sources, and
  // bump "low" to "medium" once at least 2 independent sources back the entry
  // (a competitor with 4 linked candidates is more than a single guess).
  let confidence: BriefConfidenceLevel = profile.confidence ?? "low";
  if (!verified) confidence = "low";
  else if (evidenceCount < 2 && confidence === "high") confidence = "medium";
  else if (evidenceCount >= 2 && confidence === "low") confidence = "medium";

  return {
    name: profile.name.trim(),
    url: evidence[0] ?? null,
    reason: profile.what_they_do?.trim() || "Discovered competitor.",
    confidence,
    verification: verified ? "verified" : "unverified",
    evidence_count: evidenceCount,
    evidence_urls: evidence.slice(0, MAX_EVIDENCE_SAMPLE),
    kind: profile.kind,
  };
}

/**
 * Merge evidence-backed discovery competitors with the brief's existing model
 * guesses. Verified entries win on name collisions; remaining guesses are kept
 * but explicitly downgraded and labelled unverified. Verified entries are
 * sorted first (most-evidenced first) so the founder sees true things on top.
 */
export function mergeBriefCompetitors(
  existing: unknown,
  synthesisCompetitors: CompetitorStrategyProfile[],
  linkedCandidateCounts: Map<string, number> = new Map()
): BriefCompetitorEntry[] {
  const byName = new Map<string, BriefCompetitorEntry>();

  for (const profile of synthesisCompetitors) {
    const name = profile.name?.trim();
    if (!name) continue;
    const linkedCount = linkedCandidateCounts.get(normalizeName(name)) ?? 0;
    const entry = profileToEntry(profile, linkedCount);
    const key = normalizeName(name);
    const prior = byName.get(key);
    // Keep the richer (more evidence) profile if the same competitor appears twice.
    if (!prior || entry.evidence_count > prior.evidence_count) byName.set(key, entry);
  }

  for (const guess of parseExistingGuesses(existing)) {
    const key = normalizeName(guess.name);
    if (byName.has(key)) continue; // already covered by a verified/synthesis entry
    byName.set(key, {
      name: guess.name,
      url: guess.url,
      reason: guess.reason?.trim() || UNVERIFIED_REASON,
      confidence: "low",
      verification: "unverified",
      evidence_count: 0,
      evidence_urls: [],
    });
  }

  return [...byName.values()].sort((a, b) => {
    if (a.verification !== b.verification) return a.verification === "verified" ? -1 : 1;
    return b.evidence_count - a.evidence_count;
  });
}

/**
 * Derive the brief's `confidence.competitors` band from evidence, not vibes.
 * - high: at least 2 competitors each backed by 2+ sources
 * - medium: at least 1 evidence-backed competitor
 * - low: only guesses
 */
export function computeCompetitorConfidence(entries: BriefCompetitorEntry[]): BriefConfidenceLevel {
  const stronglyVerified = entries.filter((e) => e.verification === "verified" && e.evidence_count >= 2).length;
  const verified = entries.filter((e) => e.verification === "verified").length;
  if (stronglyVerified >= 2) return "high";
  if (verified >= 1) return "medium";
  return "low";
}
