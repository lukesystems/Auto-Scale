import "server-only";

import { generateObject } from "@/services/ai/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  StoryboardSchema,
  type Storyboard,
  type VideoScript,
} from "@/services/growth-run/schema";

/**
 * Build a storyboard from a script. Storyboard is mandatory before video
 * generation per the direction: "do not just prompt Seedance randomly."
 * Each scene declares an asset_method so the factory knows whether to
 * render a slide, call fal/Seedance, or expect a screen-demo upload.
 */
export async function generateStoryboardForConcept(opts: {
  conceptId: string;
  projectId: string;
  script: VideoScript;
  videoType: string;
  platform: "tiktok" | "instagram" | "youtube";
  targetLengthSeconds: number;
  preferFalForBroll: boolean; // when concept is ai_broll or trend_remix, allow fal_clip
}): Promise<{ storyboard: Storyboard; storyboardId: string }> {
  const supabase = createSupabaseServerClient();
  const aspect = "9:16";

  const prompt = [
    "You are AutoScale's Storyboard Agent.",
    `Concept type: ${opts.videoType}, target length: ${opts.targetLengthSeconds}s, platform: ${opts.platform}, aspect: ${aspect}.`,
    "",
    "Script:",
    JSON.stringify(opts.script),
    "",
    "Produce a Storyboard JSON: scenes[] with role (hook|context|demo|proof|cta|outro|transition),",
    "duration_seconds, visual_intent, on_screen_text, voiceover_line, asset_method, asset_prompt.",
    "",
    "Rules for asset_method:",
    "- For 'slide' / 'pain_led' / 'founder_pov' / 'objection' / 'comparison' / 'demo' videos:",
    "    use 'slide' for text-on-color scenes and 'screen_demo' for product UI moments.",
    opts.preferFalForBroll
      ? "- For 'ai_broll' / 'trend_remix' videos: prefer 'fal_clip' for visual scenes."
      : "- Avoid 'fal_clip' unless the scene specifically requires cinematic AI footage.",
    "- Sum of scene durations must approximately equal target length.",
    "- Open with a 'hook' scene of 1.5-3s with the hook_line as voiceover.",
    "- Close with a 'cta' scene.",
    "",
    "Return strict JSON. Do not invent metrics.",
  ].join("\n");

  const res = await generateObject({
    schema: StoryboardSchema,
    schemaDescription:
      "Storyboard: aspect_ratio, total_duration_seconds, scenes[] (scene_index, role, duration_seconds, visual_intent, on_screen_text, voiceover_line, asset_method, asset_prompt), notes.",
    taskType: "content",
    system: "You build short-form video storyboards. Mandatory before generation.",
    prompt,
    temperature: 0.5,
    maxTokens: 2500,
  });

  const board = res.object;
  const { data: sbRow, error: sbErr } = await supabase
    .from("storyboards")
    .insert({
      concept_id: opts.conceptId,
      project_id: opts.projectId,
      aspect_ratio: board.aspect_ratio,
      total_duration_seconds: Math.round(board.total_duration_seconds),
      notes: board.notes ?? null,
    })
    .select("id")
    .single();
  if (sbErr) throw new Error(`storyboards insert: ${sbErr.message}`);

  const sceneRows = board.scenes.map((s, idx) => ({
    storyboard_id: sbRow!.id,
    scene_index: idx,
    role: s.role,
    duration_seconds: s.duration_seconds,
    visual_intent: s.visual_intent,
    on_screen_text: s.on_screen_text || null,
    voiceover_line: s.voiceover_line || null,
    asset_method: s.asset_method,
    asset_prompt: s.asset_prompt || null,
  }));
  const { error: scErr } = await supabase.from("storyboard_scenes").insert(sceneRows);
  if (scErr) throw new Error(`storyboard_scenes insert: ${scErr.message}`);

  return { storyboard: board, storyboardId: sbRow!.id };
}
