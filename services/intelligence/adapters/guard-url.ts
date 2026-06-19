import { assertSafePublicHttpUrl, UnsafeUrlError } from "@/services/trendwatch/ingestion";
import type { CrawlAdapterName, CrawledPageContent } from "../types";

export { assertSafePublicHttpUrl, UnsafeUrlError };

export async function guardAdapterTargetUrl(url: string): Promise<void> {
  await assertSafePublicHttpUrl(url);
}

export function failedPageForUnsafeUrl(
  url: string,
  error: unknown,
  adapterUsed: CrawlAdapterName
): CrawledPageContent {
  const message =
    error instanceof UnsafeUrlError
      ? error.message
      : error instanceof Error
        ? error.message
        : "Unsafe URL rejected.";

  return {
    url,
    finalUrl: url,
    title: null,
    description: null,
    headings: [],
    ctas: [],
    bodyText: "",
    markdown: "",
    html: null,
    adapterUsed,
    fetchStatus: "failed",
    error: message,
  };
}

export async function filterSafeResultUrls<T extends { url: string }>(items: T[]): Promise<T[]> {
  const safe: T[] = [];
  for (const item of items) {
    try {
      await assertSafePublicHttpUrl(item.url);
      safe.push(item);
    } catch {
      // Drop candidates that fail the public-host safety check.
    }
  }
  return safe;
}
