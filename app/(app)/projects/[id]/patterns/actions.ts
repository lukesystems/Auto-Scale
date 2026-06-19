"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { runPatternMining } from "@/services/intelligence/patterns/run-pattern-mining";
import { logAIRun } from "@/services/ai/logger";

export type PatternActionResult =
  | { ok: true; patternCount?: number; sourceCount?: number }
  | { ok: false; error: string };

export async function runPatternMiningAction(projectId: string): Promise<PatternActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };

  const parsed = z.string().uuid().safeParse(projectId);
  if (!parsed.success) return { ok: false, error: "Invalid project." };

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  try {
    const result = await runPatternMining({ projectId: parsed.data });

    await logAIRun({
      ownerId: user.id,
      projectId: parsed.data,
      kind: "pattern_mining",
      provider: result.usedAi ? "openrouter" : "deterministic",
      model: result.usedAi ? "trendwatch-routed" : "fallback",
      input: { sourceCount: result.sourceCount },
      rawOutput: JSON.stringify({ patternCount: result.patternCount, usedAi: result.usedAi }),
      parsedOutput: result as never,
      status: result.ok ? "success" : "failed",
      errorMessage: result.error,
    });

    revalidatePath(`/projects/${parsed.data}/patterns`);

    if (!result.ok) return { ok: false, error: result.error ?? "Pattern mining failed." };
    return {
      ok: true,
      patternCount: result.patternCount,
      sourceCount: result.sourceCount,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Pattern mining failed." };
  }
}
