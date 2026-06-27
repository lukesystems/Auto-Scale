"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function skipOnboardingAction(): Promise<void> {
  if (!isSupabaseConfigured()) {
    redirect("/projects");
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  await supabase.from("user_settings").upsert(
    {
      owner_id: user.id,
      onboarding_completed: true,
    },
    { onConflict: "owner_id" }
  );

  revalidatePath("/onboarding");
  redirect("/projects");
}
