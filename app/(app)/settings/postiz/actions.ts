"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const Schema = z.object({
  api_url: z.string().url().optional().or(z.literal("")),
  api_key: z.string().optional(),
});

export type Result = { ok: true } | { ok: false; error: string };

export async function savePostizConnectionAction(formData: FormData): Promise<Result> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };
  const parsed = Schema.safeParse({
    api_url: formData.get("api_url") ?? undefined,
    api_key: formData.get("api_key") ?? undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };

  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const apiKey = parsed.data.api_key && parsed.data.api_key !== "**********" ? parsed.data.api_key : undefined;

  const { error } = await supabase
    .from("postiz_connections")
    .upsert(
      {
        owner_id: user.id,
        api_url: parsed.data.api_url || null,
        api_key: apiKey ?? null,
        status: parsed.data.api_url && apiKey ? "connected" : "disconnected",
      },
      { onConflict: "owner_id" }
    );

  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/postiz");
  return { ok: true };
}

export async function disconnectPostizAction(): Promise<Result> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { error } = await supabase.from("postiz_connections").delete().eq("owner_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/postiz");
  return { ok: true };
}
