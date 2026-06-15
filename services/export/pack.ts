import JSZip from "jszip";

export interface ExportPostInput {
  id: string;
  format: string | null;
  platform: string | null;
  hook: string | null;
  caption: string | null;
  cta: string | null;
  target_audience: string | null;
  hypothesis: string | null;
  metric_to_watch: string | null;
  status: string;
  slides: Array<{ slide_number: number; headline: string | null; body: string | null }>;
}

export interface BuildExportInput {
  projectName: string;
  posts: ExportPostInput[];
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

export function buildPostsCsv(posts: ExportPostInput[]): string {
  const header = [
    "id",
    "platform",
    "format",
    "status",
    "hook",
    "target_audience",
    "hypothesis",
    "metric_to_watch",
    "cta",
    "caption",
  ].join(",");

  const rows = posts.map((p) =>
    [
      csvEscape(p.id),
      csvEscape(p.platform),
      csvEscape(p.format),
      csvEscape(p.status),
      csvEscape(p.hook),
      csvEscape(p.target_audience),
      csvEscape(p.hypothesis),
      csvEscape(p.metric_to_watch),
      csvEscape(p.cta),
      csvEscape(p.caption),
    ].join(",")
  );

  return [header, ...rows].join("\n");
}

export function buildCaptionsTxt(posts: ExportPostInput[]): string {
  return posts
    .map((p) => {
      const slides = p.slides
        .map((s) => `  ${s.slide_number}. ${s.headline ?? ""}${s.body ? `\n     ${s.body}` : ""}`)
        .join("\n");
      return [
        `--- ${p.id} ---`,
        `Hook: ${p.hook ?? ""}`,
        `Platform: ${p.platform ?? ""}`,
        `Format: ${p.format ?? ""}`,
        `Audience: ${p.target_audience ?? ""}`,
        `Hypothesis: ${p.hypothesis ?? ""}`,
        `Metric to watch: ${p.metric_to_watch ?? ""}`,
        ``,
        `Slides:`,
        slides || "  (none)",
        ``,
        `Caption:`,
        p.caption ?? "",
        ``,
        `CTA:`,
        p.cta ?? "",
      ].join("\n");
    })
    .join("\n\n");
}

export function buildScheduleCsv(posts: ExportPostInput[]): string {
  const header = ["post_id", "platform", "scheduled_for", "status", "hook"].join(",");
  const rows = posts.map((p) =>
    [csvEscape(p.id), csvEscape(p.platform), "", csvEscape(p.status), csvEscape(p.hook)].join(",")
  );
  return [header, ...rows].join("\n");
}

export function buildExperimentTrackerCsv(posts: ExportPostInput[]): string {
  const header = [
    "post_id",
    "platform",
    "hook",
    "format",
    "metric_to_watch",
    "date_posted",
    "views",
    "saves",
    "shares",
    "comments",
    "clicks",
    "signups",
    "purchases",
    "revenue",
    "status",
    "notes",
  ].join(",");
  const rows = posts.map((p) =>
    [
      csvEscape(p.id),
      csvEscape(p.platform),
      csvEscape(p.hook),
      csvEscape(p.format),
      csvEscape(p.metric_to_watch),
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ].join(",")
  );
  return [header, ...rows].join("\n");
}

export function buildPostizPayloads(posts: ExportPostInput[]): unknown[] {
  return posts.map((p) => ({
    external_ref: p.id,
    platform: p.platform,
    caption: p.caption,
    cta: p.cta,
    slides: p.slides.map((s) => ({ headline: s.headline, body: s.body })),
  }));
}

export async function buildExportZip(input: BuildExportInput): Promise<Uint8Array> {
  const zip = new JSZip();
  const root = zip.folder("autoscale-export") ?? zip;

  root.file("posts.csv", buildPostsCsv(input.posts));
  root.file(
    "posts.json",
    JSON.stringify({ project: input.projectName, generated_at: input.generatedAt ?? new Date().toISOString(), posts: input.posts }, null, 2)
  );
  root.file("captions.txt", buildCaptionsTxt(input.posts));
  root.file("schedule.csv", buildScheduleCsv(input.posts));
  root.file("experiment-tracker.csv", buildExperimentTrackerCsv(input.posts));
  root.file("postiz-payloads.json", JSON.stringify(buildPostizPayloads(input.posts), null, 2));
  root.file(
    "README.md",
    [
      `# AutoScale export — ${input.projectName}`,
      ``,
      `Generated: ${input.generatedAt ?? new Date().toISOString()}`,
      `Posts: ${input.posts.length}`,
      ``,
      `Contents:`,
      `- posts.csv — flat post metadata`,
      `- posts.json — full structured payload`,
      `- captions.txt — copy-paste captions + CTA per post`,
      `- schedule.csv — empty schedule template`,
      `- experiment-tracker.csv — empty metrics template`,
      `- postiz-payloads.json — Postiz-ready payload preview`,
      ``,
      `Protect the chain: source → insight → hook → post → metric → variant.`,
    ].join("\n")
  );

  return zip.generateAsync({ type: "uint8array" });
}
