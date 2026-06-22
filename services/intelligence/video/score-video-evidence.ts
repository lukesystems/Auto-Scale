import type { VideoEvidence } from "./schema";

export interface VideoEvidenceScore {
  score: number;
  reasons: string[];
}

export function scoreVideoEvidence(evidence: VideoEvidence, briefKeywords: string[] = []): VideoEvidenceScore {
  let score = 0;
  const reasons: string[] = [];
  const add = (points: number, reason: string) => {
    score += points;
    reasons.push(reason);
  };

  if (evidence.platform !== "other") add(0.12, "Supported short-form platform.");
  if (evidence.rawSourceType === "video") add(0.08, "Direct video URL.");
  if (evidence.fetchStatus === "success") add(0.14, "Public page fetched successfully.");
  if (evidence.caption || evidence.title) add(0.12, "Visible title or caption extracted.");
  if (evidence.accountHandle || evidence.accountUrl) add(0.08, "Public account identity available.");
  if (evidence.hashtags.length) add(0.05, "Visible hashtags extracted.");
  if (evidence.linkedUrls.length) add(0.06, "Visible outbound links extracted.");
  if (evidence.detectedHook) add(0.08, "Hook evidence extracted.");
  if (evidence.detectedCTA) add(0.06, "CTA evidence extracted.");
  if (evidence.formatGuess !== "unknown") add(0.06, "Format identified deterministically.");
  if ([evidence.viewCount, evidence.likeCount, evidence.commentCount, evidence.shareCount].some((value) => value != null)) {
    add(0.08, "At least one visible engagement metric extracted.");
  }

  const text = [evidence.caption, evidence.title, evidence.detectedHook, ...evidence.hashtags].filter(Boolean).join(" ").toLowerCase();
  const normalizedKeywords = briefKeywords.map((keyword) => keyword.trim().toLowerCase()).filter((keyword) => keyword.length >= 3);
  if (normalizedKeywords.some((keyword) => text.includes(keyword))) add(0.07, "Matches saved product brief language.");
  if (evidence.competitorId) add(0.06, "Linked to a known competitor.");

  return { score: Math.min(1, Math.round(score * 100) / 100), reasons };
}
