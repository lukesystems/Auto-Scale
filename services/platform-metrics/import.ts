import { z } from "zod";

export const MetricCsvRowSchema = z.object({
  schedule_item_id: z.string().uuid().optional(),
  video_id: z.string().uuid().optional(),
  post_url: z.string().url().optional(),
  views: z.coerce.number().int().nonnegative().optional(),
  likes: z.coerce.number().int().nonnegative().optional(),
  comments: z.coerce.number().int().nonnegative().optional(),
  shares: z.coerce.number().int().nonnegative().optional(),
  saves: z.coerce.number().int().nonnegative().optional(),
  completion_rate: z.coerce.number().min(0).max(1).optional(),
  link_clicks: z.coerce.number().int().nonnegative().optional(),
  signups: z.coerce.number().int().nonnegative().optional(),
});

export type MetricCsvRow = z.infer<typeof MetricCsvRowSchema>;

export function parseMetricsCsv(text: string): MetricCsvRow[] {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0]!.split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const rows: MetricCsvRow[] = [];

  for (const line of lines.slice(1)) {
    const values = line.split(",").map((v) => v.trim());
    const record: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (values[i]) record[h] = values[i]!;
    });
    const parsed = MetricCsvRowSchema.safeParse(record);
    if (parsed.success) rows.push(parsed.data);
  }

  return rows;
}
