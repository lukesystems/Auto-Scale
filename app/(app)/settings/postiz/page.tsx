import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getProviderModeForUser, isManagedMode } from "@/lib/provider-mode";
import { getClientSafeProviderStatus } from "@/services/providers/status";
import { PostizForm } from "./postiz-form";
import { redirect } from "next/navigation";

export const metadata = { title: "Postiz" };

export default async function PostizSettingsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="container py-10 max-w-2xl">
        <PageHeader title="Postiz connection" description="Configure Supabase first." />
      </div>
    );
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const mode = await getProviderModeForUser(user.id);
  const status = getClientSafeProviderStatus(mode);
  const connection = await loadConnection(user.id);
  const connected = isManagedMode(mode)
    ? status.postiz.configured
    : Boolean(connection?.api_url && connection?.api_key);

  return (
    <div className="container py-10 max-w-2xl space-y-8">
      <PageHeader
        title="Postiz connection"
        description={
          isManagedMode(mode)
            ? "Managed Mode uses AutoScale's Postiz integration. You do not need to enter an API key."
            : "Connect Postiz to push approved posts directly to your scheduler. AutoScale falls back to manual exports if Postiz is offline."
        }
        badge={
          <Badge variant={connected ? "success" : "secondary"}>
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-success animate-pulse-soft" : "bg-muted-foreground"}`} />
            {connected ? (isManagedMode(mode) ? "Managed by AutoScale" : "Connected") : "Not connected"}
          </Badge>
        }
      />

      {isManagedMode(mode) ? (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h3 className="font-semibold">Managed by AutoScale</h3>
          <p className="text-sm text-muted-foreground">
            Postiz scheduling runs through AutoScale-managed server credentials. No API key is stored in your account or
            shown in the browser.
          </p>
          <div className="text-sm space-y-1">
            <p>
              Status:{" "}
              <span className={status.postiz.configured ? "text-foreground" : "text-muted-foreground"}>
                {status.postiz.configured ? "Configured on server" : "Not configured on server"}
              </span>
            </p>
            {!status.postiz.configured && (
              <p className="text-muted-foreground text-xs">
                Set POSTIZ_API_URL and POSTIZ_API_KEY in server environment. Until then, schedules queue locally.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-6">
          <PostizForm
            initial={{
              api_url: connection?.api_url ?? "",
              has_key: Boolean(connection?.api_key),
            }}
          />
        </div>
      )}

      <div className="rounded-xl border border-border bg-secondary/30 p-5 text-sm text-muted-foreground">
        <h4 className="font-semibold text-foreground">Heads up</h4>
        {isManagedMode(mode) ? (
          <p className="mt-2">
            Switch to Advanced Mode in onboarding or provider settings (future) to bring your own Postiz credentials.
          </p>
        ) : (
          <p className="mt-2">
            Your Postiz API key is stored in Supabase under your user row, protected by RLS. Don&apos;t share screenshots
            that include it.
          </p>
        )}
        <p className="mt-2">
          For best results, configure channels in your Postiz workspace first, then enter the channel ID/name when
          scheduling from /schedule.
        </p>
      </div>
    </div>
  );
}

async function loadConnection(userId: string) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("postiz_connections")
    .select("api_url, api_key")
    .eq("owner_id", userId)
    .maybeSingle();
  return data;
}
