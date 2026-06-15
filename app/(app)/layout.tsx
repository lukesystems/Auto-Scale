import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // If Supabase isn't configured, show the shell with a banner instead of redirecting.
  // The middleware already handled actual session enforcement for configured deployments.
  if (!isSupabaseConfigured()) {
    return (
      <AppShellFallback>
        {children}
      </AppShellFallback>
    );
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <AppShell user={user} displayName={profile?.display_name}>
      {children}
    </AppShell>
  );
}

function AppShellFallback({ children }: { children: React.ReactNode }) {
  // Minimal fallback that renders WITHOUT a real session so the dev can still
  // browse the UI before wiring Supabase.
  const fakeUser = {
    id: "preview-user",
    email: "preview@autoscale.app",
    aud: "authenticated",
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  } as never;
  return (
    <AppShell user={fakeUser} displayName="Preview" configured={false}>
      {children}
    </AppShell>
  );
}
