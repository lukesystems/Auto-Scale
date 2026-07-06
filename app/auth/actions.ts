"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { safeRelativeRedirect } from "@/lib/safe-redirect";

export type AuthResult = { ok: true; redirectTo: string } | { ok: false; error: string };

function postSignUpRedirect(productUrl: string): string {
  const trimmed = productUrl.trim();
  if (!trimmed) return "/projects?new=1";
  return `/projects?new=1&url=${encodeURIComponent(trimmed)}`;
}

function absoluteAuthCallback(next: string): string {
  const requestHeaders = headers();
  const origin =
    requestHeaders.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const callback = new URL("/auth/callback", origin);
  callback.searchParams.set("next", next);
  return callback.toString();
}

export async function signInAction(formData: FormData): Promise<AuthResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase is not configured. Add SUPABASE env vars and restart." };
  }
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeRelativeRedirect(String(formData.get("next") ?? "/projects"));

  if (!email || !password) return { ok: false, error: "Email and password are required." };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true, redirectTo: next };
}

export async function signUpAction(formData: FormData): Promise<AuthResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase is not configured. Add SUPABASE env vars and restart." };
  }
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();
  const productUrl = String(formData.get("product_url") ?? "").trim();

  if (!email || !password) return { ok: false, error: "Email and password are required." };
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };

  const supabase = createSupabaseServerClient();
  const redirectTo = postSignUpRedirect(productUrl);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName || null },
      emailRedirectTo: absoluteAuthCallback(redirectTo),
    },
  });
  if (error) return { ok: false, error: error.message };

  // If email confirmation is disabled, the session is set immediately.
  if (data.session) {
    revalidatePath("/", "layout");
    return { ok: true, redirectTo };
  }

  return { ok: true, redirectTo: `/auth/check-email?next=${encodeURIComponent(redirectTo)}` };
}

export async function signOutAction(): Promise<never> {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
