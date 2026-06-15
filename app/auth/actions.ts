"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type AuthResult = { ok: true; redirectTo: string } | { ok: false; error: string };

export async function signInAction(formData: FormData): Promise<AuthResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase is not configured. Add SUPABASE env vars and restart." };
  }
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/projects");

  if (!email || !password) return { ok: false, error: "Email and password are required." };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true, redirectTo: next || "/projects" };
}

export async function signUpAction(formData: FormData): Promise<AuthResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase is not configured. Add SUPABASE env vars and restart." };
  }
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();

  if (!email || !password) return { ok: false, error: "Email and password are required." };
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName || null },
    },
  });
  if (error) return { ok: false, error: error.message };

  // If email confirmation is disabled, the session is set immediately.
  if (data.session) {
    revalidatePath("/", "layout");
    return { ok: true, redirectTo: "/projects" };
  }

  return { ok: true, redirectTo: "/auth/check-email" };
}

export async function signOutAction(): Promise<never> {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
