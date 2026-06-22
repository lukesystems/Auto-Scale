import "server-only";

import { createHash } from "node:crypto";
import { generateObject } from "@/services/ai/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const CaptionVariantSchema = z.object({
  caption: z.string().min(3),
  hashtags: z.array(z.string()).default([]),
  cta: z.string().optional().default(""),
});
const CaptionsBatchSchema = z.object({
  variants: z.array(CaptionVariantSchema).min(1),
});

/**
 * Per-account caption variants for a video. Required so the same video
 * never goes out to 20 accounts with identical caption/hook (the direction
 * called this out explicitly — "may damage accounts").
 */
export async function generateCaptionsForVideo(opts: {
  videoId: string;
  conceptId: string;
  projectId: string;
  accounts: Array<{ id: string; platform: "tiktok" | "instagram" | "youtube"; handle: string; persona: string | null }>;
}): Promise<{ captionIds: string[] }> {
  if (!opts.accounts.length) return { captionIds: [] };
  const supabase = createSupabaseServerClient();

  const { data: concept, error } = await supabase
    .from("video_concepts")
    .select("hook, angle, promise, cta, video_type")
    .eq("id", opts.conceptId)
    .single();
  if (error || !concept) throw new Error(`concept load: ${error?.message}`);

  const prompt = [
    "You are AutoScale's Caption Agent.",
    `Generate ${opts.accounts.length} platform-aware caption variants — one per account.`,
    "Each variant must feel native to its platform and account persona.",
    "Vary the opening line so accounts do not look duplicated.",
    "",
    "Concept:",
    JSON.stringify(concept),
    "",
    "Accounts:",
    JSON.stringify(opts.accounts.map((a) => ({
      platform: a.platform,
      handle: a.handle,
      persona: a.persona ?? "default",
    }))),
    "",
    "Return JSON { variants: [{ caption, hashtags[], cta }] } in the same order as accounts[].",
    "Hashtags: 4-10, platform-appropriate. TikTok: tight & trending. IG: mid. YT Shorts: searchable.",
    "Captions stay under 2200 chars. No emojis in the first line.",
  ].join("\n");

  const res = await generateObject({
    schema: CaptionsBatchSchema,
    schemaDescription: "{ variants: [{caption, hashtags[], cta}] } in same order as the accounts list.",
    taskType: "content",
    system: "You write per-account captions. You vary tone, hook, and hashtags to avoid duplicate-detection.",
    prompt,
    temperature: 0.8,
    maxTokens: 1800,
  });

  const variants = res.object.variants.slice(0, opts.accounts.length);
  while (variants.length < opts.accounts.length) {
    // Pad with last variant if the model returned fewer than requested.
    variants.push(variants[variants.length - 1]);
  }

  const rows = opts.accounts.map((a, i) => {
    const v = variants[i];
    const seed = createHash("sha1").update(v.caption).digest("hex").slice(0, 16);
    return {
      video_id: opts.videoId,
      project_id: opts.projectId,
      connected_account_id: a.id,
      platform: a.platform,
      caption: v.caption,
      hashtags: v.hashtags as never,
      cta: v.cta || null,
      variation_seed: seed,
      variation_score: computeVariationScore(variants.map((x) => x.caption), i),
    };
  });

  const { data, error: cErr } = await supabase
    .from("video_captions")
    .insert(rows)
    .select("id");
  if (cErr) throw new Error(`video_captions insert: ${cErr.message}`);
  return { captionIds: (data ?? []).map((r) => r.id) };
}

function computeVariationScore(captions: string[], idx: number): number {
  if (captions.length <= 1) return 1;
  const target = captions[idx].toLowerCase();
  const otherTokens = new Set<string>();
  captions.forEach((c, i) => {
    if (i === idx) return;
    c.toLowerCase().split(/\s+/).forEach((t) => otherTokens.add(t));
  });
  const myTokens = target.split(/\s+/);
  if (!myTokens.length) return 0;
  const unique = myTokens.filter((t) => !otherTokens.has(t)).length;
  return Math.min(1, unique / myTokens.length);
}
