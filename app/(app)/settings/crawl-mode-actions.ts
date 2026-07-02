"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const CrawlModeSchema = z.enum(["llm", "heuristic"]);

export async function updateCrawlModeAction(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const mode = CrawlModeSchema.safeParse(formData.get("crawlMode"));
  if (!mode.success) return;

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("user_settings").upsert(
    { owner_id: user.id, crawl_mode: mode.data },
    { onConflict: "owner_id" }
  );

  revalidatePath("/settings");
  revalidatePath("/projects");
}
