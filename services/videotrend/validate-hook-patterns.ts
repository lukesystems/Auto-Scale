import type { VideoTrendReport } from "@/services/growth-run/schema";

export interface EvidenceUrlPacket {
  id: string;
  url: string;
  platform: string;
  handle: string | null;
}

export interface HookPatternValidationMeta {
  valid_count: number;
  dropped_count: number;
  dropped_urls: string[];
  kept_fallback: boolean;
  fallback_reason: string | null;
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, "");
  } catch {
    return url.trim().replace(/\/$/, "");
  }
}

function isUrlInEvidenceSet(referenceUrl: string, evidenceUrls: Set<string>): boolean {
  if (!referenceUrl?.trim()) return false;
  const normalized = normalizeUrl(referenceUrl);
  if (evidenceUrls.has(normalized)) return true;
  // Allow exact raw match when normalization differs slightly.
  return evidenceUrls.has(referenceUrl.trim());
}

/**
 * Drop hook patterns whose reference_url is not in the loaded evidence set.
 * If every hook would be dropped, keep one low-confidence fallback tied to the
 * first evidence URL so the schema minimum is satisfied.
 */
export function validateHookPatterns(
  report: Pick<VideoTrendReport, "hook_patterns" | "confidence">,
  evidencePackets: EvidenceUrlPacket[]
): {
  hook_patterns: VideoTrendReport["hook_patterns"];
  confidence: number;
  validation: HookPatternValidationMeta;
} {
  const evidenceUrlSet = new Set(
    evidencePackets.map((packet) => normalizeUrl(packet.url)).filter(Boolean)
  );

  const valid: VideoTrendReport["hook_patterns"] = [];
  const droppedUrls: string[] = [];

  for (const hook of report.hook_patterns) {
    if (isUrlInEvidenceSet(hook.reference_url, evidenceUrlSet)) {
      valid.push(hook);
    } else {
      droppedUrls.push(hook.reference_url ?? "(missing)");
      console.warn("[videotrend] dropped hook with invalid reference_url", {
        label: hook.label,
        reference_url: hook.reference_url,
      });
    }
  }

  let hook_patterns = valid;
  let confidence = report.confidence;
  let keptFallback = false;
  let fallbackReason: string | null = null;

  if (hook_patterns.length === 0 && report.hook_patterns.length > 0) {
    const fallbackUrl = evidencePackets[0]?.url;
    const source = report.hook_patterns[0]!;
    if (fallbackUrl) {
      hook_patterns = [
        {
          ...source,
          reference_url: fallbackUrl,
          when_to_use: [source.when_to_use, "Low-confidence fallback — hook lacked valid evidence URL."]
            .filter(Boolean)
            .join(" "),
        },
      ];
      keptFallback = true;
      fallbackReason = "All hook reference_urls failed validation; kept one fallback tied to top evidence.";
      confidence = Math.min(confidence, 0.25);
      console.warn("[videotrend] kept low-confidence hook fallback", { fallbackUrl });
    } else {
      hook_patterns = [source];
      keptFallback = true;
      fallbackReason =
        "No evidence URLs available for validation; kept one unverified hook and reduced confidence.";
      confidence = Math.min(confidence, 0.15);
    }
  } else if (droppedUrls.length > 0) {
    confidence = Math.min(confidence, Math.max(0.2, confidence - droppedUrls.length * 0.05));
  }

  return {
    hook_patterns,
    confidence,
    validation: {
      valid_count: hook_patterns.length,
      dropped_count: droppedUrls.length,
      dropped_urls: droppedUrls,
      kept_fallback: keptFallback,
      fallback_reason: fallbackReason,
    },
  };
}
