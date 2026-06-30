import "server-only";

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { renderSlidePng } from "./slide-renderer";

export interface ScreenDemoInput {
  sourceUrl?: string | null;
  aspectRatio?: string;
  durationSeconds: number;
  brandColor?: string | null;
}

export interface ScreenDemoResult {
  filePath: string;
  kind: "video" | "image";
  isPlaceholder: boolean;
}

/**
 * Resolve screen-demo scene: download user clip OR render placeholder slide.
 */
export async function resolveScreenDemo(
  input: ScreenDemoInput,
  workDir: string
): Promise<ScreenDemoResult> {
  const url = input.sourceUrl?.trim();
  if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        const contentType = res.headers.get("content-type") ?? "";
        const isVideo =
          contentType.includes("video") || /\.(mp4|webm|mov)(\?|$)/i.test(url);
        const ext = isVideo ? "mp4" : "png";
        const filePath = join(workDir, `screen-demo.${ext}`);
        await writeFile(filePath, buf);
        return {
          filePath,
          kind: isVideo ? "video" : "image",
          isPlaceholder: false,
        };
      }
    } catch {
      // Fall through to placeholder.
    }
  }

  const placeholderText = "Upload demo clip — replace with your product screen recording.";
  const buffer = await renderSlidePng({
    onScreenText: placeholderText,
    role: "demo",
    purpose: "demo",
    aspectRatio: input.aspectRatio ?? "9:16",
    brandColor: input.brandColor,
  });
  const filePath = join(workDir, `screen-demo-placeholder.png`);
  await writeFile(filePath, buffer);
  return { filePath, kind: "image", isPlaceholder: true };
}
