import "server-only";

import { generateObject } from "@/services/ai/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { VideoScriptSchema, type VideoScript } from "@/services/growth-run/schema";

/**
 * Generate a per-concept script. Storyboard is built from this script in
 * a second step (see storyboard.ts).
 */
export async function generateScriptForConcept(opts: {
  conceptId: string;
  projectId: string;
}): Promise<{ script: VideoScript; scriptId: string }> {
  const supabase = createSupabaseServerClient();
  const { data: concept, error: cErr } = await supabase
    .from("video_concepts")
    .select("*")
    .eq("id", opts.conceptId)
    .single();
  if (cErr || !concept) throw new Error(`concept load failed: ${cErr?.message}`);

  const prompt = [
    "You are AutoScale's Script Agent.",
    "Write a tight short-form video script.",
    "",
    "Concept:",
    JSON.stringify({
      video_type: concept.video_type,
      platform: concept.platform,
      target_length_seconds: concept.target_length_seconds,
      hook: concept.hook,
      angle: concept.angle,
      promise: concept.promise,
      cta: concept.cta,
      hypothesis: concept.hypothesis,
    }),
    "",
    "Return JSON matching VideoScript:",
    "- hook_line: spoken in first 2 seconds, mirrors the concept hook",
    "- body_lines: 3-7 short lines",
    "- cta_line: single sentence",
    "- voiceover_full: the script as one continuous voiceover string",
    "- on_screen_text: 3-7 short on-screen overlay phrases",
    "- estimated_duration_seconds: integer near target_length_seconds",
    "",
    "Tone: founder-grade. No hype. No emojis in voiceover. Concrete.",
  ].join("\n");

  const res = await generateObject({
    schema: VideoScriptSchema,
    schemaDescription:
      "VideoScript with hook_line, body_lines[], cta_line, voiceover_full, on_screen_text[], estimated_duration_seconds.",
    taskType: "content",
    system: "Founder-grade short-form video script writer. No filler.",
    prompt,
    temperature: 0.6,
  });

  const { data: row, error } = await supabase
    .from("video_scripts")
    .insert({
      concept_id: opts.conceptId,
      project_id: opts.projectId,
      hook_line: res.object.hook_line,
      body_lines: res.object.body_lines as never,
      cta_line: res.object.cta_line,
      voiceover_full: res.object.voiceover_full,
      on_screen_text: res.object.on_screen_text as never,
      total_words: res.object.voiceover_full.split(/\s+/).filter(Boolean).length,
      estimated_duration_seconds: res.object.estimated_duration_seconds,
    })
    .select("id")
    .single();
  if (error) throw new Error(`video_scripts insert: ${error.message}`);

  await supabase
    .from("video_concepts")
    .update({ status: "scripted" })
    .eq("id", opts.conceptId);

  return { script: res.object, scriptId: row!.id };
}
