import "server-only";

import { generateObject } from "@/services/ai/runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { VideoScriptSchema, type VideoScript } from "@/services/growth-run/schema";

type StoredScriptRow = {
  id: string;
  hook_line: string;
  body_lines: unknown;
  cta_line: string | null;
  voiceover_full: string | null;
  on_screen_text: unknown;
  estimated_duration_seconds: number | null;
};

export function videoScriptFromStoredRow(row: StoredScriptRow): VideoScript {
  return VideoScriptSchema.parse({
    hook_line: row.hook_line,
    body_lines: Array.isArray(row.body_lines)
      ? row.body_lines.filter((line): line is string => typeof line === "string")
      : [],
    cta_line: row.cta_line ?? "",
    voiceover_full: row.voiceover_full ?? "",
    on_screen_text: Array.isArray(row.on_screen_text)
      ? row.on_screen_text.filter((line): line is string => typeof line === "string")
      : [],
    estimated_duration_seconds: row.estimated_duration_seconds ?? 30,
  });
}

/**
 * Generate a per-concept script. Storyboard is built from this script in
 * a second step (see storyboard.ts).
 */
export async function generateScriptForConcept(opts: {
  conceptId: string;
  projectId: string;
}): Promise<{ script: VideoScript; scriptId: string }> {
  const supabase = createSupabaseServerClient();

  const { data: existingScript, error: existingErr } = await supabase
    .from("video_scripts")
    .select(
      "id, hook_line, body_lines, cta_line, voiceover_full, on_screen_text, estimated_duration_seconds"
    )
    .eq("concept_id", opts.conceptId)
    .maybeSingle();
  if (existingErr) {
    throw new Error(`video_scripts load: ${existingErr.message}`);
  }
  if (existingScript) {
    return {
      script: videoScriptFromStoredRow(existingScript),
      scriptId: existingScript.id,
    };
  }

  const [conceptResult, receiptResult, cellResult] = await Promise.all([
    supabase.from("video_concepts").select("*").eq("id", opts.conceptId).single(),
    supabase.from("trend_receipts").select("*").eq("concept_id", opts.conceptId).maybeSingle(),
    supabase
      .from("experiment_cells")
      .select("experiment_id, variant_label, variable_value")
      .eq("concept_id", opts.conceptId)
      .maybeSingle(),
  ]);
  const { data: concept, error: cErr } = conceptResult;
  if (cErr || !concept) throw new Error(`concept load failed: ${cErr?.message}`);

  const { data: experiment } = cellResult.data?.experiment_id
    ? await supabase
        .from("controlled_experiments")
        .select("tested_variable, fixed_body, fixed_cta, fixed_audience, audience_pain")
        .eq("id", cellResult.data.experiment_id)
        .maybeSingle()
    : { data: null };

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
    "Controlled experiment contract:",
    JSON.stringify({
      tested_variable: experiment?.tested_variable ?? null,
      variant_label: cellResult.data?.variant_label ?? null,
      variable_value: cellResult.data?.variable_value ?? null,
      audience_pain: experiment?.audience_pain ?? null,
      fixed_body: experiment?.fixed_body ?? null,
      fixed_cta: experiment?.fixed_cta ?? null,
      fixed_audience: experiment?.fixed_audience ?? null,
    }),
    "Trend Receipt:",
    JSON.stringify(receiptResult.data ?? { confidence: 0, missing_evidence: ["No Trend Receipt stored."] }),
    "If a controlled experiment exists, preserve every fixed field exactly and change only the tested variable.",
    "Do not turn strategic inference into an observed fact.",
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
