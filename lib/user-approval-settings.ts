import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { ApprovalPolicy } from "@/lib/approval-policy";

export async function getUserApprovalPolicy(userId: string): Promise<ApprovalPolicy> {
  if (!isSupabaseConfigured()) return "ask_at_critical";

  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("user_settings")
    .select("approval_policy")
    .eq("owner_id", userId)
    .maybeSingle();

  const policy = data?.approval_policy;
  if (
    policy === "auto_approve_all" ||
    policy === "ask_at_critical" ||
    policy === "ask_at_every_stage"
  ) {
    return policy;
  }
  return "ask_at_critical";
}
