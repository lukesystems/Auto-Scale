import "server-only";

import { extractVideoEvidence } from "./extract-video-evidence";
import { saveVideoEvidence } from "./save-video-evidence";
import { canonicalizeVideoUrl, isSupportedPublicVideoUrl } from "./video-url";

export function parseManualVideoUrls(value: string): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const token of value.split(/[\s,]+/)) {
    const trimmed = token.trim();
    if (!trimmed || !isSupportedPublicVideoUrl(trimmed)) continue;
    const canonical = canonicalizeVideoUrl(trimmed);
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    urls.push(trimmed);
    if (urls.length >= 20) break;
  }
  return urls;
}

export async function importManualVideoEvidence(input: { projectId: string; urls: string[]; briefKeywords?: string[] }) {
  const results: Array<{ url: string; ok: boolean; error: string | null }> = [];
  for (const url of input.urls.slice(0, 20)) {
    try {
      const evidence = await extractVideoEvidence(url);
      await saveVideoEvidence({ evidence, projectId: input.projectId, briefKeywords: input.briefKeywords });
      results.push({ url, ok: true, error: null });
    } catch (error) {
      results.push({ url, ok: false, error: error instanceof Error ? error.message : "Import failed." });
    }
  }
  return results;
}
