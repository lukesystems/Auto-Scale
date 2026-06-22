import "server-only";

import { SUPABASE_URL } from "@/lib/supabase/env";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const BUCKET = "growth-media";

export function buildGrowthMediaPublicUrl(storagePath: string): string {
  const base = SUPABASE_URL.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

export async function uploadGrowthMedia(opts: {
  projectId: string;
  growthRunId: string;
  conceptId: string;
  filename: string;
  body: Buffer;
  contentType: string;
}): Promise<{ storagePath: string; publicUrl: string }> {
  const storagePath = `${opts.projectId}/${opts.growthRunId}/${opts.conceptId}/${opts.filename}`;
  const admin = createSupabaseAdminClient();
  const { error } = await admin.storage.from(BUCKET).upload(storagePath, opts.body, {
    contentType: opts.contentType,
    upsert: true,
  });
  if (error) throw new Error(`growth-media upload failed: ${error.message}`);
  return { storagePath, publicUrl: buildGrowthMediaPublicUrl(storagePath) };
}
