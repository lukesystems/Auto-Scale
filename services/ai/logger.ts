import { createHash } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface AIRunLogInput {
  ownerId: string;
  projectId?: string | null;
  kind: string;
  provider: string;
  model: string;
  promptVersion?: string;
  input: unknown;
  rawOutput?: string;
  parsedOutput?: unknown;
  status: "pending" | "running" | "success" | "failed" | "validation_failed";
  validationError?: string | null;
  retryCount?: number;
  latencyMs?: number | null;
  costEstimate?: number | null;
  errorMessage?: string | null;
}

export async function logAIRun(input: AIRunLogInput): Promise<string | null> {
  try {
    const supabase = createSupabaseServerClient();
    const inputHash = hashInput(input.input);
    const { data, error } = await supabase
      .from("ai_runs")
      .insert({
        owner_id: input.ownerId,
        project_id: input.projectId ?? null,
        kind: input.kind,
        provider: input.provider,
        model: input.model,
        prompt_version: input.promptVersion ?? null,
        input: input.input as never,
        input_hash: inputHash,
        raw_output: input.rawOutput ?? null,
        parsed_output: (input.parsedOutput ?? {}) as never,
        status: input.status,
        validation_error: input.validationError ?? null,
        retry_count: input.retryCount ?? 0,
        latency_ms: input.latencyMs ?? null,
        cost_estimate: input.costEstimate ?? null,
        error_message: input.errorMessage ?? null,
      })
      .select("id")
      .single();
    if (error) {
      console.warn("[ai_runs] log failed", error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (e) {
    console.warn("[ai_runs] log threw", e);
    return null;
  }
}

function hashInput(input: unknown): string {
  try {
    return createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 32);
  } catch {
    return "";
  }
}
