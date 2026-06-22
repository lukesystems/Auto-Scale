import JSZip from "jszip";

export interface GrowthRunExportVideo {
  videoId: string;
  conceptId: string;
  platform: string;
  videoType: string;
  hook: string;
  caption: string;
  hashtags: string[];
  mediaUrl: string | null;
  scheduledFor: string | null;
  accountHandle: string | null;
}

export interface BuildGrowthRunExportInput {
  projectName: string;
  growthRunId: string;
  videos: GrowthRunExportVideo[];
  generatedAt?: string;
}

function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes("\n") || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildGrowthRunScheduleCsv(videos: GrowthRunExportVideo[]): string {
  const header = [
    "video_id",
    "platform",
    "account_handle",
    "scheduled_for",
    "hook",
    "media_url",
    "caption",
  ].join(",");
  const rows = videos.map((v) =>
    [
      csvEscape(v.videoId),
      csvEscape(v.platform),
      csvEscape(v.accountHandle),
      csvEscape(v.scheduledFor),
      csvEscape(v.hook),
      csvEscape(v.mediaUrl),
      csvEscape(v.caption),
    ].join(",")
  );
  return [header, ...rows].join("\n");
}

export async function buildGrowthRunExportZip(input: BuildGrowthRunExportInput): Promise<Uint8Array> {
  const zip = new JSZip();
  const root = zip.folder(`growth-run-${input.growthRunId.slice(0, 8)}`) ?? zip;

  root.file("schedule.csv", buildGrowthRunScheduleCsv(input.videos));
  root.file(
    "videos.json",
    JSON.stringify(
      {
        project: input.projectName,
        growth_run_id: input.growthRunId,
        generated_at: input.generatedAt ?? new Date().toISOString(),
        videos: input.videos,
      },
      null,
      2
    )
  );
  root.file(
    "captions.txt",
    input.videos
      .map(
        (v) =>
          `--- ${v.videoId} (${v.platform}) ---\nHook: ${v.hook}\n\n${v.caption}\n\nHashtags: ${v.hashtags.join(" ")}\nMedia: ${v.mediaUrl ?? "(pending)"}`
      )
      .join("\n\n")
  );
  root.file(
    "README.md",
    [
      `# Growth Run export — ${input.projectName}`,
      ``,
      `Run: ${input.growthRunId}`,
      `Videos: ${input.videos.length}`,
      ``,
      `Use schedule.csv + captions.txt when Postiz is unavailable.`,
      `Download MP4s from media_url in videos.json and upload manually if needed.`,
    ].join("\n")
  );

  return zip.generateAsync({ type: "uint8array" });
}
