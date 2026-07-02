"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { ApprovalPolicy } from "@/lib/approval-policy";

const PolicySchema = z.enum(["auto_approve_all", "ask_at_critical", "ask_at_every_stage"]);

export async function updateApprovalPolicyAction(
  policy: ApprovalPolicy
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };

  const parsed = PolicySchema.safeParse(policy);
  if (!parsed.success) return { ok: false, error: "Invalid policy." };

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("user_settings")
    .upsert(
      {
        owner_id: user.id,
        approval_policy: parsed.data,
      },
      { onConflict: "owner_id" }
    );

  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  return { ok: true };
}
